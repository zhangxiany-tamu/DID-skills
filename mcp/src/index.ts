#!/usr/bin/env node
// ============================================================================
// did-mcp — Entry Point
// ============================================================================

import { startServer } from "./server.js";

const rPath = process.env.R_PATH || "Rscript";
const recycleAfterCalls = process.env.DID_MCP_RECYCLE_AFTER_CALLS
  ? parseInt(process.env.DID_MCP_RECYCLE_AFTER_CALLS, 10)
  : undefined;

startServer({
  rPath,
  recycleAfterCalls,
}).catch((err) => {
  console.error("Failed to start did-mcp server:", err);
  process.exit(1);
});
