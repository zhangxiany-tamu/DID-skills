// ============================================================================
// did-mcp — R Worker Subprocess Manager
// ============================================================================
// Spawns a single R bridge.R process. NDJSON over stdin/stdout.
// Handles timeout, crash, and interactive-prompt stall detection.

import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { RpcRequest, RpcResponse } from "../types.js";
import { NdjsonCodec, encodeNdjson } from "./protocol.js";

// Walk up from the compiled file until package.json is found, then locate r/.
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function findBridgeScript(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const root = findProjectRoot(thisDir);
  return resolve(root, "r", "bridge.R");
}

const BRIDGE_SCRIPT = findBridgeScript();

const STALL_PATTERNS = [
  /\(y\/n\)/i,
  /\[y\/n\]/i,
  /Continue\?/i,
  /Update all\/some\/none\?/i,
  /Selection:/i,
  /Enter an item from the menu/i,
];

type PendingRequest = {
  resolve: (response: RpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type RWorkerConfig = {
  rPath: string;
  timeoutMs: number;
  onCrash?: (error: Error) => void;
  onStall?: (lastOutput: string) => void;
};

const DEFAULT_CONFIG: RWorkerConfig = {
  rPath: "Rscript",
  timeoutMs: 60_000,
};

export class RWorker {
  private proc: ChildProcess | null = null;
  private codec: NdjsonCodec | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();
  private config: RWorkerConfig;
  private lastStdout = "";
  private stderrBuffer = "";
  private _started = false;
  private _intentionalStop = false;

  constructor(config?: Partial<RWorkerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isRunning(): boolean {
    return this.proc !== null && !this.proc.killed && this._started;
  }

  async start(): Promise<void> {
    if (this.proc) {
      throw new Error("Worker already started");
    }

    return new Promise<void>((resolveStart, rejectStart) => {
      const bridgeDir = resolve(BRIDGE_SCRIPT, "..");
      const proc = spawn(this.config.rPath, ["--vanilla", BRIDGE_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          R_DEFAULT_PACKAGES: "base,stats,utils,methods",
          DID_MCP_BRIDGE_DIR: bridgeDir,
        },
      });

      this.proc = proc;

      const codec = new NdjsonCodec(
        (response) => {
          const pending = this.pending.get(response.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(response.id);
            pending.resolve(response);
          }
        },
        (error) => {
          console.error("[RWorker] NDJSON parse error:", error.message);
        },
      );

      this.codec = codec;

      proc.stdout!.setEncoding("utf-8");
      proc.stdout!.on("data", (chunk: string) => {
        this.lastStdout = chunk;
        codec.feed(chunk);
      });

      proc.stderr!.setEncoding("utf-8");
      proc.stderr!.on("data", (chunk: string) => {
        this.stderrBuffer += chunk;
        for (const pattern of STALL_PATTERNS) {
          if (pattern.test(chunk)) {
            this.config.onStall?.(chunk);
          }
        }
      });

      proc.on("error", (err) => {
        if (!this._started) {
          rejectStart(new Error(`Failed to spawn R process: ${err.message}`));
        }
        this.handleCrash(err);
      });

      proc.on("exit", (code, signal) => {
        if (!this._started) {
          rejectStart(
            new Error(
              `R process exited during startup: code=${code}, signal=${signal}. stderr: ${this.stderrBuffer.slice(-500)}`,
            ),
          );
          return;
        }
        if (this._intentionalStop) return;
        this.handleCrash(
          new Error(
            `R process exited unexpectedly: code=${code}, signal=${signal}. stderr: ${this.stderrBuffer.slice(-500)}`,
          ),
        );
      });

      // Give R a moment to load jsonlite + source companion files.
      const startupTimer = setTimeout(() => {
        this._started = true;
        resolveStart();
      }, 500);

      proc.on("exit", () => clearTimeout(startupTimer));
    });
  }

  async call(
    method: string,
    params: Record<string, unknown>,
  ): Promise<RpcResponse> {
    if (!this.proc || !this.codec) {
      throw new Error("Worker not started");
    }

    const id = ++this.requestId;
    const request: RpcRequest = {
      id,
      method: method as RpcRequest["method"],
      params,
    };

    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `R call timed out after ${this.config.timeoutMs}ms: ${method}`,
          ),
        );
      }, this.config.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const encoded = encodeNdjson(request as unknown as Record<string, unknown>);
      this.proc!.stdin!.write(encoded);
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;

    this._intentionalStop = true;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Worker stopped"));
      this.pending.delete(id);
    }

    const proc = this.proc;
    this.proc = null;
    this.codec?.reset();
    this.codec = null;
    this._started = false;

    return new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        proc.kill("SIGKILL");
        resolve();
      }, 5000);

      proc.on("exit", () => {
        clearTimeout(killTimer);
        resolve();
      });

      proc.stdin?.end();
    });
  }

  private handleCrash(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`R worker crashed: ${error.message}`));
      this.pending.delete(id);
    }

    this.proc = null;
    this.codec?.reset();
    this.codec = null;
    this._started = false;

    this.config.onCrash?.(error);
  }
}
