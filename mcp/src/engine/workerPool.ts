// ============================================================================
// did-mcp — R Worker Pool
// ============================================================================
// 1 active + 1 standby worker. Recycle on call count / uptime. Promote standby
// on crash. Persist serializable handles via saveRDS across recycle.

import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RpcResponse, WorkerPoolConfig } from "../types.js";
import { DEFAULT_POOL_CONFIG } from "../types.js";
import { RWorker } from "./RWorker.js";
import {
  type SessionStore,
  getSerializableHandleIds,
  markHandlesLost,
  updateHandlesWorkerId,
} from "./session.js";

function generateWorkerId(): string {
  return "w_" + randomBytes(4).toString("hex");
}

type ManagedWorker = {
  id: string;
  worker: RWorker;
  callCount: number;
  startedAt: number;
};

export class WorkerPool {
  private active: ManagedWorker | null = null;
  private standby: ManagedWorker | null = null;
  private config: WorkerPoolConfig;
  private sessionStore: SessionStore;
  private sessionDir: string;
  private recyclePromise: Promise<void> | null = null;

  constructor(sessionStore: SessionStore, config?: Partial<WorkerPoolConfig>) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.sessionStore = sessionStore;

    this.sessionDir = join(
      tmpdir(),
      "did-mcp",
      sessionStore.getState().sessionId,
    );
    mkdirSync(this.sessionDir, { recursive: true });
  }

  async start(): Promise<void> {
    this.active = await this.spawnWorker();
    this.standby = await this.spawnWorker();
  }

  async call(
    method: string,
    params: Record<string, unknown>,
  ): Promise<RpcResponse> {
    // If a recycle is in flight, wait for it to finish so we dispatch to the
    // freshly-promoted worker, not the one that's about to be stopped. A call
    // that arrived mid-recycle would otherwise see this.active still pointing
    // at the old worker (until line ~173 of recycle()) and receive a "Worker
    // stopped" rejection when stop() fires.
    if (this.recyclePromise) {
      await this.recyclePromise;
    }

    if (!this.active) {
      throw new Error("Worker pool not started");
    }

    if (this.shouldRecycle(this.active)) {
      await this.recycle();
    }

    if (!this.active) {
      throw new Error("No active worker available after recycle");
    }

    // Snapshot active-worker references BEFORE the await. A concurrent
    // handleCrash() could null this.active mid-flight; reading
    // this.active.worker in the error handler would then throw TypeError
    // instead of routing through handleCrash() cleanly.
    const activeAtDispatch = this.active;
    const workerAtDispatch = activeAtDispatch.worker;
    activeAtDispatch.callCount++;

    try {
      return await workerAtDispatch.call(method, params);
    } catch (error) {
      if (!workerAtDispatch.isRunning) {
        await this.handleCrash();
      }
      throw error;
    }
  }

  get activeWorkerId(): string | null {
    return this.active?.id ?? null;
  }

  get sessionDirPath(): string {
    return this.sessionDir;
  }

  async stop(): Promise<void> {
    const stops: Promise<void>[] = [];
    if (this.active) {
      stops.push(this.active.worker.stop());
      this.active = null;
    }
    if (this.standby) {
      stops.push(this.standby.worker.stop());
      this.standby = null;
    }
    await Promise.all(stops);
  }

  getStatus(): {
    activeWorkerId: string | null;
    activeCallCount: number;
    standbyReady: boolean;
  } {
    return {
      activeWorkerId: this.active?.id ?? null,
      activeCallCount: this.active?.callCount ?? 0,
      standbyReady: this.standby?.worker.isRunning ?? false,
    };
  }

  /**
   * Drop handles from the TS session store AND delete their .rds snapshots
   * from disk so a future restore cannot resurrect orphan R objects.
   * Without the file cleanup, dispatch_restore unconditionally readRDS-es
   * every .rds it sees, which would reload objects the TS side no longer
   * knows about — an unrecoverable leak across crash/recycle cycles.
   */
  private loseHandles(ids: string[]): void {
    if (ids.length === 0) return;
    for (const id of ids) {
      const path = join(this.sessionDir, `${id}.rds`);
      try {
        rmSync(path, { force: true });
      } catch {
        // best-effort; the TS-side removal still happens below
      }
    }
    markHandlesLost(this.sessionStore, ids);
  }

  private async spawnWorker(): Promise<ManagedWorker> {
    const id = generateWorkerId();
    const worker = new RWorker({
      rPath: this.config.rPath,
      timeoutMs: this.config.callTimeoutMs,
      onCrash: (err) => {
        console.error(`[WorkerPool] Worker ${id} crashed:`, err.message);
      },
      onStall: (lastOutput) => {
        // Surfaced when STALL_PATTERNS matches stderr (interactive y/n prompt,
        // browser()/debug, etc.). Without this hook an interactive stall sits
        // silently until the per-call timeout; the log at least tells the
        // operator which worker is stuck and what R is asking.
        const snippet = lastOutput.slice(-200).replace(/\s+/g, " ");
        console.error(
          `[WorkerPool] Worker ${id} appears stalled (likely interactive prompt): ${snippet}`,
        );
      },
    });

    await worker.start();

    return {
      id,
      worker,
      callCount: 0,
      startedAt: Date.now(),
    };
  }

  private shouldRecycle(w: ManagedWorker): boolean {
    if (this.recyclePromise) return false;
    if (w.callCount >= this.config.recycleAfterCalls) return true;
    const uptimeMinutes = (Date.now() - w.startedAt) / 60_000;
    if (uptimeMinutes >= this.config.recycleAfterMinutes) return true;
    return false;
  }

  private async recycle(): Promise<void> {
    if (this.recyclePromise) return this.recyclePromise;
    if (!this.active) return;
    this.recyclePromise = this.doRecycle();
    try {
      await this.recyclePromise;
    } finally {
      this.recyclePromise = null;
    }
  }

  private async doRecycle(): Promise<void> {
    if (!this.active) return;

    try {
      // 1. Persist serializable handles
      const serializableIds = getSerializableHandleIds(this.sessionStore);
      if (serializableIds.length > 0) {
        try {
          const resp = await this.active.worker.call("persist", {
            handles: serializableIds,
            session_dir: this.sessionDir,
          });
          if (resp.persistFailed && resp.persistFailed.length > 0) {
            this.loseHandles([...resp.persistFailed]);
          }
        } catch {
          this.loseHandles(serializableIds);
        }
      }

      // 2. Stop active worker
      await this.active.worker.stop();

      // 3. Promote standby
      if (this.standby) {
        this.active = this.standby;
        this.standby = null;

        // 4. Restore handles. Reconcile what was ACTUALLY restored against
        // what we persisted — dispatch_restore can partially succeed when
        // individual .rds files are unreadable. Without this diff, the TS
        // store keeps the failed handles and re-tags them to the new worker,
        // producing zombies (TS references an R object that doesn't exist).
        if (serializableIds.length > 0) {
          try {
            const resp = await this.active.worker.call("restore", {
              session_dir: this.sessionDir,
            });
            const restoredIds = new Set(
              (resp.result as { restored?: string[] } | undefined)?.restored ??
                [],
            );
            const missing = serializableIds.filter(
              (id) => !restoredIds.has(id),
            );
            if (missing.length > 0) this.loseHandles(missing);
          } catch {
            this.loseHandles(serializableIds);
          }
        }

        updateHandlesWorkerId(this.sessionStore, this.active.id);
      } else {
        this.active = await this.spawnWorker();
      }

      // 5. Spawn new standby
      this.standby = await this.spawnWorker();

      // 6. Mark ephemeral handles lost (and remove their .rds files if any).
      const allHandles = this.sessionStore.getState().handles;
      const ephemeralIds = [...allHandles.values()]
        .filter((h) => h.persistenceClass === "ephemeral")
        .map((h) => h.id);
      if (ephemeralIds.length > 0) {
        this.loseHandles(ephemeralIds);
      }
    } catch (e) {
      // Re-raise so the awaiting recycle() sees the failure.
      throw e;
    }
  }

  private async handleCrash(): Promise<void> {
    this.active = null;

    // Snapshot the serializable handle set before mutating anything. Any
    // serializable handle NOT restored by the promoted worker is a zombie:
    // it was created after the last persist snapshot and has no .rds to
    // restore from. Mark those lost alongside the ephemerals.
    const serializableBeforeRecovery = new Set(
      getSerializableHandleIds(this.sessionStore),
    );

    if (this.standby) {
      this.active = this.standby;
      this.standby = null;

      let restoredIds = new Set<string>();
      try {
        const resp = await this.active.worker.call("restore", {
          session_dir: this.sessionDir,
        });
        const restored =
          (resp.result as { restored?: string[] } | undefined)?.restored ?? [];
        restoredIds = new Set(restored);
      } catch {
        // restore failed — no ids restored
      }

      updateHandlesWorkerId(this.sessionStore, this.active.id);

      const allHandles = this.sessionStore.getState().handles;
      const zombieSerializable = [...serializableBeforeRecovery].filter(
        (id) => !restoredIds.has(id),
      );
      const ephemeralIds = [...allHandles.values()]
        .filter((h) => h.persistenceClass === "ephemeral")
        .map((h) => h.id);
      const lost = Array.from(new Set([...zombieSerializable, ...ephemeralIds]));
      if (lost.length > 0) this.loseHandles(lost);

      try {
        this.standby = await this.spawnWorker();
      } catch {
        // continue with just active
      }
    } else {
      try {
        this.active = await this.spawnWorker();
        // No standby means no restore happened; every serializable handle
        // above is gone. Plus all ephemerals.
        const allHandles = this.sessionStore.getState().handles;
        const ephemeralIds = [...allHandles.values()]
          .filter((h) => h.persistenceClass === "ephemeral")
          .map((h) => h.id);
        const lost = Array.from(
          new Set([...serializableBeforeRecovery, ...ephemeralIds]),
        );
        if (lost.length > 0) this.loseHandles(lost);
        updateHandlesWorkerId(this.sessionStore, this.active.id);
      } catch (e) {
        throw new Error(
          `Cannot recover: failed to spawn R worker: ${(e as Error).message}`,
        );
      }
    }
  }
}
