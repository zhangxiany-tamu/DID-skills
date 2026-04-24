// ============================================================================
// did-mcp — did_diagnose_twfe tool
// ============================================================================
// Step 2: run bacondecomp + TwoWayFEWeights on a panel and return a unified
// severity report (MINIMAL / MILD / MODERATE / SEVERE) plus a recommendation.
// If the panel is unbalanced or has >1000 units, bacon is skipped with a
// warning and the tool reports weights-only (per the skill's "if negative
// weight share > 25% the conclusion is definitive" decision rule).

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

export const DID_DIAGNOSE_TWFE_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: {
      type: "string",
      description: "Handle id of a panel (e.g. 'panel_1') from did_load_panel.",
    },
    outcome_var: {
      type: "string",
      description:
        "Outcome column (yname). Defaults to the panel schema's outcome_var.",
    },
    treat_var: {
      type: "string",
      description:
        "Binary 0/1 treatment indicator column. If omitted, synthesized from the panel's treat_timing_var as 1{t >= gname & gname > 0}.",
    },
    run_bacon: {
      type: "boolean",
      description:
        "Run Goodman-Bacon decomposition. Default true. Auto-skipped on unbalanced or very large (>1000 unit) panels with a warning.",
    },
    run_weights: {
      type: "boolean",
      description: "Run TwoWayFEWeights negative-weight diagnostic. Default true.",
    },
    weights_type: {
      type: "string",
      enum: ["feTR", "feS", "fdTR", "fdS"],
      description:
        "Regression type for TwoWayFEWeights: fixed effects + time-varying (feTR, default), fixed effects + constant (feS), first differences + time-varying (fdTR), first differences + constant (fdS).",
    },
  },
  required: ["panel_id"],
};

export type DidDiagnoseTwfeInput = {
  panel_id: string;
  outcome_var?: string;
  treat_var?: string;
  run_bacon?: boolean;
  run_weights?: boolean;
  weights_type?: "feTR" | "feS" | "fdTR" | "fdS";
};

export async function executeDidDiagnoseTwfe(
  input: DidDiagnoseTwfeInput,
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
        "did_diagnose_twfe: outcome_var is required (pass it, or re-load the panel with outcome_var set).",
      );
    }

    const resultHandleId = reserveHandleId(sessionStore, "twfe_diagnostic");

    const params: Record<string, unknown> = {
      panel_id: input.panel_id,
      handle_id: resultHandleId,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
      outcome_var: outcome,
    };
    // Only forward treat_var if the USER passed one. We deliberately do not
    // fall back to schema.treat_var: many DiD panels store it as an
    // "ever-treated" flag (1 on every row of a treated unit) rather than the
    // currently-treated post-indicator bacondecomp needs. Letting the
    // diagnostic synthesize from (gname, t) is the safe default.
    if (input.treat_var !== undefined && input.treat_var !== "") {
      params.treat_var = input.treat_var;
    }
    if (input.run_bacon !== undefined) params.run_bacon = input.run_bacon;
    if (input.run_weights !== undefined) params.run_weights = input.run_weights;
    if (input.weights_type) params.weights_type = input.weights_type;

    const response = await workerPool.call("diagnose_twfe", params);

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
        registerHandle(sessionStore, created, workerId, "did_diagnose_twfe");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_diagnose_twfe failed: ${(e as Error).message}`);
  }
}
