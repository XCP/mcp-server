#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api-client.js';
import { initSigningConfig } from './signer.js';
import { createServer } from './server.js';

const DEFAULT_NODE_URL = 'https://api.counterparty.io:4000';
const nodeUrl = process.env.COUNTERPARTY_NODE || DEFAULT_NODE_URL;

if (!process.env.COUNTERPARTY_NODE) {
  console.error(`No COUNTERPARTY_NODE set, using default: ${DEFAULT_NODE_URL}`);
}

const client = new ApiClient(nodeUrl);
const signingConfig = initSigningConfig();
const server = createServer(client, signingConfig);

if (signingConfig) {
  console.error(`Signing enabled for address: ${signingConfig.address} (${signingConfig.addressType})`);
} else {
  console.error('Signing disabled (set SIGNER_PRIVATE_KEY and SIGNER_ADDRESS to enable)');
}

const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
