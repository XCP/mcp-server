# @xcp/mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI agents access to the [Counterparty](https://counterparty.io) protocol — query balances, assets, orders, dispensers, compose transactions, and optionally sign & broadcast, all through your own Counterparty node.

## Quick Start

### 1. Add to your MCP client config

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["@xcp/mcp-server"],
      "env": {
        "COUNTERPARTY_NODE": "https://api.counterparty.io"
      }
    }
  }
}
```

**Claude Code** (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["@xcp/mcp-server"],
      "env": {
        "COUNTERPARTY_NODE": "https://api.counterparty.io"
      }
    }
  }
}
```

This gives the agent read-only access to query balances, assets, orders, dispensers, etc., and the ability to compose unsigned transactions.

### 2. (Optional) Enable transaction signing

To let the agent sign and broadcast transactions, add a signing key and address:

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["@xcp/mcp-server"],
      "env": {
        "COUNTERPARTY_NODE": "https://api.counterparty.io",
        "SIGNER_PRIVATE_KEY": "L1aW4aubDFB7yfras2S1mN...",
        "SIGNER_ADDRESS": "bc1q..."
      }
    }
  }
}
```

This enables the `sign_and_broadcast` tool. **Read the Security section below before enabling this.**

## Security

**Signing gives the AI agent the ability to spend funds.** Treat this seriously.

### Recommended: bot wallet pattern

1. **Generate a fresh keypair offline.** Do not reuse an existing wallet. Use standard Bitcoin tools to create a new private key and address — do not generate keys through the MCP server or AI.
2. **Fund it with only what you're willing to risk.** Transfer a small, bounded amount of BTC and tokens to the bot address. This is your blast radius.
3. **Use a single address.** One private key, one address, no HD derivation complexity. Counterparty reuses addresses by design.
4. **Keep your main holdings elsewhere.** The bot wallet is disposable. If something goes wrong, you lose only what's in it.

### Without signing keys

Without `SIGNER_PRIVATE_KEY` and `SIGNER_ADDRESS`, the server operates in compose-only mode. All compose tools still work and return unsigned transaction hex, which you can review and sign offline using your own tools. This is the safest mode of operation.

### Transaction verification

When `sign_and_broadcast` is used, the server extracts and returns the embedded OP_RETURN data from the composed transaction before signing. This is done locally without trusting the API, so the AI can verify the transaction contents match what was requested.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COUNTERPARTY_NODE` | Yes | URL of your Counterparty node (e.g. `https://api.counterparty.io`) |
| `SIGNER_PRIVATE_KEY` | No | WIF-encoded private key for transaction signing |
| `SIGNER_ADDRESS` | No | Bitcoin address corresponding to the private key (determines address type for signing) |

## Available Tools

### Query Tools (19)
Read-only queries against the Counterparty API:

| Tool | Description |
|------|-------------|
| `get_balances` | Get all token balances for an address |
| `get_balance` | Get balance of a specific asset for an address |
| `get_asset_info` | Get asset metadata (supply, divisibility, issuer) |
| `get_asset_balances` | Get all balances for an asset across all holders |
| `get_assets` | Search/list assets |
| `get_issuances` | Get issuance history for an asset |
| `get_orders` | Get open DEX orders |
| `get_order` | Get a specific order |
| `get_order_matches` | Get matches for an order |
| `get_orders_by_pair` | Get order book for a trading pair |
| `get_address_orders` | Get orders by address |
| `get_dispensers` | Get all open dispensers |
| `get_dispenser` | Get a specific dispenser |
| `get_dispensers_by_asset` | Get dispensers for an asset |
| `get_address_dispensers` | Get dispensers by address |
| `get_address_transactions` | Get transaction history |
| `get_sends` | Get sends from an address |
| `get_utxo_balances` | Get token balances on a UTXO |
| `get_block` | Get latest block info |

### Compose Tools (17)
Build unsigned transactions (returns raw tx hex + PSBT):

| Tool | Description |
|------|-------------|
| `compose_send` | Send tokens to an address |
| `compose_mpma` | Multi-party multi-asset send |
| `compose_order` | Create a DEX order |
| `compose_cancel` | Cancel an open order |
| `compose_btcpay` | Pay for a matched BTC order |
| `compose_issuance` | Issue/create a new asset |
| `compose_dispenser` | Create/manage a dispenser |
| `compose_dispense` | Buy from a dispenser |
| `compose_dividend` | Distribute dividends |
| `compose_broadcast` | Broadcast a message |
| `compose_sweep` | Sweep all assets to destination |
| `compose_destroy` | Burn tokens |
| `compose_fairminter` | Create a fair launch |
| `compose_fairmint` | Mint from a fairminter |
| `compose_attach` | Attach tokens to a UTXO |
| `compose_detach` | Detach tokens from a UTXO |
| `compose_movetoutxo` | Move UTXO to new address |

### Bitcoin Tools (4)
| Tool | Description |
|------|-------------|
| `broadcast_transaction` | Broadcast a signed transaction |
| `sign_and_broadcast` | Sign with local key and broadcast (requires `SIGNER_PRIVATE_KEY` + `SIGNER_ADDRESS`) |
| `get_fee_estimate` | Get current fee rate |
| `decode_transaction` | Decode a raw transaction |

### Utility Tools (3)
| Tool | Description |
|------|-------------|
| `unpack_transaction` | Decode a Counterparty message |
| `get_server_info` | Get node status and version |
| `api_request` | Generic escape hatch for any API endpoint |

## Resources

The server exposes an MCP resource with protocol documentation:

- `counterparty://protocol-overview` — Summary of Counterparty concepts (assets, divisibility, DEX, dispensers, fair minting, etc.)

## Development

```bash
git clone https://github.com/XCP/mcp-server.git
cd mcp-server
npm install
npm run build
npm test
```

Test locally by adding to your MCP client config:

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "COUNTERPARTY_NODE": "https://api.counterparty.io"
      }
    }
  }
}
```

## License

MIT
