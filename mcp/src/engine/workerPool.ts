// ============================================================================
// did-mcp — R Worker Pool
// ============================================================================
// 1 active + 1 standby worker. Recycle on call count / uptime. Promote standby
// on crash. Persist serializable handles via saveRDS across recycle.

import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
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
  private recycling = false;

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
    if (!this.active) {
      throw new Error("Worker pool not started");
    }

    if (this.shouldRecycle(this.active)) {
      await this.recycle();
    }

    if (!this.active) {
      throw new Error("No active worker available after recycle");
    }

    this.active.callCount++;

    try {
      return await this.active.worker.call(method, params);
    } catch (error) {
      if (!this.active.worker.isRunning) {
        await this.handleCrash();
        throw error;
      }
      throw error;
    }
  }

  get activeWorkerId(): string | null {
    return this.active?.id ?? null;
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

  private async spawnWorker(): Promise<ManagedWorker> {
    const id = generateWorkerId();
    const worker = new RWorker({
      rPath: this.config.rPath,
      timeoutMs: this.config.callTimeoutMs,
      onCrash: (err) => {
        console.error(`[WorkerPool] Worker ${id} crashed:`, err.message);
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
    if (this.recycling) return false;
    if (w.callCount >= this.config.recycleAfterCalls) return true;
    const uptimeMinutes = (Date.now() - w.startedAt) / 60_000;
    if (uptimeMinutes >= this.config.recycleAfterMinutes) return true;
    return false;
  }

  private async recycle(): Promise<void> {
    if (this.recycling || !this.active) return;
    this.recycling = true;

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
            markHandlesLost(this.sessionStore, [...resp.persistFailed]);
          }
        } catch {
          markHandlesLost(this.sessionStore, serializableIds);
        }
      }

      // 2. Stop active worker
      await this.active.worker.stop();

      // 3. Promote standby
      if (this.standby) {
        this.active = this.standby;
        this.standby = null;

        // 4. Restore handles
        if (serializableIds.length > 0) {
          try {
            await this.active.worker.call("restore", {
              session_dir: this.sessionDir,
            });
          } catch {
            markHandlesLost(this.sessionStore, serializableIds);
          }
        }

        updateHandlesWorkerId(this.sessionStore, this.active.id);
      } else {
        this.active = await this.spawnWorker();
      }

      // 5. Spawn new standby
      this.standby = await this.spawnWorker();

      // 6. Mark ephemeral handles lost
      const allHandles = this.sessionStore.getState().handles;
      const ephemeralIds = [...allHandles.values()]
        .filter((h) => h.persistenceClass === "ephemeral")
        .map((h) => h.id);
      if (ephemeralIds.length > 0) {
        markHandlesLost(this.sessionStore, ephemeralIds);
      }
    } finally {
      this.recycling = false;
    }
  }

  private async handleCrash(): Promise<void> {
    this.active = null;

    if (this.standby) {
      this.active = this.standby;
      this.standby = null;

      try {
        await this.active.worker.call("restore", {
          session_dir: this.sessionDir,
        });
      } catch {
        // restore failed
      }

      updateHandlesWorkerId(this.sessionStore, this.active.id);

      const allHandles = this.sessionStore.getState().handles;
      const ephemeralIds = [...allHandles.values()]
        .filter((h) => h.persistenceClass === "ephemeral")
        .map((h) => h.id);
      markHandlesLost(this.sessionStore, ephemeralIds);

      try {
        this.standby = await this.spawnWorker();
      } catch {
        // continue with just active
      }
    } else {
      try {
        this.active = await this.spawnWorker();
      } catch (e) {
        throw new Error(
          `Cannot recover: failed to spawn R worker: ${(e as Error).message}`,
        );
      }
    }
  }
}
