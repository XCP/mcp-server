import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';

const paginationParams = {
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(1000).default(100).optional().describe('Number of results to return'),
  offset: z.number().optional().describe('Number of results to skip'),
};

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerQueryTools(server: McpServer, client: ApiClient) {
  // ── Balances ──

  server.tool(
    'get_balances',
    'Get all Counterparty token balances for a Bitcoin address',
    {
      address: z.string().describe('Bitcoin address'),
      ...paginationParams,
    },
    async ({ address, cursor, limit, offset }) => {
      const data = await client.get(`/v2/addresses/${address}/balances`, { cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_balance',
    'Get the balance of a specific asset for a Bitcoin address',
    {
      address: z.string().describe('Bitcoin address'),
      asset: z.string().describe('Asset name (e.g. XCP, PEPECASH)'),
    },
    async ({ address, asset }) => {
      const data = await client.get(`/v2/addresses/${address}/balances/${asset}`);
      return jsonResponse(data);
    }
  );

  // ── Assets ──

  server.tool(
    'get_asset_info',
    'Get metadata for a Counterparty asset (supply, divisibility, issuer, description, etc.)',
    {
      asset: z.string().describe('Asset name (e.g. XCP, PEPECASH, A12345)'),
    },
    async ({ asset }) => {
      const data = await client.get(`/v2/assets/${asset}`);
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_asset_balances',
    'Get all balances for a specific asset across all holders',
    {
      asset: z.string().describe('Asset name'),
      ...paginationParams,
    },
    async ({ asset, cursor, limit, offset }) => {
      const data = await client.get(`/v2/assets/${asset}/balances`, { cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_assets',
    'Search or list Counterparty assets',
    {
      named: z.boolean().optional().describe('Filter to named assets only'),
      ...paginationParams,
    },
    async ({ named, cursor, limit, offset }) => {
      const data = await client.get('/v2/assets', { named, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_issuances',
    'Get the issuance history for a Counterparty asset',
    {
      asset: z.string().describe('Asset name'),
      ...paginationParams,
    },
    async ({ asset, cursor, limit, offset }) => {
      const data = await client.get(`/v2/assets/${asset}/issuances`, { cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  // ── Orders (DEX) ──

  server.tool(
    'get_orders',
    'Get open orders on the Counterparty DEX',
    {
      status: z.enum(['open', 'expired', 'filled', 'cancelled']).default('open').optional().describe('Order status filter'),
      ...paginationParams,
    },
    async ({ status, cursor, limit, offset }) => {
      const data = await client.get('/v2/orders', { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_order',
    'Get details of a specific DEX order by its transaction hash',
    {
      order_hash: z.string().describe('Order transaction hash'),
    },
    async ({ order_hash }) => {
      const data = await client.get(`/v2/orders/${order_hash}`);
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_order_matches',
    'Get matches for a specific DEX order',
    {
      order_hash: z.string().describe('Order transaction hash'),
      status: z.enum(['pending', 'completed', 'expired']).optional().describe('Match status filter'),
      ...paginationParams,
    },
    async ({ order_hash, status, cursor, limit, offset }) => {
      const data = await client.get(`/v2/orders/${order_hash}/matches`, { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_orders_by_pair',
    'Get the order book for a specific trading pair on the DEX',
    {
      asset1: z.string().describe('First asset (e.g. XCP)'),
      asset2: z.string().describe('Second asset (e.g. PEPECASH)'),
      status: z.enum(['open', 'expired', 'filled', 'cancelled']).default('open').optional().describe('Order status filter'),
      ...paginationParams,
    },
    async ({ asset1, asset2, status, cursor, limit, offset }) => {
      const data = await client.get(`/v2/orders/${asset1}/${asset2}`, { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_address_orders',
    'Get all DEX orders placed by a specific address',
    {
      address: z.string().describe('Bitcoin address'),
      status: z.enum(['open', 'expired', 'filled', 'cancelled']).optional().describe('Order status filter'),
      ...paginationParams,
    },
    async ({ address, status, cursor, limit, offset }) => {
      const data = await client.get(`/v2/addresses/${address}/orders`, { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  // ── Dispensers ──

  server.tool(
    'get_dispensers',
    'Get all open Counterparty dispensers',
    {
      status: z.enum(['0', '1', '10']).default('0').optional().describe('Status: 0=open, 1=closed, 10=closing'),
      ...paginationParams,
    },
    async ({ status, cursor, limit, offset }) => {
      const data = await client.get('/v2/dispensers', { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_dispenser',
    'Get details of a specific dispenser by its transaction hash',
    {
      hash: z.string().describe('Dispenser transaction hash'),
    },
    async ({ hash }) => {
      const data = await client.get(`/v2/dispensers/${hash}`);
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_dispensers_by_asset',
    'Get all dispensers for a specific asset',
    {
      asset: z.string().describe('Asset name'),
      status: z.enum(['0', '1', '10']).default('0').optional().describe('Status: 0=open, 1=closed, 10=closing'),
      ...paginationParams,
    },
    async ({ asset, status, cursor, limit, offset }) => {
      const data = await client.get(`/v2/assets/${asset}/dispensers`, { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_address_dispensers',
    'Get all dispensers created by a specific address',
    {
      address: z.string().describe('Bitcoin address'),
      status: z.enum(['0', '1', '10']).optional().describe('Status: 0=open, 1=closed, 10=closing'),
      ...paginationParams,
    },
    async ({ address, status, cursor, limit, offset }) => {
      const data = await client.get(`/v2/addresses/${address}/dispensers`, { status, cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  // ── Transactions & Sends ──

  server.tool(
    'get_address_transactions',
    'Get transaction history for a Bitcoin address on Counterparty',
    {
      address: z.string().describe('Bitcoin address'),
      ...paginationParams,
    },
    async ({ address, cursor, limit, offset }) => {
      const data = await client.get(`/v2/addresses/${address}/transactions`, { cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  server.tool(
    'get_sends',
    'Get all sends (token transfers) from a specific address',
    {
      address: z.string().describe('Bitcoin address'),
      ...paginationParams,
    },
    async ({ address, cursor, limit, offset }) => {
      const data = await client.get(`/v2/addresses/${address}/sends`, { cursor, limit, offset });
      return jsonResponse(data);
    }
  );

  // ── UTXOs ──

  server.tool(
    'get_utxo_balances',
    'Get Counterparty token balances attached to a specific UTXO',
    {
      utxo: z.string().describe('UTXO identifier (txid:vout)'),
    },
    async ({ utxo }) => {
      const data = await client.get(`/v2/utxos/${utxo}/balances`);
      return jsonResponse(data);
    }
  );

  // ── Block ──

  server.tool(
    'get_block',
    'Get the latest block information from the Counterparty node',
    {},
    async () => {
      const data = await client.get('/v2/blocks/last');
      return jsonResponse(data);
    }
  );
}
