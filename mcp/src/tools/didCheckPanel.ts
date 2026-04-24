// ============================================================================
// did-mcp — did_check_panel tool
// ============================================================================
// Runs the six panel integrity checks (uniqueness, timing consistency,
// balance, sentinels, already-treated, future-treatment) on a loaded panel
// and returns a structured report. Pulls column-name schema from the panel
// handle; no new handles created.

import type { WorkerPool } from "../engine/workerPool.js";
import { getHandle, type SessionStore } from "../engine/session.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_CHECK_PANEL_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: {
      type: "string",
      description: "Handle id of a panel (e.g. 'panel_1') from did_load_panel.",
    },
  },
  required: ["panel_id"],
};

export type DidCheckPanelInput = {
  panel_id: string;
};

export async function executeDidCheckPanel(
  input: DidCheckPanelInput,
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
        `panel '${input.panel_id}' is missing column schema (id_var/time_var/treat_timing_var). Re-load with did_load_panel.`,
      );
    }

    const response = await workerPool.call("check_panel", {
      panel_id: input.panel_id,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
    });

    if (response.error) {
      return errorResult(response.error.message, {
        code: response.error.code,
        suggestion: response.error.suggestion,
        traceback: response.error.traceback,
      });
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_check_panel failed: ${(e as Error).message}`);
  }
}
