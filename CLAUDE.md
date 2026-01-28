# Pulsar

**Your Wealth, One Dashboard** — The all-in-one personal finance platform for the future.

## Vision

The financial landscape is evolving rapidly. Your wealth is scattered across crypto wallets, stock brokerages, DeFi protocols, staking platforms, and traditional banks. Pulsar aims to be the unified dashboard that connects it all — giving you a complete picture of your financial life.

### What Pulsar Will Support

- **Crypto Wallets** — Multi-chain tracking (Ethereum, Bitcoin, Solana, L2s)
- **Stocks & ETFs** — Brokerage account integration
- **Staking & Yields** — DeFi positions and staking rewards
- **Vaults** — Secure savings and fixed deposits
- **Traditional Finance** — Bank accounts and credit cards (future)

## Core Principles

1. **User-first Design** — Beautiful, intuitive interface that anyone can use
2. **Security by Default** — Per-user encrypted API keys, no wallet connections required
3. **Modular Architecture** — Easy to add new asset types and integrations
4. **Real-time Updates** — Automated syncing with configurable refresh rates

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

**Use `bun` for local dev, `npm` also works** — Railway uses bun by default.

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
│   ├── _index.tsx           # Landing page (guests) / Dashboard (authenticated)
│   ├── _app.tsx             # Authenticated layout (sidebar, navbar)
│   ├── _app.accounts.tsx    # Accounts/wallets management
│   ├── _app.settings.tsx    # User settings (API keys, preferences)
│   ├── auth.login.tsx       # Login action (modal-based)
│   ├── auth.register.tsx    # Registration action (modal-based)
│   ├── auth.logout.tsx      # Logout handler
│   └── api.refresh.ts       # Manual balance refresh API
├── components/
│   ├── ui/                  # UI components
│   ├── auth/                # Auth components (modal)
│   ├── landing/             # Landing page components
│   └── layout/              # Layout components (sidebar, navbar)
├── lib/
│   ├── auth/                # Authentication system
│   ├── balance/             # Balance refresh system
│   ├── providers/           # External API providers (Alchemy, Helius)
│   ├── settings.server.ts   # Per-user settings store
│   └── db.server.ts         # Prisma client
└── root.tsx                 # Root layout

prisma/
├── schema.prisma            # Database schema
└── migrations/              # SQL migrations
```

## Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Landing page (guests) or Dashboard (authenticated) | Dynamic |
| `/accounts` | Wallet/account management | Required |
| `/settings` | User settings (API keys, refresh, timezone) | Required |
| `/auth/login` | Login action (POST) + redirect | Guest only |
| `/auth/register` | Registration action (POST) + redirect | Guest only |
| `/auth/logout` | Logout (POST only) | Required |
| `/api/refresh` | Manual balance refresh | Required |

## Authentication System

Modal-based authentication with database-backed sessions.

### Flow

1. **Landing page** (`/`) shows for unauthenticated users with Login/Register modals
2. **Dashboard** (`/`) shows for authenticated users
3. **Sessions** stored in database with 30-day lifetime, sliding expiration

### Route Guards

```typescript
import { requireAuth, redirectIfAuthenticated, optionalAuth } from "~/lib/auth";

// Require login, redirect to / if not authenticated
const user = await requireAuth(request);

// Check auth without redirecting
const user = await optionalAuth(request);
```

## Settings System

Per-user settings with encrypted API key storage.

```typescript
import {
  getUserSetting,
  setUserSetting,
  getAlchemyApiKey,
  setAlchemyApiKey,
  getRefreshesPerDay,
} from "~/lib/settings.server";

// All settings functions require userId
const apiKey = await getAlchemyApiKey(userId);
await setRefreshesPerDay(userId, 5);
```

### Setting Keys

- `alchemy_api_key` — Encrypted Alchemy API key
- `helius_api_key` — Encrypted Helius API key
- `timezone` — User's timezone preference
- `refreshes_per_day` — Auto-refresh frequency (1, 3, 5, or 10)
- `token_threshold_usd` — Minimum token value to track

## Balance Refresh System

Scheduled and manual balance refreshing for all users.

### Scheduler

- Runs every 4 hours for all users
- Uses each user's individual API keys and settings
- Creates snapshots in the database

### Manual Refresh

- POST to `/api/refresh`
- Rate limited to 1 request per minute per user

## Database Schema

### Models

- **User** — User accounts (username, passwordHash, avatarUrl)
- **Session** — Database-backed auth sessions
- **UserSetting** — Per-user key-value settings (encrypted API keys)
- **Wallet** — User's tracked wallet addresses
- **BalanceSnapshot** — Historical balance data
- **TokenSnapshot** — Token balances within a snapshot

### Relationships

```
User 1──* Session
User 1──* UserSetting
User 1──* Wallet 1──* BalanceSnapshot 1──* TokenSnapshot
```

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| Alchemy | EVM chains + Bitcoin | Per-user API key |
| Helius | Solana | Per-user API key |
| CoinGecko | Price data | Optional API key |

## Deployment

### Railway (Recommended)

1. Connect GitHub repo
2. Add PostgreSQL database
3. Set environment variables:
   - `DATABASE_URL` — Auto-set by Railway
   - `ENCRYPTION_KEY` — Generate with `openssl rand -base64 32`
   - `SESSION_SECRET` — Generate with `openssl rand -base64 32`
4. Deploy

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=base64-encoded-32-byte-key
SESSION_SECRET=random-string

# Optional
NODE_ENV=production
PORT=3000
```

## Roadmap

### Phase 1: Crypto (Current)
- [x] Multi-chain wallet tracking
- [x] Real-time balance updates
- [x] Portfolio analytics
- [x] Per-user API keys

### Phase 2: Expanded Assets
- [ ] Stock portfolio tracking (brokerage integration)
- [ ] Staking & yield tracking
- [ ] DeFi position monitoring

### Phase 3: Full Finance
- [ ] Vault/savings tracking
- [ ] Bank account integration
- [ ] Tax reporting
- [ ] Mobile apps (iOS/Android)

---

**Pulsar** — The future of personal finance 🚀
