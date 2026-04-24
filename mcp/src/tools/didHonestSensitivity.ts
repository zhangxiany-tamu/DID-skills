// ============================================================================
// did-mcp — did_honest_sensitivity tool
// ============================================================================
// Takes an `event_study` handle (from did_extract_event_study) and runs
// HonestDiD::createSensitivityResults_relativeMagnitudes (default) or
// createSensitivityResults (smoothness) plus constructOriginalCS. Returns an
// `honest_result` handle and a standardized payload: robust CIs per M,
// original (non-robust) CI, and the breakdown M (the smallest M at which the
// robust CI includes zero, or NA if the effect is robust to every tested M).

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

export const DID_HONEST_SENSITIVITY_SCHEMA = {
  type: "object" as const,
  properties: {
    event_study_id: {
      type: "string",
      description:
        "Handle id of an event_study (e.g. 'event_study_1') from did_extract_event_study.",
    },
    method: {
      type: "string",
      enum: ["relative_magnitudes", "smoothness"],
      description:
        "relative_magnitudes (default): bound post-trend violations by Mbar × max pre-trend violation. smoothness: bound second differences of the trend by M.",
    },
    Mbarvec: {
      type: "array",
      items: { type: "number" },
      description:
        "Vector of Mbar values for method='relative_magnitudes'. Default: seq(0.5, 2, by=0.5).",
    },
    Mvec: {
      type: "array",
      items: { type: "number" },
      description:
        "Vector of M (smoothness) values for method='smoothness'. Default: c(0, 0.01, 0.02, 0.03).",
    },
    smoothness_method: {
      type: "string",
      enum: ["FLCI", "Conditional", "C-F", "C-LF"],
      description:
        "Inference method for smoothness. Default: 'FLCI' (fixed-length CIs).",
    },
    reference_period: {
      type: "number",
      description:
        "Omitted event time in the event study. Default -1. If tVec contains this value it is dropped before running sensitivity.",
    },
    max_pre_periods: {
      type: "number",
      description:
        "Max number of pre-treatment periods to keep (closest-to-zero retained). Default 5. Pass a large value to disable. HonestDiD scales poorly with n_pre; 10-pre ≈ 70s/Mbar.",
    },
    max_post_periods: {
      type: "number",
      description:
        "Max number of post-treatment periods to keep (earliest retained). Default 5. Pass a large value to disable.",
    },
  },
  required: ["event_study_id"],
};

export type DidHonestSensitivityInput = {
  event_study_id: string;
  method?: "relative_magnitudes" | "smoothness";
  Mbarvec?: number[];
  Mvec?: number[];
  smoothness_method?: string;
  reference_period?: number;
  max_pre_periods?: number;
  max_post_periods?: number;
};

export async function executeDidHonestSensitivity(
  input: DidHonestSensitivityInput,
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

    const resultHandleId = reserveHandleId(sessionStore, "honest_result");

    const params: Record<string, unknown> = {
      event_study_id: input.event_study_id,
      handle_id: resultHandleId,
    };
    if (input.method) params.method = input.method;
    if (input.Mbarvec) params.Mbarvec = input.Mbarvec;
    if (input.Mvec) params.Mvec = input.Mvec;
    if (input.smoothness_method) params.smoothness_method = input.smoothness_method;
    if (input.reference_period !== undefined) {
      params.reference_period = input.reference_period;
    }
    if (input.max_pre_periods !== undefined) {
      params.max_pre_periods = input.max_pre_periods;
    }
    if (input.max_post_periods !== undefined) {
      params.max_post_periods = input.max_post_periods;
    }

    const response = await workerPool.call("honest_sensitivity", params);

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
        registerHandle(
          sessionStore,
          created,
          workerId,
          "did_honest_sensitivity",
        );
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_honest_sensitivity failed: ${(e as Error).message}`);
  }
}
