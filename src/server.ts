import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from './api-client.js';
import { SigningConfig } from './signer.js';
import { registerAllTools } from './tools/index.js';
import { registerResources } from './resources/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

/**
 * Create and configure the MCP server.
 * Separated from transport for testability.
 */
export function createServer(client: ApiClient, signingConfig: SigningConfig | null): McpServer {
  const server = new McpServer(
    {
      name: 'counterparty',
      version: pkg.version,
    },
    {
      instructions:
        'IMPORTANT: Before composing any transaction involving token quantities, ' +
        'always call get_asset_info first to check the asset\'s `divisible` flag. ' +
        'Divisible assets require quantity * 10^8 (e.g. 1.0 XCP = 100000000). ' +
        'Indivisible assets use whole numbers. Getting this wrong causes an off-by-10^8 error. ' +
        'BTC is always in satoshis (1 BTC = 100000000 satoshis).',
    },
  );

  registerAllTools(server, client, signingConfig);
  registerResources(server);

  return server;
}
