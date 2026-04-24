// ============================================================================
// did-mcp — MCP Server
// ============================================================================
// Exposes DID workflow tools to Claude Code (or any MCP client) over stdio.
// Phases 1-6 shipped: session/ping, Step 1 loading/checking/profiling/
// recoding/rollout, Step 2 TWFE diagnostics, Step 3 estimators/comparison/
// event-study extraction, Step 4 power, Step 5 sensitivity, and Step 6
// plotting/DRDID/reports. See mcp/README.md.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { WorkerPool } from "./engine/workerPool.js";
import { createSessionStore } from "./engine/session.js";
import type { DidToolResult } from "./types.js";
import { randomBytes } from "node:crypto";

import {
  DID_PING_SCHEMA,
  executeDidPing,
  type DidPingInput,
} from "./tools/didPing.js";
import {
  DID_SESSION_SCHEMA,
  executeDidSession,
  type DidSessionInput,
} from "./tools/didSession.js";
import {
  DID_LOAD_PANEL_SCHEMA,
  executeDidLoadPanel,
  type DidLoadPanelInput,
} from "./tools/didLoadPanel.js";
import {
  DID_CHECK_PANEL_SCHEMA,
  executeDidCheckPanel,
  type DidCheckPanelInput,
} from "./tools/didCheckPanel.js";
import {
  DID_PROFILE_DESIGN_SCHEMA,
  executeDidProfileDesign,
  type DidProfileDesignInput,
} from "./tools/didProfileDesign.js";
import {
  DID_RECODE_NEVER_TREATED_SCHEMA,
  executeDidRecodeNeverTreated,
  type DidRecodeNeverTreatedInput,
} from "./tools/didRecodeNeverTreated.js";
import {
  DID_PLOT_ROLLOUT_SCHEMA,
  executeDidPlotRollout,
  type DidPlotRolloutInput,
} from "./tools/didPlotRollout.js";
import {
  DID_ESTIMATE_SCHEMA,
  executeDidEstimate,
  type DidEstimateInput,
} from "./tools/didEstimate.js";
import {
  DID_COMPARE_ESTIMATORS_SCHEMA,
  executeDidCompareEstimators,
  type DidCompareEstimatorsInput,
} from "./tools/didCompareEstimators.js";
import {
  DID_EXTRACT_EVENT_STUDY_SCHEMA,
  executeDidExtractEventStudy,
  type DidExtractEventStudyInput,
} from "./tools/didExtractEventStudy.js";
import {
  DID_HONEST_SENSITIVITY_SCHEMA,
  executeDidHonestSensitivity,
  type DidHonestSensitivityInput,
} from "./tools/didHonestSensitivity.js";
import {
  DID_POWER_ANALYSIS_SCHEMA,
  executeDidPowerAnalysis,
  type DidPowerAnalysisInput,
} from "./tools/didPowerAnalysis.js";
import {
  DID_DIAGNOSE_TWFE_SCHEMA,
  executeDidDiagnoseTwfe,
  type DidDiagnoseTwfeInput,
} from "./tools/didDiagnoseTwfe.js";
import {
  DID_PLOT_SCHEMA,
  executeDidPlot,
  type DidPlotInput,
} from "./tools/didPlot.js";
import {
  DID_DRDID_SCHEMA,
  executeDidDrdid,
  type DidDrdidInput,
} from "./tools/didDrdid.js";
import {
  DID_REPORT_SCHEMA,
  executeDidReport,
  type DidReportInput,
} from "./tools/didReport.js";

export type ServerConfig = {
  rPath?: string;
  recycleAfterCalls?: number;
};

export async function createDidMcpServer(
  config: ServerConfig,
): Promise<{ server: Server; cleanup: () => Promise<void> }> {
  const sessionId = "s_" + randomBytes(6).toString("hex");
  const sessionStore = createSessionStore(sessionId);

  const poolConfig: Record<string, unknown> = {};
  if (config.rPath) poolConfig.rPath = config.rPath;
  // Explicit undefined-check so a valid value of 0 (recycle after every call,
  // useful for integration testing) is not silently dropped as falsy.
  if (config.recycleAfterCalls !== undefined) {
    poolConfig.recycleAfterCalls = config.recycleAfterCalls;
  }

  const workerPool = new WorkerPool(sessionStore, poolConfig);
  await workerPool.start();

  const server = new Server(
    { name: "did-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  // ---- tools/list ----------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "did_ping",
        description:
          "Smoke test for the DID MCP server. Round-trips a message through the R bridge and returns R version, jsonlite version, and an echo of the input. Use this to verify the server and R bridge are wired correctly.",
        inputSchema: DID_PING_SCHEMA,
      },
      {
        name: "did_session",
        description:
          "Inspect or manage the active DID analysis session. Actions: 'list' (all handles), 'inspect' (one handle by id), 'drop' (free both the R-side object AND remove the TypeScript handle, so the memory is reclaimed), 'status' (worker pool state). Handles are the outputs of other did_* tools (panel_1, estimate_1, etc.).",
        inputSchema: DID_SESSION_SCHEMA,
      },
      {
        name: "did_load_panel",
        description:
          "Step 1: load a CSV or Parquet panel and register it as a `panel` handle. Caller supplies id_var, time_var, treat_timing_var (required) and optional treat_var (for reversal detection) and outcome_var (for plots). Parquet requires the R `arrow` package.",
        inputSchema: DID_LOAD_PANEL_SCHEMA,
      },
      {
        name: "did_check_panel",
        description:
          "Step 1: run six panel integrity checks on a `panel` handle — uniqueness, treatment-timing consistency, balance, sentinel values, already-treated-before-sample, and future-treatment. Returns a structured report with overall_ok flag.",
        inputSchema: DID_CHECK_PANEL_SCHEMA,
      },
      {
        name: "did_profile_design",
        description:
          "Step 1: classify panel design as NO_TREATMENT / CANONICAL / STAGGERED and recommend a route (NONE / CANONICAL / STAGGERED / ADVANCED). Returns a `design_profile` handle plus the 10-field structured profile (timing, route, cohorts, balance, absorbing, etc.).",
        inputSchema: DID_PROFILE_DESIGN_SCHEMA,
      },
      {
        name: "did_recode_never_treated",
        description:
          "Step 1: convert never-treated coding between conventions (zero / na / inf / max_plus_10) to match a target estimator (CS / SA / staggered / BJS). Returns a new `panel` handle; the source is unchanged.",
        inputSchema: DID_RECODE_NEVER_TREATED_SCHEMA,
      },
      {
        name: "did_plot_rollout",
        description:
          "Step 1: render panelView treatment-rollout heatmap and/or outcome trajectories to PNG. plot_type in {rollout, outcome, both}. Returns `plot` handle(s) whose schema carries the PNG path on disk.",
        inputSchema: DID_PLOT_ROLLOUT_SCHEMA,
      },
      {
        name: "did_estimate",
        description:
          "Step 3: run one of five heterogeneity-robust estimators on a panel. estimator in {cs, sa, bjs, did2s, staggered}. Never-treated coding is auto-converted per estimator. Returns a standardized envelope (overall ATT + event study + metadata) and registers an `estimate` handle.",
        inputSchema: DID_ESTIMATE_SCHEMA,
      },
      {
        name: "did_compare_estimators",
        description:
          "Step 3: run several Step 3 estimators on the same panel and return parallel standardized envelopes plus a wide comparison table keyed on event_time. Each estimator produces its own `estimate` handle.",
        inputSchema: DID_COMPARE_ESTIMATORS_SCHEMA,
      },
      {
        name: "did_extract_event_study",
        description:
          "Step 3: given an `estimate` handle (MP / fixest / did_imputation / staggered_combined), return canonical {betahat, sigma, tVec} and register an `event_study` handle for downstream HonestDiD / pretrends tools.",
        inputSchema: DID_EXTRACT_EVENT_STUDY_SCHEMA,
      },
      {
        name: "did_honest_sensitivity",
        description:
          "Step 5: HonestDiD robust sensitivity analysis. Takes an `event_study` handle; returns robust confidence intervals under relative-magnitude (default) or smoothness restrictions on pre-trend violations, plus the original (non-robust) CI and the breakdown M. Registers an `honest_result` handle.",
        inputSchema: DID_HONEST_SENSITIVITY_SCHEMA,
      },
      {
        name: "did_power_analysis",
        description:
          "Step 4: pretrends power analysis. Takes an `event_study` handle; returns the linear pre-trend slope detectable at each target power (default 0.5 and 0.8) via pretrends::slope_for_power. Optionally runs pretrends() if `deltatrue` is supplied. Registers a `power_result` handle.",
        inputSchema: DID_POWER_ANALYSIS_SCHEMA,
      },
      {
        name: "did_diagnose_twfe",
        description:
          "Step 2: diagnose TWFE bias under staggered adoption. Runs Goodman-Bacon decomposition (bacondecomp::bacon) and de Chaisemartin-D'Haultfoeuille weights (TwoWayFEWeights::twowayfeweights) on a panel; returns per-diagnostic severity bands (MINIMAL/MILD/MODERATE/SEVERE), an overall severity, and an action recommendation. Auto-synthesizes a binary treatment indicator from the panel's treat_timing_var when needed. Bacon is skipped on unbalanced or very large panels with a warning. Registers a `twfe_diagnostic` handle.",
        inputSchema: DID_DIAGNOSE_TWFE_SCHEMA,
      },
      {
        name: "did_plot",
        description:
          "Render an event-study plot (from an `event_study` handle: point estimates with 95% CI) or a HonestDiD sensitivity plot (from an `honest_result` handle: robust CIs vs M with the original CI as backdrop). Auto-detects which plot kind to draw from the source handle's type. Writes PNG to disk; registers a `plot` handle whose schema carries the file path.",
        inputSchema: DID_PLOT_SCHEMA,
      },
      {
        name: "did_drdid",
        description:
          "Standalone doubly-robust DiD (DRDID::drdid) for a two-period panel slice with explicit covariates. Complements did_estimate: use when you have exactly one pre/post pair and want doubly-robust inference without the full Callaway-Sant'Anna machinery. Registers an `estimate` handle.",
        inputSchema: DID_DRDID_SCHEMA,
      },
      {
        name: "did_report",
        description:
          "Generate a markdown narrative report covering every step present in the current session: panel + design profile (Step 1), TWFE diagnostics (Step 2), estimates and event studies (Step 3), power analysis (Step 4), and HonestDiD sensitivity (Step 5). Writes the .md to disk; registers a `report` handle whose schema carries the file path.",
        inputSchema: DID_REPORT_SCHEMA,
      },
    ],
  }));

  // ---- tools/call ----------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    let result: DidToolResult;

    switch (name) {
      case "did_ping":
        result = await executeDidPing(
          args as unknown as DidPingInput,
          workerPool,
        );
        break;

      case "did_session":
        result = await executeDidSession(
          args as unknown as DidSessionInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_load_panel":
        result = await executeDidLoadPanel(
          args as unknown as DidLoadPanelInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_check_panel":
        result = await executeDidCheckPanel(
          args as unknown as DidCheckPanelInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_profile_design":
        result = await executeDidProfileDesign(
          args as unknown as DidProfileDesignInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_recode_never_treated":
        result = await executeDidRecodeNeverTreated(
          args as unknown as DidRecodeNeverTreatedInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_plot_rollout":
        result = await executeDidPlotRollout(
          args as unknown as DidPlotRolloutInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_estimate":
        result = await executeDidEstimate(
          args as unknown as DidEstimateInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_compare_estimators":
        result = await executeDidCompareEstimators(
          args as unknown as DidCompareEstimatorsInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_extract_event_study":
        result = await executeDidExtractEventStudy(
          args as unknown as DidExtractEventStudyInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_honest_sensitivity":
        result = await executeDidHonestSensitivity(
          args as unknown as DidHonestSensitivityInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_power_analysis":
        result = await executeDidPowerAnalysis(
          args as unknown as DidPowerAnalysisInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_diagnose_twfe":
        result = await executeDidDiagnoseTwfe(
          args as unknown as DidDiagnoseTwfeInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_plot":
        result = await executeDidPlot(
          args as unknown as DidPlotInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_drdid":
        result = await executeDidDrdid(
          args as unknown as DidDrdidInput,
          workerPool,
          sessionStore,
        );
        break;

      case "did_report":
        result = await executeDidReport(
          args as unknown as DidReportInput,
          workerPool,
          sessionStore,
        );
        break;

      default:
        result = {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: true,
                message: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }

    return result;
  });

  const cleanup = async () => {
    await workerPool.stop();
  };

  return { server, cleanup };
}

export async function startServer(config: ServerConfig): Promise<void> {
  const { server, cleanup } = await createDidMcpServer(config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });
}
