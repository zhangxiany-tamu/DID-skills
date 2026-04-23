// ============================================================================
// did-mcp — Core Type Definitions
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes as cryptoRandomBytes } from "node:crypto";

// ----------------------------------------------------------------------------
// Object Handle System
// ----------------------------------------------------------------------------
// Handles are the data contract between tool calls. Each tool returns a typed
// handle; later tools accept that handle as input. The R object lives in the
// worker process; the handle is a stable string ID.

export type HandleType =
  // v1
  | "panel"           // loaded panel data (data.frame)
  | "design_profile"  // output of did_profile_design
  | "estimate"        // output of did_estimate (att_gt, feols, did_imputation, staggered)
  | "event_study"     // canonical { betahat, sigma, tVec } from did_extract_event_study
  | "plot"            // file-on-disk PNG/PDF/SVG
  // v2 (reserved; not yet implemented)
  | "twfe_diagnostic"
  | "power_result"
  | "honest_result"
  | "report";

export type PersistenceClass =
  | "serializable"    // saveRDS/readRDS survives worker recycle
  | "ephemeral"       // lost on recycle (external pointers, connections)
  | "reconstructable"; // future: restore via stored call

/** R classes known to survive saveRDS/readRDS cleanly for DID workflows. */
export const SERIALIZABLE_R_CLASSES: ReadonlySet<string> = new Set([
  "data.frame",
  "tbl_df",
  "data.table",
  "list",
  "numeric",
  "integer",
  "character",
  "logical",
  "factor",
  "matrix",
  "array",
  // DID-specific:
  "MP",              // did::att_gt() return
  "AGGTEobj",        // did::aggte() return
  "fixest",          // fixest::feols() return
  "fixest_multi",    // fixest multi-lhs/rhs return
  "did_imputation",  // didimputation return
  "staggered",       // staggered package return
  "drdid",           // DRDID return
  "honest_did",      // HonestDiD return
  "pretrends",       // pretrends return
]);

export function getPersistenceClass(rClass: string): PersistenceClass {
  if (SERIALIZABLE_R_CLASSES.has(rClass)) return "serializable";
  // "plot" handles point to a file on disk — treat as serializable (file survives)
  if (rClass === "plot_file") return "serializable";
  return "ephemeral";
}

export type RuntimeType = "r";

export type ObjectHandle = {
  readonly id: string;
  readonly type: HandleType;
  readonly runtime: RuntimeType;
  readonly rClass: string;
  readonly persistenceClass: PersistenceClass;
  readonly sessionId: string;
  readonly workerId: string;
  readonly createdBy: string;
  readonly createdAt: number;
  lastAccessedAt: number;
  readonly sizeBytes: number;
  readonly summary: string;
  readonly schema?: Readonly<Record<string, string>>;
};

// ----------------------------------------------------------------------------
// R Bridge Protocol (NDJSON over stdin/stdout)
// ----------------------------------------------------------------------------

export type RpcMethod =
  | "ping"
  | "persist"
  | "restore"
  | "list_objects"
  // reserved for v1 tools
  | "load_panel"
  | "check_panel"
  | "profile_design"
  | "plot_rollout"
  | "recode_never_treated"
  | "estimate"
  | "compare_estimators"
  | "extract_event_study";

export type RpcRequest = {
  readonly id: number;
  readonly method: RpcMethod;
  readonly params: Record<string, unknown>;
};

export type RpcResponse = {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly traceback?: string;
    readonly suggestion?: string;
  };
  readonly warnings?: readonly string[];
  readonly stdout?: readonly string[];
  readonly objectsCreated?: readonly RpcObjectCreated[];
  readonly persistFailed?: readonly string[];
};

export type RpcObjectCreated = {
  readonly id: string;
  readonly type: HandleType;
  readonly rClass: string;
  readonly summary: string;
  readonly sizeBytes: number;
  readonly schema?: Record<string, string>;
};

// ----------------------------------------------------------------------------
// Session State (immutable updates)
// ----------------------------------------------------------------------------

export type SessionState = {
  readonly sessionId: string;
  readonly handles: ReadonlyMap<string, ObjectHandle>;
  readonly nextId: Readonly<Record<HandleType, number>>;
};

export function createSessionState(sessionId: string): SessionState {
  return {
    sessionId,
    handles: new Map(),
    nextId: {
      panel: 0,
      design_profile: 0,
      estimate: 0,
      event_study: 0,
      plot: 0,
      twfe_diagnostic: 0,
      power_result: 0,
      honest_result: 0,
      report: 0,
    },
  };
}

export function nextHandleId(
  state: SessionState,
  type: HandleType,
): { id: string; nextId: Readonly<Record<HandleType, number>> } {
  const counter = state.nextId[type] + 1;
  return {
    id: `${type}_${counter}`,
    nextId: { ...state.nextId, [type]: counter },
  };
}

// ----------------------------------------------------------------------------
// Worker Pool Config
// ----------------------------------------------------------------------------

export type WorkerPoolConfig = {
  readonly maxWorkers: number;
  readonly recycleAfterCalls: number;
  readonly recycleAfterMinutes: number;
  readonly callTimeoutMs: number;
  readonly rPath: string;
};

export const DEFAULT_POOL_CONFIG: WorkerPoolConfig = {
  maxWorkers: 2, // 1 active + 1 standby
  recycleAfterCalls: 100,
  recycleAfterMinutes: 60,
  callTimeoutMs: 60_000, // 60s — DID estimators can be slower than generic stats
  rPath: "Rscript",
};

// ----------------------------------------------------------------------------
// Tool Result Envelope
// ----------------------------------------------------------------------------

export type DidToolResult = {
  readonly content: ReadonlyArray<{ type: "text"; text: string }>;
  readonly isError?: boolean;
};

export function successResult(data: unknown): DidToolResult {
  const json = JSON.stringify(data, null, 2);

  // Persist to disk if >100KB; return metadata pointer
  if (json.length > 100_000) {
    try {
      const dir = join(tmpdir(), "did-mcp", "results");
      mkdirSync(dir, { recursive: true });
      const filepath = join(dir, `result_${cryptoRandomBytes(6).toString("hex")}.json`);
      writeFileSync(filepath, json, "utf-8");

      const preview = json.slice(0, 2000);
      const sizeKB = (json.length / 1024).toFixed(1);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            _persisted: true,
            message: `Result too large (${sizeKB}KB). Full output saved to: ${filepath}`,
            preview_text: preview + "\n... (truncated)",
            original_size_kb: parseFloat(sizeKB),
            filepath,
          }, null, 2),
        }],
      };
    } catch {
      // fall through to inline result if persistence fails
    }
  }

  return {
    content: [{ type: "text", text: json }],
  };
}

export function errorResult(
  message: string,
  details?: Record<string, unknown>,
): DidToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: true, message, ...details }, null, 2),
      },
    ],
    isError: true,
  };
}

// ----------------------------------------------------------------------------
// Reactive Store
// ----------------------------------------------------------------------------

export type Store<T> = {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
