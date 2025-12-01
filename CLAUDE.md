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
- Prisma + SQLite (Better-SQLite3 adapter) for storage
- bcrypt for password hashing

## Package Manager

**Always use `bun`** — never use npm, yarn, or pnpm.

```bash
bun install          # Install dependencies
bun run dev          # Start dev server
bun run build        # Build for production
bun add <package>    # Add a dependency
bun remove <package> # Remove a dependency
bunx prisma ...      # Run prisma commands
```

## Project Structure

```
app/
├── routes/                  # Remix routes
│   ├── _index.tsx           # Dashboard (protected)
│   ├── auth.login.tsx       # Login page
│   ├── auth.register.tsx    # Registration redirect
│   ├── auth.logout.tsx      # Logout handler
│   ├── setup._index.tsx     # Setup wizard router
│   ├── setup.account.tsx    # Setup step 1: Create admin
│   ├── setup.settings.tsx   # Setup step 2: Configure app
│   └── setup.complete.tsx   # Setup step 3: Finish
├── components/
│   ├── ui/                  # shadcn/ui components
│   │   ├── button.tsx       # Button with variants
│   │   ├── card.tsx         # Card container
│   │   ├── input.tsx        # Form input
│   │   ├── badge.tsx        # Status badges
│   │   ├── asset-card.tsx   # Asset display card
│   │   ├── portfolio-chart.tsx  # Recharts line chart
│   │   └── transaction-table.tsx # Transaction history
│   ├── auth/                # Auth components
│   │   └── auth-form.tsx    # Reusable login form
│   └── layout/              # Layout components
│       └── sidebar.tsx      # Navigation sidebar
├── config/                  # Configuration system
│   ├── public/              # Client-safe config
│   │   ├── app.ts           # App name, URL, locale
│   │   └── features.ts      # Feature flags
│   ├── private/             # Server-only config
│   │   ├── auth.server.ts   # Auth policies
│   │   ├── secrets.server.ts    # APP_KEY, SESSION_SECRET
│   │   ├── database.server.ts   # Database config
│   │   └── services.server.ts   # External API keys
│   ├── index.ts             # Public config export
│   └── index.server.ts      # Full config export
├── lib/
│   ├── auth/                # Authentication system
│   │   ├── auth.server.ts   # Login/register logic
│   │   ├── session.server.ts    # Session management
│   │   ├── password.server.ts   # Password hashing
│   │   ├── guards.server.ts     # Route protection
│   │   └── index.ts         # Public exports
│   ├── config.ts            # config() helper (public)
│   ├── config.server.ts     # config() helper (full)
│   ├── settings.server.ts   # Key-value settings store
│   ├── setup.server.ts      # Setup utilities
│   ├── env.ts               # env() helper
│   ├── utils.ts             # Tailwind utilities
│   └── db.server.ts         # Prisma client
├── root.tsx                 # Root layout
└── tailwind.css             # Global styles

prisma/
├── schema.prisma    # Database schema
├── migrations/      # SQL migrations
└── data/            # SQLite database file (gitignored)
```

## Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Dashboard with portfolio overview | Required |
| `/auth/login` | Login page | Guest only |
| `/auth/logout` | Logout (POST only) | Required |
| `/setup/*` | Initial setup wizard | First run only |

## Authentication System

Complete session-based authentication with database-backed sessions.

### How It Works

1. **Registration** (during setup only)
   - Username: 3-32 chars, alphanumeric + underscore
   - Password: minimum 8 characters
   - Hashed with bcrypt (12 rounds)

2. **Login**
   - Validates credentials against database
   - Creates session record with 30-day lifetime
   - Sets HttpOnly cookie with session ID

3. **Session Management**
   - Sessions stored in database (not just cookies)
   - Sliding expiration: refreshes after 24 hours of inactivity
   - Automatic cleanup of expired sessions

4. **Logout**
   - POST-only endpoint (CSRF protection)
   - Deletes session from database
   - Clears session cookie

### Route Guards

```typescript
import { requireAuth, redirectIfAuthenticated, optionalAuth } from "~/lib/auth";

// In loaders
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Require login, redirect to /auth/login if not
  const { user, session } = await requireAuth(request);

  // Redirect logged-in users away (for login page)
  await redirectIfAuthenticated(request);

  // Get user if logged in, null otherwise
  const user = await optionalAuth(request);
};
```

### Auth Configuration

Located in `app/config/private/auth.server.ts`:

```typescript
{
  session: {
    lifetime: 30 * 24 * 60 * 60 * 1000,      // 30 days
    refreshThreshold: 24 * 60 * 60 * 1000,    // 24 hours
    cookieName: "__session"
  },
  password: {
    minLength: 8,
    bcryptRounds: 12
  },
  username: {
    minLength: 3,
    maxLength: 32,
    pattern: /^[a-zA-Z0-9_]+$/
  }
}
```

### Security Features

- **Password hashing**: bcrypt with 12 rounds
- **HttpOnly cookies**: JavaScript cannot access session
- **SameSite=lax**: CSRF protection
- **Generic errors**: No user enumeration ("Invalid credentials")
- **Session validation**: Verified on every request
- **Sliding expiration**: Prevents stale sessions

## Setup Wizard

First-time setup flow that runs before the app is usable.

### Steps

1. **Account** (`/setup/account`) — Create admin username & password
2. **Settings** (`/setup/settings`) — Configure app name & timezone
3. **Complete** (`/setup/complete`) — Auto-login and redirect to dashboard

### Behavior

- Setup status tracked in `Setting` table (`setup_step`, `setup_complete`)
- Cannot skip steps or go backward
- After setup, `/setup/*` routes redirect to dashboard
- Login/register routes redirect to setup if not complete

### Checking Setup Status

```typescript
import { isSetupComplete, getSetupStep } from "~/lib/settings.server";

const complete = await isSetupComplete();  // boolean
const step = await getSetupStep();         // 1, 2, or 3
```

## Settings System

Key-value store for persistent settings using the `Setting` model.

```typescript
import {
  getSetting,
  getSettingWithDefault,
  setSetting,
  getSettings,
  setSettings
} from "~/lib/settings.server";

// Single values
const appName = await getSetting('app_name');
const timezone = await getSettingWithDefault('timezone', 'UTC');
await setSetting('app_name', 'My Portfolio');

// Multiple values
const settings = await getSettings(['app_name', 'timezone']);
await setSettings({ app_name: 'My Portfolio', timezone: 'America/New_York' });
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

### Models

- **User** — Admin accounts (username, passwordHash)
- **Session** — Database-backed auth sessions (userId, expiresAt, lastActiveAt)
- **Setting** — Key-value store for app settings
- **Wallet** — Tracked wallet addresses (address, chain, label)
- **Balance** — Token balances per wallet (token, amount, usdValue)
- **PortfolioSnapshot** — Historical data for charts (totalUsd, cryptoUsd, cashUsd)

### Relationships

```
User 1──* Session (cascade delete)
Wallet 1──* Balance (cascade delete)
```

## How It Works

1. User deploys their own instance (Railway recommended)
2. **Setup wizard** creates admin account and configures app
3. Add wallet addresses (multi-chain: EVM, Solana, Bitcoin, etc.)
4. System fetches balances and displays portfolio overview
5. All data stays with the user — SQLite file on their server

## Database Commands

```bash
bunx prisma migrate dev    # Run migrations (dev)
bunx prisma generate       # Generate client
bunx prisma studio         # Open database GUI
bunx prisma migrate reset  # Reset database (dev only)
```

## External Services (Configured)

API integrations are configured but not yet implemented:

| Service | Purpose | Env Variable |
|---------|---------|--------------|
| CoinGecko | Price data | `COINGECKO_API_KEY` |
| Etherscan | Ethereum data | `ETHERSCAN_API_KEY` |
| Alchemy | RPC provider | `ALCHEMY_API_KEY` |
| Infura | RPC provider | `INFURA_PROJECT_ID` |

## Roadmap

- [ ] Data source integration (price feeds, balance APIs)
- [ ] Wallet management UI
- [ ] Balance fetching logic
- [ ] Multi-user support (optional)
- [ ] Price alerts & notifications
