import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../api-client.js';
import { SigningConfig } from '../signer.js';
import { registerQueryTools } from './query.js';
import { registerComposeTools } from './compose.js';
import { registerBitcoinTools } from './bitcoin.js';
import { registerUtilityTools } from './utility.js';

export function registerAllTools(server: McpServer, client: ApiClient, signingConfig: SigningConfig | null) {
  registerQueryTools(server, client);
  registerComposeTools(server, client);
  registerBitcoinTools(server, client, signingConfig);
  registerUtilityTools(server, client);
}
