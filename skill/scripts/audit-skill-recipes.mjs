#!/usr/bin/env node
// ============================================================================
// did-analysis skill — 5-step fallback recipe audit (Node driver)
// ============================================================================
// 1. Prepare the same 6 CSVs the MCP audit uses (replicated prep logic).
// 2. Write a config JSON consumed by audit-skill-recipes.R.
// 3. Invoke Rscript to run the fallback recipes.
// 4. Read per-dataset JSON, score against README benchmarks, emit matrix.
//
// Emits:
//   skill/validation-output/audit-skill-recipes-<RUN_ID>.md
//   skill/validation-output/audit-skill-recipes-<RUN_ID>.json
//
// This tests the code-gen fallback path of the skill — the R recipes
// documented in skill/references/did-step-{1..5}-*.md — independent of MCP.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const DEFAULT_EXAMPLES_DIR = "/Users/xianyangzhang/My Drive/DID Examples";
const EXAMPLES_DIR = process.env.DID_EXAMPLES_DIR || DEFAULT_EXAMPLES_DIR;
const OUTPUT_DIR = process.env.DID_SKILL_VALIDATION_OUTPUT_DIR ||
  resolve(SKILL_ROOT, "validation-output");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const TMP_DIR = join("/tmp", `did-skill-audit-${RUN_ID}`);
const R_SCRIPT = resolve(__dirname, "audit-skill-recipes.R");

// Copy of CSV helpers from MCP audit. Intentionally replicated — keeps this
// script independent.

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
  for (const r of rows) { const k = fn(r); m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
function weightedMean(rows, vc, wc) {
  let n = 0; let d = 0;
  for (const r of rows) {
    const v = num(r[vc]); const w = num(r[wc]);
    if (Number.isFinite(v) && Number.isFinite(w) && w > 0) { n += v * w; d += w; }
  }
  return d > 0 ? n / d : NaN;
}
function fmt(v, dig = 4) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(dig) : "NA";
}

// Per-dataset prep + skill-recipe config.
function prepareAll() {
  const prepared = [];

  // medicaid-insurance
  {
    const src = join(EXAMPLES_DIR, "medicaid-insurance", "ehec_data.csv");
    const rows = readCsv(src);
    addMappedId(rows, "stfips", "state_id");
    for (const r of rows) {
      const g = num(r.yexp2); const y = num(r.year);
      r.yexp2_clean = Number.isFinite(g) ? String(g) : "";
      r.treat_post = Number.isFinite(g) && y >= g ? "1" : "0";
    }
    const out = join(TMP_DIR, "medicaid-insurance.csv");
    writeCsv(out, rows, ["state_id", "stfips", "year", "dins", "yexp2_clean", "treat_post", "W"]);
    prepared.push({
      name: "medicaid-insurance",
      title: "Medicaid Insurance Coverage",
      csv: out,
      id_var: "state_id",
      time_var: "year",
      gname_var: "yexp2_clean",
      treat_post_var: "treat_post",
      outcome_var: "dins",
      control_group: "notyettreated",
      weights_var: "W",
      has_never_treated: true,
    });
  }

  // medicaid-mortality
  {
    const src = join(EXAMPLES_DIR, "medicaid-mortality", "county_mortality_data.csv");
    const excluded = new Set(["10", "11", "25", "36", "50"]);
    const cr = readCsv(src).filter((r) => !excluded.has(String(num(r.stfips))) && Number.isFinite(num(r.crude_rate_20_64)));
    const groups = new Map();
    for (const r of cr) {
      const k = `${r.stfips}::${r.year}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const rows = [];
    for (const g of groups.values()) {
      const f = g[0]; const y = num(f.year); const ya = num(f.yaca);
      const G = [2014, 2015, 2016, 2019].includes(ya) ? ya : NaN;
      const pop = g.reduce((s, r) => { const v = num(r.population_20_64); return s + (Number.isFinite(v) ? v : 0); }, 0);
      rows.push({
        state_id: String(f.stfips),
        state: f.state,
        year: String(y),
        mortality_rate: String(weightedMean(g, "crude_rate_20_64", "population_20_64")),
        first_treat: Number.isFinite(G) ? String(G) : "",
        treat_post: Number.isFinite(G) && y >= G ? "1" : "0",
        pop_weight: String(pop),
      });
    }
    rows.sort((a, b) => Number(a.state_id) - Number(b.state_id) || Number(a.year) - Number(b.year));
    const out = join(TMP_DIR, "medicaid-mortality.csv");
    writeCsv(out, rows, ["state_id", "state", "year", "mortality_rate", "first_treat", "treat_post", "pop_weight"]);
    prepared.push({
      name: "medicaid-mortality",
      title: "Medicaid Mortality",
      csv: out,
      id_var: "state_id",
      time_var: "year",
      gname_var: "first_treat",
      treat_post_var: "treat_post",
      outcome_var: "mortality_rate",
      control_group: "notyettreated",
      weights_var: "pop_weight",
      has_never_treated: true,
    });
  }

  // teacher-bargaining
  {
    const src = join(EXAMPLES_DIR, "teacher-bargaining", "paglayan_dataset.csv");
    const rows = readCsv(src).filter((r) => {
      const y = num(r.year);
      return y >= 1959 && y <= 1990 && Number.isFinite(num(r.lnppexpend));
    });
    addMappedId(rows, "State", "state_id");
    for (const r of rows) {
      const g = num(r.YearCBrequired); const y = num(r.year);
      r.g_clean = Number.isFinite(g) ? String(g) : "";
      r.treat_post = Number.isFinite(g) && y >= g ? "1" : "0";
    }
    const out = join(TMP_DIR, "teacher-bargaining.csv");
    writeCsv(out, rows, ["state_id", "State", "year", "lnppexpend", "g_clean", "treat_post"]);
    prepared.push({
      name: "teacher-bargaining",
      title: "Teacher Collective Bargaining",
      csv: out,
      id_var: "state_id",
      time_var: "year",
      gname_var: "g_clean",
      treat_post_var: "treat_post",
      outcome_var: "lnppexpend",
      control_group: "nevertreated",
      weights_var: "",
      has_never_treated: true,
    });
  }

  // divorce-laws
  {
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
    for (const r of rows) {
      const g = num(r.lfdivlaw); const y = num(r.year);
      r.g_clean = g === 2000 ? "" : String(g);
      r.treat_post = g !== 2000 && y >= g ? "1" : "0";
    }
    const out = join(TMP_DIR, "divorce-laws.csv");
    writeCsv(out, rows, ["state_id", "st", "year", "div_rate", "g_clean", "treat_post", "stpop"]);
    prepared.push({
      name: "divorce-laws",
      title: "Unilateral Divorce Laws",
      csv: out,
      id_var: "state_id",
      time_var: "year",
      gname_var: "g_clean",
      treat_post_var: "treat_post",
      outcome_var: "div_rate",
      control_group: "notyettreated",
      weights_var: "stpop",
      has_never_treated: true,
    });
  }

  // sentencing-laws
  {
    const src = join(EXAMPLES_DIR, "sentencing-laws", "sentencing_data.csv");
    const complete = readCsv(src).filter((r) => Number.isFinite(num(r.lnpcrrobgun)));
    const allYears = uniqueSorted(complete.map((r) => r.year));
    const c = countBy(complete, (r) => r.state_fips);
    const full = new Set([...c.entries()].filter(([, n]) => n === allYears.length).map(([s]) => s));
    const rows = complete.filter((r) => full.has(r.state_fips));
    for (const r of rows) {
      const adoption = num(r.treatment_year); const y = num(r.year);
      const g = adoption > 0 ? adoption + 1 : NaN;
      r.g_clean = Number.isFinite(g) ? String(g) : "";
      r.treat_absorbing = Number.isFinite(g) && y >= g ? "1" : "0";
    }
    const out = join(TMP_DIR, "sentencing-laws.csv");
    writeCsv(out, rows, ["state_fips", "state_name", "year", "lnpcrrobgun", "g_clean", "treat_absorbing"]);
    prepared.push({
      name: "sentencing-laws",
      title: "Sentencing Enhancements",
      csv: out,
      id_var: "state_fips",
      time_var: "year",
      gname_var: "g_clean",
      treat_post_var: "treat_absorbing",
      outcome_var: "lnpcrrobgun",
      control_group: "nevertreated",
      weights_var: "",
      has_never_treated: true,
    });
  }

  // bank-deregulation
  {
    const src = join(EXAMPLES_DIR, "bank-deregulation", "bank_deregulation_data.csv");
    const raw = readCsv(src);
    const rows = raw.filter((r) => {
      const y = num(r.wrkyr); const g = num(r.branch_reform); const gini = num(r.gini);
      return y <= 1998 && g > 1976 && Number.isFinite(gini) && gini > 0;
    });
    for (const r of rows) {
      const g = num(r.branch_reform); const y = num(r.wrkyr);
      r.branch_g = g > 1998 ? "0" : String(g);
      r.treat_intra = g <= 1998 && y >= g ? "1" : "0";
      r.log_gini = String(Math.log(num(r.gini)));
    }
    const out = join(TMP_DIR, "bank-deregulation.csv");
    writeCsv(out, rows, ["statefip", "state", "wrkyr", "log_gini", "branch_g", "treat_intra"]);
    prepared.push({
      name: "bank-deregulation",
      title: "Bank Deregulation",
      csv: out,
      id_var: "statefip",
      time_var: "wrkyr",
      gname_var: "branch_g",
      treat_post_var: "treat_intra",
      outcome_var: "log_gini",
      control_group: "notyettreated",
      weights_var: "",
      has_never_treated: false,
    });
  }

  return prepared;
}

// Benchmarks per dataset (parallel to MCP audit).
const BENCH = {
  "medicaid-insurance": { att_range: [0.04, 0.10], null_ok: false, sign: "positive" },
  "medicaid-mortality": { att_range: null, null_ok: true, sign: "either" },
  "teacher-bargaining": { att_range: [-0.15, 0.15], null_ok: true, sign: "null" },
  "divorce-laws":       { att_range: null, null_ok: true, sign: "hump" },
  "sentencing-laws":    { att_range: [-0.5, 0.1], null_ok: true, sign: "negative-or-null" },
  "bank-deregulation":  { att_range: null, null_ok: true, sign: "either" },
};

function scoreStep1(r) {
  const s = r?.step1;
  if (!s) return { status: "FAIL", detail: "no step1" };
  const b = s.balanced?.value;
  const c = s.cohorts?.value;
  const pv = s.panelview?.value;
  if (!b || !c) return { status: "FAIL", detail: `balance=${s.balanced?.error ?? "n/a"}, cohorts=${s.cohorts?.error ?? "n/a"}` };
  const pvOk = s.panelview?.ok === true && pv?.plot_ok === true;
  const det = `n_units=${b.n_units}, n_times=${b.n_times}, n_rows=${b.n_rows}, balanced=${b.balanced}, n_cohorts=${Object.keys(c.cohorts ?? {}).length}, panelview=${pvOk ? "ok" : "FAIL"}`;
  return { status: pvOk ? "PASS" : "FAIL", detail: det };
}

function scoreStep2(r) {
  const s = r?.step2;
  if (!s) return { status: "FAIL", detail: "no step2" };
  const bOk = s.bacon?.ok === true && s.bacon_summary;
  const wOk = s.weights?.ok === true;
  if (!bOk && !wOk) return { status: "FAIL", detail: `bacon=${s.bacon?.error ?? "n/a"}; weights=${s.weights?.error ?? "n/a"}` };
  const wSum = s.bacon_summary?.weights_sum;
  const wSumOk = typeof wSum === "number" && Math.abs(wSum - 1.0) < 0.01;
  const detail = `bacon=${bOk ? "ok" : "FAIL"}(sum=${fmt(wSum, 3)}); twowayfe=${wOk ? "ok" : "FAIL"}`;
  const ok = bOk && (wSumOk || !bOk) && wOk; // weights-sum only asserted if bacon succeeded
  return { status: ok ? "PASS" : "FAIL", detail };
}

function scoreStep3(r, bench) {
  const s = r?.step3;
  if (!s) return { status: "FAIL", detail: "no step3", atts: {} };
  const atts = {};
  const details = [];
  for (const est of ["cs", "sa", "bjs", "did2s", "staggered"]) {
    const e = s[est];
    const ok = e?.ok === true;
    let att = NaN;
    if (ok) {
      const v = e.value;
      att = (est === "cs") ? v.att_dynamic :
            (est === "sa") ? v.att_dynamic :
            v.att;
    }
    atts[est] = att;
    details.push(`${est}=${ok ? fmt(att) : `ERR(${e?.error?.slice(0, 80) ?? "n/a"})`}`);
  }
  const okCount = Object.values(atts).filter((v) => Number.isFinite(v)).length;
  // Benchmark check on CS
  const csAtt = atts.cs;
  let benchDetail = "";
  let benchOk = true;
  if (Number.isFinite(csAtt) && bench.att_range) {
    benchOk = csAtt >= bench.att_range[0] && csAtt <= bench.att_range[1];
    benchDetail = `bench=${benchOk ? "ok" : "MISS"}(exp ${JSON.stringify(bench.att_range)})`;
  }
  return {
    status: okCount >= 3 && benchOk ? "PASS" : "FAIL",
    detail: `${okCount}/5 estimators ok — ${details.join("; ")} ${benchDetail}`,
    atts,
  };
}

function scoreStep4(r) {
  const s = r?.step4;
  if (!s) return { status: "FAIL", detail: "no step4" };
  if (!s.ok) return { status: "FAIL", detail: `error: ${s.error}` };
  const v = s.value;
  const s50 = v?.slope_50;
  const s80 = v?.slope_80;
  const ok = Number.isFinite(s50) || Number.isFinite(s80);
  return { status: ok ? "PASS" : "FAIL", detail: `source=${v?.source}, slope_50=${fmt(s50)}, slope_80=${fmt(s80)}` };
}

function scoreStep5(r) {
  const s = r?.step5;
  if (!s) return { status: "FAIL", detail: "no step5" };
  if (!s.ok) return { status: "FAIL", detail: `error: ${s.error}` };
  const v = s.value;
  const nRows = Array.isArray(v?.robust) ? v.robust.length : (v?.robust ? Object.keys(v.robust).length : 0);
  const bd = v?.breakdown_M;
  const ok = nRows > 0 && v?.n_pre > 0 && v?.n_post > 0;
  return { status: ok ? "PASS" : "FAIL", detail: `n_pre=${v?.n_pre}, n_post=${v?.n_post}, robust_rows=${nRows}, breakdown_M=${bd ?? "NA"}` };
}

function renderMarkdown(configs, results) {
  const lines = [];
  lines.push("# did-analysis skill — 5-step R Fallback Recipe Audit");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Examples: \`${EXAMPLES_DIR}\``);
  lines.push(`Temp CSVs: \`${TMP_DIR}\``);
  lines.push("");
  lines.push("This audit validates the R code-gen **fallback path** of the skill — the recipes");
  lines.push("written in `skill/references/did-step-{1..5}-*.md`. It does NOT drive the MCP;");
  lines.push("it exercises the functions the skill instructs agents to run when MCP is absent.");
  lines.push("");

  // Matrix
  lines.push("## Step × Dataset Matrix");
  lines.push("");
  lines.push("| Dataset | Step 1 (profile) | Step 2 (diagnostics) | Step 3 (estimators) | Step 4 (power) | Step 5 (HonestDiD) |");
  lines.push("|---|---|---|---|---|---|");
  const scored = {};
  for (const cfg of configs) {
    const r = results[cfg.name];
    const bench = BENCH[cfg.name];
    const s1 = scoreStep1(r);
    const s2 = scoreStep2(r);
    const s3 = scoreStep3(r, bench);
    const s4 = scoreStep4(r);
    const s5 = scoreStep5(r);
    scored[cfg.name] = { s1, s2, s3, s4, s5 };
    const icon = (s) => s.status === "PASS" ? "✅" : s.status === "N/A" ? "➖" : "❌";
    lines.push(`| ${cfg.title} | ${icon(s1)} | ${icon(s2)} | ${icon(s3)} | ${icon(s4)} | ${icon(s5)} |`);
  }
  lines.push("");

  // Per-dataset detail
  for (const cfg of configs) {
    const s = scored[cfg.name];
    lines.push(`## ${cfg.title}`);
    lines.push("");
    lines.push(`CSV: \`${cfg.csv}\``);
    lines.push("");
    lines.push("| Step | Status | Detail |");
    lines.push("|---|---|---|");
    lines.push(`| 1. Treatment structure | ${s.s1.status} | ${s.s1.detail} |`);
    lines.push(`| 2. TWFE diagnostics | ${s.s2.status} | ${s.s2.detail} |`);
    lines.push(`| 3. Robust estimators | ${s.s3.status} | ${s.s3.detail.replace(/\|/g, "\\|")} |`);
    lines.push(`| 4. Power analysis | ${s.s4.status} | ${s.s4.detail} |`);
    lines.push(`| 5. HonestDiD sensitivity | ${s.s5.status} | ${s.s5.detail} |`);
    lines.push("");
  }

  // Summary
  const counts = { PASS: 0, FAIL: 0 };
  for (const cfg of configs) {
    for (const key of ["s1", "s2", "s3", "s4", "s5"]) {
      const st = scored[cfg.name][key].status;
      counts[st] = (counts[st] || 0) + 1;
    }
  }
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total cells: ${configs.length * 5}`);
  lines.push(`- PASS: ${counts.PASS}`);
  lines.push(`- FAIL: ${counts.FAIL}`);
  lines.push("");
  return { md: lines.join("\n") + "\n", scored };
}

function main() {
  if (!existsSync(EXAMPLES_DIR)) throw new Error(`examples dir missing: ${EXAMPLES_DIR}`);
  if (!existsSync(R_SCRIPT)) throw new Error(`R script missing: ${R_SCRIPT}`);
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Preparing CSVs in ${TMP_DIR}...`);
  const configs = prepareAll();
  const configPath = join(TMP_DIR, "config.json");
  writeFileSync(configPath, JSON.stringify({ datasets: configs }, null, 2));

  const outputJson = join(TMP_DIR, "recipes-output.json");
  console.log(`Running Rscript...`);
  const proc = spawnSync("Rscript", [R_SCRIPT, configPath, outputJson], {
    stdio: ["ignore", "inherit", "inherit"],
    timeout: 30 * 60 * 1000,
  });
  if (proc.status !== 0) {
    console.error(`Rscript failed with status ${proc.status}`);
    // Still attempt to read partial output if it exists.
  }

  let raw = {};
  if (existsSync(outputJson)) {
    raw = JSON.parse(readFileSync(outputJson, "utf8"));
  } else {
    console.error(`R produced no output at ${outputJson}; reporting all-FAIL.`);
  }
  const results = raw.results || {};
  const { md, scored } = renderMarkdown(configs, results);

  const mdPath = join(OUTPUT_DIR, `audit-skill-recipes-${RUN_ID}.md`);
  const jsonPath = join(OUTPUT_DIR, `audit-skill-recipes-${RUN_ID}.json`);
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    examples_dir: EXAMPLES_DIR,
    tmp_dir: TMP_DIR,
    configs,
    r_results: results,
    scored,
  }, null, 2));
  console.log(`\nMarkdown: ${mdPath}`);
  console.log(`JSON:     ${jsonPath}`);
}

main();
