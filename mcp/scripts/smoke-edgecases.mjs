#!/usr/bin/env node
// Edge-case smoke: verify the tools behave predictably off the happy path.
//   1. Canonical single-cohort slice → did_profile_design routes to CANONICAL
//   2. Bad column names in did_load_panel → clear error from R
//   3. Wrong handle-type in did_estimate → clear TS-side error before R call
//   4. Non-existent handle → clear error
//   5. did_check_panel with duplicate rows → reports overall_ok=false

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, "..", "dist", "index.js");
const FIXTURE = resolve(__dirname, "..", "test", "fixtures", "mpdta.csv");

// Build a canonical-single-cohort slice of mpdta: keep only units whose
// first.treat is 2007 (or never-treated). We write it to a scratch CSV.
const tmp = mkdtempSync(join(tmpdir(), "did-mcp-edge-"));
const CANONICAL = join(tmp, "mpdta-canonical.csv");
{
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(FIXTURE, "utf-8").trim().split("\n");
  const header = raw[0];
  const rows = raw.slice(1).filter((r) => {
    const cols = r.split(",");
    // Column order: year,countyreal,lpop,lemp,first.treat,treat
    const first_treat = Number(cols[4]);
    return first_treat === 0 || first_treat === 2007;
  });
  writeFileSync(CANONICAL, [header, ...rows].join("\n") + "\n");
}

// Build a panel with deliberate duplicate (id, time) pairs.
const DUPS = join(tmp, "dups.csv");
{
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(FIXTURE, "utf-8").trim().split("\n");
  // duplicate the first data row
  const dup = [raw[0], raw[1], raw[1], ...raw.slice(2)].join("\n") + "\n";
  writeFileSync(DUPS, dup);
}

const proc = spawn("node", [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, R_PATH: process.env.R_PATH || "Rscript" },
});

let buffer = "";
const pending = new Map();
let nextId = 1;

const overall = setTimeout(() => {
  console.error("FAIL: overall timeout");
  proc.kill("SIGTERM");
  process.exit(1);
}, 120_000);

proc.stdout.setEncoding("utf-8");
proc.stdout.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      const handler = pending.get(msg.id);
      if (handler) { pending.delete(msg.id); handler(msg); }
    } catch {}
  }
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolveP, rejectP) => {
    const to = setTimeout(() => {
      pending.delete(id);
      rejectP(new Error(`timeout ${method}`));
    }, 60_000);
    pending.set(id, (msg) => {
      clearTimeout(to);
      if (msg.error) rejectP(new Error(msg.error.message));
      else resolveP(msg.result);
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function callTool(name, args) {
  return send("tools/call", { name, arguments: args });
}
async function callToolOk(name, args) {
  const res = await callTool(name, args);
  if (res.isError) {
    throw new Error(`${name} errored unexpectedly: ${res.content?.[0]?.text}`);
  }
  return JSON.parse(res.content[0].text);
}

(async () => {
  try {
    await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-edge", version: "0" },
    });
    proc.stdin.write(JSON.stringify({
      jsonrpc: "2.0", method: "notifications/initialized", params: {},
    }) + "\n");

    // 1. Canonical single-cohort slice → design profile = CANONICAL
    await callToolOk("did_load_panel", {
      path: CANONICAL, id_var: "countyreal", time_var: "year",
      treat_timing_var: "first.treat", treat_var: "treat", outcome_var: "lemp",
    });
    const profile = await callToolOk("did_profile_design", { panel_id: "panel_1" });
    if (profile.timing !== "CANONICAL") {
      throw new Error(`canonical slice: expected timing=CANONICAL, got ${profile.timing}`);
    }
    if (profile.route !== "CANONICAL") {
      throw new Error(`canonical slice: expected route=CANONICAL, got ${profile.route}`);
    }
    if (profile.n_cohorts !== 1) {
      throw new Error(`canonical slice: expected 1 cohort, got ${profile.n_cohorts}`);
    }
    console.log(
      `OK canonical profile: timing=${profile.timing} route=${profile.route} cohorts=${profile.n_cohorts}`,
    );

    // CS still runs on a single-cohort panel (behaves like standard 2x2).
    const csCanon = await callToolOk("did_estimate", {
      panel_id: "panel_1", estimator: "cs", outcome_var: "lemp",
    });
    if (typeof csCanon.overall?.att !== "number" || !isFinite(csCanon.overall.att)) {
      throw new Error(`canonical CS: non-finite ATT (${csCanon.overall?.att})`);
    }
    console.log(`OK canonical CS: ATT=${csCanon.overall.att.toFixed(4)}`);

    // 2. Bad column name → R-side error with a helpful message
    const badCol = await callTool("did_load_panel", {
      path: FIXTURE, id_var: "NOT_A_COLUMN", time_var: "year",
      treat_timing_var: "first.treat",
    });
    if (!badCol.isError) throw new Error("bad column name should have errored");
    if (!badCol.content[0].text.includes("not found")) {
      throw new Error(`bad col error missing expected phrase; got: ${badCol.content[0].text}`);
    }
    console.log("OK bad column name → clear error");

    // 3. Wrong handle type for did_estimate → TS-side error (no R call)
    const wrongHandle = await callTool("did_estimate", {
      panel_id: "panel_1",  // this IS a panel — need to reference a non-panel handle
      estimator: "cs",
      outcome_var: "lemp",
    });
    // Actually panel_1 is valid; let's instead reference a non-existent handle.
    const missing = await callTool("did_estimate", {
      panel_id: "panel_999", estimator: "cs", outcome_var: "lemp",
    });
    if (!missing.isError) throw new Error("non-existent panel handle should have errored");
    if (!missing.content[0].text.includes("not found")) {
      throw new Error(`missing handle error missing expected phrase; got: ${missing.content[0].text}`);
    }
    console.log("OK non-existent handle → clear error");

    // 4. Use an estimate handle where a panel is required → type mismatch
    //    panel_1 is fine — we just made a CS estimate on it, so estimate_X exists.
    const estHandle = csCanon.handle;
    const typeMismatch = await callTool("did_check_panel", { panel_id: estHandle });
    if (!typeMismatch.isError) throw new Error("panel_id = estimate handle should error");
    if (!/expected panel/i.test(typeMismatch.content[0].text)) {
      throw new Error(`type mismatch error wording changed; got: ${typeMismatch.content[0].text}`);
    }
    console.log("OK handle-type mismatch → clear error");

    // 5. did_check_panel with duplicate (id,time) → overall_ok=false
    const dupLoad = await callToolOk("did_load_panel", {
      path: DUPS, id_var: "countyreal", time_var: "year",
      treat_timing_var: "first.treat",
    });
    const dupCheck = await callToolOk("did_check_panel", { panel_id: dupLoad.handle });
    if (dupCheck.overall_ok !== false) {
      throw new Error(`dup panel: expected overall_ok=false, got ${dupCheck.overall_ok}`);
    }
    if (dupCheck.uniqueness?.ok !== false) {
      throw new Error(`dup panel: uniqueness.ok should be false`);
    }
    console.log("OK duplicate (id,time) → overall_ok=false");

    console.log("\nALL EDGE CASES PASS");
    clearTimeout(overall);
    proc.kill("SIGTERM");
    process.exit(0);
  } catch (e) {
    console.error("FAIL:", e.message);
    clearTimeout(overall);
    proc.kill("SIGTERM");
    process.exit(1);
  }
})();
