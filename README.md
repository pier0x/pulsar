# Pulsar

**Your Wealth, One Dashboard** — A personal finance dashboard to track all your assets in one place.

## What It Does

Pulsar is a personal portfolio tracker that brings together crypto wallets, token balances, and portfolio analytics into a single clean interface. Built for personal use.

### Current Features
- 🔐 **Multi-chain Crypto Tracking** — Monitor wallets across Ethereum, Bitcoin, Solana, Arbitrum, Base, and Polygon
- 📊 **Real-time Portfolio Analytics** — Charts and breakdowns of holdings
- 🔑 **Your Own API Keys** — Uses Alchemy, Helius, and CoinGecko for data
- 🔄 **Automated Refresh** — Scheduled balance updates throughout the day
- 🎨 **Modern UI** — Dark theme, responsive design

### Planned
- 📈 Stock portfolio tracking
- 💰 Staking & yield tracking
- 🏦 Vault / savings tracking
- Multi-currency support

## Tech Stack

- **Framework:** [Remix](https://remix.run/) + React + TypeScript
- **Bundler:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v4
- **Database:** PostgreSQL + [Prisma](https://prisma.io/)
- **Charts:** Recharts
- **Animations:** [Framer Motion](https://framer.com/motion/)
- **Blockchain APIs:** Alchemy, Helius, CoinGecko

## Setup

```bash
bun install
cp .env.example .env   # Edit with your DATABASE_URL, ENCRYPTION_KEY, SESSION_SECRET
bunx prisma migrate deploy
bun run dev
```

## Deployment

Deployed on [Railway](https://railway.app/) with PostgreSQL.

## License

MIT
