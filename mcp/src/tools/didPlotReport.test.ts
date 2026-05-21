// ============================================================================
// Unit tests for plotting and report tool wiring.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import {
  createSessionStore,
  registerHandle,
  reserveHandleId,
} from "../engine/session.js";
import { executeDidPlot } from "./didPlot.js";
import { executeDidReport } from "./didReport.js";
import type { HandleType, RpcResponse } from "../types.js";

function makeStubbedPool(response: RpcResponse) {
  return {
    call: vi.fn(async () => response),
    activeWorkerId: "w_test",
    sessionDirPath: "/tmp/test-session",
  };
}

function seedHandle(
  store: ReturnType<typeof createSessionStore>,
  type: HandleType,
  rClass = "list",
) {
  const id = reserveHandleId(store, type);
  registerHandle(
    store,
    { id, type, rClass, summary: type, sizeBytes: 100 },
    "w_test",
    "seed",
  );
  return id;
}

describe("did_plot", () => {
  it("rejects unsupported source handle types before R", async () => {
    const store = createSessionStore("s_test");
    const panelId = seedHandle(store, "panel", "data.frame");
    const pool = makeStubbedPool({ id: 1, result: {} });

    const res = await executeDidPlot(
      { source_id: panelId },
      pool as never,
      store,
    );

    expect(res.isError).toBe(true);
    expect(pool.call).not.toHaveBeenCalled();
  });

  it("registers plot handles for accepted source types", async () => {
    const store = createSessionStore("s_test");
    const esId = seedHandle(store, "event_study");
    const pool = makeStubbedPool({
      id: 1,
      result: { handle: "plot_1", path: "/tmp/plot.png", kind: "event_study" },
      objectsCreated: [
        {
          id: "plot_1",
          type: "plot",
          rClass: "plot_file",
          summary: "plot",
          sizeBytes: 10,
          schema: { path: "/tmp/plot.png" },
        },
      ],
    });

    const res = await executeDidPlot(
      { source_id: esId, title: "Event Study", width: 7 },
      pool as never,
      store,
    );

    expect(res.isError).toBeFalsy();
    expect(pool.call).toHaveBeenCalledWith("plot", {
      source_id: esId,
      handle_id: "plot_1",
      title: "Event Study",
      width: 7,
    });
    expect(store.getState().handles.get("plot_1")?.type).toBe("plot");
  });
});

describe("did_report", () => {
  it("passes the TS handle type map and registers the report handle", async () => {
    const store = createSessionStore("s_test");
    const panelId = seedHandle(store, "panel", "data.frame");
    const estimateId = seedHandle(store, "estimate", "MP");
    const pool = makeStubbedPool({
      id: 1,
      result: { handle: "report_1", path: "/tmp/report.md", preview: "# Report" },
      objectsCreated: [
        {
          id: "report_1",
          type: "report",
          rClass: "report",
          summary: "report",
          sizeBytes: 20,
          schema: { path: "/tmp/report.md" },
        },
      ],
    });

    const res = await executeDidReport(
      { include_ids: [panelId, estimateId] },
      pool as never,
      store,
    );

    expect(res.isError).toBeFalsy();
    expect(pool.call).toHaveBeenCalledWith("report", {
      handle_id: "report_1",
      handle_types: {
        [panelId]: "panel",
        [estimateId]: "estimate",
      },
      include_ids: [panelId, estimateId],
    });
    expect(store.getState().handles.get("report_1")?.type).toBe("report");
  });
});
