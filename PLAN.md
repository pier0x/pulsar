# Pulsar — Unified Finance Dashboard: Implementation Plan

> After all phases are complete, the DB will be wiped clean. No backwards compatibility needed.

## Overview

Unify on-chain crypto, Hyperliquid, bank accounts, and brokerage holdings into a single dashboard with filtering by account type.

---

## Phase 1: Unified Data Model

**Goal:** Replace the current wallet-only model with a unified Account system.

### New models

```prisma
model Account {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String      // "Main Wallet", "Wells Fargo Checking", "IBKR Portfolio"
  type      String      // "onchain" | "bank" | "brokerage"
  provider  String      // "alchemy" | "helius" | "hyperliquid" | "plaid"
  
  // On-chain fields (nullable)
  network   String?     // "ethereum", "bitcoin", "solana", "hyperliquid", etc.
  address   String?     // wallet address
  
  // Plaid fields (nullable)
  plaidConnectionId String?
  plaidConnection   PlaidConnection? @relation(fields: [plaidConnectionId], references: [id])
  plaidAccountId    String?          // Plaid's account_id
  plaidSubtype      String?          // "checking", "savings", "brokerage"
  
  snapshots AccountSnapshot[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, network, address])  // for on-chain dedup
  @@index([userId])
  @@index([userId, type])
}

model AccountSnapshot {
  id        String   @id @default(cuid())
  accountId String
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  timestamp DateTime @default(now())
  
  // Universal fields
  totalUsdValue  Decimal
  
  // On-chain specific (nullable)
  nativeBalance    String?
  nativeBalanceUsd Decimal?
  nativePriceUsd   Decimal?
  tokensUsdValue   Decimal?
  
  // Bank specific (nullable)
  availableBalance Decimal?
  currentBalance   Decimal?
  currency         String?    // "USD" always for now
  
  // Brokerage specific (nullable)
  holdingsValue    Decimal?
  cashBalance      Decimal?
  
  tokenSnapshots TokenSnapshot[]
  holdings       HoldingSnapshot[]

  @@index([accountId])
  @@index([accountId, timestamp])
  @@index([timestamp])
}

// Existing — unchanged
model TokenSnapshot {
  id         String          @id @default(cuid())
  snapshotId String
  snapshot   AccountSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  contractAddress String
  symbol          String
  name            String?
  decimals        Int
  logoUrl         String?
  balance         String
  balanceUsd      Decimal
  priceUsd        Decimal
  @@index([snapshotId])
}

// New — for brokerage holdings
model HoldingSnapshot {
  id         String          @id @default(cuid())
  snapshotId String
  snapshot   AccountSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  ticker     String          // "AAPL", "VTI", etc.
  name       String?
  quantity   Decimal
  priceUsd   Decimal
  valueUsd   Decimal
  costBasis  Decimal?        // if provided by Plaid
  @@index([snapshotId])
}

model PlaidConnection {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  institutionId   String   // Plaid institution ID
  institutionName String   // "Wells Fargo"
  accessToken     String   // encrypted
  itemId          String   @unique
  cursor          String?  // for transaction sync
  lastSynced      DateTime?
  accounts        Account[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([userId])
}
```

### Changes
- Delete old `Wallet`, `BalanceSnapshot` models
- Delete `RefreshLog`, `RefreshError` (rebuild simpler)
- Keep `Position`, `AssetPrice`, `User`, `Session`, `UserSetting`, `RateLimit`
- Update all references throughout the codebase

### Tasks
- [ ] Write new schema
- [ ] Create migration
- [ ] Update `User` model relations
- [ ] Remove old wallet-related lib files that reference old models
- [ ] Create new `lib/accounts.server.ts` with CRUD helpers

---

## Phase 2: On-chain Migration

**Goal:** Port existing on-chain wallet logic to the new Account model.

### Tasks
- [ ] Update `/accounts` page — "Add Wallet" creates Account with `type: "onchain"`
- [ ] EVM address → creates accounts for each network (ethereum, arbitrum, base, polygon) + hyperliquid check
- [ ] BTC/SOL → creates single account
- [ ] Update refresh logic (`lib/balance/refresh.server.ts`) to work with Account model
  - Query accounts by type "onchain"
  - Create AccountSnapshot instead of BalanceSnapshot
  - TokenSnapshot relation updated
- [ ] Update dashboard loader — read from Account + AccountSnapshot
- [ ] Update navbar refresh button + overlay
- [ ] Verify: add wallet → refresh → dashboard shows data

---

## Phase 3: Plaid Integration — Bank Accounts

**Goal:** Connect Wells Fargo and Bask Bank, show balances.

### Setup
- [ ] `bun add plaid` (Plaid Node SDK)
- [ ] Env vars: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=development`
- [ ] Create `lib/providers/plaid.server.ts` — Plaid client wrapper

### Plaid Link flow
- [ ] New API route: `POST /api/plaid/create-link-token` — generates a link_token
- [ ] New API route: `POST /api/plaid/exchange-token` — exchanges public_token → access_token, stores PlaidConnection + associated Accounts
- [ ] Frontend: Plaid Link component (use `react-plaid-link` package)
- [ ] Add "Connect Bank" button to `/accounts` page — opens Plaid Link
- [ ] On success: store access_token (encrypted), create Account entries for each Plaid account

### Balance fetching
- [ ] In refresh flow: for each Account with `provider: "plaid"` and `type: "bank"`:
  - Call `plaid.accountsBalanceGet(accessToken)`
  - Create AccountSnapshot with `currentBalance`, `availableBalance`
- [ ] Handle token expiration (Plaid sends webhooks, but for now just show error on refresh)

### Tasks
- [ ] Plaid SDK setup + client helper
- [ ] Link token + exchange routes
- [ ] React Plaid Link integration on accounts page
- [ ] Refresh flow for bank accounts
- [ ] Test with Wells Fargo + Bask

---

## Phase 4: Plaid Integration — Brokerage (Interactive Brokers)

**Goal:** Show IBKR holdings and total portfolio value.

### Balance + holdings fetching
- [ ] For Account with `type: "brokerage"`:
  - Call `plaid.investmentsHoldingsGet(accessToken)`
  - Returns: securities list + holdings (ticker, quantity, price, value)
  - Create AccountSnapshot with `holdingsValue`, `cashBalance`
  - Create HoldingSnapshot for each holding
- [ ] Show brokerage accounts on dashboard as cards with total value
- [ ] Optionally: show top holdings in a detail view

### Tasks
- [ ] Investment holdings fetch in refresh flow
- [ ] HoldingSnapshot creation
- [ ] Brokerage card on dashboard
- [ ] Test with Interactive Brokers

---

## Phase 5: Unified Dashboard

**Goal:** All account types shown together with filtering.

### Filter bar
- [ ] Add filter to dashboard: `[All] [On-chain] [Banking] [Investments]`
- [ ] Filter stored in URL search params (`/?filter=onchain`)
- [ ] Filters apply to: portfolio chart, breakdown, account cards

### Portfolio chart
- [ ] Aggregate AccountSnapshots across all account types (or filtered)
- [ ] Same daily aggregation logic, just reads from AccountSnapshot

### Breakdown
- [ ] Replace network-based breakdown with category-based:
  - On-chain: aggregate by network (Ethereum, Bitcoin, Solana, Hyperliquid)
  - Banking: aggregate by institution (Wells Fargo, Bask)
  - Investments: aggregate by institution (IBKR)
- [ ] Colors: keep existing network colors, add institution colors

### Account cards
- [ ] Unified card component that works for all account types
- [ ] On-chain: shows native balance + token count
- [ ] Bank: shows current balance
- [ ] Brokerage: shows total holdings value

### Top movers
- [ ] Keep for on-chain (token price changes)
- [ ] Add for brokerage (stock price changes from HoldingSnapshot)
- [ ] Or: combine into one unified movers section

### Tasks
- [ ] Filter bar component
- [ ] Dashboard loader with filter support
- [ ] Unified account card component
- [ ] Updated breakdown logic
- [ ] Updated chart aggregation

---

## Phase 6: Cleanup & Polish

- [ ] Remove all old wallet-specific code that's no longer used
- [ ] Update CLAUDE.md with new architecture
- [ ] Update README
- [ ] Clean up unused imports, dead code
- [ ] Test full flow: onboard → add wallets → connect banks → refresh → dashboard
- [ ] Wipe production DB, run fresh migrations, re-onboard

---

## Env vars (final state)

```bash
# Core
DATABASE_URL=...
APP_KEY=...
SESSION_SECRET=...
ENCRYPTION_SECRET=...       # for Plaid access tokens

# Blockchain
ALCHEMY_API_KEY=...
HELIUS_API_KEY=...
COINGECKO_API_KEY=...       # Pro key

# Plaid
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=development       # or "production" when approved
```

---

## Estimated effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| 1. Data model | Medium | None |
| 2. On-chain port | Medium | Phase 1 |
| 3. Bank accounts | Medium | Phase 1 |
| 4. Brokerage | Small | Phase 3 |
| 5. Dashboard | Medium | Phase 2 + 3 |
| 6. Cleanup | Small | All |

Phases 2 and 3 can run in parallel after Phase 1.
