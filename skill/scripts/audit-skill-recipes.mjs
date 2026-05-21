#!/usr/bin/env node
// ============================================================================
// did-analysis skill — 5-step fallback recipe audit (Node driver)
// ============================================================================
// 1. Prepare the same 6 CSVs the MCP audit uses (shared prep helper).
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
import {
  DEFAULT_EXAMPLES_DIR,
  fmt,
  prepareSkillRecipeDatasets,
} from "../../scripts/did-examples-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const EXAMPLES_DIR = process.env.DID_EXAMPLES_DIR || DEFAULT_EXAMPLES_DIR;
const OUTPUT_DIR = process.env.DID_SKILL_VALIDATION_OUTPUT_DIR ||
  resolve(SKILL_ROOT, "validation-output");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const TMP_DIR = join("/tmp", `did-skill-audit-${RUN_ID}`);
const R_SCRIPT = resolve(__dirname, "audit-skill-recipes.R");

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
  const configs = prepareSkillRecipeDatasets({ examplesDir: EXAMPLES_DIR, tmpDir: TMP_DIR });
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
