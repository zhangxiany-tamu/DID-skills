// ============================================================================
// did-mcp — did_power_analysis tool
// ============================================================================
// Takes an `event_study` handle and answers "what linear pre-trend slope would
// we detect with power P?" via pretrends::slope_for_power, for each requested
// target power. Optionally runs pretrends::pretrends(deltatrue) when the user
// supplies a hypothesized trend. Returns a `power_result` handle.

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

export const DID_POWER_ANALYSIS_SCHEMA = {
  type: "object" as const,
  properties: {
    event_study_id: {
      type: "string",
      description:
        "Handle id of an event_study (e.g. 'event_study_1') from did_extract_event_study.",
    },
    target_powers: {
      type: "array",
      items: { type: "number" },
      description:
        "Target power levels for slope_for_power(). Default: [0.5, 0.8].",
    },
    reference_period: {
      type: "number",
      description: "Omitted event time. Default -1.",
    },
    alpha: {
      type: "number",
      description: "Significance level. Default 0.05.",
    },
    deltatrue: {
      type: "array",
      items: { type: "number" },
      description:
        "Optional hypothesized trend violation vector (one entry per event time, excluding the reference period). If provided, the tool additionally runs pretrends() and returns df_power.",
    },
  },
  required: ["event_study_id"],
};

export type DidPowerAnalysisInput = {
  event_study_id: string;
  target_powers?: number[];
  reference_period?: number;
  alpha?: number;
  deltatrue?: number[];
};

export async function executeDidPowerAnalysis(
  input: DidPowerAnalysisInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handle = getHandle(sessionStore, input.event_study_id);
    if (!handle) {
      return errorResult(`event_study handle '${input.event_study_id}' not found`);
    }
    if (handle.type !== "event_study") {
      return errorResult(
        `handle '${input.event_study_id}' is a ${handle.type}, expected event_study`,
      );
    }

    const resultHandleId = reserveHandleId(sessionStore, "power_result");

    const params: Record<string, unknown> = {
      event_study_id: input.event_study_id,
      handle_id: resultHandleId,
    };
    if (input.target_powers) params.target_powers = input.target_powers;
    if (input.reference_period !== undefined) {
      params.reference_period = input.reference_period;
    }
    if (input.alpha !== undefined) params.alpha = input.alpha;
    if (input.deltatrue) params.deltatrue = input.deltatrue;

    const response = await workerPool.call("power_analysis", params);

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
        registerHandle(sessionStore, created, workerId, "did_power_analysis");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_power_analysis failed: ${(e as Error).message}`);
  }
}
