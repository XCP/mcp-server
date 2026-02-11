import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROTOCOL_OVERVIEW = `# Counterparty Protocol Overview

Counterparty is a protocol built on top of Bitcoin that enables the creation and trading of digital assets (tokens).

## Key Concepts

### Assets / Tokens
- **Named assets**: Custom names like PEPECASH, FLOORCARD. Must be 4-12 uppercase letters and **cannot start with "A"** (that prefix is reserved for numeric assets). Costs **0.5 XCP** to register.
- **Numeric assets**: Auto-assigned IDs in the form A + number (e.g. A12345678901234567). **Free** to register.
- **Subassets**: Registered as PARENT.child (e.g. PEPECASH.RARE). Under the hood, subassets are numeric assets with an \`asset_longname\` field storing the human-readable name. When displaying assets, use \`asset_longname\` if present, otherwise \`asset\` (i.e. \`asset_longname ?? asset\`). **Free** to register.
- **Divisible vs Indivisible**: Divisible assets have 8 decimal places (like BTC). Indivisible assets are whole numbers only.
- **XCP**: The native Counterparty token, used for protocol fees.

### Quantities — CRITICAL

All API responses include both raw integer and human-readable normalized fields:
- \`quantity\`: Raw integer (e.g. \`100000000\`)
- \`quantity_normalized\`: Human-readable string (e.g. \`"1.00000000"\`)

**Divisible assets** (like XCP): stored as integers with 8 decimal places. 1.0 XCP = \`100000000\` in the API.
**Indivisible assets**: stored as whole integers. 1 token = \`1\` in the API.

**IMPORTANT: Compose endpoints accept ONLY raw integers, never normalized values.**
- To send 1.0 of a divisible asset, pass \`quantity: 100000000\` (not \`1\` or \`1.0\`)
- To send 1 of an indivisible asset, pass \`quantity: 1\`
- Getting this wrong means sending 0.00000001 instead of 1.0 — an off-by-10^8 error

**Before composing any transaction**, check the asset's \`divisible\` flag via \`get_asset_info\`:
- If \`divisible: true\`: multiply the human amount by \`10^8\` → pass as integer
- If \`divisible: false\`: pass the amount directly as integer
- BTC is always expressed in satoshis (1 BTC = \`100000000\` satoshis)

When reading query results, prefer the \`_normalized\` fields for display and the raw integer fields for compose inputs.

### DEX (Decentralized Exchange)
- Users can place **orders** to trade any asset pair (including BTC)
- Orders are matched on-chain by the protocol
- For BTC trades, the buyer must make a **BTCPay** transaction to complete the trade
- Orders have an **expiration** in blocks. **Maximum expiration is 8064 blocks** (~2 months)

### Dispensers
- Automated token vending machines on Bitcoin addresses
- Send BTC to a dispenser address to receive tokens at a fixed rate
- The **mainchainrate** is the BTC price (in satoshis) per dispense
- **give_quantity** is the amount of tokens per dispense
- **escrow_quantity** is the total tokens loaded into the dispenser

### UTXO-Attached Assets
- Tokens can be **attached** to specific UTXOs
- Attached tokens move when the UTXO is spent
- Use **detach** to move tokens back to an address-based balance
- Use **movetoutxo** to move a UTXO to a new output
- UTXO operations work with any address type

### Inscriptions
- Counterparty can embed data via Bitcoin inscriptions (ordinal envelope scripts)
- **Inscriptions require a taproot (P2TR) address**
- Supported for: issuances, subasset issuances, fairminters, and broadcasts

### Fair Minting
- **Fairminter**: Creates a new asset with fair launch mechanics
- **Fairmint**: Allows anyone to mint from an active fairminter
- Can set hard caps, per-tx limits, start/end blocks, and commissions

### Sends & MPMA
- **Enhanced send**: Standard token transfer between addresses
- **MPMA** (Multi-Party Multi-Asset): Send multiple assets to multiple recipients in one transaction

### Transaction Lifecycle
1. **Compose**: Build an unsigned transaction using a compose endpoint
2. **Sign**: Sign the transaction with your private key
3. **Broadcast**: Submit the signed transaction to the Bitcoin network

The compose endpoints return:
- \`rawtransaction\`: Unsigned transaction hex
- \`params\`: The Counterparty parameters encoded in the transaction
- \`inputs_values\` and \`lock_scripts\`: Data needed for signing (always included via verbose mode)

## Protocol Fees & Limits

### Asset Registration Fees
- **Named assets** (4-12 uppercase chars): **0.5 XCP**
- **Numeric assets** (A + number, 13+ chars): **Free**
- **Subassets** (PARENT.CHILD): **Free**

### Transaction Fees
- **Dividends**: **0.0002 XCP per holder** of the asset receiving dividends
- **Sweep**: **0.5 XCP** base fee + anti-spam fee (0.001 XCP x2 per balance + 0.001 XCP x4 per issuance held)
- All other transaction types (sends, orders, dispensers, etc.) have no XCP protocol fee — only the Bitcoin miner fee

### Limits
- **Max order expiration**: 8064 blocks (~2 months)
- **Max dispenser refills**: 5

## Operational Tips

### Bulk Operations & Transaction Chaining
- Bitcoin Core limits unconfirmed transaction chains to **25 ancestors** (mempool policy). If you broadcast 25 transactions spending each other's outputs, the 26th will be rejected.
- After broadcasting a transaction, **wait 15–30 seconds** before composing the next one. The Counterparty node needs time to see the new transaction in the mempool and reflect updated balances/UTXOs.
- For sequenced operations (e.g. issue → attach → move), each step depends on the previous transaction's output. Compose each step only after confirming the prior broadcast succeeded and the node has processed it.

### MPMA vs Individual Sends
- MPMA (multi-party multi-asset) sends pack multiple transfers into one transaction using efficient bit-level encoding.
- However, when the encoded data exceeds the OP_RETURN limit (~80 bytes), the transaction falls back to bare multisig encoding which uses more block weight.
- For a small number of recipients (2–4), individual enhanced sends via OP_RETURN are often smaller and cheaper than a single MPMA transaction.
- MPMA is most beneficial for large batches (10+) where the per-send overhead savings outweigh the encoding cost.

## API Pagination
- Most list endpoints support \`cursor\`, \`limit\`, and \`offset\` parameters
- The response includes a \`next_cursor\` field for fetching the next page
- Default limit is typically 100, max is 1000
`;

const XCP420_STANDARD = `# XCP-420 Fair Launch Standard

XCP-420 is a community-driven fair launch standard for Counterparty fairminters. It defines fixed parameters so every launch is safe, fair, and repeatable.

## Why XCP-420

- **Familiarity**: Every mint follows the same parameters
- **Fairness**: No premine, no creator rake, no hidden edge cases
- **Safety**: Refunds enforced by the protocol if soft cap isn't met
- **Anti-whale**: Max 0.35% of supply per address
- **Trustless**: 100% enforced by the Counterparty protocol

## Fixed Parameters

| Parameter | Human Value | API Integer |
|-----------|------------|-------------|
| hard_cap | 10,000,000 tokens | 1000000000000000 |
| soft_cap | 4,200,000 tokens (42%) | 420000000000000 |
| price | 0.1 XCP per mint | 10000000 |
| quantity_by_price | 1,000 tokens per mint | 100000000000 |
| max_mint_per_tx | 35,000 tokens | 3500000000000 |
| max_mint_per_address | 35,000 tokens (0.35%) | 3500000000000 |
| Duration | 1,000 blocks (~7 days) | end_block = start_block + 1000 |
| soft_cap_deadline_block | end_block - 1 | end_block - 1 |
| burn_payment | true | true |
| lock_quantity | true | true |
| divisible | true | true |
| premint_quantity | 0 | 0 |
| minted_asset_commission | 0 | 0 |

## Lifecycle

1. **Rolled Up**: Scheduled to begin at start_block
2. **Lit**: Minting open for 1,000 blocks (~1 week)
3. **Burned**: If >= 4.2M tokens minted, all contributed XCP is burned and tokens distributed
4. **Ashed**: If < 4.2M tokens minted, all XCP is automatically refunded (BTC miner fees excluded)

Average result: ~285 addresses burn 1,000 XCP total to share 10M tokens.

## How to Use

Use the \`compose_xcp420_fairminter\` tool. Only three inputs are needed:
- **asset**: The asset name to create
- **start_block**: A future block height when minting starts (runs for exactly 1000 blocks)
- **description**: Optional asset description

All other parameters are automatically set to the XCP-420 standard values.
`;

const QUICK_START = `# Quick Start Workflows

Common step-by-step workflows for Counterparty operations. Each workflow assumes you have a funded Bitcoin address.

## Signing Mode

The final step of each workflow uses \`sign_and_broadcast\`, which requires \`SIGNER_PRIVATE_KEY\` and \`SIGNER_ADDRESS\` environment variables. If these are not set, the server operates in **compose-only mode** — all compose tools still work and return unsigned transaction hex, but you cannot sign or broadcast.

**Recommended setup**: Create a fresh keypair, fund it with only what you're willing to risk, and use a segwit address (bc1q... or bc1p...). This is your bot wallet — keep main holdings elsewhere.

## Send Tokens

1. \`get_asset_info\` — Check the asset's \`divisible\` flag
2. \`get_balance\` — Confirm the source address holds enough of the asset
3. \`get_fee_estimate\` — Get the current fee rate
4. \`compose_send\` — Build the transaction (remember: divisible assets need quantity * 10^8)
5. \`sign_and_broadcast\` — Sign and broadcast (pass \`rawtransaction\`, \`inputs_values\`, and \`lock_scripts\` from the compose response)

## Create a New Asset

1. \`get_balance\` — Confirm the address holds at least 0.5 XCP (named assets cost 0.5 XCP; numeric assets starting with "A" are free)
2. \`compose_issuance\` — Build the issuance transaction (choose asset name, quantity, divisible, description)
3. \`sign_and_broadcast\` — Sign and broadcast
4. Wait for confirmation, then \`get_asset_info\` to verify

## Set Up a Dispenser

1. \`get_asset_info\` — Check divisibility of the asset you want to dispense
2. \`get_balance\` — Confirm you hold enough of the asset
3. \`compose_dispenser\` — Build the dispenser (set \`give_quantity\` per dispense, \`escrow_quantity\` total, \`mainchainrate\` in satoshis)
4. \`sign_and_broadcast\` — Sign and broadcast
5. Anyone can now send BTC to your address to receive tokens automatically

## Place a DEX Order

1. \`get_asset_info\` — Check divisibility of both assets in the pair
2. \`get_orders_by_pair\` — Check the current order book for the trading pair
3. \`compose_order\` — Build the order (\`give_asset\`, \`give_quantity\`, \`get_asset\`, \`get_quantity\`, \`expiration\` max 8064 blocks)
4. \`sign_and_broadcast\` — Sign and broadcast
5. If trading BTC: when matched, use \`get_order_matches\` to find the match, then \`compose_btcpay\` + \`sign_and_broadcast\` to complete the trade

## Check Transaction Status

1. \`get_transaction\` — Look up a specific transaction by hash
2. \`unpack_transaction\` — Decode the embedded Counterparty message to verify what was sent

## Tips

- Always check \`get_asset_info\` before composing — getting divisibility wrong means an off-by-10^8 error
- After broadcasting, wait 15–30 seconds before composing the next transaction
- Use \`get_fee_estimate\` to pick an appropriate \`sat_per_vbyte\` — overpaying wastes BTC, underpaying risks getting stuck
- For bulk sends to many addresses, consider \`compose_mpma\` for 10+ recipients, or individual \`compose_send\` calls for 2–4 recipients
- For high-value transactions, use \`decode_transaction\` or \`unpack_transaction\` to verify the composed transaction before signing
- The \`sign_and_broadcast\` tool automatically extracts and returns OP_RETURN data for verification, but manual inspection adds an extra safety layer
`;

export function registerResources(server: McpServer) {
  server.resource(
    'protocol-overview',
    'counterparty://protocol-overview',
    {
      description: 'Overview of Counterparty protocol concepts, asset types, DEX, dispensers, and transaction lifecycle',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [{
        uri: 'counterparty://protocol-overview',
        mimeType: 'text/markdown',
        text: PROTOCOL_OVERVIEW,
      }],
    })
  );

  server.resource(
    'xcp420-standard',
    'counterparty://xcp420-standard',
    {
      description: 'XCP-420 fair launch standard — fixed parameters for safe, fair, repeatable token launches',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [{
        uri: 'counterparty://xcp420-standard',
        mimeType: 'text/markdown',
        text: XCP420_STANDARD,
      }],
    })
  );

  server.resource(
    'quick-start',
    'counterparty://quick-start',
    {
      description: 'Step-by-step workflows for common Counterparty operations (send tokens, create assets, dispensers, DEX orders)',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [{
        uri: 'counterparty://quick-start',
        mimeType: 'text/markdown',
        text: QUICK_START,
      }],
    })
  );
}
