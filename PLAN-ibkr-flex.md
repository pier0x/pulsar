# IBKR Flex Query Integration — Enrich SimpleFIN with Holdings Data

SimpleFIN only returns IBKR's settled cash balance. Use IBKR's Flex Web Service to fetch full portfolio holdings and enrich the brokerage account data.

## How Flex Web Service Works

Two-step async flow:
1. **SendRequest** — `GET /SendRequest?t={TOKEN}&q={QUERY_ID}&v=3` → returns XML with `<ReferenceCode>`
2. **GetStatement** — `GET /GetStatement?t={TOKEN}&q={REFERENCE_CODE}&v=3` → returns the report (XML)

Wait ~10-30 seconds between steps. Rate limit: 1 req/sec, 10 req/min per token.

Base URL: `https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService`

Data is updated end-of-day (not real-time). Best fetched once daily.

## User Setup (one-time, in IBKR Client Portal)

1. Go to **Reporting → Flex Queries → Flex Web Service Configuration**
2. Enable Flex Web Service → get a **Current Token** (set expiry to 1 year)
3. Create an **Activity Flex Query** with these sections:
   - **Open Positions** — include: Symbol, Description, Quantity, MarkPrice, PositionValue, CostBasis, UnrealizedPnL, AssetCategory, Currency
4. Note the **Query ID** from the info icon

Two env vars: `IBKR_FLEX_TOKEN` and `IBKR_FLEX_QUERY_ID`

---

## Phase 1: IBKR Flex Provider

**New file: `app/lib/providers/ibkr-flex.server.ts`**

```ts
// Send a Flex Query request → get reference code
async function requestFlexReport(token: string, queryId: string): Promise<{
  success: true; referenceCode: string;
} | { success: false; error: string }>

// Fetch the generated report by reference code
async function fetchFlexReport(token: string, referenceCode: string): Promise<{
  success: true; holdings: IbkrHolding[]; totalValue: number; cashBalance: number;
} | { success: false; error: string }>

// Combined: request + wait + fetch (with retry)
async function getIbkrHoldings(): Promise<{
  success: true; holdings: IbkrHolding[]; totalValue: number; cashBalance: number;
} | { success: false; error: string }>

interface IbkrHolding {
  symbol: string;        // "AAPL", "VTI"
  description: string;   // "APPLE INC"
  quantity: number;
  markPrice: number;     // current market price
  positionValue: number; // quantity * markPrice
  costBasis: number;
  unrealizedPnl: number;
  assetCategory: string; // "STK", "OPT", "CASH", etc.
  currency: string;
}
```

Implementation:
- Parse XML responses (use a lightweight XML parser or regex for the simple structure)
- `requestFlexReport()` → GET /SendRequest, parse `<Status>`, `<ReferenceCode>`
- `fetchFlexReport()` → GET /GetStatement, parse `<OpenPosition>` elements
- `getIbkrHoldings()` → calls request, waits 15s, then fetch with up to 3 retries (5s apart)
- All requests include `User-Agent: Pulsar/1.0` header (required by IBKR)
- Returns if `IBKR_FLEX_TOKEN` or `IBKR_FLEX_QUERY_ID` not set → `{ success: false, error: "IBKR not configured" }`

---

## Phase 2: Enrich During Refresh

**Update `app/lib/balance/refresh.server.ts`:**

After SimpleFIN refresh completes, check if any accounts look like IBKR:
- Match by connection name containing "interactive brokers" (case-insensitive)
- Or match by account name containing "settled cash" from an IBKR-like connection

If IBKR account detected AND `IBKR_FLEX_TOKEN` is configured:
1. Call `getIbkrHoldings()`
2. Find or create a brokerage Account for this IBKR connection (type: "brokerage", provider: "ibkr-flex")
3. Create `AccountSnapshot` with `totalUsdValue` = total portfolio value
4. Create `HoldingSnapshot` entries for each position (symbol, quantity, price, value, costBasis)
5. The SimpleFIN "Settled Cash" account stays as-is (type: "bank") — it's the cash portion

This way:
- SimpleFIN handles the cash balance (auto-updates daily)
- IBKR Flex handles the investment holdings (fetched during refresh)
- Dashboard shows both: cash + investment positions

---

## Phase 3: Dashboard Display

Minimal changes needed — the dashboard already handles brokerage accounts with `HoldingSnapshot` data (from the old Plaid brokerage support). The IBKR brokerage account will just show up like any other brokerage account with holdings.

If needed, update the brokerage card to show:
- Total portfolio value
- Individual holdings with symbol, quantity, value, P&L
- Cost basis and unrealized P&L per holding

---

## Phase 4: Cleanup

- Add `IBKR_FLEX_TOKEN` and `IBKR_FLEX_QUERY_ID` to `.env.example`
- Update `CLAUDE.md` with IBKR Flex provider docs
- Add IBKR to the account types documentation
- Remove debug logging from SimpleFIN provider

---

## Env Vars

```bash
IBKR_FLEX_TOKEN=528191644107458877539776    # From IBKR Client Portal
IBKR_FLEX_QUERY_ID=800969                    # From Flex Query info
```

---

## File Changes Summary

| File | Action |
|------|--------|
| `app/lib/providers/ibkr-flex.server.ts` | **New** — Flex Web Service client |
| `app/lib/balance/refresh.server.ts` | Detect IBKR accounts, call Flex Query during refresh |
| `app/lib/accounts.server.ts` | Add `"ibkr-flex"` to AccountProvider type |
| `.env.example` | Add IBKR env vars |
| `CLAUDE.md` | Update docs |

---

## Rate Limits & Timing

- IBKR Flex: 1 request/sec, 10 requests/min per token
- Data updates end-of-day only — no benefit to fetching more than once daily
- The 15-30s wait between SendRequest and GetStatement is built into the flow
- Total refresh time for IBKR: ~20-30 seconds (acceptable for a manual refresh)
