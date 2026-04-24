// ============================================================================
// did-mcp — did_extract_event_study tool
// ============================================================================
// Given an `estimate` handle (MP / fixest / did_imputation / staggered_combined),
// returns a canonical {betahat, sigma, tVec} that downstream Phase 4 tools
// (HonestDiD, pretrends) consume directly. Creates an `event_study` handle.

import type { WorkerPool } from "../engine/workerPool.js";
import {
  getHandle,
  registerHandle,
  reserveHandleId,
  type SessionStore,
} from "../engine/session.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_EXTRACT_EVENT_STUDY_SCHEMA = {
  type: "object" as const,
  properties: {
    estimate_id: {
      type: "string",
      description: "Handle id of an estimate (e.g. 'estimate_1') from did_estimate.",
    },
    min_e: {
      type: "number",
      description: "Optional lower event-time bound to keep in the extracted event study.",
    },
    max_e: {
      type: "number",
      description: "Optional upper event-time bound to keep in the extracted event study.",
    },
  },
  required: ["estimate_id"],
};

export type DidExtractEventStudyInput = {
  estimate_id: string;
  min_e?: number;
  max_e?: number;
};

export async function executeDidExtractEventStudy(
  input: DidExtractEventStudyInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handle = getHandle(sessionStore, input.estimate_id);
    if (!handle) return errorResult(`estimate handle '${input.estimate_id}' not found`);
    if (handle.type !== "estimate") {
      return errorResult(
        `handle '${input.estimate_id}' is a ${handle.type}, expected estimate`,
      );
    }

    const esHandleId = reserveHandleId(sessionStore, "event_study");

    const params: Record<string, unknown> = {
      estimate_id: input.estimate_id,
      handle_id: esHandleId,
    };
    if (input.min_e !== undefined) params.min_e = input.min_e;
    if (input.max_e !== undefined) params.max_e = input.max_e;

    const response = await workerPool.call("extract_event_study", params);

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
        registerHandle(sessionStore, created, workerId, "did_extract_event_study");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_extract_event_study failed: ${(e as Error).message}`);
  }
}
