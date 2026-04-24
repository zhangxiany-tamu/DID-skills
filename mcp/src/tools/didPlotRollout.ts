// ============================================================================
// did-mcp — did_plot_rollout tool
// ============================================================================
// Renders the panelView treatment-rollout heatmap and/or outcome-trajectory
// plot to PNG files on disk. Each rendered plot becomes a `plot` handle whose
// schema carries the file path. Pulls column names from the panel handle.

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

export const DID_PLOT_ROLLOUT_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: {
      type: "string",
      description: "Handle id of a panel (e.g. 'panel_1') from did_load_panel.",
    },
    plot_type: {
      type: "string",
      enum: ["rollout", "outcome", "both"],
      description:
        "rollout = treatment status heatmap (by.timing=TRUE). outcome = trajectories by treatment status (by.group=TRUE). both = render both (default).",
    },
    outcome_var: {
      type: "string",
      description:
        "Outcome column to plot. Defaults to the panel handle's outcome_var. Required when plot_type != 'rollout'.",
    },
    title: {
      type: "string",
      description: "Optional override for the plot title.",
    },
    width: {
      type: "number",
      description: "PNG width in inches (default 10).",
    },
    height: {
      type: "number",
      description: "PNG height in inches (default 6).",
    },
  },
  required: ["panel_id"],
};

export type DidPlotRolloutInput = {
  panel_id: string;
  plot_type?: "rollout" | "outcome" | "both";
  outcome_var?: string;
  title?: string;
  width?: number;
  height?: number;
};

export async function executeDidPlotRollout(
  input: DidPlotRolloutInput,
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

    const plotType = input.plot_type ?? "both";
    const outcomeVar = input.outcome_var ?? schema.outcome_var ?? "";
    if (plotType !== "rollout" && !outcomeVar) {
      return errorResult(
        "did_plot_rollout: outcome_var is required for plot_type 'outcome' or 'both'. Pass it in, or re-load the panel with outcome_var set.",
      );
    }

    const params: Record<string, unknown> = {
      panel_id: input.panel_id,
      plot_type: plotType,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
      outcome_var: outcomeVar,
    };
    if (input.title) params.title = input.title;
    if (input.width) params.width = input.width;
    if (input.height) params.height = input.height;

    if (plotType === "rollout" || plotType === "both") {
      params.handle_id_rollout = reserveHandleId(sessionStore, "plot");
    }
    if (plotType === "outcome" || plotType === "both") {
      params.handle_id_outcome = reserveHandleId(sessionStore, "plot");
    }

    const response = await workerPool.call("plot_rollout", params);

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
        registerHandle(sessionStore, created, workerId, "did_plot_rollout");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_plot_rollout failed: ${(e as Error).message}`);
  }
}
