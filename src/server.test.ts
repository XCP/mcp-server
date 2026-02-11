import { describe, test, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  ListToolsResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ApiClient } from './api-client.js';
import { createServer } from './server.js';

// Create server with a dummy API client (no real network calls in tests)
const client = new ApiClient('https://localhost:0');

describe('MCP Server', () => {
  let mcpClient: Client;
  let toolNames: string[];
  let tools: { name: string; description?: string; annotations?: Record<string, boolean> }[];

  beforeAll(async () => {
    const server = createServer(client, null);
    mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    tools = result.tools;
    toolNames = tools.map(t => t.name);
  });

  test('registers 48 tools (no sign_and_broadcast without signing config)', () => {
    expect(tools.length).toBe(48);
  });

  test('has expected query tools', () => {
    expect(toolNames).toContain('get_balances');
    expect(toolNames).toContain('get_balance');
    expect(toolNames).toContain('get_asset_info');
    expect(toolNames).toContain('get_asset_balances');
    expect(toolNames).toContain('get_orders');
    expect(toolNames).toContain('get_dispensers');
    expect(toolNames).toContain('get_owned_assets');
    expect(toolNames).toContain('get_asset_orders');
    expect(toolNames).toContain('get_dispenses');
    expect(toolNames).toContain('get_dividends');
    expect(toolNames).toContain('get_transaction');
    expect(toolNames).toContain('get_latest_block');
  });

  test('has expected compose tools', () => {
    expect(toolNames).toContain('compose_send');
    expect(toolNames).toContain('compose_order');
    expect(toolNames).toContain('compose_issuance');
    expect(toolNames).toContain('compose_dispenser');
    expect(toolNames).toContain('compose_fairminter');
    expect(toolNames).toContain('compose_xcp420_fairminter');
    expect(toolNames).toContain('compose_attach');
    expect(toolNames).toContain('compose_detach');
  });

  test('has expected bitcoin tools', () => {
    expect(toolNames).toContain('broadcast_transaction');
    expect(toolNames).toContain('get_fee_estimate');
    expect(toolNames).toContain('decode_transaction');
    // sign_and_broadcast should NOT be present without signing config
    expect(toolNames).not.toContain('sign_and_broadcast');
  });

  test('has expected utility tools', () => {
    expect(toolNames).toContain('unpack_transaction');
    expect(toolNames).toContain('get_server_info');
    expect(toolNames).toContain('api_request');
  });

  test('tools have correct annotations', () => {
    const getBalances = tools.find(t => t.name === 'get_balances');
    expect(getBalances?.annotations?.readOnlyHint).toBe(true);
    expect(getBalances?.annotations?.destructiveHint).toBe(false);

    const broadcast = tools.find(t => t.name === 'broadcast_transaction');
    expect(broadcast?.annotations?.readOnlyHint).toBe(false);
    expect(broadcast?.annotations?.destructiveHint).toBe(true);

    const composeSend = tools.find(t => t.name === 'compose_send');
    expect(composeSend?.annotations?.readOnlyHint).toBe(false);
    expect(composeSend?.annotations?.destructiveHint).toBe(false);
  });

  test('lists resources', async () => {
    const result = await mcpClient.request(
      { method: 'resources/list', params: {} },
      ListResourcesResultSchema,
    );
    expect(result.resources.length).toBe(3);
    const uris = result.resources.map(r => r.uri);
    expect(uris).toContain('counterparty://protocol-overview');
    expect(uris).toContain('counterparty://xcp420-standard');
    expect(uris).toContain('counterparty://quick-start');
  });

  test('reads protocol overview resource', async () => {
    const result = await mcpClient.request(
      { method: 'resources/read', params: { uri: 'counterparty://protocol-overview' } },
      ReadResourceResultSchema,
    );
    expect(result.contents.length).toBe(1);
    const text = result.contents[0].text as string;
    expect(text).toContain('Counterparty Protocol Overview');
    expect(text).toContain('0.5 XCP');
    expect(text).toContain('8064 blocks');
    expect(text).toContain('asset_longname');
  });

  test('tool errors are returned as isError content, not protocol errors', async () => {
    const result = await mcpClient.request(
      {
        method: 'tools/call',
        params: {
          name: 'get_balances',
          arguments: { address: 'invalid-address' },
        },
      },
      CallToolResultSchema,
    );
    expect(result.isError).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');
  });
});

describe('MCP Server with signing', () => {
  let mcpClient: Client;
  let tools: { name: string; description?: string }[];

  beforeAll(async () => {
    const signingConfig = {
      privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
      compressed: true,
      address: 'bc1qtest',
      addressType: 'p2wpkh' as const,
    };
    const server = createServer(client, signingConfig);
    mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    tools = result.tools;
  });

  test('sign_and_broadcast is available with signing config', () => {
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('sign_and_broadcast');
  });

  test('sign_and_broadcast description includes address', () => {
    const tool = tools.find(t => t.name === 'sign_and_broadcast');
    expect(tool?.description).toContain('bc1qtest');
  });
});
