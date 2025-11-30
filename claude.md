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
- SQLite for storage (Railway deployment)

## Project Structure

```
app/
├── routes/          # Remix routes
│   └── _index.tsx   # Home/dashboard
├── components/
│   ├── ui/          # shadcn/ui components
│   └── layout/      # Layout components
├── lib/             # Utilities
├── root.tsx         # Root layout
└── tailwind.css     # Global styles
```

## How It Works

1. User deploys their own instance (Railway recommended)
2. Add wallet addresses (multi-chain: EVM, Solana, Bitcoin, etc.)
3. System fetches balances and displays portfolio overview
4. All data stays with the user — SQLite file on their server

## Scoping Needed

- [ ] Data source strategy (price feeds, balance APIs)
- [ ] SQLite + Drizzle setup
- [ ] Wallet management UI
