# Pulsar

**Your Wealth, One Dashboard** — A unified personal finance dashboard for tracking all your assets in one place.

## What It Does

Pulsar is a personal portfolio tracker that brings together crypto, banking, and brokerage accounts into a single clean interface. Built for personal use.

### Features
- 🔐 **Multi-chain Crypto Tracking** — Monitor wallets across Ethereum, Bitcoin, Solana, Arbitrum, Base, Polygon, and Hyperliquid
- 🏦 **Bank Accounts** — Connect checking and savings accounts via Plaid
- 📈 **Brokerage Accounts** — Track investment holdings via Plaid
- 📊 **Unified Dashboard** — Filter by account type (crypto / bank / brokerage) with a single total
- 🔄 **Automated Refresh** — Scheduled balance updates every 4 hours
- 🔑 **Your Own API Keys** — Uses Alchemy, Helius, CoinGecko, and Plaid for data
- 🎨 **Modern UI** — Dark theme, responsive design

## Tech Stack

- **Framework:** [Remix](https://remix.run/) + React + TypeScript
- **Bundler:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v4
- **Database:** PostgreSQL + [Prisma](https://prisma.io/)
- **Charts:** Recharts
- **Animations:** [Framer Motion](https://framer.com/motion/)
- **Blockchain APIs:** Alchemy, Helius, CoinGecko
- **Banking/Brokerage:** [Plaid](https://plaid.com/)

## Setup

```bash
bun install
cp .env.example .env   # Edit with your credentials (see below)
bunx prisma migrate deploy
bun run dev
```

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
APP_KEY=random-string
SESSION_SECRET=random-string
ENCRYPTION_SECRET=random-string    # Encrypts Plaid access tokens at rest

# Blockchain API Keys
ALCHEMY_API_KEY=...        # EVM chains + Bitcoin (alchemy.com)
HELIUS_API_KEY=...         # Solana (helius.dev)
COINGECKO_API_KEY=...      # Price data, optional (coingecko.com)

# Plaid (for bank & brokerage — optional if only using crypto)
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox           # sandbox | development | production
```

## Deployment

Deployed on [Railway](https://railway.app/) with PostgreSQL.

## License

MIT
