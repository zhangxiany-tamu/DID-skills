// ============================================================================
// did-mcp — did_report tool
// ============================================================================
// Walks the session's handles and renders a markdown report covering every
// step the session touched (Step 1 panel/profile → Step 2 TWFE diagnostic
// → Step 3 estimates → Step 4 power → Step 5 sensitivity). Writes the .md
// to disk and registers a `report` handle whose schema carries the path.

import type { WorkerPool } from "../engine/workerPool.js";
import {
  listHandles,
  registerHandle,
  reserveHandleId,
  type SessionStore,
} from "../engine/session.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_REPORT_SCHEMA = {
  type: "object" as const,
  properties: {
    include_ids: {
      type: "array",
      items: { type: "string" },
      description:
        "Optional subset of handle ids to include. Default: every handle currently in the session store.",
    },
  },
  required: [],
};

export type DidReportInput = {
  include_ids?: string[];
};

export async function executeDidReport(
  input: DidReportInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const reportHandleId = reserveHandleId(sessionStore, "report");

    // Pass the TS-side handle type map to R so the renderer picks the
    // canonical kind (panel / design_profile / estimate / …) without having
    // to guess from R class inspection. Object-store-only handles (created
    // outside a did_* tool) still work via the R-side fallback.
    const handleTypes: Record<string, string> = {};
    for (const h of listHandles(sessionStore)) {
      handleTypes[h.id] = h.type;
    }

    const params: Record<string, unknown> = {
      handle_id: reportHandleId,
      handle_types: handleTypes,
    };
    if (input.include_ids && input.include_ids.length > 0) {
      params.include_ids = input.include_ids;
    }

    const response = await workerPool.call("report", params);

    if (response.error) {
      return errorResult(response.error.message, {
        code: response.error.code,
        suggestion: response.error.suggestion,
        traceback: response.error.traceback,
      });
    }

    const workerId = workerPool.activeWorkerId ?? "unknown";
    if (response.objectsCreated) {
      for (const created of response.objectsCreated) {
        registerHandle(sessionStore, created, workerId, "did_report");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_report failed: ${(e as Error).message}`);
  }
}
