// ============================================================================
// did-mcp — did_estimate tool
// ============================================================================
// Runs one of five Step 3 estimators (cs / sa / bjs / did2s / staggered) on a
// loaded panel and registers the raw R object as an `estimate` handle. Reads
// column names from the panel handle schema. Never-treated coding is converted
// per estimator inside R (see step3_common.R::coerce_never_treated_for_estimator).

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

export const DID_ESTIMATE_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: {
      type: "string",
      description: "Handle id of a panel (e.g. 'panel_1') from did_load_panel.",
    },
    estimator: {
      type: "string",
      enum: [...ESTIMATORS],
      description:
        "Which estimator to run: cs (Callaway-Sant'Anna, did), sa (Sun-Abraham, fixest), bjs (Borusyak-Jaravel-Spiess, didimputation), did2s (Gardner two-stage), staggered (Roth-Sant'Anna).",
    },
    outcome_var: {
      type: "string",
      description: "Outcome column (yname). Defaults to the panel schema's outcome_var if set.",
    },
    xformla_vars: {
      type: "array",
      items: { type: "string" },
      description: "Optional list of covariate column names (time-invariant by default).",
    },
    cluster_var: {
      type: "string",
      description: "Clustering variable. Defaults to the panel's id_var.",
    },
    control_group: {
      type: "string",
      enum: ["nevertreated", "notyettreated"],
      description: "CS only. Default 'notyettreated'.",
    },
    est_method: {
      type: "string",
      description: "CS only: 'dr' | 'ipw' | 'reg'. Default 'dr'.",
    },
    min_e: { type: "number", description: "Restrict event study to event_time >= min_e." },
    max_e: { type: "number", description: "Restrict event study to event_time <= max_e." },
    weights_var: {
      type: "string",
      description:
        "Optional sampling-weights column. Not supported for estimator='staggered'.",
    },
    anticipation: {
      type: "number",
      description: "CS only: number of anticipation periods. Default 0.",
    },
    bstrap: { type: "boolean", description: "CS only: use bootstrap inference. Default true." },
    cband: { type: "boolean", description: "CS only: uniform confidence band. Default true." },
  },
  required: ["panel_id", "estimator"],
};

export type DidEstimateInput = {
  panel_id: string;
  estimator: (typeof ESTIMATORS)[number];
  outcome_var?: string;
  xformla_vars?: string[];
  cluster_var?: string;
  control_group?: "nevertreated" | "notyettreated";
  est_method?: string;
  min_e?: number;
  max_e?: number;
  weights_var?: string;
  anticipation?: number;
  bstrap?: boolean;
  cband?: boolean;
};

export async function executeDidEstimate(
  input: DidEstimateInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handle = getHandle(sessionStore, input.panel_id);
    if (!handle) return errorResult(`panel handle '${input.panel_id}' not found`);
    if (handle.type !== "panel") {
      return errorResult(
        `handle '${input.panel_id}' is a ${handle.type}, expected panel`,
      );
    }
    const schema = handle.schema ?? {};
    if (!schema.id_var || !schema.time_var || !schema.treat_timing_var) {
      return errorResult(
        `panel '${input.panel_id}' is missing column schema. Re-load with did_load_panel.`,
      );
    }

    if (!ESTIMATORS.includes(input.estimator)) {
      return errorResult(
        `estimator must be one of ${ESTIMATORS.join(" / ")} (got '${input.estimator}')`,
      );
    }

    const outcome = input.outcome_var ?? schema.outcome_var ?? "";
    if (!outcome) {
      return errorResult(
        "did_estimate: outcome_var is required (pass it, or re-load the panel with outcome_var set).",
      );
    }

    const estimateHandleId = reserveHandleId(sessionStore, "estimate");

    const params: Record<string, unknown> = {
      panel_id: input.panel_id,
      handle_id: estimateHandleId,
      estimator: input.estimator,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
      treat_var: schema.treat_var ?? "",
      outcome_var: outcome,
      xformla_vars: input.xformla_vars ?? [],
    };
    if (input.cluster_var) params.cluster_var = input.cluster_var;
    if (input.control_group) params.control_group = input.control_group;
    if (input.est_method) params.est_method = input.est_method;
    if (input.min_e !== undefined) params.min_e = input.min_e;
    if (input.max_e !== undefined) params.max_e = input.max_e;
    if (input.weights_var) params.weights_var = input.weights_var;
    if (input.anticipation !== undefined) params.anticipation = input.anticipation;
    if (input.bstrap !== undefined) params.bstrap = input.bstrap;
    if (input.cband !== undefined) params.cband = input.cband;

    const response = await workerPool.call("estimate", params);

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
        registerHandle(sessionStore, created, workerId, "did_estimate");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_estimate failed: ${(e as Error).message}`);
  }
}
