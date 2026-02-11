#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api-client.js';
import { initSigningConfig } from './signer.js';
import { registerAllTools } from './tools/index.js';
import { registerResources } from './resources/index.js';

const nodeUrl = process.env.COUNTERPARTY_NODE;
if (!nodeUrl) {
  console.error('Error: COUNTERPARTY_NODE environment variable is required.');
  console.error('Set it to your Counterparty node URL, e.g. https://api.counterparty.io');
  process.exit(1);
}

const client = new ApiClient(nodeUrl);
const signingConfig = initSigningConfig();

const server = new McpServer({
  name: 'counterparty',
  version: '1.0.0',
});

registerAllTools(server, client, signingConfig);
registerResources(server);

if (signingConfig) {
  console.error(`Signing enabled for address: ${signingConfig.address} (${signingConfig.addressType})`);
} else {
  console.error('Signing disabled (set PRIVATE_KEY and ADDRESS env vars to enable)');
}

const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
