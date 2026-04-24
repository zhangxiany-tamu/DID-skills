// ============================================================================
// Unit tests for did_honest_sensitivity tool wiring.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import {
  createSessionStore,
  registerHandle,
  reserveHandleId,
} from "../engine/session.js";
import {
  executeDidHonestSensitivity,
  type DidHonestSensitivityInput,
} from "./didHonestSensitivity.js";
import type { RpcResponse } from "../types.js";

function makeStubbedPool(response: RpcResponse) {
  return {
    call: vi.fn(async () => response),
    activeWorkerId: "w_test",
    sessionDirPath: "/tmp/test-session",
  };
}

function seedEventStudy(store: ReturnType<typeof createSessionStore>) {
  const id = reserveHandleId(store, "event_study");
  registerHandle(
    store,
    { id, type: "event_study", rClass: "list", summary: "es", sizeBytes: 200 },
    "w_test",
    "seed",
  );
  return id;
}

describe("did_honest_sensitivity", () => {
  it("errors when source is not an event_study handle", async () => {
    const store = createSessionStore("s_test");
    const panelId = reserveHandleId(store, "panel");
    registerHandle(
      store,
      { id: panelId, type: "panel", rClass: "data.frame", summary: "x", sizeBytes: 1 },
      "w_test",
      "seed",
    );
    const pool = makeStubbedPool({ id: 1, result: {} });
    const res = await executeDidHonestSensitivity(
      { event_study_id: panelId } as DidHonestSensitivityInput,
      pool as never,
      store,
    );
    expect(res.isError).toBe(true);
    expect(pool.call).not.toHaveBeenCalled();
  });

  it("forwards Mbarvec and registers the honest_result handle", async () => {
    const store = createSessionStore("s_test");
    const esId = seedEventStudy(store);
    const response: RpcResponse = {
      id: 1,
      result: {
        handle: "honest_result_1",
        robust: [{ Mbar: 0.5, lb: -0.1, ub: 0.05 }],
        breakdown_M: 0.5,
        n_pre: 2,
        n_post: 4,
      },
      objectsCreated: [
        {
          id: "honest_result_1",
          type: "honest_result",
          rClass: "honest_did_result",
          summary: "hr",
          sizeBytes: 500,
        },
      ],
    };
    const pool = makeStubbedPool(response);
    const res = await executeDidHonestSensitivity(
      { event_study_id: esId, Mbarvec: [0.5, 1.0] },
      pool as never,
      store,
    );
    expect(res.isError).toBeFalsy();
    const [method, params] = pool.call.mock.calls[0];
    expect(method).toBe("honest_sensitivity");
    expect(params).toMatchObject({ event_study_id: esId, Mbarvec: [0.5, 1.0] });
    expect(store.getState().handles.get("honest_result_1")?.type).toBe("honest_result");
  });
});
