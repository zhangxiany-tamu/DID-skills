// ============================================================================
// did-mcp — did_compare_estimators tool
// ============================================================================
// Runs several Step 3 estimators on the same panel and returns parallel
// standardized envelopes plus a wide comparison table keyed on event_time.
// Each estimator also produces its own `estimate` handle.

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

const ESTIMATORS = ["cs", "sa", "bjs", "did2s", "staggered"] as const;

export const DID_COMPARE_ESTIMATORS_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: { type: "string", description: "Handle id of a panel." },
    estimators: {
      type: "array",
      items: { type: "string", enum: [...ESTIMATORS] },
      description: "Subset of {cs, sa, bjs, did2s, staggered}.",
    },
    outcome_var: { type: "string", description: "Outcome column." },
    xformla_vars: { type: "array", items: { type: "string" } },
    cluster_var: { type: "string" },
    min_e: { type: "number" },
    max_e: { type: "number" },
    stop_on_error: {
      type: "boolean",
      description:
        "If true, abort the whole comparison on the first estimator failure. Default false (collect errors).",
    },
  },
  required: ["panel_id", "estimators"],
};

export type DidCompareEstimatorsInput = {
  panel_id: string;
  estimators: (typeof ESTIMATORS)[number][];
  outcome_var?: string;
  xformla_vars?: string[];
  cluster_var?: string;
  min_e?: number;
  max_e?: number;
  stop_on_error?: boolean;
};

export async function executeDidCompareEstimators(
  input: DidCompareEstimatorsInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handle = getHandle(sessionStore, input.panel_id);
    if (!handle) return errorResult(`panel handle '${input.panel_id}' not found`);
    if (handle.type !== "panel") {
      return errorResult(`handle '${input.panel_id}' is a ${handle.type}, expected panel`);
    }
    const schema = handle.schema ?? {};
    if (!schema.id_var || !schema.time_var || !schema.treat_timing_var) {
      return errorResult(
        `panel '${input.panel_id}' is missing column schema. Re-load with did_load_panel.`,
      );
    }

    if (!Array.isArray(input.estimators) || input.estimators.length === 0) {
      return errorResult("did_compare_estimators: `estimators` must be a non-empty array.");
    }
    for (const est of input.estimators) {
      if (!ESTIMATORS.includes(est)) {
        return errorResult(
          `did_compare_estimators: unknown estimator '${est}' (expected ${ESTIMATORS.join(" / ")})`,
        );
      }
    }

    const outcome = input.outcome_var ?? schema.outcome_var ?? "";
    if (!outcome) {
      return errorResult(
        "did_compare_estimators: outcome_var is required (pass it, or re-load the panel with outcome_var set).",
      );
    }

    const handleIds = input.estimators.map(() => reserveHandleId(sessionStore, "estimate"));

    const params: Record<string, unknown> = {
      panel_id: input.panel_id,
      estimators: input.estimators,
      handle_ids: handleIds,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
      treat_var: schema.treat_var ?? "",
      outcome_var: outcome,
      xformla_vars: input.xformla_vars ?? [],
    };
    if (input.cluster_var) params.cluster_var = input.cluster_var;
    if (input.min_e !== undefined) params.min_e = input.min_e;
    if (input.max_e !== undefined) params.max_e = input.max_e;
    if (input.stop_on_error !== undefined) params.stop_on_error = input.stop_on_error;

    const response = await workerPool.call("compare_estimators", params);

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
        registerHandle(sessionStore, created, workerId, "did_compare_estimators");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_compare_estimators failed: ${(e as Error).message}`);
  }
}
