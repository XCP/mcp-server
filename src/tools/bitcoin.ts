import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../api-client.js';
import { SigningConfig, signTransaction, extractOpReturnData } from '../signer.js';
import { jsonResponse, safeHandler } from '../helpers.js';

export function registerBitcoinTools(server: McpServer, client: ApiClient, signingConfig: SigningConfig | null) {
  // ── Broadcast Transaction ──

  server.tool(
    'broadcast_transaction',
    'Broadcast a signed Bitcoin transaction to the network via the Counterparty node',
    {
      raw_transaction: z.string().describe('Signed raw transaction hex'),
    },
    { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    safeHandler(async ({ raw_transaction }) => {
      const data = await client.post('/v2/bitcoin/transactions', {
        signedhex: raw_transaction,
      });
      return jsonResponse(data);
    })
  );

  // ── Sign and Broadcast ──

  if (signingConfig) {
    server.tool(
      'sign_and_broadcast',
      `Sign a raw transaction with the configured private key and broadcast it. ` +
      `The signing key corresponds to address: ${signingConfig.address}. ` +
      `Only use this with transactions composed for this address.`,
      {
        raw_transaction: z.string().describe('Unsigned raw transaction hex (from a compose tool)'),
        inputs_values: z.array(z.number()).optional().describe('Input values in satoshis (from compose response btc_in_values or inputs_values)'),
        lock_scripts: z.array(z.string()).optional().describe('Input lock scripts in hex (from compose response lock_scripts)'),
      },
      { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      safeHandler(async ({ raw_transaction, inputs_values, lock_scripts }) => {
        // Extract OP_RETURN data locally (trustless — does not call the API)
        const opReturnData = extractOpReturnData(raw_transaction);

        const signedHex = signTransaction(
          raw_transaction,
          signingConfig,
          inputs_values,
          lock_scripts,
        );

        const data = await client.post('/v2/bitcoin/transactions', {
          signedhex: signedHex,
        });

        return jsonResponse({
          op_return_data: opReturnData,
          has_counterparty_data: opReturnData !== null,
          signed_transaction: signedHex,
          broadcast_result: data,
        });
      })
    );
  }

  // ── Fee Estimate ──

  server.tool(
    'get_fee_estimate',
    'Get the current Bitcoin fee rate estimate from the Counterparty node',
    {
      conf_target: z.number().default(3).optional().describe('Confirmation target in blocks (default 3)'),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    safeHandler(async ({ conf_target }) => {
      const data = await client.get('/v2/bitcoin/estimatesmartfee', { conf_target });
      return jsonResponse(data);
    })
  );

  // ── Decode Transaction ──

  server.tool(
    'decode_transaction',
    'Decode a raw Bitcoin transaction hex into its components (inputs, outputs, etc.)',
    {
      raw_transaction: z.string().describe('Raw transaction hex to decode'),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    safeHandler(async ({ raw_transaction }) => {
      const data = await client.get('/v2/bitcoin/transactions/decode', { rawtransaction: raw_transaction });
      return jsonResponse(data);
    })
  );
}
