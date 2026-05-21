// ============================================================================
// Unit tests for did_load_panel tool wiring.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { createSessionStore } from "../engine/session.js";
import { executeDidLoadPanel, type DidLoadPanelInput } from "./didLoadPanel.js";
import type { RpcResponse } from "../types.js";

function makeStubbedPool(response: RpcResponse) {
  return {
    call: vi.fn(async () => response),
    activeWorkerId: "w_test",
    sessionDirPath: "/tmp/test-session",
  };
}

describe("did_load_panel", () => {
  it("forwards schema, reserves a panel handle, and registers it", async () => {
    const store = createSessionStore("s_test");
    const response: RpcResponse = {
      id: 1,
      result: { handle: "panel_1", n_obs: 12, n_units: 3 },
      objectsCreated: [
        {
          id: "panel_1",
          type: "panel",
          rClass: "data.frame",
          summary: "panel with 12 rows",
          sizeBytes: 1200,
          schema: {
            id_var: "unit",
            time_var: "year",
            treat_timing_var: "g",
            treat_var: "treated",
            outcome_var: "y",
          },
        },
      ],
    };
    const pool = makeStubbedPool(response);

    const res = await executeDidLoadPanel(
      {
        path: "/tmp/panel.csv",
        id_var: "unit",
        time_var: "year",
        treat_timing_var: "g",
        treat_var: "treated",
        outcome_var: "y",
      },
      pool as never,
      store,
    );

    expect(res.isError).toBeFalsy();
    expect(pool.call).toHaveBeenCalledWith("load_panel", {
      path: "/tmp/panel.csv",
      id_var: "unit",
      time_var: "year",
      treat_timing_var: "g",
      treat_var: "treated",
      outcome_var: "y",
      handle_id: "panel_1",
    });
    expect(store.getState().handles.get("panel_1")?.schema?.outcome_var).toBe("y");
  });

  it("uses empty optional schema fields and returns R-side errors", async () => {
    const store = createSessionStore("s_test");
    const pool = makeStubbedPool({
      id: 1,
      error: { code: 4, message: "column not found", suggestion: "check id_var" },
    });

    const res = await executeDidLoadPanel(
      {
        path: "/tmp/panel.csv",
        id_var: "unit",
        time_var: "year",
        treat_timing_var: "g",
      } as DidLoadPanelInput,
      pool as never,
      store,
    );

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("column not found");
    expect(pool.call).toHaveBeenCalledWith("load_panel", expect.objectContaining({
      treat_var: "",
      outcome_var: "",
      handle_id: "panel_1",
    }));
    expect(store.getState().handles.size).toBe(0);
  });
});
