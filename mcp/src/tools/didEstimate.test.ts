// ============================================================================
// Unit tests for did_estimate tool wiring.
// ============================================================================
// These tests exercise the TS-side glue in isolation — they don't run R. We
// stub workerPool.call with a synthetic RpcResponse and assert that:
//   * schema validation rejects missing / bad inputs before calling the worker
//   * a successful response registers the created handle in the session store
//   * schema defaults (cluster_var, outcome_var fallback to panel schema) are
//     surfaced to the worker call correctly

import { describe, it, expect, vi } from "vitest";
import {
  createSessionStore,
  registerHandle,
  reserveHandleId,
} from "../engine/session.js";
import {
  executeDidEstimate,
  type DidEstimateInput,
} from "./didEstimate.js";
import type { RpcResponse } from "../types.js";

type WorkerPoolStub = {
  call: ReturnType<typeof vi.fn<[string, Record<string, unknown>], Promise<RpcResponse>>>;
  activeWorkerId: string | null;
  sessionDirPath: string;
  getStatus?: () => unknown;
};

function makeStubbedPool(response: RpcResponse): WorkerPoolStub {
  return {
    call: vi.fn(async () => response),
    activeWorkerId: "w_test",
    sessionDirPath: "/tmp/test-session",
  };
}

function seedPanelHandle(
  store: ReturnType<typeof createSessionStore>,
  extras: Partial<Record<string, string>> = {},
) {
  const id = reserveHandleId(store, "panel");
  registerHandle(
    store,
    {
      id,
      type: "panel",
      rClass: "data.frame",
      summary: "test panel",
      sizeBytes: 1000,
      schema: {
        id_var: "unit",
        time_var: "year",
        treat_timing_var: "gname",
        outcome_var: "y",
        ...extras,
      },
    },
    "w_test",
    "test-seed",
  );
  return id;
}

describe("did_estimate", () => {
  it("errors when the panel handle is missing", async () => {
    const store = createSessionStore("s_test");
    const pool = makeStubbedPool({ id: 1, result: {} });
    const res = await executeDidEstimate(
      { panel_id: "panel_999", estimator: "cs" } as DidEstimateInput,
      pool as never,
      store,
    );
    expect(res.isError).toBe(true);
    expect(pool.call).not.toHaveBeenCalled();
  });

  it("errors when the handle is not a panel", async () => {
    const store = createSessionStore("s_test");
    const estId = reserveHandleId(store, "estimate");
    registerHandle(
      store,
      { id: estId, type: "estimate", rClass: "MP", summary: "x", sizeBytes: 10 },
      "w_test",
      "seed",
    );
    const pool = makeStubbedPool({ id: 1, result: {} });
    const res = await executeDidEstimate(
      { panel_id: estId, estimator: "cs" } as DidEstimateInput,
      pool as never,
      store,
    );
    expect(res.isError).toBe(true);
    expect(pool.call).not.toHaveBeenCalled();
  });

  it("rejects an unknown estimator", async () => {
    const store = createSessionStore("s_test");
    const panelId = seedPanelHandle(store);
    const pool = makeStubbedPool({ id: 1, result: {} });
    const res = await executeDidEstimate(
      { panel_id: panelId, estimator: "bogus" as unknown as "cs" },
      pool as never,
      store,
    );
    expect(res.isError).toBe(true);
    expect(pool.call).not.toHaveBeenCalled();
  });

  it("forwards schema-derived outcome_var and registers the estimate handle", async () => {
    const store = createSessionStore("s_test");
    const panelId = seedPanelHandle(store);

    const response: RpcResponse = {
      id: 1,
      result: { overall: { att: -0.04 }, handle: "estimate_1" },
      objectsCreated: [
        {
          id: "estimate_1",
          type: "estimate",
          rClass: "MP",
          summary: "estimate (cs)",
          sizeBytes: 2048,
        },
      ],
    };
    const pool = makeStubbedPool(response);

    const res = await executeDidEstimate(
      { panel_id: panelId, estimator: "cs" },
      pool as never,
      store,
    );
    expect(res.isError).toBeFalsy();
    expect(pool.call).toHaveBeenCalledOnce();

    const [method, params] = pool.call.mock.calls[0];
    expect(method).toBe("estimate");
    expect(params).toMatchObject({
      panel_id: panelId,
      estimator: "cs",
      id_var: "unit",
      time_var: "year",
      treat_timing_var: "gname",
      outcome_var: "y",
      xformla_vars: [],
    });

    // The estimate handle should now be in the session store.
    const state = store.getState();
    expect(state.handles.get("estimate_1")?.type).toBe("estimate");
  });

  it("propagates an R-side error back as isError", async () => {
    const store = createSessionStore("s_test");
    const panelId = seedPanelHandle(store);
    const response: RpcResponse = {
      id: 1,
      error: { code: 42, message: "boom", traceback: "" },
    };
    const pool = makeStubbedPool(response);
    const res = await executeDidEstimate(
      { panel_id: panelId, estimator: "cs" },
      pool as never,
      store,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("boom");
  });
});
