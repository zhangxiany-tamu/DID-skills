// ============================================================================
// did-mcp — did_load_panel tool
// ============================================================================
// Reads a CSV or Parquet panel from disk and registers it as a `panel` handle. Caller
// supplies the column-name schema (id_var, time_var, treat_timing_var, plus
// optional treat_var / outcome_var). The handle carries that schema so
// downstream tools (check, profile, recode, plot) don't need to re-ask.

import type { WorkerPool } from "../engine/workerPool.js";
import {
  registerHandle,
  reserveHandleId,
  type SessionStore,
} from "../engine/session.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_LOAD_PANEL_SCHEMA = {
  type: "object" as const,
  properties: {
    path: {
      type: "string",
      description:
        "Absolute path to a .csv or .parquet file. Parquet requires the R `arrow` package.",
    },
    id_var: {
      type: "string",
      description: "Column name for the unit identifier (e.g. 'countyreal').",
    },
    time_var: {
      type: "string",
      description: "Column name for the time period (e.g. 'year').",
    },
    treat_timing_var: {
      type: "string",
      description:
        "Column name for the treatment-timing / first-treated period (a.k.a. gname; e.g. 'first.treat').",
    },
    treat_var: {
      type: "string",
      description:
        "Optional: column name for a binary treatment indicator. Required only if you want did_profile_design to detect treatment reversals.",
    },
    outcome_var: {
      type: "string",
      description:
        "Optional: column name for the outcome variable (e.g. 'lemp'). Needed by did_plot_rollout for outcome-trajectory plots.",
    },
  },
  required: ["path", "id_var", "time_var", "treat_timing_var"],
};

export type DidLoadPanelInput = {
  path: string;
  id_var: string;
  time_var: string;
  treat_timing_var: string;
  treat_var?: string;
  outcome_var?: string;
};

export async function executeDidLoadPanel(
  input: DidLoadPanelInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handleId = reserveHandleId(sessionStore, "panel");

    const response = await workerPool.call("load_panel", {
      path: input.path,
      id_var: input.id_var,
      time_var: input.time_var,
      treat_timing_var: input.treat_timing_var,
      treat_var: input.treat_var ?? "",
      outcome_var: input.outcome_var ?? "",
      handle_id: handleId,
    });

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
        registerHandle(sessionStore, created, workerId, "did_load_panel");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_load_panel failed: ${(e as Error).message}`);
  }
}
