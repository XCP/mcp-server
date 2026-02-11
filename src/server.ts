import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from './api-client.js';
import { SigningConfig } from './signer.js';
import { registerAllTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

/**
 * Create and configure the MCP server.
 * Separated from transport for testability.
 */
export function createServer(client: ApiClient, signingConfig: SigningConfig | null): McpServer {
  const server = new McpServer({
    name: 'counterparty',
    version: pkg.version,
  });

  registerAllTools(server, client, signingConfig);
  registerResources(server);

  return server;
}
