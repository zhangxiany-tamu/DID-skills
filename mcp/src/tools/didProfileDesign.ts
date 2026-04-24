// ============================================================================
// did-mcp — did_profile_design tool
// ============================================================================
// Runs profile_did_design on a panel and returns the timing classification +
// routing decision. Registers a `design_profile` handle (the full 10-field
// list) for downstream tools / reporting.

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

export const DID_PROFILE_DESIGN_SCHEMA = {
  type: "object" as const,
  properties: {
    panel_id: {
      type: "string",
      description: "Handle id of a panel (e.g. 'panel_1') from did_load_panel.",
    },
  },
  required: ["panel_id"],
};

export type DidProfileDesignInput = {
  panel_id: string;
};

export async function executeDidProfileDesign(
  input: DidProfileDesignInput,
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

    const profileHandleId = reserveHandleId(sessionStore, "design_profile");

    const response = await workerPool.call("profile_design", {
      panel_id: input.panel_id,
      id_var: schema.id_var,
      time_var: schema.time_var,
      treat_timing_var: schema.treat_timing_var,
      treat_var: schema.treat_var ?? "",
      handle_id: profileHandleId,
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
        registerHandle(sessionStore, created, workerId, "did_profile_design");
      }
    }

    return successResult({
      ...(response.result as object),
      warnings: response.warnings ?? [],
      stdout: response.stdout ?? [],
    });
  } catch (e) {
    return errorResult(`did_profile_design failed: ${(e as Error).message}`);
  }
}
