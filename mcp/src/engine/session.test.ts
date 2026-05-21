// ============================================================================
// Unit tests for session handle bookkeeping.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  createSessionStore,
  getSerializableHandleIds,
  markHandlesLost,
  registerHandle,
  reserveHandleId,
  updateHandlesWorkerId,
} from "./session.js";

describe("session handle store", () => {
  it("tracks serializable handles, drops lost handles, and retags workers", () => {
    const store = createSessionStore("s_test");
    const panelId = reserveHandleId(store, "panel");
    registerHandle(
      store,
      {
        id: panelId,
        type: "panel",
        rClass: "data.frame",
        summary: "panel",
        sizeBytes: 100,
      },
      "w_old",
      "seed",
    );
    const ephemeralId = reserveHandleId(store, "plot");
    registerHandle(
      store,
      {
        id: ephemeralId,
        type: "plot",
        rClass: "externalptr",
        summary: "ephemeral plot",
        sizeBytes: 10,
      },
      "w_old",
      "seed",
    );

    expect(getSerializableHandleIds(store)).toEqual([panelId]);

    updateHandlesWorkerId(store, "w_new");
    expect(store.getState().handles.get(panelId)?.workerId).toBe("w_new");
    expect(store.getState().handles.get(ephemeralId)?.workerId).toBe("w_new");

    markHandlesLost(store, [ephemeralId]);
    expect(store.getState().handles.has(panelId)).toBe(true);
    expect(store.getState().handles.has(ephemeralId)).toBe(false);
  });
});
