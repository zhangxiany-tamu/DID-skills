// ============================================================================
// did-mcp — did_session tool
// ============================================================================
// Inspect or manage the active session: list handles, inspect one by ID,
// drop one (frees the R-side object AND the TS handle), or show worker pool
// status.

import type { WorkerPool } from "../engine/workerPool.js";
import {
  type SessionStore,
  getHandle,
  listHandles,
  dropHandle,
} from "../engine/session.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_SESSION_SCHEMA = {
  type: "object" as const,
  properties: {
    action: {
      type: "string",
      enum: ["list", "inspect", "drop", "status"],
      description:
        "list: show all handles. inspect: show one handle by id. drop: free the R object AND remove the handle. status: show worker pool state.",
    },
    id: {
      type: "string",
      description:
        "Handle id (e.g. 'panel_1'). Required for inspect and drop.",
    },
  },
  required: ["action"],
};

export type DidSessionInput = {
  action: "list" | "inspect" | "drop" | "status";
  id?: string;
};

export async function executeDidSession(
  input: DidSessionInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  switch (input.action) {
    case "list": {
      const handles = listHandles(sessionStore).map((h) => ({
        id: h.id,
        type: h.type,
        rClass: h.rClass,
        persistenceClass: h.persistenceClass,
        sizeBytes: h.sizeBytes,
        summary: h.summary,
        createdBy: h.createdBy,
      }));
      return successResult({
        sessionId: sessionStore.getState().sessionId,
        handleCount: handles.length,
        handles,
      });
    }

    case "inspect": {
      if (!input.id) return errorResult("id is required for inspect");
      const h = getHandle(sessionStore, input.id);
      if (!h) return errorResult(`handle '${input.id}' not found`);
      return successResult(h);
    }

    case "drop": {
      if (!input.id) return errorResult("id is required for drop");
      const handle = getHandle(sessionStore, input.id);
      if (!handle) return errorResult(`handle '${input.id}' not found`);

      // Free the R-side object before dropping the TS handle. A failure here
      // surfaces to the caller; we do not silently swallow it.
      let freedInR = false;
      try {
        const resp = await workerPool.call("drop_object", {
          handle: input.id,
          session_dir: workerPool.sessionDirPath,
        });
        if (resp.error) {
          return errorResult(
            `did_session drop: R-side drop failed: ${resp.error.message}`,
            { code: resp.error.code },
          );
        }
        freedInR =
          (resp.result as { freed?: boolean } | undefined)?.freed ?? false;
      } catch (e) {
        return errorResult(
          `did_session drop: R call failed: ${(e as Error).message}`,
        );
      }

      const droppedInTs = dropHandle(sessionStore, input.id);
      return successResult({
        dropped: input.id,
        freedInR,
        droppedInTs,
      });
    }

    case "status": {
      return successResult({
        sessionId: sessionStore.getState().sessionId,
        handleCount: sessionStore.getState().handles.size,
        pool: workerPool.getStatus(),
      });
    }

    default:
      return errorResult(`unknown action: ${input.action}`);
  }
}
