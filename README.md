# Counterparty MCP Server

Give AI agents the ability to interact with [Counterparty](https://counterparty.io) — the token protocol built on Bitcoin. Query balances, assets, orders, and dispensers. Compose, sign, and broadcast transactions. Works with any MCP-compatible client.

[![npm](https://img.shields.io/npm/v/@21e14/mcp-server)](https://www.npmjs.com/package/@21e14/mcp-server)

## Install

No download needed — just add the config below to your AI client. `npx` fetches and runs the server automatically.

### Claude Desktop

Add to `claude_desktop_config.json` ([how to find it](https://modelcontextprotocol.io/quickstart/user)):

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["-y", "@21e14/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add counterparty -- npx -y @21e14/mcp-server
```

With signing (see [Signing & Broadcasting](#signing--broadcasting)):

```bash
claude mcp add counterparty \
  -e SIGNER_PRIVATE_KEY=L1aW4aubDFB7yfras2S1mN... \
  -e SIGNER_ADDRESS=bc1q... \
  -- npx -y @21e14/mcp-server
```

Manage servers with `claude mcp list`, `claude mcp get counterparty`, or `claude mcp remove counterparty`.

### VS Code (Copilot)

Use `Ctrl+Shift+P` → **MCP: Add Server** → **Stdio**, then enter:

```
npx -y @21e14/mcp-server
```

Or add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "counterparty": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@21e14/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["-y", "@21e14/mcp-server"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["-y", "@21e14/mcp-server"]
    }
  }
}
```

### ChatGPT

In ChatGPT desktop, go to **Settings → Beta Features → MCP Servers**, then add:

```
npx -y @21e14/mcp-server
```

### Any MCP Client

The server speaks stdio. Point any MCP-compatible client at:

```bash
npx -y @21e14/mcp-server
```

That's it. The agent can now query the Counterparty network and compose unsigned transactions.

## Signing & Broadcasting

To let the agent sign and broadcast transactions, add a signing key:

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "npx",
      "args": ["-y", "@21e14/mcp-server"],
      "env": {
        "SIGNER_PRIVATE_KEY": "L1aW4aubDFB7yfras2S1mN...",
        "SIGNER_ADDRESS": "bc1q..."
      }
    }
  }
}
```

This enables the `sign_and_broadcast` tool. **Signing gives the AI agent the ability to spend funds** — read the security guidance below.

### Bot wallet pattern (recommended)

1. **Generate a fresh keypair offline.** Don't reuse an existing wallet or generate keys through the AI.
2. **Fund it with only what you're willing to risk.** This is your blast radius.
3. **Use a segwit address.** P2WPKH (`bc1q...`), P2SH-P2WPKH (`3...`), or P2TR (`bc1p...`). Legacy P2PKH is not supported.
4. **One key, one address.** No HD derivation. Counterparty reuses addresses by design.
5. **Keep main holdings elsewhere.** The bot wallet is disposable.

### Compose-only mode

Without signing keys, the server returns unsigned transaction hex from all compose tools. You can review and sign offline with your own tooling. This is the safest mode.

### Transaction verification

`sign_and_broadcast` extracts and returns the embedded OP_RETURN data from the transaction before signing — done locally without trusting the API, so the agent can verify the transaction matches what was requested.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COUNTERPARTY_NODE` | No | Counterparty node URL (default: `https://api.counterparty.io:4000`) |
| `SIGNER_PRIVATE_KEY` | No | WIF-encoded private key for signing |
| `SIGNER_ADDRESS` | No | Bitcoin address for the signing key |

## Tools

### Query (24)

| Tool | Description |
|------|-------------|
| `get_balances` | All token balances for an address |
| `get_balance` | Single asset balance for an address |
| `get_asset_info` | Asset metadata (supply, divisibility, issuer) |
| `get_asset_balances` | All holders of an asset |
| `get_assets` | Search/list assets |
| `get_issuances` | Issuance history for an asset |
| `get_owned_assets` | Assets issued by an address |
| `get_orders` | DEX orders |
| `get_order` | Single order by hash |
| `get_order_matches` | Matches for an order |
| `get_orders_by_pair` | Order book for a trading pair |
| `get_asset_orders` | Orders involving an asset |
| `get_address_orders` | Orders by address |
| `get_dispensers` | Dispensers |
| `get_dispenser` | Single dispenser by hash |
| `get_dispensers_by_asset` | Dispensers for an asset |
| `get_address_dispensers` | Dispensers by address |
| `get_dispenses` | Purchases from a dispenser |
| `get_dividends` | Dividend distributions for an asset |
| `get_address_transactions` | Transaction history for an address |
| `get_sends` | Token transfers from an address |
| `get_transaction` | Single transaction by hash |
| `get_utxo_balances` | Tokens attached to a UTXO |
| `get_latest_block` | Latest block info |

### Compose (18)

| Tool | Description |
|------|-------------|
| `compose_send` | Send tokens to an address |
| `compose_mpma` | Multi-party multi-asset send |
| `compose_order` | Place a DEX order |
| `compose_cancel` | Cancel an open order |
| `compose_btcpay` | Pay for a matched BTC order |
| `compose_issuance` | Create or update an asset (supports inscriptions) |
| `compose_dispenser` | Create, open, or close a dispenser |
| `compose_dispense` | Buy from a dispenser |
| `compose_dividend` | Distribute dividends to holders |
| `compose_broadcast` | Broadcast a message (supports inscriptions) |
| `compose_sweep` | Sweep all assets to a destination |
| `compose_destroy` | Permanently burn tokens |
| `compose_fairminter` | Create a fair launch (supports inscriptions) |
| `compose_xcp420_fairminter` | XCP-420 compliant fair launch |
| `compose_fairmint` | Mint from an active fair launch |
| `compose_attach` | Attach tokens to a UTXO |
| `compose_detach` | Detach tokens from a UTXO |
| `compose_movetoutxo` | Move a UTXO to a new output |

### Bitcoin (4)

| Tool | Description |
|------|-------------|
| `sign_and_broadcast` | Sign and broadcast (requires signing keys) |
| `broadcast_transaction` | Broadcast an already-signed transaction |
| `get_fee_estimate` | Current fee rate estimate |
| `decode_transaction` | Decode raw transaction hex |

### Utility (3)

| Tool | Description |
|------|-------------|
| `unpack_transaction` | Decode a Counterparty message from a transaction |
| `get_server_info` | Node status and version |
| `api_request` | Raw API request to any endpoint ([full API reference](https://raw.githubusercontent.com/CounterpartyXCP/counterparty-core/refs/heads/master/apiary.apib)) |

## Resources

The server includes protocol documentation that agents can read for context:

- `counterparty://protocol-overview` — Assets, quantities, DEX, dispensers, fair minting, fees, and operational tips
- `counterparty://xcp420-standard` — XCP-420 fair launch standard
- `counterparty://quick-start` — Step-by-step workflows for common operations

## Development

```bash
git clone https://github.com/XCP/mcp-server.git
cd mcp-server
npm install
npm test
```

Test locally:

```json
{
  "mcpServers": {
    "counterparty": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

## License

MIT
