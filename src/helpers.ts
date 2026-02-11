/**
 * Shared helpers for MCP tool handlers.
 */

export type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/** MCP tool annotations for read-only query tools. */
export const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;

/** MCP tool annotations for compose and other non-destructive mutating tools. */
export const composeAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

/** MCP tool annotations for irreversible tools (broadcast, sign_and_broadcast). */
export const destructiveAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: true } as const;

/**
 * Format successful data as a JSON text response.
 */
export function jsonResponse(data: unknown): ToolResult {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * Format an error as an MCP tool error response.
 * This ensures the AI sees the descriptive error message instead of
 * getting a generic JSON-RPC protocol error.
 */
export function errorResponse(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

/**
 * Wrap a tool handler with error catching.
 * Catches any thrown errors and returns them as MCP tool errors (isError: true)
 * so the AI can see and react to descriptive API error messages.
 */
export function safeHandler<T>(fn: (args: T) => Promise<ToolResult>): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
