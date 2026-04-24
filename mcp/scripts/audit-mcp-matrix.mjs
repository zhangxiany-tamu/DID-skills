#!/usr/bin/env node
// ============================================================================
// did-mcp — MCP audit matrix
// ============================================================================
// Diagnose-only audit. For each of the 6 DID Examples datasets, exercise every
// one of the 16 did_* tools and record per-cell PASS/FAIL with:
//   - tool status + elapsed_ms
//   - raw warnings from the tool / R worker
//   - numeric benchmark check vs README expectation
//
// Emits:
//   mcp/validation-output/audit-mcp-matrix-<RUN_ID>.md
//   mcp/validation-output/audit-mcp-matrix-<RUN_ID>.json
//
// Does not modify any MCP or skill code.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(__dirname, "..");
const SERVER = resolve(MCP_ROOT, "dist", "index.js");
const DEFAULT_EXAMPLES_DIR = "/Users/xianyangzhang/My Drive/DID Examples";
const EXAMPLES_DIR = process.env.DID_EXAMPLES_DIR || DEFAULT_EXAMPLES_DIR;
const OUTPUT_DIR = process.env.DID_MCP_VALIDATION_OUTPUT_DIR ||
  resolve(MCP_ROOT, "validation-output");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const TMP_DIR = join("/tmp", `did-mcp-audit-${RUN_ID}`);

const TOOLS = [
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

// ## CSV helpers (duplicated from validate-real-examples.mjs intentionally —
// audit is additive, not a modification).

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.some((v) => v !== "")).map((r) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) obj[header[i]] = r[i] ?? "";
    return obj;
  });
}

function readCsv(p) { return parseCsv(readFileSync(p, "utf8")); }

function csvEscape(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(p, rows, cols) {
  const lines = [cols.map(csvEscape).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(","));
  writeFileSync(p, `${lines.join("\n")}\n`);
}

function num(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (s === "" || s.toUpperCase() === "NA" || s === ".") return NaN;
  return Number(s);
}

function uniqueSorted(xs) {
  return [...new Set(xs)].sort((a, b) => String(a).localeCompare(String(b)));
}

function addMappedId(rows, src, tgt) {
  const vs = uniqueSorted(rows.map((r) => r[src]));
  const ids = new Map(vs.map((v, i) => [v, String(i + 1)]));
  for (const r of rows) r[tgt] = ids.get(r[src]);
}

function countBy(rows, fn) {
  const m = new Map();
  for (const r of rows) {
    const k = fn(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function weightedMean(rows, vc, wc) {
  let n = 0;
  let d = 0;
  for (const r of rows) {
    const v = num(r[vc]);
    const w = num(r[wc]);
    if (Number.isFinite(v) && Number.isFinite(w) && w > 0) { n += v * w; d += w; }
  }
  return d > 0 ? n / d : NaN;
}

function fmt(v, dig = 4) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(dig) : "NA";
}

// ## Scenario preparation (one per dataset).
// Each returns { source, path, loadArgs, drdid }.

function prepareMedicaidInsurance() {
  const src = join(EXAMPLES_DIR, "medicaid-insurance", "ehec_data.csv");
  const rows = readCsv(src);
  addMappedId(rows, "stfips", "state_id");
  for (const r of rows) {
    const g = num(r.yexp2);
    const y = num(r.year);
    r.yexp2_clean = Number.isFinite(g) ? String(g) : "";
    r.treat_post = Number.isFinite(g) && y >= g ? "1" : "0";
    r.dr_treated_2014 = g === 2014 ? "1" : "0";
  }
  const out = join(TMP_DIR, "medicaid-insurance.csv");
  writeCsv(out, rows, ["state_id", "stfips", "year", "dins", "yexp2_clean", "treat_post", "dr_treated_2014", "W"]);
  return {
    source: src,
    path: out,
    loadArgs: {
      path: out,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "yexp2_clean",
      treat_var: "treat_post",
      outcome_var: "dins",
    },
    drdid: {
      outcome_var: "dins",
      treated_var: "dr_treated_2014",
      time_values: [2013, 2014],
      weights_var: "W",
    },
  };
}

function prepareMedicaidMortality() {
  const src = join(EXAMPLES_DIR, "medicaid-mortality", "county_mortality_data.csv");
  const excluded = new Set(["10", "11", "25", "36", "50"]);
  const countyRows = readCsv(src).filter((r) => !excluded.has(String(num(r.stfips))) && Number.isFinite(num(r.crude_rate_20_64)));
  const groups = new Map();
  for (const r of countyRows) {
    const k = `${r.stfips}::${r.year}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const rows = [];
  for (const g of groups.values()) {
    const f = g[0];
    const y = num(f.year);
    const ya = num(f.yaca);
    const G = [2014, 2015, 2016, 2019].includes(ya) ? ya : NaN;
    const pop = g.reduce((s, r) => { const v = num(r.population_20_64); return s + (Number.isFinite(v) ? v : 0); }, 0);
    rows.push({
      state_id: String(f.stfips),
      state: f.state,
      year: String(y),
      mortality_rate: String(weightedMean(g, "crude_rate_20_64", "population_20_64")),
      first_treat: Number.isFinite(G) ? String(G) : "",
      treat_post: Number.isFinite(G) && y >= G ? "1" : "0",
      dr_treated_2014: G === 2014 ? "1" : "0",
      pop_weight: String(pop),
    });
  }
  rows.sort((a, b) => Number(a.state_id) - Number(b.state_id) || Number(a.year) - Number(b.year));
  const out = join(TMP_DIR, "medicaid-mortality.csv");
  writeCsv(out, rows, ["state_id", "state", "year", "mortality_rate", "first_treat", "treat_post", "dr_treated_2014", "pop_weight"]);
  return {
    source: src,
    path: out,
    loadArgs: {
      path: out,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "first_treat",
      treat_var: "treat_post",
      outcome_var: "mortality_rate",
    },
    drdid: {
      outcome_var: "mortality_rate",
      treated_var: "dr_treated_2014",
      time_values: [2013, 2014],
      weights_var: "pop_weight",
    },
  };
}

function prepareTeacherBargaining() {
  const src = join(EXAMPLES_DIR, "teacher-bargaining", "paglayan_dataset.csv");
  const rows = readCsv(src).filter((r) => {
    const y = num(r.year);
    return y >= 1959 && y <= 1990 && Number.isFinite(num(r.lnppexpend));
  });
  addMappedId(rows, "State", "state_id");
  // Pick the largest cohort as the drdid treated group (most power).
  const gCounts = countBy(rows, (r) => String(num(r.YearCBrequired)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [k, c] of gCounts.entries()) {
    const G = Number(k);
    if (Number.isFinite(G) && G >= 1960 && G <= 1980 && c > bestCount) { bestG = G; bestCount = c; }
  }
  for (const r of rows) {
    const g = num(r.YearCBrequired);
    const y = num(r.year);
    r.g_clean = Number.isFinite(g) ? String(g) : "";
    r.treat_post = Number.isFinite(g) && y >= g ? "1" : "0";
    r.dr_treated = Number.isFinite(g) && g === bestG ? "1" : "0";
  }
  const out = join(TMP_DIR, "teacher-bargaining.csv");
  writeCsv(out, rows, ["state_id", "State", "year", "lnppexpend", "g_clean", "treat_post", "dr_treated"]);
  const drPre = Number.isFinite(bestG) ? bestG - 1 : 1964;
  const drPost = Number.isFinite(bestG) ? bestG : 1965;
  return {
    source: src,
    path: out,
    loadArgs: {
      path: out,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "g_clean",
      treat_var: "treat_post",
      outcome_var: "lnppexpend",
    },
    drdid: {
      outcome_var: "lnppexpend",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
    },
  };
}

function prepareDivorceLaws() {
  const src = join(EXAMPLES_DIR, "divorce-laws", "divorce_data.csv");
  const raw = readCsv(src).filter((r) => {
    const y = num(r.year);
    return !["AK", "OK"].includes(r.st) && y >= 1968 && y <= 1985 && Number.isFinite(num(r.div_rate));
  });
  const nY = uniqueSorted(raw.map((r) => r.year)).length;
  const c = countBy(raw, (r) => r.st);
  const complete = new Set([...c.entries()].filter(([, n]) => n === nY).map(([s]) => s));
  const rows = raw.filter((r) => complete.has(r.st));
  addMappedId(rows, "st", "state_id");
  // Pick the most common post-1968 reform year as drdid cohort.
  const gCounts = countBy(rows, (r) => String(num(r.lfdivlaw)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [k, cnt] of gCounts.entries()) {
    const G = Number(k);
    if (Number.isFinite(G) && G >= 1969 && G <= 1977 && cnt > bestCount) { bestG = G; bestCount = cnt; }
  }
  for (const r of rows) {
    const g = num(r.lfdivlaw);
    const y = num(r.year);
    r.g_clean = g === 2000 ? "" : String(g);
    r.treat_post = g !== 2000 && y >= g ? "1" : "0";
    r.dr_treated = Number.isFinite(g) && g === bestG ? "1" : "0";
  }
  const out = join(TMP_DIR, "divorce-laws.csv");
  writeCsv(out, rows, ["state_id", "st", "year", "div_rate", "g_clean", "treat_post", "dr_treated", "stpop"]);
  const drPre = Number.isFinite(bestG) ? bestG - 1 : 1968;
  const drPost = Number.isFinite(bestG) ? bestG : 1969;
  return {
    source: src,
    path: out,
    loadArgs: {
      path: out,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "g_clean",
      treat_var: "treat_post",
      outcome_var: "div_rate",
    },
    drdid: {
      outcome_var: "div_rate",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
      weights_var: "stpop",
    },
  };
}

function prepareSentencingLaws() {
  const src = join(EXAMPLES_DIR, "sentencing-laws", "sentencing_data.csv");
  const complete = readCsv(src).filter((r) => Number.isFinite(num(r.lnpcrrobgun)));
  const allYears = uniqueSorted(complete.map((r) => r.year));
  const c = countBy(complete, (r) => r.state_fips);
  const full = new Set([...c.entries()].filter(([, n]) => n === allYears.length).map(([s]) => s));
  const rows = complete.filter((r) => full.has(r.state_fips));
  // Find most common treatment_year cohort post-1975.
  const gCounts = countBy(rows, (r) => String(num(r.treatment_year)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [k, cnt] of gCounts.entries()) {
    const G = Number(k);
    if (Number.isFinite(G) && G > 1970 && cnt > bestCount) { bestG = G; bestCount = cnt; }
  }
  for (const r of rows) {
    const adoption = num(r.treatment_year);
    const y = num(r.year);
    const g = adoption > 0 ? adoption + 1 : NaN;
    r.g_clean = Number.isFinite(g) ? String(g) : "";
    r.treat_absorbing = Number.isFinite(g) && y >= g ? "1" : "0";
    r.dr_treated = Number.isFinite(adoption) && adoption === bestG ? "1" : "0";
  }
  const out = join(TMP_DIR, "sentencing-laws.csv");
  writeCsv(out, rows, ["state_fips", "state_name", "year", "lnpcrrobgun", "g_clean", "treat_absorbing", "dr_treated"]);
  const drPre = Number.isFinite(bestG) ? bestG : 1975;
  const drPost = Number.isFinite(bestG) ? bestG + 1 : 1976;
  return {
    source: src,
    path: out,
    loadArgs: {
      path: out,
      id_var: "state_fips",
      time_var: "year",
      treat_timing_var: "g_clean",
      treat_var: "treat_absorbing",
      outcome_var: "lnpcrrobgun",
    },
    drdid: {
      outcome_var: "lnpcrrobgun",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
    },
  };
}

function prepareBankDeregulation() {
  const src = join(EXAMPLES_DIR, "bank-deregulation", "bank_deregulation_data.csv");
  const raw = readCsv(src);
  const rows = raw.filter((r) => {
    const y = num(r.wrkyr);
    const g = num(r.branch_reform);
    const gini = num(r.gini);
    return y <= 1998 && g > 1976 && Number.isFinite(gini) && gini > 0;
  });
  // For DRDID, pick the earliest in-sample cohort as treated.
  const gCounts = countBy(rows, (r) => String(num(r.branch_reform)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [k, cnt] of gCounts.entries()) {
    const G = Number(k);
    if (Number.isFinite(G) && G > 1976 && G <= 1998 && cnt > bestCount) { bestG = G; bestCount = cnt; }
  }
  for (const r of rows) {
    const g = num(r.branch_reform);
    const y = num(r.wrkyr);
    r.branch_g = g > 1998 ? "0" : String(g);
    r.treat_intra = g <= 1998 && y >= g ? "1" : "0";
    r.log_gini = String(Math.log(num(r.gini)));
    r.dr_treated = Number.isFinite(g) && g === bestG ? "1" : "0";
  }
  const out = join(TMP_DIR, "bank-deregulation.csv");
  writeCsv(out, rows, ["statefip", "state", "wrkyr", "log_gini", "branch_g", "treat_intra", "dr_treated"]);
  const drPre = Number.isFinite(bestG) ? bestG - 1 : 1978;
  const drPost = Number.isFinite(bestG) ? bestG : 1979;
  return {
    source: src,
    path: out,
    loadArgs: {
      path: out,
      id_var: "statefip",
      time_var: "wrkyr",
      treat_timing_var: "branch_g",
      treat_var: "treat_intra",
      outcome_var: "log_gini",
    },
    drdid: {
      outcome_var: "log_gini",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
    },
  };
}

// ## MCP client (stdio)

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
    this.proc.stdout.on("data", (c) => this.onStdout(c));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (c) => {
      this.stderr += c;
      if (process.env.DID_MCP_VERBOSE) process.stderr.write(c);
    });
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: `audit-${this.name}`, version: "0.0.0" },
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
      try { msg = JSON.parse(line); } catch { continue; }
      const h = this.pending.get(msg.id);
      if (h) { this.pending.delete(msg.id); h(msg); }
    }
  }

  send(method, params, timeoutMs = 180_000) {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        rej(new Error(`timeout waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, (msg) => {
        clearTimeout(t);
        if (msg.error) rej(new Error(msg.error.message || "MCP error"));
        else res(msg.result);
      });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async listTools() {
    const l = await this.send("tools/list", {});
    return l.tools.map((t) => t.name);
  }

  async callTool(name, args, timeoutMs = 240_000) {
    const r = await this.send("tools/call", { name, arguments: args }, timeoutMs);
    if (r.isError) {
      const text = r.content?.[0]?.text || `${name} returned isError`;
      const err = new Error(text);
      err.isToolError = true;
      throw err;
    }
    return JSON.parse(r.content[0].text);
  }

  close() {
    if (this.proc && !this.proc.killed) this.proc.kill("SIGTERM");
  }
}

// ## Benchmarks per dataset

const BENCHMARKS = {
  "medicaid-insurance": {
    title: "Medicaid Insurance Coverage",
    hasNeverTreated: true,
    twfeSeverity: ["MINIMAL", "MILD"],
    csControl: "notyettreated",
    csAttRange: [0.04, 0.10],
    csSignCoversZero: false,
    honestBreakdownMustBeFinite: true,
    postAttExpected: "positive",
  },
  "medicaid-mortality": {
    title: "Medicaid Mortality",
    hasNeverTreated: true,
    twfeSeverity: ["MINIMAL", "MILD", "MODERATE"],
    csControl: "notyettreated",
    csAttRange: null, // Sign can flip weighted/unweighted; finite only.
    csSignCoversZero: null,
    honestBreakdownMustBeFinite: false, // May be NA if weights too noisy.
    postAttExpected: "finite",
  },
  "teacher-bargaining": {
    title: "Teacher Collective Bargaining",
    hasNeverTreated: true,
    twfeSeverity: ["MILD", "MODERATE", "SEVERE"],
    csControl: "nevertreated",
    csAttRange: [-0.08, 0.08],
    csSignCoversZero: true,
    honestBreakdownMustBeFinite: false,
    postAttExpected: "null",
  },
  "divorce-laws": {
    title: "Unilateral Divorce Laws",
    hasNeverTreated: true,
    twfeSeverity: ["MILD", "MODERATE", "SEVERE"],
    csControl: "notyettreated",
    csAttRange: null,
    csSignCoversZero: null,
    honestBreakdownMustBeFinite: false,
    postAttExpected: "hump-shaped",
  },
  "sentencing-laws": {
    title: "Sentencing Enhancements",
    hasNeverTreated: true,
    twfeSeverity: ["MINIMAL", "MILD", "MODERATE"],
    csControl: "nevertreated",
    csAttRange: [-0.5, 0.05],
    csSignCoversZero: null,
    honestBreakdownMustBeFinite: false,
    postAttExpected: "negative",
  },
  "bank-deregulation": {
    title: "Bank Deregulation",
    // Prepared sample has 1 unit (Iowa, 1999 adopter) outside the ≤1998 cutoff
    // and coded as never-treated. README says "no never-treated group" for the
    // full panel; our cutoff carves out Iowa. True value is: yes, one unit.
    hasNeverTreated: true,
    twfeSeverity: ["MODERATE", "SEVERE"],
    csControl: "notyettreated",
    csAttRange: null,
    csSignCoversZero: null,
    honestBreakdownMustBeFinite: false,
    postAttExpected: "finite",
  },
};

// ## Audit runner for one dataset

function newCell(tool) {
  return {
    tool,
    status: "PENDING",
    elapsed_ms: 0,
    warnings: [],
    errors: [],
    benchmark: null,
    detail: "",
  };
}

function recordWarnings(cell, payload) {
  const add = (items, src) => {
    if (!Array.isArray(items)) return;
    for (const it of items) {
      if (it !== null && it !== undefined && String(it).trim() !== "") {
        cell.warnings.push({ src, message: String(it) });
      }
    }
  };
  add(payload?.warnings, "tool");
  add(payload?.metadata?.warnings, "metadata");
}

function fail(cell, detail) {
  cell.status = "FAIL";
  cell.detail = detail;
}

function pass(cell, detail) {
  cell.status = "PASS";
  cell.detail = detail;
}

function na(cell, detail) {
  cell.status = "N/A";
  cell.detail = detail;
}

function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function summarizeEstimate(est) {
  const att = est?.overall?.att;
  const ci = [est?.overall?.ci_lower, est?.overall?.ci_upper];
  return `ATT=${fmt(att)}, CI=[${fmt(ci[0])}, ${fmt(ci[1])}]`;
}

async function timed(cell, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    cell.elapsed_ms = Date.now() - t0;
    return { ok: true, value: r };
  } catch (e) {
    cell.elapsed_ms = Date.now() - t0;
    cell.errors.push(e.message);
    return { ok: false, error: e };
  }
}

async function auditDataset(name, prepared, bench) {
  const client = new McpClient(name);
  const cells = Object.fromEntries(TOOLS.map((t) => [t, newCell(t)]));
  const state = {
    panelHandle: null,
    estimateHandles: {}, // estimator -> handle
    eventStudyHandle: null,
    honestHandle: null,
    plotHandles: [],
  };

  try {
    await client.start();
    const listed = await client.listTools();
    for (const t of TOOLS) {
      if (!listed.includes(t)) {
        cells[t].status = "FAIL";
        cells[t].errors.push(`tool not listed in tools/list`);
      }
    }

    // 1. did_ping
    {
      const c = cells.did_ping;
      const r = await timed(c, () => client.callTool("did_ping", { echo: name }));
      if (!r.ok) fail(c, `ping error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        if (r.value?.pong === true) pass(c, `echo=${r.value.echo ?? name}`);
        else fail(c, `pong not true: ${JSON.stringify(r.value)}`);
      }
    }

    // 2. did_session (status)
    {
      const c = cells.did_session;
      const r = await timed(c, () => client.callTool("did_session", { action: "status" }));
      if (!r.ok) fail(c, `session error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        if (r.value?.pool?.activeWorkerId) pass(c, `handles=${r.value.handleCount ?? 0}`);
        else fail(c, `no activeWorkerId: ${JSON.stringify(r.value)}`);
      }
    }

    // 3. did_load_panel
    {
      const c = cells.did_load_panel;
      const r = await timed(c, () => client.callTool("did_load_panel", prepared.loadArgs));
      if (!r.ok) {
        fail(c, `load error: ${r.error.message}`);
      } else {
        recordWarnings(c, r.value);
        if (!r.value?.handle) fail(c, "no handle returned");
        else {
          state.panelHandle = r.value.handle;
          c.benchmark = { n_obs: r.value.n_obs, n_units: r.value.n_units };
          pass(c, `handle=${r.value.handle}, n_obs=${r.value.n_obs}, n_units=${r.value.n_units}`);
        }
      }
    }
    // If panelHandle is null, downstream tool calls will fail gracefully and
    // be recorded as FAIL per-cell (rather than aborting the whole dataset).

    // 4. did_check_panel
    {
      const c = cells.did_check_panel;
      const r = await timed(c, () => client.callTool("did_check_panel", { panel_id: state.panelHandle }));
      if (!r.ok) fail(c, `check error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        c.benchmark = { overall_ok: r.value.overall_ok };
        if (r.value?.overall_ok === true) pass(c, "integrity ok");
        else fail(c, `overall_ok=${r.value.overall_ok}`);
      }
    }

    // 5. did_profile_design
    {
      const c = cells.did_profile_design;
      const r = await timed(c, () => client.callTool("did_profile_design", { panel_id: state.panelHandle }));
      if (!r.ok) fail(c, `profile error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        // MCP returns `never_treated` (count) + `ever_treated` (count) but no
        // boolean has_never_treated flag. We infer it from count > 0. This is
        // a skill UX gap (agents asked to check a boolean but must derive it).
        const nt = r.value?.never_treated;
        const derivedHasNT = typeof nt === "number" ? nt > 0 : null;
        c.benchmark = {
          timing: r.value.timing,
          route: r.value.route,
          never_treated: nt,
          ever_treated: r.value?.ever_treated,
          derivedHasNeverTreated: derivedHasNT,
        };
        const details = [`timing=${r.value.timing}`, `route=${r.value.route}`, `never_treated=${nt}`, `ever_treated=${r.value?.ever_treated}`];
        const timingOk = r.value.timing === "STAGGERED";
        const neverOk = derivedHasNT === bench.hasNeverTreated;
        if (timingOk && neverOk) pass(c, details.join("; "));
        else {
          const why = [];
          if (!timingOk) why.push(`expected STAGGERED, got ${r.value.timing}`);
          if (!neverOk) why.push(`has_never_treated expected ${bench.hasNeverTreated}, derived ${derivedHasNT} from never_treated=${nt}`);
          fail(c, `${details.join("; ")} — ${why.join("; ")}`);
        }
      }
    }

    // 6. did_recode_never_treated
    {
      const c = cells.did_recode_never_treated;
      const r = await timed(c, () => client.callTool("did_recode_never_treated", {
        panel_id: state.panelHandle,
        target: "zero",
      }));
      if (!r.ok) {
        // For bank-deregulation (no never-treated), a principled error is acceptable.
        if (!bench.hasNeverTreated && /no never[- ]treated|nothing to recode/i.test(r.error.message)) {
          pass(c, `no-op as expected: ${r.error.message}`);
        } else {
          fail(c, `recode error: ${r.error.message}`);
        }
      } else {
        recordWarnings(c, r.value);
        if (typeof r.value?.handle === "string" && r.value.handle.startsWith("panel_")) {
          pass(c, `new handle=${r.value.handle}`);
        } else {
          fail(c, `no new panel handle: ${JSON.stringify(r.value)}`);
        }
      }
    }

    // 7. did_plot_rollout
    {
      const c = cells.did_plot_rollout;
      const r = await timed(c, () => client.callTool("did_plot_rollout", {
        panel_id: state.panelHandle,
        plot_type: "rollout",
        outcome_var: prepared.loadArgs.outcome_var,
        title: bench.title,
        width: 9,
        height: 7,
      }));
      if (!r.ok) fail(c, `rollout error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        const plots = Array.isArray(r.value?.plots) ? r.value.plots : [];
        const allExist = plots.length > 0 && plots.every((p) => {
          if (!p.path || !existsSync(p.path)) return false;
          try { return statSync(p.path).size > 0; } catch { return false; }
        });
        if (allExist) {
          state.plotHandles.push(...plots.map((p) => p.handle));
          pass(c, `${plots.length} plots: ${plots.map((p) => p.handle).join(",")}`);
        } else fail(c, `missing plot file(s): ${JSON.stringify(plots)}`);
      }
    }

    // 8. did_diagnose_twfe
    {
      const c = cells.did_diagnose_twfe;
      const r = await timed(c, () => client.callTool("did_diagnose_twfe", {
        panel_id: state.panelHandle,
        outcome_var: prepared.loadArgs.outcome_var,
      }));
      if (!r.ok) fail(c, `twfe error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        c.benchmark = { severity: r.value.overall_severity };
        if (bench.twfeSeverity.includes(r.value.overall_severity)) {
          pass(c, `severity=${r.value.overall_severity} in expected set`);
        } else {
          fail(c, `severity=${r.value.overall_severity} not in expected ${JSON.stringify(bench.twfeSeverity)}`);
        }
      }
    }

    // 9. did_estimate — run all 5 estimators
    const estimators = ["cs", "sa", "bjs", "did2s", "staggered"];
    const estAttempts = [];
    const estResults = {};
    for (const estimator of estimators) {
      const args = {
        panel_id: state.panelHandle,
        estimator,
        outcome_var: prepared.loadArgs.outcome_var,
        min_e: -10,
        max_e: 10,
      };
      if (estimator === "cs") {
        args.control_group = bench.csControl;
        args.bstrap = false;
        args.cband = false;
      }
      const r = await (async () => {
        const t0 = Date.now();
        try {
          const v = await client.callTool("did_estimate", args);
          return { ok: true, value: v, elapsed: Date.now() - t0 };
        } catch (e) {
          return { ok: false, error: e, elapsed: Date.now() - t0 };
        }
      })();
      estAttempts.push({ estimator, ok: r.ok, att: r.ok ? r.value?.overall?.att : null, error: r.ok ? null : r.error.message, handle: r.ok ? r.value?.handle : null, elapsed: r.elapsed, payload: r.ok ? r.value : null });
      if (r.ok) {
        estResults[estimator] = r.value;
        state.estimateHandles[estimator] = r.value.handle;
      }
    }
    {
      const c = cells.did_estimate;
      const totalElapsed = estAttempts.reduce((s, a) => s + a.elapsed, 0);
      c.elapsed_ms = totalElapsed;
      for (const a of estAttempts) {
        if (a.ok && a.payload) recordWarnings(c, a.payload);
        if (!a.ok) c.errors.push(`${a.estimator}: ${a.error}`);
      }
      const okCount = estAttempts.filter((a) => a.ok && isFiniteNum(a.att)).length;
      c.benchmark = {
        attempts: estAttempts.map((a) => ({ estimator: a.estimator, ok: a.ok, att: a.att })),
      };
      const detail = estAttempts.map((a) => `${a.estimator}=${a.ok ? fmt(a.att) : "ERR"}`).join("; ");
      // Bank-deregulation is known-problematic for SA (no never-treated). Allow
      // SA to fail there without marking the cell FAIL iff other estimators succeed.
      const expectedFailures = new Set();
      if (name === "bank-deregulation") expectedFailures.add("sa");
      const unexpectedFailures = estAttempts.filter((a) => !a.ok && !expectedFailures.has(a.estimator));
      if (okCount >= 3 && unexpectedFailures.length === 0) pass(c, `${okCount}/5 estimators ok — ${detail}`);
      else fail(c, `${okCount}/5 estimators ok — ${detail}`);

      // Benchmark check on CS ATT range (per dataset).
      const cs = estResults.cs;
      if (cs && isFiniteNum(cs.overall?.att)) {
        const attPass =
          (bench.csAttRange === null) ||
          (cs.overall.att >= bench.csAttRange[0] && cs.overall.att <= bench.csAttRange[1]);
        const ciCovers = cs.overall.ci_lower <= 0 && cs.overall.ci_upper >= 0;
        const coversOk = bench.csSignCoversZero === null ||
          bench.csSignCoversZero === ciCovers;
        if (!attPass || !coversOk) {
          c.warnings.push({
            src: "benchmark",
            message: `CS ATT benchmark miss: ${summarizeEstimate(cs)}; expected range=${JSON.stringify(bench.csAttRange)}, covers_zero_expected=${bench.csSignCoversZero}`,
          });
          fail(c, `${detail} — CS benchmark miss: ${summarizeEstimate(cs)}`);
        }
      }
    }

    // 10. did_compare_estimators
    {
      const c = cells.did_compare_estimators;
      const cmpArgs = {
        panel_id: state.panelHandle,
        estimators: ["sa", "did2s"],
        outcome_var: prepared.loadArgs.outcome_var,
        min_e: -5,
        max_e: 5,
        stop_on_error: false,
      };
      const r = await timed(c, () => client.callTool("did_compare_estimators", cmpArgs));
      if (!r.ok) fail(c, `compare error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        const envs = Object.keys(r.value?.envelopes || {});
        const rows = Array.isArray(r.value?.table) ? r.value.table.length : 0;
        c.benchmark = { envelopes: envs, rows };
        if (envs.includes("sa") && envs.includes("did2s") && rows > 0) {
          pass(c, `envelopes=${envs.join(",")}, rows=${rows}`);
        } else fail(c, `envelopes=${envs.join(",")}, rows=${rows}`);
      }
    }

    // 11. did_extract_event_study — use SA handle if present, else CS.
    const esSource = state.estimateHandles.sa || state.estimateHandles.cs || state.estimateHandles.bjs;
    {
      const c = cells.did_extract_event_study;
      if (!esSource) { fail(c, "no estimate handle available"); }
      else {
        const r = await timed(c, () => client.callTool("did_extract_event_study", {
          estimate_id: esSource,
          min_e: -5,
          max_e: 5,
        }));
        if (!r.ok) fail(c, `extract error: ${r.error.message}`);
        else {
          recordWarnings(c, r.value);
          state.eventStudyHandle = r.value.handle;
          const n = r.value.n ?? (r.value.tVec?.length ?? 0);
          c.benchmark = { n, source: esSource };
          if (n >= 2) pass(c, `n=${n}`);
          else fail(c, `n=${n} (<2)`);
        }
      }
    }

    // 12. did_power_analysis
    {
      const c = cells.did_power_analysis;
      if (!state.eventStudyHandle) fail(c, "no event_study handle");
      else {
        const r = await timed(c, () => client.callTool("did_power_analysis", {
          event_study_id: state.eventStudyHandle,
          target_power: [0.5, 0.8],
        }));
        if (!r.ok) fail(c, `power error: ${r.error.message}`);
        else {
          recordWarnings(c, r.value);
          const slopes = Array.isArray(r.value?.detectable_slopes) ? r.value.detectable_slopes : [];
          const finite = slopes.filter((s) => isFiniteNum(s.slope)).length;
          c.benchmark = { n_slopes: slopes.length, finite };
          if (slopes.length >= 2 && finite >= 1) pass(c, `${finite}/${slopes.length} finite slopes`);
          else fail(c, `${finite}/${slopes.length} finite slopes`);
        }
      }
    }

    // 13. did_honest_sensitivity
    {
      const c = cells.did_honest_sensitivity;
      if (!state.eventStudyHandle) fail(c, "no event_study handle");
      else {
        // Use a wider Mbar grid so breakdown points for strongly-robust
        // estimates (e.g., medicaid-insurance) are found. Default skill grid
        // of seq(0.5, 2, by=0.5) often returns NA for robust cases.
        const mbarvec = [0.5, 1, 1.5, 2, 3, 4, 5];
        const r = await timed(c, () => client.callTool("did_honest_sensitivity", {
          event_study_id: state.eventStudyHandle,
          Mbarvec: mbarvec,
        }));
        if (!r.ok) fail(c, `honest error: ${r.error.message}`);
        else {
          recordWarnings(c, r.value);
          state.honestHandle = r.value.handle;
          const bd = r.value.breakdown_M ?? r.value.breakdown_value ?? null;
          const robustRows = Array.isArray(r.value.robust) ? r.value.robust.length : 0;
          c.benchmark = { breakdown_M: bd, robust_rows: robustRows, mbarvec };
          const bdIsNull = bd === null || bd === undefined || (typeof bd === "string" && bd === "NA") || (typeof bd === "number" && Number.isNaN(bd));
          if (robustRows === 0) fail(c, `empty robust table; breakdown=${bd}`);
          else if (bench.honestBreakdownMustBeFinite && bdIsNull) {
            fail(c, `breakdown_M=${bd} (expected finite within Mbar=${mbarvec.slice(-1)[0]})`);
          } else {
            const bdText = bdIsNull ? `>${mbarvec.slice(-1)[0]} (robust)` : bd;
            pass(c, `robust_rows=${robustRows}, breakdown_M=${bdText}`);
          }
        }
      }
    }

    // 14. did_plot (event_study)
    {
      const c = cells.did_plot;
      if (!state.eventStudyHandle) fail(c, "no event_study handle");
      else {
        const r = await timed(c, () => client.callTool("did_plot", {
          source_id: state.eventStudyHandle,
        }));
        if (!r.ok) fail(c, `plot error: ${r.error.message}`);
        else {
          recordWarnings(c, r.value);
          const p = r.value?.path;
          const ok = Boolean(p && existsSync(p) && statSync(p).size > 0);
          c.benchmark = { path: p, bytes: ok ? statSync(p).size : 0 };
          if (ok) {
            state.plotHandles.push(r.value.handle);
            pass(c, `path=${p}, bytes=${c.benchmark.bytes}`);
          } else fail(c, `plot file missing or empty: ${p}`);
        }
      }
    }

    // 15. did_drdid
    {
      const c = cells.did_drdid;
      const drArgs = {
        panel_id: state.panelHandle,
        ...prepared.drdid,
        boot: false,
      };
      const r = await timed(c, () => client.callTool("did_drdid", drArgs));
      if (!r.ok) {
        // bank-deregulation may legitimately fail (no valid two-period slice
        // with a never-treated comparison group).
        if (!bench.hasNeverTreated) {
          na(c, `no-never-treated slice not applicable: ${r.error.message}`);
        } else {
          fail(c, `drdid error: ${r.error.message}`);
        }
      } else {
        recordWarnings(c, r.value);
        const att = r.value?.overall?.att;
        const se = r.value?.overall?.se;
        c.benchmark = { att, se };
        if (isFiniteNum(att) && isFiniteNum(se) && se > 0) pass(c, `ATT=${fmt(att)}, SE=${fmt(se)}`);
        else fail(c, `bad drdid result: ATT=${fmt(att)}, SE=${fmt(se)}`);
      }
    }

    // 16. did_report
    {
      const c = cells.did_report;
      const r = await timed(c, () => client.callTool("did_report", {}));
      if (!r.ok) fail(c, `report error: ${r.error.message}`);
      else {
        recordWarnings(c, r.value);
        const p = r.value?.path;
        const preview = r.value?.preview ?? "";
        c.benchmark = { path: p, preview_length: preview.length };
        const exists = Boolean(p && existsSync(p));
        if (exists && preview.length > 0) pass(c, `path=${p}, preview_len=${preview.length}`);
        else fail(c, `report missing or empty: path=${p}, preview_len=${preview.length}`);
      }
    }

    // Final: did_session list (side-effect)
    try {
      const list = await client.callTool("did_session", { action: "list" });
      cells.did_session.benchmark = {
        ...(cells.did_session.benchmark || {}),
        final_handles: list?.handleCount ?? null,
      };
    } catch (e) {
      cells.did_session.warnings.push({ src: "list", message: e.message });
    }
  } finally {
    client.close();
  }
  return {
    name,
    title: bench.title,
    source: prepared.source,
    preparedCsv: prepared.path,
    cells,
  };
}

// ## Reporting

function renderMarkdown(results) {
  const lines = [];
  lines.push("# did-mcp 16-tool × 6-dataset Audit Matrix");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Examples: \`${EXAMPLES_DIR}\``);
  lines.push(`Temp CSVs: \`${TMP_DIR}\``);
  lines.push("");
  lines.push("## Matrix");
  lines.push("");
  // Header row: tools across the top.
  const header = ["Dataset", ...TOOLS.map((t) => t.replace(/^did_/, ""))];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);
  for (const r of results) {
    const row = [r.title, ...TOOLS.map((t) => {
      const c = r.cells[t];
      if (!c) return "—";
      if (c.status === "PASS") return "✅";
      if (c.status === "FAIL") return "❌";
      if (c.status === "N/A") return "➖";
      return "·";
    })];
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");

  // Benchmark tie-out table
  lines.push("## Benchmark Tie-out (CS ATT per dataset)");
  lines.push("");
  lines.push("| Dataset | TWFE severity | CS ATT | CS CI | Expected range | Honest breakdown_M |");
  lines.push("|---|---|---:|---|---|---:|");
  for (const r of results) {
    const tw = r.cells.did_diagnose_twfe?.benchmark?.severity ?? "n/a";
    const est = r.cells.did_estimate?.benchmark?.attempts?.find((a) => a.estimator === "cs");
    const att = est ? fmt(est.att) : "n/a";
    const bench = BENCHMARKS[r.name];
    const expected = bench.csAttRange ? `[${bench.csAttRange[0]}, ${bench.csAttRange[1]}]` : "—";
    const bd = r.cells.did_honest_sensitivity?.benchmark?.breakdown_M ?? "n/a";
    lines.push(`| ${r.title} | ${tw} | ${att} | — | ${expected} | ${bd} |`);
  }
  lines.push("");

  // Per-dataset detail.
  for (const r of results) {
    lines.push(`## ${r.title}`);
    lines.push("");
    lines.push(`Source: \`${r.source}\``);
    lines.push(`Prepared: \`${r.preparedCsv}\``);
    lines.push("");
    lines.push("| Tool | Status | Elapsed (ms) | Detail |");
    lines.push("|---|---|---:|---|");
    for (const t of TOOLS) {
      const c = r.cells[t];
      lines.push(`| \`${t}\` | ${c.status} | ${c.elapsed_ms} | ${c.detail.replace(/\|/g, "\\|")} |`);
    }
    lines.push("");
    // Errors per tool
    const errCount = TOOLS.reduce((s, t) => s + r.cells[t].errors.length, 0);
    if (errCount > 0) {
      lines.push("### Errors");
      for (const t of TOOLS) {
        const errs = r.cells[t].errors;
        if (errs.length === 0) continue;
        for (const e of errs) lines.push(`- \`${t}\`: ${e}`);
      }
      lines.push("");
    }
    // Warnings (deduplicated + truncated)
    const warnAgg = new Map();
    for (const t of TOOLS) {
      for (const w of r.cells[t].warnings) {
        const k = `${t}::${w.src}::${w.message.slice(0, 200)}`;
        if (!warnAgg.has(k)) warnAgg.set(k, { tool: t, ...w, count: 0 });
        warnAgg.get(k).count += 1;
      }
    }
    if (warnAgg.size > 0) {
      lines.push("### Warnings");
      const arr = [...warnAgg.values()];
      arr.sort((a, b) => b.count - a.count);
      for (const w of arr.slice(0, 30)) {
        lines.push(`- \`${w.tool}\` (${w.src}, x${w.count}): ${String(w.message).slice(0, 300)}`);
      }
      if (arr.length > 30) lines.push(`- ... ${arr.length - 30} more warnings omitted`);
      lines.push("");
    }
  }

  // Escalated warnings list.
  const escalated = [];
  const patterns = [/\bNA[ _-]?breakdown\b/i, /singular/i, /not positive semi-definite/i, /rank.?deficient/i, /deprecated/i, /NaN/, /failed/i];
  for (const r of results) {
    for (const t of TOOLS) {
      for (const w of r.cells[t].warnings) {
        if (patterns.some((p) => p.test(w.message))) {
          escalated.push({ dataset: r.title, tool: t, message: w.message });
        }
      }
    }
  }
  if (escalated.length > 0) {
    lines.push("## Escalated Warnings (potential bugs)");
    lines.push("");
    const dedup = new Map();
    for (const e of escalated) {
      const k = `${e.dataset}::${e.tool}::${e.message.slice(0, 200)}`;
      if (!dedup.has(k)) dedup.set(k, { ...e, count: 0 });
      dedup.get(k).count += 1;
    }
    for (const e of dedup.values()) {
      lines.push(`- **${e.dataset}** / \`${e.tool}\` (x${e.count}): ${String(e.message).slice(0, 400)}`);
    }
    lines.push("");
  }

  // Summary
  const counts = { PASS: 0, FAIL: 0, "N/A": 0, PENDING: 0 };
  for (const r of results) for (const t of TOOLS) counts[r.cells[t].status] = (counts[r.cells[t].status] || 0) + 1;
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total cells: ${results.length * TOOLS.length}`);
  lines.push(`- PASS: ${counts.PASS}`);
  lines.push(`- FAIL: ${counts.FAIL}`);
  lines.push(`- N/A: ${counts["N/A"]}`);
  lines.push(`- PENDING/Unknown: ${counts.PENDING}`);
  lines.push("");

  return lines.join("\n") + "\n";
}

// ## Main

async function main() {
  if (!existsSync(SERVER)) throw new Error(`missing built server: ${SERVER}. Run npm run build first.`);
  if (!existsSync(EXAMPLES_DIR)) throw new Error(`examples dir not found: ${EXAMPLES_DIR}`);
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const scenarios = [
    ["medicaid-insurance", prepareMedicaidInsurance],
    ["medicaid-mortality", prepareMedicaidMortality],
    ["teacher-bargaining", prepareTeacherBargaining],
    ["divorce-laws", prepareDivorceLaws],
    ["sentencing-laws", prepareSentencingLaws],
    ["bank-deregulation", prepareBankDeregulation],
  ];

  const results = [];
  for (const [name, prep] of scenarios) {
    console.log(`\n=== ${name} ===`);
    let prepared;
    try {
      prepared = prep();
    } catch (e) {
      console.log(`PREP FAIL: ${e.message}`);
      continue;
    }
    const bench = BENCHMARKS[name];
    const result = await auditDataset(name, prepared, bench);
    results.push(result);
    for (const t of TOOLS) {
      const c = result.cells[t];
      console.log(`  [${c.status.padEnd(4)}] ${t}: ${c.detail || c.errors.join("; ")}`);
    }
  }

  const md = renderMarkdown(results);
  const mdPath = join(OUTPUT_DIR, `audit-mcp-matrix-${RUN_ID}.md`);
  const jsonPath = join(OUTPUT_DIR, `audit-mcp-matrix-${RUN_ID}.json`);
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    examples_dir: EXAMPLES_DIR,
    tmp_dir: TMP_DIR,
    benchmarks: BENCHMARKS,
    results,
  }, null, 2));
  console.log(`\nMarkdown: ${mdPath}`);
  console.log(`JSON:     ${jsonPath}`);
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
