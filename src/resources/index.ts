import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROTOCOL_OVERVIEW = `# Counterparty Protocol Overview

Counterparty is a protocol built on top of Bitcoin that enables the creation and trading of digital assets (tokens).

## Key Concepts

### Assets / Tokens
- **Named assets**: Custom names like PEPECASH, FLOORCARD (4+ uppercase chars, no starting with "A" followed by numbers)
- **Numeric assets**: Automatically assigned IDs like A12345678901234567
- **Subassets**: Child assets like PARENT.CHILD
- **Divisible vs Indivisible**: Divisible assets have 8 decimal places (like BTC). Indivisible assets are whole numbers only.
- **XCP**: The native Counterparty token, used for some protocol fees

### Quantities
- For **divisible** assets, quantities in the API are in satoshi-like units (multiply display amount by 10^8)
- For **indivisible** assets, quantities are whole numbers
- Always check the asset's \`divisible\` flag via \`get_asset_info\` when working with quantities

### DEX (Decentralized Exchange)
- Users can place **orders** to trade any asset pair (including BTC)
- Orders are matched on-chain by the protocol
- For BTC trades, the buyer must make a **BTCPay** transaction to complete the trade
- Orders have an **expiration** in blocks

### Dispensers
- Automated token vending machines on Bitcoin addresses
- Send BTC to a dispenser address to receive tokens at a fixed rate
- The **mainchainrate** is the BTC price (in satoshis) per dispense
- **give_quantity** is the amount of tokens per dispense
- **escrow_quantity** is the total tokens loaded into the dispenser

### UTXO-Attached Assets
- Tokens can be **attached** to specific UTXOs (like Stamps/SRC-20)
- Attached tokens move when the UTXO is spent
- Use **detach** to move tokens back to an address-based balance
- Use **movetoutxo** to move a UTXO to a new output

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
- When \`verbose=true\`: Additional data like \`inputs_values\` and \`lock_scripts\` for signing

## API Pagination
- Most list endpoints support \`cursor\`, \`limit\`, and \`offset\` parameters
- The response includes a \`next_cursor\` field for fetching the next page
- Default limit is typically 100, max is 1000
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
}
