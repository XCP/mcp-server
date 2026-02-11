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

  beforeAll(async () => {
    const server = createServer(client, null);
    mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);
  });

  test('lists all tools', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    expect(Array.isArray(result.tools)).toBe(true);
    // Should have ~43 tools (no sign_and_broadcast without signing config)
    expect(result.tools.length).toBeGreaterThanOrEqual(40);
  });

  test('has expected query tools', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    const toolNames = result.tools.map(t => t.name);

    expect(toolNames).toContain('get_balances');
    expect(toolNames).toContain('get_balance');
    expect(toolNames).toContain('get_asset_info');
    expect(toolNames).toContain('get_asset_balances');
    expect(toolNames).toContain('get_orders');
    expect(toolNames).toContain('get_dispensers');
    expect(toolNames).toContain('get_block');
  });

  test('has expected compose tools', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    const toolNames = result.tools.map(t => t.name);

    expect(toolNames).toContain('compose_send');
    expect(toolNames).toContain('compose_order');
    expect(toolNames).toContain('compose_issuance');
    expect(toolNames).toContain('compose_dispenser');
    expect(toolNames).toContain('compose_fairminter');
    expect(toolNames).toContain('compose_attach');
    expect(toolNames).toContain('compose_detach');
  });

  test('has expected bitcoin tools', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    const toolNames = result.tools.map(t => t.name);

    expect(toolNames).toContain('broadcast_transaction');
    expect(toolNames).toContain('get_fee_estimate');
    expect(toolNames).toContain('decode_transaction');
    // sign_and_broadcast should NOT be present without signing config
    expect(toolNames).not.toContain('sign_and_broadcast');
  });

  test('has expected utility tools', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    const toolNames = result.tools.map(t => t.name);

    expect(toolNames).toContain('unpack_transaction');
    expect(toolNames).toContain('get_server_info');
    expect(toolNames).toContain('api_request');
  });

  test('tools have annotations', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );

    const getBalances = result.tools.find(t => t.name === 'get_balances');
    expect(getBalances?.annotations?.readOnlyHint).toBe(true);
    expect(getBalances?.annotations?.destructiveHint).toBe(false);

    const broadcast = result.tools.find(t => t.name === 'broadcast_transaction');
    expect(broadcast?.annotations?.readOnlyHint).toBe(false);
    expect(broadcast?.annotations?.destructiveHint).toBe(true);

    const composeSend = result.tools.find(t => t.name === 'compose_send');
    expect(composeSend?.annotations?.readOnlyHint).toBe(false);
    expect(composeSend?.annotations?.destructiveHint).toBe(false);
  });

  test('lists resources', async () => {
    const result = await mcpClient.request(
      { method: 'resources/list', params: {} },
      ListResourcesResultSchema,
    );
    expect(result.resources.length).toBe(1);
    expect(result.resources[0].uri).toBe('counterparty://protocol-overview');
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
    // Calling a tool with a bad address against a non-existent API should
    // return an isError result, not throw a protocol error
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
    // The tool should catch the fetch error and return it as content with isError
    expect(result.isError).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');
  });
});

describe('MCP Server with signing', () => {
  let mcpClient: Client;

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
  });

  test('sign_and_broadcast is available with signing config', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    const toolNames = result.tools.map(t => t.name);
    expect(toolNames).toContain('sign_and_broadcast');
  });

  test('sign_and_broadcast description includes address', async () => {
    const result = await mcpClient.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    );
    const tool = result.tools.find(t => t.name === 'sign_and_broadcast');
    expect(tool?.description).toContain('bc1qtest');
  });
});
