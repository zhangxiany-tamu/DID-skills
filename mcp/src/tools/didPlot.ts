// ============================================================================
// did-mcp — did_plot tool
// ============================================================================
// Generic plot for Step 3+ artifacts. Auto-picks the plot kind from the
// source handle's type:
//   * event_study → point + 95% CI event plot
//   * honest_result → robust CIs vs M, with the original CI as a backdrop
// Returns a `plot` handle whose schema carries the PNG path.

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

export const DID_PLOT_SCHEMA = {
  type: "object" as const,
  properties: {
    source_id: {
      type: "string",
      description:
        "Handle id of an event_study (e.g. 'event_study_1') or an honest_result (e.g. 'honest_result_1'). Plot kind is inferred from the handle type.",
    },
    title: { type: "string", description: "Optional plot title override." },
    xlab: { type: "string", description: "Optional x-axis label." },
    ylab: { type: "string", description: "Optional y-axis label." },
    width: { type: "number", description: "PNG width in inches (default 8)." },
    height: { type: "number", description: "PNG height in inches (default 5)." },
    alpha: {
      type: "number",
      description: "Significance level for error bars (event_study only). Default 0.05.",
    },
  },
  required: ["source_id"],
};

export type DidPlotInput = {
  source_id: string;
  title?: string;
  xlab?: string;
  ylab?: string;
  width?: number;
  height?: number;
  alpha?: number;
};

export async function executeDidPlot(
  input: DidPlotInput,
  workerPool: WorkerPool,
  sessionStore: SessionStore,
): Promise<DidToolResult> {
  try {
    const handle = getHandle(sessionStore, input.source_id);
    if (!handle) {
      return errorResult(`source handle '${input.source_id}' not found`);
    }
    if (handle.type !== "event_study" && handle.type !== "honest_result") {
      return errorResult(
        `handle '${input.source_id}' is a ${handle.type}; did_plot accepts event_study or honest_result`,
      );
    }

    const plotHandleId = reserveHandleId(sessionStore, "plot");

    const params: Record<string, unknown> = {
      source_id: input.source_id,
      handle_id: plotHandleId,
    };
    if (input.title) params.title = input.title;
    if (input.xlab) params.xlab = input.xlab;
    if (input.ylab) params.ylab = input.ylab;
    if (input.width !== undefined) params.width = input.width;
    if (input.height !== undefined) params.height = input.height;
    if (input.alpha !== undefined) params.alpha = input.alpha;

    const response = await workerPool.call("plot", params);

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
        registerHandle(sessionStore, created, workerId, "did_plot");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_plot failed: ${(e as Error).message}`);
  }
}
