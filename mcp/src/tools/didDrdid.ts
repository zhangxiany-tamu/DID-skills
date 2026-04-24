// ============================================================================
// did-mcp — did_drdid tool
// ============================================================================
// Standalone doubly-robust DiD (DRDID::drdid) for a two-period panel slice.
// Complements did_estimate (which wraps the 5 staggered-DiD estimators); DRDID
// is the right tool when you have a single pre/post pair with explicit
// covariates and want CS-style doubly-robust inference without the full
// Callaway-Sant'Anna machinery.

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

export const DID_DRDID_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: { type: "string", description: "Handle id of a panel." },
    outcome_var: {
      type: "string",
      description: "Outcome column. Defaults to the panel's outcome_var.",
    },
    treated_var: {
      type: "string",
      description:
        "Column with a 1-if-eventually-treated indicator (time-invariant within unit). If omitted, synthesized from the panel's treat_timing_var as 1{gname > 0 & is.finite(gname)}.",
    },
    xformla_vars: {
      type: "array",
      items: { type: "string" },
      description: "Covariate column names.",
    },
    est_method: {
      type: "string",
      enum: ["imp", "ipw", "reg", "trad", "dr"],
      description:
        "Estimation method: imp (improved doubly-robust, DEFAULT), ipw (inverse-probability weighting), reg (outcome regression), trad (traditional DR). 'dr' is a legacy alias for 'imp' — DRDID >=1.2 renamed it.",
    },
    time_values: {
      type: "array",
      items: { type: "number" },
      description:
        "Pre/post time values [pre, post]. Required when the panel has more than 2 time values.",
    },
    panel: {
      type: "boolean",
      description:
        "Treat the data as panel (default true) vs. repeated cross-section.",
    },
    weights_var: { type: "string", description: "Optional sampling-weights column." },
    boot: { type: "boolean", description: "Bootstrap CI. Default false." },
    nboot: { type: "number", description: "Bootstrap iterations. Default 999." },
  },
  required: ["panel_id"],
};

export type DidDrdidInput = {
  panel_id: string;
  outcome_var?: string;
  treated_var?: string;
  xformla_vars?: string[];
  est_method?: "dr" | "ipw" | "reg" | "trad" | "imp";
  time_values?: number[];
  panel?: boolean;
  weights_var?: string;
  boot?: boolean;
  nboot?: number;
};

export async function executeDidDrdid(
  input: DidDrdidInput,
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

    const outcome = input.outcome_var ?? schema.outcome_var ?? "";
    if (!outcome) {
      return errorResult(
        "did_drdid: outcome_var is required (pass it, or re-load the panel with outcome_var set).",
      );
    }

    const estHandleId = reserveHandleId(sessionStore, "estimate");

    const params: Record<string, unknown> = {
      panel_id: input.panel_id,
      handle_id: estHandleId,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
      treat_var: schema.treat_var ?? "",
      outcome_var: outcome,
      xformla_vars: input.xformla_vars ?? [],
    };
    if (input.treated_var) params.treated_var = input.treated_var;
    if (input.est_method) params.est_method = input.est_method;
    if (input.time_values) params.time_values = input.time_values;
    if (input.panel !== undefined) params.panel = input.panel;
    if (input.weights_var) params.weights_var = input.weights_var;
    if (input.boot !== undefined) params.boot = input.boot;
    if (input.nboot !== undefined) params.nboot = input.nboot;

    const response = await workerPool.call("drdid", params);

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
        registerHandle(sessionStore, created, workerId, "did_drdid");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_drdid failed: ${(e as Error).message}`);
  }
}
