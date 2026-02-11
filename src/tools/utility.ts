import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';
import { jsonResponse, safeHandler } from '../helpers.js';

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };

export function registerUtilityTools(server: McpServer, client: ApiClient) {
  // ── Unpack Transaction ──

  server.tool(
    'unpack_transaction',
    'Decode and unpack a Counterparty message from a raw transaction, revealing the embedded Counterparty data',
    {
      raw_transaction: z.string().describe('Raw transaction hex containing a Counterparty message'),
      block_index: z.number().optional().describe('Block index for context (optional)'),
    },
    readOnly,
    safeHandler(async ({ raw_transaction, block_index }) => {
      const data = await client.get('/v2/transactions/unpack', {
        datahex: raw_transaction,
        block_index,
      });
      return jsonResponse(data);
    })
  );

  // ── Server Info ──

  server.tool(
    'get_server_info',
    'Get Counterparty node status, version, and network information',
    {},
    readOnly,
    safeHandler(async () => {
      const data = await client.get('/v2/');
      return jsonResponse(data);
    })
  );

  // ── Generic API Request ──

  server.tool(
    'api_request',
    'Make a raw API request to any Counterparty REST endpoint not covered by the other tools. ' +
    'See the Counterparty API docs for available endpoints. ' +
    'Example: endpoint="/v2/blocks/last", method="GET"',
    {
      endpoint: z.string().describe('API endpoint path (e.g. /v2/blocks/last, /v2/addresses/{addr}/credits)'),
      method: z.enum(['GET', 'POST']).default('GET').optional().describe('HTTP method'),
      params: z.record(z.string(), z.unknown()).optional().describe('Query parameters (for GET) or body fields (for POST)'),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    safeHandler(async ({ endpoint, method, params }) => {
      const data = method === 'POST'
        ? await client.post(endpoint, params ?? {})
        : await client.get(endpoint, params);
      return jsonResponse(data);
    })
  );
}
