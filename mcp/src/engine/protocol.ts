// ============================================================================
// did-mcp — NDJSON Codec
// ============================================================================
// Buffers partial lines from R stdout; parses complete \n-terminated JSON
// objects and dispatches them. R may emit large JSON in multiple chunks.

import type { RpcResponse } from "../types.js";

export type MessageHandler = (response: RpcResponse) => void;
export type ErrorHandler = (error: Error) => void;

export class NdjsonCodec {
  private buffer = "";
  private readonly onMessage: MessageHandler;
  private readonly onError: ErrorHandler;

  constructor(onMessage: MessageHandler, onError: ErrorHandler) {
    this.onMessage = onMessage;
    this.onError = onError;
  }

  feed(chunk: string): void {
    this.buffer += chunk;

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length === 0) continue;

      try {
        const parsed = JSON.parse(line) as RpcResponse;
        this.onMessage(parsed);
      } catch (e) {
        this.onError(
          new Error(
            `Failed to parse R bridge response: ${(e as Error).message}. Line: ${line.slice(0, 200)}`,
          ),
        );
      }
    }
  }

  hasPartialData(): boolean {
    return this.buffer.trim().length > 0;
  }

  reset(): void {
    this.buffer = "";
  }
}

export function encodeNdjson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj) + "\n";
}
