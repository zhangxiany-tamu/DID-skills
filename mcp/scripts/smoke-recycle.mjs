#!/usr/bin/env node
// Exercise the full smoke-test workflow while forcing a worker recycle before
// every tool call after the first. This keeps handle persistence/recovery on
// the regular validation surface instead of relying on an ad hoc env-var run.

process.env.DID_MCP_RECYCLE_AFTER_CALLS =
  process.env.DID_MCP_RECYCLE_AFTER_CALLS || "1";

await import("./smoke-test.mjs");
