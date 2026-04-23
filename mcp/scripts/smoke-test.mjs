#!/usr/bin/env node
// Smoke test: drive the MCP server via stdio and call did_ping + did_session.
// Exits 0 on success, 1 on failure.

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, "..", "dist", "index.js");

const proc = spawn("node", [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, R_PATH: process.env.R_PATH || "Rscript" },
});

let buffer = "";
const pending = new Map();
let nextId = 1;
let timedOut = false;

const overall = setTimeout(() => {
  timedOut = true;
  console.error("FAIL: overall smoke test timeout (30s)");
  proc.kill("SIGTERM");
  process.exit(1);
}, 30_000);

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
      if (handler) {
        pending.delete(msg.id);
        handler(msg);
      }
    } catch (e) {
      console.error("FAIL: could not parse server line:", line);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const req = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolveP, rejectP) => {
    const to = setTimeout(() => {
      pending.delete(id);
      rejectP(new Error(`timeout waiting for response to ${method}`));
    }, 15_000);
    pending.set(id, (msg) => {
      clearTimeout(to);
      if (msg.error) rejectP(new Error(msg.error.message || "rpc error"));
      else resolveP(msg.result);
    });
    proc.stdin.write(JSON.stringify(req) + "\n");
  });
}

(async () => {
  try {
    // MCP handshake
    const init = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.0" },
    });
    console.log("OK initialize:", init.serverInfo?.name || "server");

    // Send initialized notification (no response expected)
    proc.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }) + "\n",
    );

    // List tools
    const listed = await send("tools/list", {});
    const names = listed.tools.map((t) => t.name);
    console.log("OK tools/list:", names.join(", "));
    if (!names.includes("did_ping") || !names.includes("did_session")) {
      throw new Error("expected did_ping and did_session in tool list");
    }

    // Call did_ping
    const pingRes = await send("tools/call", {
      name: "did_ping",
      arguments: { echo: "smoke-test-echo" },
    });
    const pingPayload = JSON.parse(pingRes.content[0].text);
    console.log("OK did_ping:", JSON.stringify(pingPayload.bridge).slice(0, 120));
    if (!pingPayload.pong) throw new Error("did_ping did not return pong:true");
    if (pingPayload.bridge.echo !== "smoke-test-echo")
      throw new Error("echo mismatch");
    if (!pingPayload.bridge.r_version)
      throw new Error("missing r_version in ping response");

    // Call did_session status
    const sessRes = await send("tools/call", {
      name: "did_session",
      arguments: { action: "status" },
    });
    const sessPayload = JSON.parse(sessRes.content[0].text);
    console.log("OK did_session status:", JSON.stringify(sessPayload.pool));
    if (!sessPayload.pool?.activeWorkerId)
      throw new Error("no active worker in session status");

    console.log("ALL PASS");
    clearTimeout(overall);
    proc.kill("SIGTERM");
    process.exit(0);
  } catch (e) {
    if (!timedOut) {
      console.error("FAIL:", e.message);
      clearTimeout(overall);
      proc.kill("SIGTERM");
      process.exit(1);
    }
  }
})();
