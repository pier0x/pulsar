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
├── routes/              # Remix routes
│   └── _index.tsx       # Home/dashboard
├── components/
│   ├── ui/              # shadcn/ui components
│   └── layout/          # Layout components
├── config/              # Configuration system
│   ├── public/          # Client-safe config (exposed to browser)
│   │   ├── app.ts       # App name, URL, locale
│   │   └── features.ts  # Feature flags
│   ├── private/         # Server-only config (secrets, credentials)
│   │   ├── secrets.server.ts   # APP_KEY, SESSION_SECRET
│   │   ├── database.server.ts  # Database credentials
│   │   └── services.server.ts  # API keys
│   ├── index.ts         # Public config export (client-safe)
│   └── index.server.ts  # Full config export (server-only)
├── lib/
│   ├── config.ts        # config() helper (public only)
│   ├── config.server.ts # config() helper (full access)
│   ├── env.ts           # env() helper
│   ├── utils.ts         # Utilities
│   └── db.server.ts     # Prisma client
├── root.tsx             # Root layout
└── tailwind.css         # Global styles

prisma/
├── schema.prisma    # Database schema
├── migrations/      # SQL migrations
└── data/            # SQLite database file (gitignored)
```

## Configuration System

Laravel-style configuration with public/private separation for security.

### Environment Variables

Use the `env()` helper for type-safe access:

```typescript
import { env } from "~/lib/env";

env('APP_NAME')                    // string | undefined
env('APP_NAME', 'Pulsar')          // string with fallback
env.string('APP_NAME', 'Pulsar')   // explicit string
env.int('PORT', 3000)              // number
env.bool('APP_DEBUG', false)       // boolean
env.array('ALLOWED_HOSTS', [])     // string[] (comma-separated)
env.required('DATABASE_URL')       // throws if not set
```

### Config Helper

**In components (client-safe):**
```typescript
import { config } from "~/lib/config";

config('app.name')           // "Pulsar"
config('features.priceAlerts') // false
```

**In loaders/actions (full access):**
```typescript
import { config } from "~/lib/config.server";

config('app.name')                              // Public config
config('database.connections.sqlite.url')       // Database URL
config('services.blockchain.coingecko.apiKey')  // API keys
config('secrets.appKey')                        // App secrets
```

### Passing Config to Components

Use loaders to safely pass config to client components:

```typescript
// In a loader
export const loader = () => {
  return json({
    config: config.public()  // Only public config
  });
};

// Or specific keys
export const loader = () => {
  return json({
    config: config.forClient(['app.name', 'features.priceAlerts'])
  });
};
```

### Adding New Config

**Public config** (safe for browser):
1. Create/edit file in `app/config/public/`
2. Add to `app/config/index.ts`

**Private config** (server-only):
1. Create file in `app/config/private/` with `.server.ts` suffix
2. Add to `app/config/index.server.ts`

### Security

- Files ending in `.server.ts` are never bundled for the client (Remix guarantee)
- `config()` from `~/lib/config` only accesses public config
- `config.forClient()` only allows `app.*` and `features.*` keys

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
