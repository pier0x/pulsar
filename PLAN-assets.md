# Physical Assets — Implementation Plan

Track manually-valued physical assets (watches, cars, etc.) alongside crypto, bank, and brokerage accounts in the unified dashboard.

## Design Decisions

- **Account type:** `"manual"` with `provider: "manual"`
- **Category:** Free-text string (e.g. "watches", "cars") — no enum, user enters whatever they want
- **Cost basis:** Stored on the Account record, so you always know purchase price vs current value
- **Images:** Stored on disk at `data/assets/<accountId>.{ext}`, served via a Remix resource route
- **Value updates:** Each manual value entry creates an `AccountSnapshot` → history builds automatically
- **Dashboard integration:** New filter tab `[Assets]`, rolls into total net worth

---

## Phase 1: Schema Changes

**Migration: `add_manual_assets`**

Add fields to `Account` model:

```prisma
// New fields on Account (all nullable, only used for type="manual")
category    String?   // "watches", "cars", etc.
costBasis   Decimal?  // purchase price in USD
notes       String?   // serial number, purchase date, whatever
imagePath   String?   // relative path: "data/assets/<id>.webp"
```

Update types in `accounts.server.ts`:
- Add `"manual"` to `AccountType`
- Add `"manual"` to `AccountProvider`
- Add `CreateManualAssetInput` interface

No changes to `AccountSnapshot` — just uses `totalUsdValue` like everything else.

---

## Phase 2: Image Upload & Serving

**File storage:**
- Directory: `data/assets/` (relative to project root, gitignored)
- Naming: `<accountId>.<ext>` (preserve original extension, or convert to webp)
- Max size: ~5MB per image (plenty for a photo)

**New route: `api.asset-image.$id.ts`**
- `GET` — reads `data/assets/<id>.*` from disk, returns with correct content-type
- Serves as `<img src="/api/asset-image/<accountId>">` in the UI

**Upload handling:**
- In the accounts page action, parse `multipart/form-data` when intent is `add-asset`
- Use `@remix-run/node` `unstable_parseMultipartFormData` or just read the file from the request
- Write to `data/assets/<accountId>.<ext>`
- Store relative path in `account.imagePath`

---

## Phase 3: Account CRUD

**`accounts.server.ts` additions:**

```ts
interface CreateManualAssetInput {
  userId: string;
  name: string;         // "Rolex Submariner 126610LN"
  category: string;     // "watches"
  currentValue: number; // current estimated value in USD
  costBasis?: number;   // what you paid
  notes?: string;
  imagePath?: string;
}

async function createManualAsset(input: CreateManualAssetInput): Promise<Account>
// Creates Account + initial AccountSnapshot with totalUsdValue

async function updateManualAssetValue(accountId: string, newValue: number): Promise<AccountSnapshot>
// Creates a new snapshot — that's it, history accumulates

async function updateManualAssetDetails(accountId: string, updates: { name?, category?, costBasis?, notes?, imagePath? }): Promise<Account>
// Update metadata without creating a snapshot

async function deleteManualAsset(accountId: string): Promise<void>
// Deletes account + snapshots + image file from disk
```

---

## Phase 4: Accounts Page UI

**Add new section to `_app.accounts.tsx`:**

Below the existing on-chain / bank / brokerage sections, add **"Physical Assets"** section.

**"Add Asset" form:**
- Name (text input, required)
- Category (text input, required — placeholder: "watches, cars, art...")
- Current Value (number input, required)
- Cost Basis (number input, optional)
- Notes (textarea, optional)
- Image (file input, optional — accept image/*)

**Asset cards:**
- Thumbnail image (if uploaded) on the left
- Name, category badge, current value
- Cost basis → show gain/loss: `+$2,400 (+15.3%)` in emerald or red
- "Last valued" timestamp (from latest snapshot)
- "Update Value" button → small inline form or modal to enter new value
- Delete button (with confirmation)

---

## Phase 5: Dashboard Integration

**`_index.tsx` changes:**

1. **Filter bar:** Add `[Assets]` tab (or `[Physical]`) → `filter=manual`
2. **Fetch manual accounts** when `showManual` is true:
   ```ts
   const manualAccounts = showManual
     ? await prisma.account.findMany({
         where: { userId: user.id, type: "manual" },
         include: { snapshots: { orderBy: { timestamp: "desc" }, take: 2 } },
       })
     : [];
   ```
3. **Wallet cards:** Manual assets show with image thumbnail, category, value
4. **Breakdown:** Group by category ("watches: $45,000", "cars: $32,000")
5. **Net worth:** Manual asset values roll into total
6. **Top movers:** Include manual assets if they have 2+ snapshots (show % change)

---

## Phase 6: Cleanup

- Add `data/assets/` to `.gitignore`
- Update `CLAUDE.md` with new route, account type, and category field docs
- Ensure refresh flow skips `type: "manual"` accounts (no auto-refresh needed)
- Update the unique constraint — manual assets don't have network/address, so the existing `@@unique([userId, network, address])` won't conflict (both null)

---

## File Changes Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `category`, `costBasis`, `notes`, `imagePath` to Account |
| `app/lib/accounts.server.ts` | Add manual asset CRUD functions |
| `app/routes/_app.accounts.tsx` | Add asset section, form, cards, value update |
| `app/routes/api.asset-image.$id.ts` | New — serve asset images from disk |
| `app/routes/_index.tsx` | Add `manual` filter, fetch, display, breakdown |
| `app/routes/api.refresh.ts` | Skip `type: "manual"` in refresh |
| `app/lib/balance/` | Skip manual accounts in refresh logic |
| `.gitignore` | Add `data/assets/` |
| `CLAUDE.md` | Update docs |
