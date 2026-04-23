// ============================================================================
// did-mcp — did_ping tool
// ============================================================================
// Smoke test: round-trips through the R bridge and returns { pong: true,
// r_version, jsonlite_version, echo }. Use to verify the MCP and R bridge are
// wired correctly before running substantive DID tools.

import type { WorkerPool } from "../engine/workerPool.js";
import {
  type DidToolResult,
  successResult,
  errorResult,
} from "../types.js";

export const DID_PING_SCHEMA = {
  type: "object" as const,
  properties: {
    echo: {
      type: "string",
      description: "Optional string echoed back verbatim by the R bridge.",
    },
  },
};

export type DidPingInput = {
  echo?: string;
};

export async function executeDidPing(
  input: DidPingInput,
  workerPool: WorkerPool,
): Promise<DidToolResult> {
  try {
    const response = await workerPool.call("ping", {
      echo: input.echo ?? "",
    });

    if (response.error) {
      return errorResult(response.error.message, {
        code: response.error.code,
        suggestion: response.error.suggestion,
        traceback: response.error.traceback,
      });
    }

    return successResult({
      pong: true,
      activeWorkerId: workerPool.activeWorkerId,
      bridge: response.result,
    });
  } catch (e) {
    return errorResult(`did_ping failed: ${(e as Error).message}`);
  }
}
