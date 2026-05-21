#!/usr/bin/env node
// Real-data validation for did-mcp.
//
// ## Contents
// - [Configuration](#configuration)
// - [MCP client](#mcp-client)
// - [Scenario preparation](#scenario-preparation)
// - [Scenario runners](#scenario-runners)
// - [Reporting](#reporting)
// - [Main](#main)

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  join,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_EXAMPLES_DIR,
  fmt,
  prepareDidExampleDatasets,
} from "../../scripts/did-examples-lib.mjs";

// ## Configuration

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(__dirname, "..");
const SERVER = resolve(MCP_ROOT, "dist", "index.js");
const EXAMPLES_DIR = process.env.DID_EXAMPLES_DIR || DEFAULT_EXAMPLES_DIR;
const OUTPUT_DIR = process.env.DID_MCP_VALIDATION_OUTPUT_DIR ||
  resolve(MCP_ROOT, "validation-output");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const TMP_DIR = join("/tmp", `did-mcp-real-${RUN_ID}`);

const REQUIRED_TOOLS = [
  "did_ping",
  "did_session",
  "did_load_panel",
  "did_check_panel",
  "did_profile_design",
  "did_recode_never_treated",
  "did_plot_rollout",
  "did_diagnose_twfe",
  "did_estimate",
  "did_compare_estimators",
  "did_extract_event_study",
  "did_power_analysis",
  "did_honest_sensitivity",
  "did_plot",
  "did_drdid",
  "did_report",
];

function parseArgs(argv) {
  const opts = {
    examplesDir: EXAMPLES_DIR,
    outputDir: OUTPUT_DIR,
    scenario: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--examples-dir") {
      opts.examplesDir = argv[++i];
    } else if (arg === "--output-dir") {
      opts.outputDir = argv[++i];
    } else if (arg === "--scenario") {
      opts.scenario = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/validate-real-examples.mjs [options]

Options:
  --examples-dir PATH   DID Examples directory (default: DID_EXAMPLES_DIR or ${DEFAULT_EXAMPLES_DIR})
  --output-dir PATH     Report output directory (default: mcp/validation-output)
  --scenario NAME       Run one scenario by slug, e.g. medicaid-insurance
`);
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ## MCP client

class McpClient {
  constructor(name) {
    this.name = name;
    this.proc = null;
    this.buffer = "";
    this.pending = new Map();
    this.nextId = 1;
    this.stderr = "";
  }

  async start() {
    this.proc = spawn("node", [SERVER], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, R_PATH: process.env.R_PATH || "Rscript" },
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.onStdout(chunk));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk) => {
      this.stderr += chunk;
      if (process.env.DID_MCP_VERBOSE) process.stderr.write(chunk);
    });

    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: `real-validation-${this.name}`, version: "0.0.0" },
    });
    this.proc.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }) + "\n");
  }

  onStdout(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const handler = this.pending.get(msg.id);
      if (handler) {
        this.pending.delete(msg.id);
        handler(msg);
      }
    }
  }

  send(method, params, timeoutMs = 180_000) {
    const id = this.nextId++;
    return new Promise((resolveP, rejectP) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectP(new Error(`timeout waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) {
          rejectP(new Error(msg.error.message || "MCP error"));
        } else {
          resolveP(msg.result);
        }
      });
      this.proc.stdin.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }) + "\n");
    });
  }

  async listTools() {
    const listed = await this.send("tools/list", {});
    return listed.tools.map((t) => t.name);
  }

  async callTool(name, args, timeoutMs = 240_000) {
    const result = await this.send("tools/call", {
      name,
      arguments: args,
    }, timeoutMs);
    if (result.isError) {
      throw new Error(result.content?.[0]?.text || `${name} returned isError`);
    }
    return JSON.parse(result.content[0].text);
  }

  close() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
    }
  }
}

// ## Scenario preparation

function prepareScenarioDataset(examplesDir, name) {
  return prepareDidExampleDatasets({
    examplesDir,
    tmpDir: TMP_DIR,
    names: [name],
  })[0];
}

// ## Scenario runners

function makeScenario(name, title, prep, expected, preparationNote) {
  return {
    name,
    title,
    expected,
    preparationNote,
    prep,
    status: "PASS",
    checks: [],
    metrics: {},
    warnings: [],
    errors: [],
    tools: [],
    source: null,
    preparedCsv: null,
  };
}

function addCheck(scenario, name, pass, detail) {
  scenario.checks.push({ name, pass, detail });
  if (!pass) scenario.status = "FAIL";
}

function addMetric(scenario, key, value) {
  scenario.metrics[key] = value;
}

function collectWarnings(scenario, tool, payload) {
  const add = (items, source) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item !== null && item !== undefined && String(item).trim() !== "") {
        scenario.warnings.push({ tool, source, message: String(item) });
      }
    }
  };
  add(payload?.warnings, "tool");
  add(payload?.metadata?.warnings, "metadata");
}

async function requiredTool(scenario, client, name, args) {
  scenario.tools.push(name);
  const payload = await client.callTool(name, args);
  collectWarnings(scenario, name, payload);
  return payload;
}

async function optionalTool(scenario, client, name, args) {
  scenario.tools.push(`${name} (optional)`);
  try {
    const payload = await client.callTool(name, args);
    collectWarnings(scenario, name, payload);
    return payload;
  } catch (e) {
    scenario.warnings.push({
      tool: name,
      source: "optional-error",
      message: e.message,
    });
    return null;
  }
}

function exercisedTools(results) {
  return new Set(results.flatMap((result) =>
    result.tools.map((tool) => tool.replace(/ \(optional\)$/, ""))));
}

async function runStep1Extras(scenario, client, panelId, outcomeVar, title) {
  const recoded = await requiredTool(scenario, client, "did_recode_never_treated", {
    panel_id: panelId,
    target: "zero",
  });
  addCheck(scenario, "never-treated recode creates panel",
    typeof recoded.handle === "string" && recoded.handle.startsWith("panel_"),
    `handle=${recoded.handle}`);

  const rollout = await requiredTool(scenario, client, "did_plot_rollout", {
    panel_id: panelId,
    plot_type: "rollout",
    outcome_var: outcomeVar,
    title,
    width: 9,
    height: 7,
  });
  const plots = Array.isArray(rollout.plots) ? rollout.plots : [];
  const allExist = plots.length > 0 && plots.every((p) => p.path && existsSync(p.path));
  addCheck(scenario, "rollout plot exists", allExist,
    `plots=${plots.map((p) => p.handle).join(",") || "none"}`);
}

async function runEstimatorComparison(scenario, client, panelId, outcomeVar) {
  const cmp = await requiredTool(scenario, client, "did_compare_estimators", {
    panel_id: panelId,
    estimators: ["sa", "did2s"],
    outcome_var: outcomeVar,
    min_e: -5,
    max_e: 5,
    stop_on_error: false,
  });
  const hasSa = Boolean(cmp.envelopes?.sa);
  const hasDid2s = Boolean(cmp.envelopes?.did2s);
  addCheck(scenario, "estimator comparison returns SA and did2s",
    hasSa && hasDid2s,
    `envelopes=${Object.keys(cmp.envelopes || {}).join(",")}`);
  addMetric(scenario, "comparison_rows", Array.isArray(cmp.table) ? cmp.table.length : 0);
}

async function runDrdidProbe(scenario, client, panelId) {
  const dr = await requiredTool(scenario, client, "did_drdid", {
    panel_id: panelId,
    outcome_var: "dins",
    treated_var: "dr_treated_2014",
    time_values: [2013, 2014],
    weights_var: "W",
    boot: false,
  });
  addMetric(scenario, "drdid_att", dr.overall?.att);
  addCheck(scenario, "DRDID two-period probe is finite",
    Number.isFinite(dr.overall?.att),
    `ATT=${fmt(dr.overall?.att)}`);
}

async function runGenericFiveStep(scenario, client, prepared, cfg) {
  const load = await requiredTool(scenario, client, "did_load_panel", prepared.loadArgs);
  addMetric(scenario, "n_obs", load.n_obs);
  addMetric(scenario, "n_units", load.n_units);

  const check = await requiredTool(scenario, client, "did_check_panel", {
    panel_id: load.handle,
  });
  addCheck(scenario, "panel integrity", check.overall_ok === true,
    `overall_ok=${check.overall_ok}`);

  const profile = await requiredTool(scenario, client, "did_profile_design", {
    panel_id: load.handle,
  });
  addMetric(scenario, "profile", `${profile.timing}/${profile.route}`);
  addCheck(scenario, "staggered route",
    profile.timing === "STAGGERED" && profile.route === "STAGGERED",
    `timing=${profile.timing}, route=${profile.route}`);

  await runStep1Extras(scenario, client, load.handle, cfg.outcomeVar, scenario.title);

  const twfe = await requiredTool(scenario, client, "did_diagnose_twfe", {
    panel_id: load.handle,
    outcome_var: cfg.outcomeVar,
  });
  addMetric(scenario, "twfe_severity", twfe.overall_severity);
  addCheck(scenario, cfg.twfeCheckName,
    cfg.twfePass(twfe.overall_severity),
    `severity=${twfe.overall_severity}`);

  const csArgs = {
    panel_id: load.handle,
    estimator: "cs",
    outcome_var: cfg.outcomeVar,
    control_group: cfg.controlGroup || "notyettreated",
    bstrap: false,
    cband: false,
    min_e: -10,
    max_e: 10,
  };
  if (cfg.weightsVar) csArgs.weights_var = cfg.weightsVar;
  const cs = await requiredTool(scenario, client, "did_estimate", csArgs);
  const csAtt = cs.overall?.att;
  addMetric(scenario, "cs_att", csAtt);
  addCheck(scenario, cfg.csCheckName,
    cfg.csPass(cs),
    `ATT=${fmt(csAtt)}, CI=[${fmt(cs.overall?.ci_lower)}, ${fmt(cs.overall?.ci_upper)}]`);

  const did2s = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "did2s",
    outcome_var: cfg.outcomeVar,
    min_e: -10,
    max_e: 10,
  });
  addMetric(scenario, "did2s_att", did2s.overall?.att);
  addCheck(scenario, "finite did2s ATT", Number.isFinite(did2s.overall?.att),
    `ATT=${fmt(did2s.overall?.att)}`);

  const sa = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "sa",
    outcome_var: cfg.outcomeVar,
    min_e: -10,
    max_e: 10,
  });
  addMetric(scenario, "sa_att", sa.overall?.att);

  await runEstimatorComparison(scenario, client, load.handle, cfg.outcomeVar);

  const es = await requiredTool(scenario, client, "did_extract_event_study", {
    estimate_id: sa.handle,
    min_e: -5,
    max_e: 5,
  });
  addMetric(scenario, "event_study_n", es.n);

  const power = await requiredTool(scenario, client, "did_power_analysis", {
    event_study_id: es.handle,
    target_power: [0.5, 0.8],
  });
  addMetric(scenario, "power_handle", power.handle);

  const honest = await requiredTool(scenario, client, "did_honest_sensitivity", {
    event_study_id: es.handle,
    Mbarvec: [0.5, 1],
  });
  addMetric(scenario, "honest_breakdown", honest.breakdown_M ?? honest.breakdown_value);

  const plot = await requiredTool(scenario, client, "did_plot", {
    source_id: es.handle,
  });
  addCheck(scenario, "event-study plot exists",
    Boolean(plot.path && existsSync(plot.path)),
    `path=${plot.path || "missing"}`);

  const report = await requiredTool(scenario, client, "did_report", {});
  addMetric(scenario, "report_path", report.path);
}

async function runMedicaidInsurance(scenario, client, prepared) {
  const load = await requiredTool(scenario, client, "did_load_panel", prepared.loadArgs);
  addMetric(scenario, "n_obs", load.n_obs);
  addMetric(scenario, "n_units", load.n_units);

  const check = await requiredTool(scenario, client, "did_check_panel", {
    panel_id: load.handle,
  });
  addCheck(scenario, "panel integrity", check.overall_ok === true,
    `overall_ok=${check.overall_ok}`);

  const profile = await requiredTool(scenario, client, "did_profile_design", {
    panel_id: load.handle,
  });
  addMetric(scenario, "profile", `${profile.timing}/${profile.route}`);
  addCheck(scenario, "staggered route",
    profile.timing === "STAGGERED" && profile.route === "STAGGERED",
    `timing=${profile.timing}, route=${profile.route}`);

  await runStep1Extras(scenario, client, load.handle, "dins", scenario.title);

  const twfe = await requiredTool(scenario, client, "did_diagnose_twfe", {
    panel_id: load.handle,
    outcome_var: "dins",
  });
  addMetric(scenario, "twfe_severity", twfe.overall_severity);
  addCheck(scenario, "TWFE diagnostics not severe",
    ["MINIMAL", "MILD"].includes(twfe.overall_severity),
    `severity=${twfe.overall_severity}`);

  const cs = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "cs",
    outcome_var: "dins",
    weights_var: "W",
    control_group: "notyettreated",
    bstrap: false,
    cband: false,
    min_e: -8,
    max_e: 5,
  });
  const csAtt = cs.overall?.att;
  addMetric(scenario, "cs_att", csAtt);
  addCheck(scenario, "positive CS ATT near reference range",
    Number.isFinite(csAtt) && csAtt > 0.04 && csAtt < 0.10,
    `ATT=${fmt(csAtt)}`);

  const sa = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "sa",
    outcome_var: "dins",
    weights_var: "W",
    min_e: -8,
    max_e: 5,
  });
  addMetric(scenario, "sa_att", sa.overall?.att);
  addCheck(scenario, "finite SA ATT", Number.isFinite(sa.overall?.att),
    `ATT=${fmt(sa.overall?.att)}`);

  await runEstimatorComparison(scenario, client, load.handle, "dins");
  await runDrdidProbe(scenario, client, load.handle);

  const es = await requiredTool(scenario, client, "did_extract_event_study", {
    estimate_id: sa.handle,
    min_e: -5,
    max_e: 5,
  });
  addMetric(scenario, "event_study_n", es.n);

  const power = await requiredTool(scenario, client, "did_power_analysis", {
    event_study_id: es.handle,
    target_power: [0.5, 0.8],
  });
  addMetric(scenario, "power_handle", power.handle);

  const honest = await requiredTool(scenario, client, "did_honest_sensitivity", {
    event_study_id: es.handle,
    Mbarvec: [0.5, 1],
  });
  addMetric(scenario, "honest_breakdown", honest.breakdown_M ?? honest.breakdown_value);

  const plot = await requiredTool(scenario, client, "did_plot", {
    source_id: es.handle,
  });
  addCheck(scenario, "event-study plot exists",
    Boolean(plot.path && existsSync(plot.path)),
    `path=${plot.path || "missing"}`);

  const report = await requiredTool(scenario, client, "did_report", {});
  addMetric(scenario, "report_path", report.path);
}

async function runTeacherBargaining(scenario, client, prepared) {
  const load = await requiredTool(scenario, client, "did_load_panel", prepared.loadArgs);
  addMetric(scenario, "n_obs", load.n_obs);
  addMetric(scenario, "n_units", load.n_units);

  const check = await requiredTool(scenario, client, "did_check_panel", {
    panel_id: load.handle,
  });
  addCheck(scenario, "panel integrity", check.overall_ok === true,
    `overall_ok=${check.overall_ok}`);

  const profile = await requiredTool(scenario, client, "did_profile_design", {
    panel_id: load.handle,
  });
  addMetric(scenario, "profile", `${profile.timing}/${profile.route}`);
  addCheck(scenario, "staggered route",
    profile.timing === "STAGGERED" && profile.route === "STAGGERED",
    `timing=${profile.timing}, route=${profile.route}`);

  await runStep1Extras(scenario, client, load.handle, "lnppexpend", scenario.title);

  const twfe = await requiredTool(scenario, client, "did_diagnose_twfe", {
    panel_id: load.handle,
    outcome_var: "lnppexpend",
  });
  addMetric(scenario, "twfe_severity", twfe.overall_severity);
  addCheck(scenario, "TWFE diagnostics flag non-minimal risk",
    ["MILD", "MODERATE", "SEVERE"].includes(twfe.overall_severity),
    `severity=${twfe.overall_severity}`);

  const cs = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "cs",
    outcome_var: "lnppexpend",
    control_group: "nevertreated",
    bstrap: false,
    cband: false,
    min_e: -10,
    max_e: 10,
  });
  const csAtt = cs.overall?.att;
  addMetric(scenario, "cs_att", csAtt);
  addCheck(scenario, "CS estimate is qualitatively null",
    Number.isFinite(csAtt) && Math.abs(csAtt) < 0.08,
    `ATT=${fmt(csAtt)}`);
  addCheck(scenario, "CS confidence interval covers zero",
    cs.overall?.ci_lower <= 0 && cs.overall?.ci_upper >= 0,
    `CI=[${fmt(cs.overall?.ci_lower)}, ${fmt(cs.overall?.ci_upper)}]`);

  const did2s = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "did2s",
    outcome_var: "lnppexpend",
    min_e: -10,
    max_e: 10,
  });
  addMetric(scenario, "did2s_att", did2s.overall?.att);
  addCheck(scenario, "did2s estimate is qualitatively null",
    Number.isFinite(did2s.overall?.att) && Math.abs(did2s.overall.att) < 0.08,
    `ATT=${fmt(did2s.overall?.att)}`);

  const sa = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "sa",
    outcome_var: "lnppexpend",
    min_e: -10,
    max_e: 10,
  });
  addMetric(scenario, "sa_att", sa.overall?.att);

  await runEstimatorComparison(scenario, client, load.handle, "lnppexpend");

  const es = await requiredTool(scenario, client, "did_extract_event_study", {
    estimate_id: sa.handle,
    min_e: -5,
    max_e: 5,
  });
  addMetric(scenario, "event_study_n", es.n);

  const power = await requiredTool(scenario, client, "did_power_analysis", {
    event_study_id: es.handle,
    target_power: [0.5, 0.8],
  });
  addMetric(scenario, "power_handle", power.handle);

  const honest = await requiredTool(scenario, client, "did_honest_sensitivity", {
    event_study_id: es.handle,
    Mbarvec: [0.5, 1],
  });
  addMetric(scenario, "honest_breakdown", honest.breakdown_M ?? honest.breakdown_value);

  const report = await requiredTool(scenario, client, "did_report", {});
  addMetric(scenario, "report_path", report.path);
}

async function runBankDeregulation(scenario, client, prepared) {
  const load = await requiredTool(scenario, client, "did_load_panel", prepared.loadArgs);
  addMetric(scenario, "n_obs", load.n_obs);
  addMetric(scenario, "n_units", load.n_units);

  const check = await requiredTool(scenario, client, "did_check_panel", {
    panel_id: load.handle,
  });
  addCheck(scenario, "panel integrity", check.overall_ok === true,
    `overall_ok=${check.overall_ok}`);

  const profile = await requiredTool(scenario, client, "did_profile_design", {
    panel_id: load.handle,
  });
  addMetric(scenario, "profile", `${profile.timing}/${profile.route}`);
  addCheck(scenario, "staggered route",
    profile.timing === "STAGGERED" && profile.route === "STAGGERED",
    `timing=${profile.timing}, route=${profile.route}`);

  await runStep1Extras(scenario, client, load.handle, "log_gini", scenario.title);

  const twfe = await requiredTool(scenario, client, "did_diagnose_twfe", {
    panel_id: load.handle,
    outcome_var: "log_gini",
  });
  addMetric(scenario, "twfe_severity", twfe.overall_severity);
  addCheck(scenario, "TWFE diagnostics flag meaningful risk",
    ["MILD", "MODERATE", "SEVERE"].includes(twfe.overall_severity),
    `severity=${twfe.overall_severity}`);

  const cs = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "cs",
    outcome_var: "log_gini",
    control_group: "notyettreated",
    bstrap: false,
    cband: false,
    min_e: -10,
    max_e: 10,
  });
  addMetric(scenario, "cs_att", cs.overall?.att);
  addCheck(scenario, "finite CS ATT", Number.isFinite(cs.overall?.att),
    `ATT=${fmt(cs.overall?.att)}`);

  const did2s = await requiredTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "did2s",
    outcome_var: "log_gini",
    min_e: -10,
    max_e: 10,
  });
  addMetric(scenario, "did2s_att", did2s.overall?.att);
  addCheck(scenario, "finite did2s ATT", Number.isFinite(did2s.overall?.att),
    `ATT=${fmt(did2s.overall?.att)}`);

  const sa = await optionalTool(scenario, client, "did_estimate", {
    panel_id: load.handle,
    estimator: "sa",
    outcome_var: "log_gini",
    min_e: -10,
    max_e: 10,
  });
  const estimateForEventStudy = sa?.handle || cs.handle;
  if (sa?.overall?.att !== undefined) addMetric(scenario, "sa_att", sa.overall.att);

  await runEstimatorComparison(scenario, client, load.handle, "log_gini");

  const es = await requiredTool(scenario, client, "did_extract_event_study", {
    estimate_id: estimateForEventStudy,
    min_e: -5,
    max_e: 5,
  });
  addMetric(scenario, "event_study_n", es.n);

  const report = await requiredTool(scenario, client, "did_report", {});
  addMetric(scenario, "report_path", report.path);
}

async function runMedicaidMortality(scenario, client, prepared) {
  await runGenericFiveStep(scenario, client, prepared, {
    outcomeVar: "mortality_rate",
    weightsVar: "pop_weight",
    twfeCheckName: "TWFE diagnostics not severe",
    twfePass: (severity) => ["MINIMAL", "MILD"].includes(severity),
    csCheckName: "finite CS ATT",
    csPass: (cs) => Number.isFinite(cs.overall?.att),
  });
}

async function runDivorceLaws(scenario, client, prepared) {
  await runGenericFiveStep(scenario, client, prepared, {
    outcomeVar: "div_rate",
    weightsVar: "stpop",
    twfeCheckName: "TWFE diagnostics flag meaningful risk",
    twfePass: (severity) => ["MILD", "MODERATE", "SEVERE"].includes(severity),
    csCheckName: "finite CS ATT",
    csPass: (cs) => Number.isFinite(cs.overall?.att),
  });
}

async function runSentencingLaws(scenario, client, prepared) {
  await runGenericFiveStep(scenario, client, prepared, {
    outcomeVar: "lnpcrrobgun",
    controlGroup: "nevertreated",
    twfeCheckName: "TWFE diagnostics not severe",
    twfePass: (severity) => ["MINIMAL", "MILD"].includes(severity),
    csCheckName: "negative or near-zero CS ATT",
    csPass: (cs) => Number.isFinite(cs.overall?.att) && cs.overall.att < 0.05,
  });
}

// ## Reporting

function renderMarkdown(results, opts) {
  const lines = [];
  const toolsUsed = exercisedTools(results);
  const missingTools = REQUIRED_TOOLS.filter((tool) => !toolsUsed.has(tool));
  lines.push("# did-mcp Real-Data Validation Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Examples directory: \`${opts.examplesDir}\``);
  lines.push("");
  lines.push("## Compatibility Note");
  lines.push("");
  lines.push("The validation client launches `node dist/index.js` over stdio and uses standard MCP `tools/list` / `tools/call` messages. This exercises generic MCP-client compatibility rather than Claude Code-specific APIs.");
  lines.push("");
  lines.push("## Tool Coverage");
  lines.push("");
  lines.push(`Required tools exercised: ${REQUIRED_TOOLS.length - missingTools.length}/${REQUIRED_TOOLS.length}`);
  if (missingTools.length === 0) {
    lines.push("Missing tools: none");
  } else {
    lines.push(`Missing tools: ${missingTools.map((tool) => `\`${tool}\``).join(", ")}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Scenario | Status | Expected qualitative result | Key metrics |");
  lines.push("|---|---:|---|---|");
  for (const result of results) {
    const metrics = Object.entries(result.metrics)
      .map(([k, v]) => `${k}=${typeof v === "number" ? fmt(v) : v}`)
      .join("; ");
    lines.push(`| ${result.title} | ${result.status} | ${result.expected} | ${metrics || "n/a"} |`);
  }
  lines.push("");

  for (const result of results) {
    lines.push(`## ${result.title}`);
    lines.push("");
    lines.push(`Status: **${result.status}**`);
    lines.push(`Source CSV: \`${result.source}\``);
    lines.push(`Prepared CSV: \`${result.preparedCsv}\``);
    lines.push(`Preparation note: ${result.preparationNote}`);
    lines.push(`Expected: ${result.expected}`);
    lines.push("");
    lines.push("Tools:");
    lines.push(result.tools.length > 0 ? result.tools.map((t) => `- \`${t}\``).join("\n") : "- n/a");
    lines.push("");
    lines.push("Checks:");
    for (const check of result.checks) {
      lines.push(`- ${check.pass ? "PASS" : "FAIL"}: ${check.name} (${check.detail})`);
    }
    if (result.checks.length === 0) lines.push("- n/a");
    lines.push("");
    lines.push("Warnings:");
    if (result.warnings.length === 0) {
      lines.push("- none");
    } else {
      for (const warning of result.warnings.slice(0, 20)) {
        lines.push(`- \`${warning.tool}\` ${warning.source}: ${warning.message}`);
      }
      if (result.warnings.length > 20) {
        lines.push(`- ... ${result.warnings.length - 20} more warnings omitted from markdown; see JSON output.`);
      }
    }
    lines.push("");
    lines.push("Errors:");
    if (result.errors.length === 0) {
      lines.push("- none");
    } else {
      for (const error of result.errors) lines.push(`- ${error}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function writeReports(results, opts) {
  mkdirSync(opts.outputDir, { recursive: true });
  const jsonPath = join(opts.outputDir, `real-datasets-${RUN_ID}.json`);
  const mdPath = join(opts.outputDir, `real-datasets-${RUN_ID}.md`);
  writeFileSync(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    examples_dir: opts.examplesDir,
    temp_dir: TMP_DIR,
    results,
  }, null, 2));
  writeFileSync(mdPath, renderMarkdown(results, opts));
  return { jsonPath, mdPath };
}

// ## Main

async function runScenario(scenario, opts) {
  const client = new McpClient(scenario.name);
  try {
    const prepared = scenario.prep(opts.examplesDir);
    scenario.source = prepared.source;
    scenario.preparedCsv = prepared.path;

    await client.start();
    const tools = await client.listTools();
    for (const tool of REQUIRED_TOOLS) {
      if (!tools.includes(tool)) {
        throw new Error(`required tool missing from tools/list: ${tool}`);
      }
    }
    const ping = await requiredTool(scenario, client, "did_ping", {
      echo: scenario.name,
    });
    addCheck(scenario, "MCP ping", ping.pong === true,
      `pong=${ping.pong}`);

    const status = await requiredTool(scenario, client, "did_session", {
      action: "status",
    });
    addCheck(scenario, "session status available",
      Boolean(status.pool?.activeWorkerId),
      `handles=${status.handleCount ?? 0}`);

    if (scenario.name === "medicaid-insurance") {
      await runMedicaidInsurance(scenario, client, prepared);
    } else if (scenario.name === "medicaid-mortality") {
      await runMedicaidMortality(scenario, client, prepared);
    } else if (scenario.name === "teacher-bargaining") {
      await runTeacherBargaining(scenario, client, prepared);
    } else if (scenario.name === "divorce-laws") {
      await runDivorceLaws(scenario, client, prepared);
    } else if (scenario.name === "sentencing-laws") {
      await runSentencingLaws(scenario, client, prepared);
    } else if (scenario.name === "bank-deregulation") {
      await runBankDeregulation(scenario, client, prepared);
    } else {
      throw new Error(`unknown scenario: ${scenario.name}`);
    }

    const list = await requiredTool(scenario, client, "did_session", {
      action: "list",
    });
    addMetric(scenario, "session_handles", list.handleCount);
  } catch (e) {
    scenario.status = "FAIL";
    scenario.errors.push(e.message);
    if (client.stderr.trim()) {
      scenario.errors.push(`stderr tail: ${client.stderr.trim().slice(-2000)}`);
    }
  } finally {
    client.close();
  }
  return scenario;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!existsSync(SERVER)) {
    throw new Error(`missing built server: ${SERVER}. Run npm run build first.`);
  }
  if (!existsSync(opts.examplesDir)) {
    throw new Error(`examples directory not found: ${opts.examplesDir}`);
  }
  mkdirSync(TMP_DIR, { recursive: true });

  const scenarios = [
    makeScenario(
      "medicaid-insurance",
      "Medicaid Insurance Coverage",
      (examplesDir) => prepareScenarioDataset(examplesDir, "medicaid-insurance"),
      "positive insurance-coverage ATT, minimal/mild TWFE risk",
      "Uses the supplied state-year panel; maps state identifiers, preserves survey weights, and derives absorbing post-expansion treatment from first expansion year.",
    ),
    makeScenario(
      "medicaid-mortality",
      "Medicaid Mortality",
      (examplesDir) => prepareScenarioDataset(examplesDir, "medicaid-mortality"),
      "finite mortality estimates, flat-to-sensitive inference, minimal/mild TWFE risk",
      "Aggregates county mortality to a state-year validation panel with population-weighted mortality rates, matching the MCP's panel scale while preserving expansion timing.",
    ),
    makeScenario(
      "teacher-bargaining",
      "Teacher Collective Bargaining",
      (examplesDir) => prepareScenarioDataset(examplesDir, "teacher-bargaining"),
      "qualitatively null spending effect with non-minimal TWFE risk",
      "Uses the 1959-1990 state-year panel with finite log spending outcomes and absorbing collective-bargaining treatment timing.",
    ),
    makeScenario(
      "divorce-laws",
      "Unilateral Divorce Laws",
      (examplesDir) => prepareScenarioDataset(examplesDir, "divorce-laws"),
      "finite dynamic divorce-rate estimates and meaningful TWFE risk",
      "Uses a balanced 1968-1985 state-year subset, excludes AK and OK, and treats the sentinel never-treated code as missing treatment timing.",
    ),
    makeScenario(
      "sentencing-laws",
      "Sentencing Enhancements",
      (examplesDir) => prepareScenarioDataset(examplesDir, "sentencing-laws"),
      "negative or near-zero gun-robbery ATT with minimal/mild TWFE risk",
      "Uses complete-state rows with finite log gun-robbery outcomes and converts the source adoption year into an absorbing first-treated year.",
    ),
    makeScenario(
      "bank-deregulation",
      "Bank Deregulation",
      (examplesDir) => prepareScenarioDataset(examplesDir, "bank-deregulation"),
      "finite robust estimates and meaningful TWFE risk",
      "Uses a Baker-style 1977-1998 state-year sample with positive Gini outcomes, log-transforms inequality, and treats post-1998 adopters as never treated.",
    ),
  ].filter((s) => !opts.scenario || s.name === opts.scenario);

  if (scenarios.length === 0) {
    throw new Error(`no scenario matched --scenario ${opts.scenario}`);
  }

  const results = [];
  for (const scenario of scenarios) {
    console.log(`\n=== ${scenario.title} ===`);
    const result = await runScenario(scenario, opts);
    results.push(result);
    console.log(`${result.status}: ${scenario.title}`);
    for (const check of result.checks) {
      console.log(`  ${check.pass ? "OK" : "FAIL"} ${check.name}: ${check.detail}`);
    }
    for (const error of result.errors) {
      console.log(`  ERROR ${error}`);
    }
  }

  const paths = writeReports(results, opts);
  console.log(`\nWrote JSON: ${paths.jsonPath}`);
  console.log(`Wrote Markdown: ${paths.mdPath}`);

  const missingTools = REQUIRED_TOOLS.filter((tool) => !exercisedTools(results).has(tool));
  if (missingTools.length > 0) {
    console.log(`FAIL: required tools not exercised: ${missingTools.join(", ")}`);
  }

  if (results.some((r) => r.status !== "PASS") || missingTools.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
