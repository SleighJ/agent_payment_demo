# Agent Payments Platform

A Telegram-based payment infrastructure for AI agents, built on Solana.

## Features

- **Wallet Management**: Create and manage Solana wallets via Telegram
- **Agent-to-Agent Payments**: Instant USDC transfers between agents
- **Spending Limits**: Daily caps to prevent runaway spending
- **Fiat Off-ramp**: Withdraw to bank (stubbed for devnet)
- **Transaction History**: Full audit trail of all payments

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get a Telegram Bot Token

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 3. Configure Environment

Create a `.env` file:

```bash
# Telegram Bot Token (from BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Solana Network
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# Database
DATABASE_PATH=./data/agent-payments.db

# Platform Settings
PLATFORM_FEE_PERCENT=1.0
DEFAULT_DAILY_LIMIT=1000
```

### 4. Run the Bot

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

### 5. Test in Telegram

1. Find your bot on Telegram
2. Send `/start` to create your account
3. Send `/connect` to create a wallet
4. Get devnet USDC from [Circle Faucet](https://faucet.circle.com/)
5. Send `/pay <address> <amount>` to test transfers

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Create account and see welcome message |
| `/connect` | Create a new Solana wallet |
| `/connect agent` | Create an agent wallet |
| `/balance` | Check wallet balances |
| `/pay <address> <amount>` | Send USDC to another wallet |
| `/limit` | View current spending limit |
| `/limit <amount>` | Set daily spending limit |
| `/withdraw <amount>` | Withdraw to bank (stubbed) |
| `/history` | View transaction history |
| `/help` | Show all commands |

## Scripts

```bash
# Set up devnet wallet and get instructions
npm run setup-devnet

# Simulate agent-to-agent transfers
npm run simulate

# Run tests
npm test
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Telegram      │────▶│   Bot Server    │
│   (Human/Agent) │     │   (grammY)      │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │  Wallet   │ │Transaction│ │  Limits   │
            │  Service  │ │  Service  │ │  Service  │
            └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                  │             │             │
                  ▼             ▼             ▼
            ┌─────────────────────────────────────┐
            │           SQLite Database           │
            └─────────────────────────────────────┘
                             │
                             ▼
            ┌─────────────────────────────────────┐
            │         Solana Devnet (USDC)        │
            └─────────────────────────────────────┘
```

## Tech Stack

- **Bot Framework**: [grammY](https://grammy.dev/)
- **Blockchain**: Solana (devnet)
- **Database**: SQLite via sql.js
- **Language**: TypeScript
- **Runtime**: Node.js 18+

## Devnet Testing

This bot runs on Solana devnet by default. To test:

1. Create a wallet with `/connect`
2. Get free devnet USDC from [faucet.circle.com](https://faucet.circle.com/)
3. Test payments between wallets

No real money is involved on devnet.

## Production Deployment

For mainnet deployment:

1. Change `SOLANA_NETWORK=mainnet-beta` in `.env`
2. Use a reliable RPC provider (Helius, QuickNode)
3. Set up Stripe Connect for fiat withdrawals
4. Deploy to Railway, Fly.io, or similar

## License

MIT

