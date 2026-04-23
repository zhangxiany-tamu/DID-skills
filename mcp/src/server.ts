// ============================================================================
// did-mcp — MCP Server
// ============================================================================
// Exposes DID workflow tools to Claude Code (or any MCP client) over stdio.
// Phase 1: did_ping + did_session. Subsequent phases add Step 1 and Step 3
// tools. See /mcp/README.md for the v1 roadmap.

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
  if (config.recycleAfterCalls) poolConfig.recycleAfterCalls = config.recycleAfterCalls;

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
          "Inspect or manage the active DID analysis session. Actions: 'list' (all handles), 'inspect' (one handle by id), 'drop' (remove a handle), 'status' (worker pool state). Handles are the outputs of other did_* tools (panel_1, estimate_1, etc.).",
        inputSchema: DID_SESSION_SCHEMA,
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
        result = executeDidSession(
          args as unknown as DidSessionInput,
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
