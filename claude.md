# Pulsar

An open source, self-hostable crypto portfolio tracker.

## Vision

A portfolio tracker that anyone can deploy on their own infrastructure — no accounts, no third-party dependencies, full ownership of your data.

## Core Principles

1. **Beginner Friendly** — Non-technical users should be able to deploy and use it without friction
2. **Simple to Deploy** — One-click deploy to Vercel/Railway/Docker, minimal configuration
3. **Easy to Customize** — Clean codebase, well-documented, easy to extend
4. **Beautiful UI** — Modern, responsive design that works on any device

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Recharts for data visualization

## How It Works

1. User deploys their own instance
2. Add wallet addresses (multi-chain: EVM, Solana, Bitcoin, etc.)
3. System fetches balances and displays portfolio overview
4. All data stays with the user — no central server

## Scoping Needed

- [ ] Data source strategy (price feeds, balance APIs)
- [ ] Storage approach (local storage vs optional database)
- [ ] Authentication (optional, for multi-device sync)
- [ ] Deployment templates (Vercel, Docker, etc.)
