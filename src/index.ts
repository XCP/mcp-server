#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api-client.js';
import { initSigningConfig } from './signer.js';
import { createServer } from './server.js';

const nodeUrl = process.env.COUNTERPARTY_NODE;
if (!nodeUrl) {
  console.error('Error: COUNTERPARTY_NODE environment variable is required.');
  console.error('Set it to your Counterparty node URL, e.g. https://api.counterparty.io');
  process.exit(1);
}

const client = new ApiClient(nodeUrl);
const signingConfig = initSigningConfig();
const server = createServer(client, signingConfig);

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
