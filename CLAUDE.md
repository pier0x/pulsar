# Pulsar

**Your Wealth, One Dashboard** — Unified personal finance dashboard for crypto, banking, and brokerage accounts.

## Overview

Single-user personal portfolio tracker. Not a SaaS — built for one person's use. Auth exists for basic access control on the deployed instance, not for multi-tenancy.

Tracks:
- **On-chain crypto** — Ethereum, Bitcoin, Solana, Arbitrum, Base, Polygon, Hyperliquid
- **Bank accounts** — Checking/savings via Plaid
- **Brokerage accounts** — Investment holdings via Plaid

## Tech Stack

- Remix + React 18 + TypeScript
- Vite for bundling
- Tailwind CSS 4
- Recharts for data visualization
- Prisma + PostgreSQL
- bcrypt for password hashing

## Design System

**The homepage dashboard is the reference design.** All pages should follow this style.

### Core Principles

- **Dark theme only** — zinc-900 base background
- **Consistent card styling** — rounded-2xl, zinc-900 bg, zinc-800 borders
- **Subtle animations** — framer-motion for smooth transitions
- **Spacious layout** — generous padding (p-5, p-6)
- **Always add `cursor-pointer` to buttons** — Tailwind v4+ does not include cursor-pointer by default on buttons

### Color Palette

```
Background:     bg-zinc-900
Card bg:        bg-zinc-900
Card border:    border-zinc-800
Text primary:   text-white
Text secondary: text-zinc-400
Text muted:     text-zinc-500
Input bg:       bg-zinc-800 or bg-zinc-800/50
Input border:   border-zinc-700
Accent/CTA:     bg-blue-600 hover:bg-blue-500
Success:        text-emerald-400, bg-emerald-500
Error:          text-red-400, bg-red-500
```

### Card Pattern

```tsx
<div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
  {/* Header */}
  <div className="space-y-1 mb-6">
    <p className="text-zinc-500 text-sm">Label</p>
    <h2 className="text-2xl font-bold text-white">Title</h2>
  </div>
  {/* Content */}
</div>
```

### Form Inputs

```tsx
<input className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600" />
```

### Buttons

```tsx
// Primary
<button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer">

// Secondary
<button className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors cursor-pointer">
```

### Typography

- Page titles: `text-2xl font-bold text-white`
- Section labels: `text-zinc-500 text-sm`
- Body text: `text-zinc-400`
- Links: `text-blue-400 hover:text-blue-300`

## Component Library

All reusable UI components are in `app/components/ui/`. Import from the barrel file:

```tsx
import { Button, Input, Label, Select, FormField, Alert, Card, Badge } from "~/components/ui";
```

## Package Manager

**Use `bun` for local dev** — Railway uses bun by default.

```bash
bun install          # Install dependencies
bun run dev          # Start dev server
bun run build        # Build for production
bun add <package>    # Add a dependency
bunx prisma ...      # Run prisma commands
```

## Project Structure

```
app/
├── routes/                  # Remix routes
│   ├── _index.tsx           # Landing / Dashboard
│   ├── _app.tsx             # Authenticated layout (sidebar, navbar)
│   ├── _app.accounts.tsx    # Account management (all types)
│   ├── _app.positions.tsx   # Positions view
│   ├── _app.settings.tsx    # Settings (API keys, preferences)
│   ├── auth.login.tsx       # Login action
│   ├── auth.logout.tsx      # Logout handler
│   ├── api.refresh.ts       # Manual balance refresh API
│   ├── api.plaid.create-link-token.ts  # Plaid Link token generation
│   └── api.plaid.exchange-token.ts     # Plaid public token exchange
├── components/
│   ├── ui/                  # UI components
│   ├── auth/                # Auth components (modal)
│   ├── landing/             # Landing page components
│   └── layout/              # Layout components (sidebar, navbar)
├── lib/
│   ├── auth/                # Authentication
│   ├── balance/             # Balance refresh system (on-chain + Plaid)
│   ├── providers/           # External API providers (Alchemy, Helius, Plaid, etc.)
│   ├── accounts.server.ts   # Account CRUD and snapshot creation
│   ├── wallet.ts            # Network types and address utilities (client-safe)
│   ├── wallet.server.ts     # Address detection/validation (server-only)
│   ├── settings.server.ts   # Settings store
│   └── db.server.ts         # Prisma client
└── root.tsx                 # Root layout

prisma/
├── schema.prisma            # Database schema
└── migrations/              # SQL migrations
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page or Dashboard |
| `/accounts` | Account management (on-chain, bank, brokerage, physical assets) |
| `/positions` | Positions view |
| `/settings` | Settings (timezone, token threshold) |
| `/auth/login` | Login (POST) |
| `/auth/logout` | Logout (POST) |
| `/api/refresh` | Manual balance refresh |
| `/api/plaid/create-link-token` | Generate Plaid Link token |
| `/api/plaid/exchange-token` | Exchange Plaid public token for access token |
| `/api/asset-image/:id` | Serve physical asset images from disk |

## Authentication

Simple auth to keep the deployed instance private. Single user — registration is disabled.

- Login modal on the landing page (no sign-up option)
- Registration route returns 403
- Database-backed sessions (30-day lifetime, sliding expiration)
- Owner account already exists in the database

## Settings

Per-user settings stored in DB (timezone, token threshold). API keys come from env vars.

```typescript
import { getTokenThresholdUsd, getUserTimezone } from "~/lib/settings.server";
import { getAlchemyApiKey, getHeliusApiKey, getCoinGeckoApiKey } from "~/lib/settings.server";
```

## Balance Refresh

- Scheduler runs every 4 hours
- Manual refresh: POST `/api/refresh` (rate limited to 1/min)
- Refreshes on-chain accounts via Alchemy/Helius, bank accounts via Plaid, brokerage accounts via Plaid

## Database Models

- **User** — Account (username, passwordHash)
- **Session** — Auth sessions
- **UserSetting** — Key-value settings (encrypted API keys)
- **Account** — Unified account (type: "onchain" | "bank" | "brokerage"; provider: "alchemy" | "helius" | "hyperliquid" | "plaid")
- **AccountSnapshot** — Historical balance data (universal + type-specific fields)
- **TokenSnapshot** — Token balances within an on-chain snapshot
- **HoldingSnapshot** — Brokerage holdings within a brokerage snapshot
- **PlaidConnection** — Plaid Item (access token, institution info)

## Account Types

| type | provider | Fields used |
|------|----------|-------------|
| `onchain` | `alchemy` / `helius` / `hyperliquid` | `network`, `address` |
| `bank` | `plaid` | `plaidConnectionId`, `plaidAccountId`, `plaidSubtype` |
| `brokerage` | `plaid` | `plaidConnectionId`, `plaidAccountId`, `plaidSubtype` |
| `manual` | `manual` | `category`, `costBasis`, `notes`, `imagePath` |

### Manual (Physical) Assets

Physical assets (watches, cars, art, etc.) use `type: "manual"` with `provider: "manual"`. They:
- Store value via `AccountSnapshot.totalUsdValue` (created on each value update)
- Have optional `category` (free-text: "watches", "cars", etc.)
- Have optional `costBasis` (purchase price for gain/loss calculation)
- Have optional `imagePath` (relative path: `data/assets/<id>.<ext>`, served via `/api/asset-image/:id`)
- Are **never refreshed automatically** — value updates are manual only
- Images are stored in `data/assets/` (gitignored, created on demand)

## External Services

| Service | Purpose | Env Var |
|---------|---------|---------|
| Alchemy | EVM chains + Bitcoin | `ALCHEMY_API_KEY` |
| Helius | Solana | `HELIUS_API_KEY` |
| CoinGecko | Price data (optional) | `COINGECKO_API_KEY` |
| Plaid | Bank & brokerage accounts | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` |

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
APP_KEY=random-string
SESSION_SECRET=random-string
ENCRYPTION_SECRET=random-string  # Used for encrypting Plaid access tokens

# Blockchain API Keys
ALCHEMY_API_KEY=...        # EVM chains + Bitcoin
HELIUS_API_KEY=...         # Solana
COINGECKO_API_KEY=...      # Price data (optional)

# Plaid (bank & brokerage)
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox           # sandbox | development | production
```

## Deployment

Railway with PostgreSQL. Deployed at: https://pulsar-production-a05b.up.railway.app

## Roadmap

- [ ] Staking & yield tracking
- [ ] DeFi position monitoring
- [ ] Multi-currency support
- [ ] Tax reporting
