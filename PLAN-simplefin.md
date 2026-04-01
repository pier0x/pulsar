# SimpleFIN Migration — Replace Plaid with SimpleFIN Bridge

Replace Plaid (SDK, OAuth, product approvals) with SimpleFIN Bridge (simple HTTP, user-managed auth, no API keys needed).

## How SimpleFIN Works

1. User visits `bridge.simplefin.org/simplefin/create` → connects their bank → gets a **Setup Token** (base64 string)
2. User pastes Setup Token into Pulsar
3. Backend base64-decodes → POST to claim URL → receives **Access URL** (contains embedded Basic Auth creds)
4. Backend stores Access URL (encrypted with AES-256-GCM, same as current Plaid tokens)
5. GET `{ACCESS_URL}/accounts` → returns account names, balances, available balances, currency, transactions
6. Rate limit: ≤24 requests/day per token

---

## Phase 1: Schema Migration

**Migration: `replace_plaid_with_simplefin`**

1. Add new model `SimplefinConnection`:
```prisma
model SimplefinConnection {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessUrl   String   // encrypted Access URL
  label       String?  // user-friendly label ("Wells Fargo", "My Bank")
  lastSynced  DateTime?
  accounts    Account[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

2. Update `Account` model:
   - Add `simplefinConnectionId` (nullable FK → SimplefinConnection)
   - Add `simplefinAccountId` (nullable, the account `id` from SimpleFIN response)
   - Keep existing Plaid fields for now (remove in cleanup phase)
   - Update `provider` type to include `"simplefin"`

3. Update `User` model:
   - Add `simplefinConnections SimplefinConnection[]` relation

4. Remove `PlaidConnection` model (and Plaid fields from Account) — or keep deprecated until fully migrated

---

## Phase 2: SimpleFIN Provider

**New file: `app/lib/providers/simplefin.server.ts`**

```ts
// Claim a Setup Token → returns encrypted Access URL
async function claimSetupToken(setupToken: string): Promise<{
  success: true; accessUrl: string; // encrypted
} | { success: false; error: string }>

// Fetch all accounts from a SimpleFIN connection
async function getSimplefinAccounts(encryptedAccessUrl: string): Promise<{
  success: true;
  accounts: SimplefinAccount[];
  connections: SimplefinConnectionInfo[];
} | { success: false; error: string }>

interface SimplefinAccount {
  id: string;           // unique account ID
  name: string;         // "Savings", "Checking"
  connId: string;       // connection ID
  connName: string;     // "Wells Fargo - Pier"
  currency: string;     // "USD"
  balance: number;      // current balance
  availableBalance: number | null;
  balanceDate: Date;    // when balance was last updated
}

interface SimplefinConnectionInfo {
  connId: string;
  name: string;         // institution name
  orgId: string;
  orgUrl: string | null;
}
```

Implementation notes:
- Base64-decode setup token → POST to claim URL → get Access URL
- Access URL format: `https://user:pass@bridge.simplefin.org/simplefin`
- To fetch: GET `{ACCESS_URL}/accounts?version=2` (credentials are in the URL, use Basic Auth)
- Reuse existing `encryptToken()` / `decryptToken()` from plaid.server.ts (move to a shared crypto util)

---

## Phase 3: API Routes

**Delete:**
- `app/routes/api.plaid.create-link-token.ts`
- `app/routes/api.plaid.exchange-token.ts`

**New: `app/routes/api.simplefin.claim.ts`**
- POST with `{ setupToken: string }`
- Claims the token → creates `SimplefinConnection` with encrypted access URL
- Fetches accounts → creates `Account` entries (type: "bank", provider: "simplefin")
- Creates initial `AccountSnapshot` for each account with balance data
- Returns `{ success, connectionLabel, accountsCreated }`

**New: `app/routes/api.simplefin.remove.ts`** (optional)
- POST with `{ connectionId: string }`
- Deletes the SimplefinConnection + associated accounts + snapshots

---

## Phase 4: Accounts Page UI

**Replace Plaid Link flow with SimpleFIN token input:**

Current flow: Click "Connect Bank" → Plaid modal opens → bank login inside modal
New flow:
1. Click "Connect Bank" → shows instructions + link to SimpleFIN Bridge
2. User opens `bridge.simplefin.org/simplefin/create` in new tab
3. User connects bank there, gets Setup Token
4. User pastes token into text input in Pulsar
5. Submit → backend claims token, fetches accounts, creates records

**UI changes in `_app.accounts.tsx`:**
- Remove `react-plaid-link` import and `usePlaidLink` hook
- Remove `ConnectBankButton` component
- New `ConnectBankSection` component:
  - Step 1: Link to SimpleFIN Bridge (opens in new tab)
  - Step 2: Textarea/input for pasting Setup Token
  - Step 3: Submit button → calls `api.simplefin.claim`
  - Success: revalidate page to show new accounts
- Update bank/brokerage account cards to reference SimpleFIN instead of Plaid
- Remove Plaid-specific copy ("Powered by Plaid", etc.)

---

## Phase 5: Balance Refresh

**Update `app/lib/balance/refresh.server.ts`:**

- Replace `refreshPlaidBankAccounts()` with `refreshSimplefinAccounts()`
- Group accounts by `SimplefinConnection` (one API call per connection, ≤24/day)
- GET `{accessUrl}/accounts?version=2` → update snapshots for each account
- Handle SimpleFIN error codes (`con.auth`, `act.failed`, etc.) → surface to user
- Remove `refreshPlaidBrokerageAccounts()` (SimpleFIN handles all account types)
- Keep investment/brokerage logic if SimpleFIN returns investment accounts (it does for some institutions)

---

## Phase 6: Dashboard

**Update `_index.tsx`:**
- Change provider references from `"plaid"` to `"simplefin"` in account queries
- Bank/brokerage cards work the same (they use Account + AccountSnapshot, provider-agnostic)
- No major changes needed — the dashboard already works with the unified Account model

---

## Phase 7: Cleanup

1. **Delete** `app/lib/providers/plaid.server.ts`
2. **Remove** `plaid` and `react-plaid-link` from dependencies (`bun remove plaid react-plaid-link`)
3. **Migration**: Drop `PlaidConnection` table, drop Plaid fields from Account (`plaidConnectionId`, `plaidAccountId`, `plaidSubtype`)
4. **Move** encryption helpers (`encryptToken`, `decryptToken`) to `app/lib/crypto.server.ts` (shared)
5. **Remove** Plaid env vars from `.env.example` and docs (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`)
6. **Add** docs for SimpleFIN in `CLAUDE.md` and `README.md`
7. **Update** `.env.example` — only need `ENCRYPTION_SECRET` (no SimpleFIN API key needed)

---

## Env Vars

**Remove:**
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`

**Keep:**
- `ENCRYPTION_SECRET` (used to encrypt SimpleFIN Access URLs)

**No new env vars needed.** SimpleFIN requires no server-side API keys.

---

## File Changes Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add SimplefinConnection, update Account, eventually drop PlaidConnection |
| `app/lib/providers/simplefin.server.ts` | **New** — claim tokens, fetch accounts |
| `app/lib/providers/plaid.server.ts` | **Delete** |
| `app/lib/crypto.server.ts` | **New** — shared encrypt/decrypt (moved from plaid.server.ts) |
| `app/lib/accounts.server.ts` | Add SimpleFIN account creation helpers |
| `app/lib/balance/refresh.server.ts` | Replace Plaid refresh with SimpleFIN refresh |
| `app/routes/api.simplefin.claim.ts` | **New** — claim Setup Token endpoint |
| `app/routes/api.plaid.create-link-token.ts` | **Delete** |
| `app/routes/api.plaid.exchange-token.ts` | **Delete** |
| `app/routes/_app.accounts.tsx` | Replace Plaid Link with SimpleFIN token input |
| `app/routes/_index.tsx` | Update provider references |
| `CLAUDE.md` | Update docs |
| `package.json` | Remove plaid, react-plaid-link |
