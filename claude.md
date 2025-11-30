# Pulsar

An open source, self-hostable crypto portfolio tracker.

## Vision

A portfolio tracker that anyone can deploy on their own infrastructure — no accounts, no third-party dependencies, full ownership of your data.

## Core Principles

1. **Beginner Friendly** — Non-technical users should be able to deploy and use it without friction
2. **Simple to Deploy** — One-click deploy to Railway/Docker, minimal configuration
3. **Easy to Customize** — Clean codebase, well-documented, easy to extend
4. **Beautiful UI** — Modern, responsive design that works on any device

## Tech Stack

- Remix + React 18 + TypeScript
- Vite for bundling
- Tailwind CSS 4 + shadcn/ui
- Recharts for data visualization
- Prisma + SQLite for storage

## Project Structure

```
app/
├── routes/          # Remix routes
│   └── _index.tsx   # Home/dashboard
├── components/
│   ├── ui/          # shadcn/ui components
│   └── layout/      # Layout components
├── lib/
│   ├── utils.ts     # Utilities
│   └── db.server.ts # Prisma client
├── root.tsx         # Root layout
└── tailwind.css     # Global styles

prisma/
├── schema.prisma    # Database schema
├── migrations/      # SQL migrations
└── data/            # SQLite database file (gitignored)
```

## Database Schema

- **Wallet** — Tracked wallet addresses (address, chain, label)
- **Balance** — Token balances per wallet (token, amount, usdValue)
- **PortfolioSnapshot** — Historical data for charts

## How It Works

1. User deploys their own instance (Railway recommended)
2. Add wallet addresses (multi-chain: EVM, Solana, Bitcoin, etc.)
3. System fetches balances and displays portfolio overview
4. All data stays with the user — SQLite file on their server

## Database Commands

```bash
bunx prisma migrate dev    # Run migrations (dev)
bunx prisma generate       # Generate client
bunx prisma studio         # Open database GUI
```

## Scoping Needed

- [ ] Data source strategy (price feeds, balance APIs)
- [ ] Wallet management UI
- [ ] Balance fetching logic
