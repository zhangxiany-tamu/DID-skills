// ============================================================================
// Unit tests for did_extract_event_study tool wiring.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import {
  createSessionStore,
  registerHandle,
  reserveHandleId,
} from "../engine/session.js";
import {
  executeDidExtractEventStudy,
  type DidExtractEventStudyInput,
} from "./didExtractEventStudy.js";
import type { RpcResponse } from "../types.js";

function makeStubbedPool(response: RpcResponse) {
  return {
    call: vi.fn(async () => response),
    activeWorkerId: "w_test",
    sessionDirPath: "/tmp/test-session",
  };
}

function seedHandle(
  store: ReturnType<typeof createSessionStore>,
  type: "panel" | "estimate",
) {
  const id = reserveHandleId(store, type);
  registerHandle(
    store,
    {
      id,
      type,
      rClass: type === "estimate" ? "fixest" : "data.frame",
      summary: type,
      sizeBytes: 100,
    },
    "w_test",
    "seed",
  );
  return id;
}

describe("did_extract_event_study", () => {
  it("errors before R when the estimate handle is missing or wrong type", async () => {
    const store = createSessionStore("s_test");
    const pool = makeStubbedPool({ id: 1, result: {} });

    const missing = await executeDidExtractEventStudy(
      { estimate_id: "estimate_999" } as DidExtractEventStudyInput,
      pool as never,
      store,
    );
    expect(missing.isError).toBe(true);

    const panelId = seedHandle(store, "panel");
    const wrongType = await executeDidExtractEventStudy(
      { estimate_id: panelId },
      pool as never,
      store,
    );
    expect(wrongType.isError).toBe(true);
    expect(pool.call).not.toHaveBeenCalled();
  });

  it("forwards trimming bounds and registers the event-study handle", async () => {
    const store = createSessionStore("s_test");
    const estimateId = seedHandle(store, "estimate");
    const response: RpcResponse = {
      id: 1,
      result: {
        handle: "event_study_1",
        n: 2,
        betahat: [0.1, 0.2],
        tVec: [-1, 0],
      },
      objectsCreated: [
        {
          id: "event_study_1",
          type: "event_study",
          rClass: "list",
          summary: "event study",
          sizeBytes: 500,
        },
      ],
    };
    const pool = makeStubbedPool(response);

    const res = await executeDidExtractEventStudy(
      { estimate_id: estimateId, min_e: -5, max_e: 5 },
      pool as never,
      store,
    );

    expect(res.isError).toBeFalsy();
    expect(pool.call).toHaveBeenCalledWith("extract_event_study", {
      estimate_id: estimateId,
      handle_id: "event_study_1",
      min_e: -5,
      max_e: 5,
    });
    expect(store.getState().handles.get("event_study_1")?.type).toBe("event_study");
  });
});
