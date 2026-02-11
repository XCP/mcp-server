import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from './api-client.js';
import { SigningConfig } from './signer.js';
import { registerAllTools } from './tools/index.js';
import { registerResources } from './resources/index.js';

/**
 * Create and configure the MCP server.
 * Separated from transport for testability.
 */
export function createServer(client: ApiClient, signingConfig: SigningConfig | null): McpServer {
  const server = new McpServer({
    name: 'counterparty',
    version: '1.0.0',
  });

  registerAllTools(server, client, signingConfig);
  registerResources(server);

  return server;
}
