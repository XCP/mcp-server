import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';
import { jsonResponse, safeHandler } from '../helpers.js';

// Common compose options shared across most compose endpoints
const feeOptions = {
  fee: z.number().optional().describe('Exact fee in satoshis (overrides fee_per_kb)'),
  fee_per_kb: z.number().optional().describe('Fee rate in satoshis per kilobyte'),
};

const utxoOptions = {
  inputs_set: z.string().optional().describe('Comma-separated UTXOs to use as inputs (txid:vout)'),
};

const composeAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

export function registerComposeTools(server: McpServer, client: ApiClient) {
  // ── Send ──

  server.tool(
    'compose_send',
    'Compose a transaction to send Counterparty tokens to an address. Returns unsigned transaction hex and PSBT.',
    {
      address: z.string().describe('Source Bitcoin address'),
      destination: z.string().describe('Destination Bitcoin address'),
      asset: z.string().describe('Asset to send (e.g. XCP, PEPECASH)'),
      quantity: z.number().describe('Raw integer amount. For divisible assets: multiply human amount by 10^8 (e.g. 1.0 XCP = 100000000). For indivisible: use whole number. Check get_asset_info for divisibility.'),
      memo: z.string().optional().describe('Optional memo to attach'),
      memo_is_hex: z.boolean().optional().describe('Whether memo is hex-encoded'),
      use_enhanced_send: z.boolean().default(true).optional().describe('Use enhanced send (default true)'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/send`, params);
      return jsonResponse(data);
    })
  );

  // ── MPMA (Multi-Party Multi-Asset Send) ──

  server.tool(
    'compose_mpma',
    'Compose a multi-party multi-asset send transaction. Sends multiple assets to multiple destinations in a single transaction.',
    {
      address: z.string().describe('Source Bitcoin address'),
      destinations: z.string().describe('JSON-encoded array of {destination, asset, quantity} objects'),
      memo: z.string().optional().describe('Optional memo to attach'),
      memo_is_hex: z.boolean().optional().describe('Whether memo is hex-encoded'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, destinations, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/mpma`, {
        ...params,
        destinations,
      });
      return jsonResponse(data);
    })
  );

  // ── Order (DEX) ──

  server.tool(
    'compose_order',
    'Compose a DEX order to trade Counterparty assets. Creates a limit order on the decentralized exchange.',
    {
      address: z.string().describe('Source Bitcoin address'),
      give_asset: z.string().describe('Asset to give/sell'),
      give_quantity: z.number().describe('Raw integer amount to give. For divisible assets: human amount * 10^8. For BTC: satoshis.'),
      get_asset: z.string().describe('Asset to receive/buy'),
      get_quantity: z.number().describe('Raw integer amount to receive. For divisible assets: human amount * 10^8. For BTC: satoshis.'),
      expiration: z.number().describe('Number of blocks until order expires'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/order`, params);
      return jsonResponse(data);
    })
  );

  // ── Cancel Order ──

  server.tool(
    'compose_cancel',
    'Compose a transaction to cancel an open DEX order',
    {
      address: z.string().describe('Source Bitcoin address (must be order creator)'),
      offer_hash: z.string().describe('Transaction hash of the order to cancel'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/cancel`, params);
      return jsonResponse(data);
    })
  );

  // ── BTCPay ──

  server.tool(
    'compose_btcpay',
    'Compose a BTC payment for a matched DEX order. Used to complete BTC trades on the DEX.',
    {
      address: z.string().describe('Source Bitcoin address'),
      order_match_id: z.string().describe('ID of the order match to pay for'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/btcpay`, params);
      return jsonResponse(data);
    })
  );

  // ── Issuance ──

  server.tool(
    'compose_issuance',
    'Compose a transaction to issue (create) a new Counterparty asset, or update an existing one.',
    {
      address: z.string().describe('Source Bitcoin address (will be the issuer)'),
      asset: z.string().describe('Asset name to create (4-12 uppercase chars, cannot start with A; or A + numeric ID for free numeric assets)'),
      quantity: z.number().describe('Raw integer amount to issue. For divisible: human amount * 10^8. For indivisible: whole number.'),
      divisible: z.boolean().default(true).optional().describe('Whether the asset is divisible (8 decimal places)'),
      description: z.string().optional().describe('Asset description (max 52 chars)'),
      transfer_destination: z.string().optional().describe('Transfer asset ownership to this address'),
      lock: z.boolean().optional().describe('Lock the asset (no further issuance)'),
      reset: z.boolean().optional().describe('Reset the asset'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/issuance`, params);
      return jsonResponse(data);
    })
  );

  // ── Dispenser ──

  server.tool(
    'compose_dispenser',
    'Compose a transaction to create, open, or close a dispenser. Dispensers automatically sell tokens for BTC.',
    {
      address: z.string().describe('Source Bitcoin address'),
      asset: z.string().describe('Asset to dispense'),
      give_quantity: z.number().describe('Raw integer amount of asset per dispense. For divisible: human amount * 10^8.'),
      escrow_quantity: z.number().describe('Raw integer total amount to load into dispenser. For divisible: human amount * 10^8.'),
      mainchainrate: z.number().describe('BTC price per dispense (in satoshis)'),
      status: z.number().default(0).optional().describe('0=open, 10=close'),
      open_address: z.string().optional().describe('Open dispenser on a different address'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/dispenser`, params);
      return jsonResponse(data);
    })
  );

  // ── Dispense ──

  server.tool(
    'compose_dispense',
    'Compose a transaction to buy from a dispenser by sending BTC to it',
    {
      address: z.string().describe('Source Bitcoin address (buyer)'),
      dispenser: z.string().describe('Dispenser address to buy from'),
      quantity: z.number().describe('Amount of BTC to send in satoshis (1 BTC = 100000000)'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/dispense`, params);
      return jsonResponse(data);
    })
  );

  // ── Dividend ──

  server.tool(
    'compose_dividend',
    'Compose a transaction to distribute dividends to all holders of an asset',
    {
      address: z.string().describe('Source Bitcoin address'),
      asset: z.string().describe('Asset whose holders will receive dividends'),
      dividend_asset: z.string().describe('Asset to distribute as dividend'),
      quantity_per_unit: z.number().describe('Raw integer amount of dividend asset per unit held. For divisible: human amount * 10^8.'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/dividend`, params);
      return jsonResponse(data);
    })
  );

  // ── Broadcast ──

  server.tool(
    'compose_broadcast',
    'Compose a transaction to broadcast a text message or numeric value to the Counterparty network',
    {
      address: z.string().describe('Source Bitcoin address'),
      text: z.string().describe('Text to broadcast'),
      value: z.number().default(0).optional().describe('Numeric value'),
      fee_fraction: z.number().default(0).optional().describe('Fee fraction for bet matching'),
      timestamp: z.number().optional().describe('Unix timestamp'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/broadcast`, params);
      return jsonResponse(data);
    })
  );

  // ── Sweep ──

  server.tool(
    'compose_sweep',
    'Compose a transaction to sweep all assets and/or BTC from one address to another',
    {
      address: z.string().describe('Source Bitcoin address'),
      destination: z.string().describe('Destination Bitcoin address'),
      flags: z.number().default(7).optional().describe('Bitfield: 1=transfer balances, 2=transfer ownership, 4=transfer BTC'),
      memo: z.string().optional().describe('Optional memo'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/sweep`, params);
      return jsonResponse(data);
    })
  );

  // ── Destroy ──

  server.tool(
    'compose_destroy',
    'Compose a transaction to permanently destroy (burn) Counterparty tokens',
    {
      address: z.string().describe('Source Bitcoin address'),
      asset: z.string().describe('Asset to destroy'),
      quantity: z.number().describe('Raw integer amount to destroy. For divisible: human amount * 10^8.'),
      tag: z.string().optional().describe('Optional tag/memo for the destruction'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/destroy`, params);
      return jsonResponse(data);
    })
  );

  // ── Fairminter ──

  server.tool(
    'compose_fairminter',
    'Compose a transaction to create a fair minting launch for a new asset',
    {
      address: z.string().describe('Source Bitcoin address'),
      asset: z.string().describe('Asset name to create'),
      max_mint_per_tx: z.number().optional().describe('Raw integer max per tx. For divisible: human amount * 10^8.'),
      hard_cap: z.number().optional().describe('Raw integer max total supply. For divisible: human amount * 10^8.'),
      divisible: z.boolean().default(true).optional().describe('Whether the asset is divisible'),
      start_block: z.number().optional().describe('Block height when minting starts'),
      end_block: z.number().optional().describe('Block height when minting ends'),
      soft_cap: z.number().optional().describe('Raw integer soft cap. For divisible: human amount * 10^8.'),
      soft_cap_deadline_block: z.number().optional().describe('Deadline block for reaching soft cap'),
      minted_asset_commission: z.number().optional().describe('Commission fraction (0-1) on minted assets'),
      burn_payment: z.boolean().optional().describe('Whether BTC payment is burned'),
      premint_quantity: z.number().optional().describe('Raw integer amount to premint. For divisible: human amount * 10^8.'),
      description: z.string().optional().describe('Asset description'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/fairminter`, params);
      return jsonResponse(data);
    })
  );

  // ── Fairmint ──

  server.tool(
    'compose_fairmint',
    'Compose a transaction to mint tokens from an active fair minter',
    {
      address: z.string().describe('Source Bitcoin address'),
      asset: z.string().describe('Asset to mint'),
      quantity: z.number().optional().describe('Raw integer amount to mint. For divisible: human amount * 10^8. If omitted, mints max allowed.'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/fairmint`, params);
      return jsonResponse(data);
    })
  );

  // ── Attach (UTXO) ──

  server.tool(
    'compose_attach',
    'Compose a transaction to attach Counterparty tokens to a specific UTXO',
    {
      address: z.string().describe('Source Bitcoin address'),
      asset: z.string().describe('Asset to attach'),
      quantity: z.number().describe('Raw integer amount to attach. For divisible: human amount * 10^8.'),
      destination_vout: z.number().optional().describe('Output index to attach to'),
      ...feeOptions,
      ...utxoOptions,
    },
    composeAnnotations,
    safeHandler(async ({ address, ...params }) => {
      const data = await client.get(`/v2/addresses/${address}/compose/attach`, params);
      return jsonResponse(data);
    })
  );

  // ── Detach (UTXO) ──

  server.tool(
    'compose_detach',
    'Compose a transaction to detach Counterparty tokens from a UTXO back to an address',
    {
      utxo: z.string().describe('UTXO identifier (txid:vout)'),
      destination: z.string().describe('Destination Bitcoin address'),
      ...feeOptions,
    },
    composeAnnotations,
    safeHandler(async ({ utxo, ...params }) => {
      const data = await client.get(`/v2/utxos/${utxo}/compose/detach`, params);
      return jsonResponse(data);
    })
  );

  // ── Move to UTXO ──

  server.tool(
    'compose_movetoutxo',
    'Compose a transaction to move a UTXO (and any attached tokens) to a new output',
    {
      utxo: z.string().describe('UTXO identifier (txid:vout)'),
      destination: z.string().optional().describe('Destination Bitcoin address'),
      ...feeOptions,
    },
    composeAnnotations,
    safeHandler(async ({ utxo, ...params }) => {
      const data = await client.get(`/v2/utxos/${utxo}/compose/movetoutxo`, params);
      return jsonResponse(data);
    })
  );
}
