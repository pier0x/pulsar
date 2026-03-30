/**
 * Hyperliquid provider — public API, no key needed.
 * https://api.hyperliquid.xyz/info
 */

const HL_API = "https://api.hyperliquid.xyz/info";

async function hlPost(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API ${res.status}`);
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────

export interface HyperliquidBalance {
  /** Perps account value in USD */
  perpsUsd: number;
  /** Spot token balances */
  spotBalances: { coin: string; total: string; hold: string }[];
  /** Total USD value (perps + spot after pricing) */
  totalUsd: number;
}

interface ClearinghouseState {
  marginSummary: { accountValue: string };
  assetPositions: unknown[];
}

interface SpotState {
  balances: { coin: string; token: number; total: string; hold: string }[];
}

// ── Check if HL account exists ─────────────────────────────────────

/**
 * Returns true if the address has any Hyperliquid activity
 * (perps value > 0 OR any spot balance > 0).
 */
export async function hasHyperliquidAccount(address: string): Promise<boolean> {
  try {
    const [perps, spot] = await Promise.all([
      hlPost({ type: "clearinghouseState", user: address }) as Promise<ClearinghouseState>,
      hlPost({ type: "spotClearinghouseState", user: address }) as Promise<SpotState>,
    ]);

    const perpsValue = parseFloat(perps.marginSummary.accountValue);
    if (perpsValue > 0) return true;

    const hasSpot = spot.balances.some((b) => parseFloat(b.total) > 0);
    return hasSpot;
  } catch {
    return false;
  }
}

// ── Fetch full balance ─────────────────────────────────────────────

/**
 * Fetch perps + spot balances and compute total USD value.
 * Uses Hyperliquid's own mid prices for spot tokens.
 */
export async function fetchHyperliquidBalance(
  address: string
): Promise<{ success: true; data: HyperliquidBalance } | { success: false; error: string }> {
  try {
    const [perps, spot, mids] = await Promise.all([
      hlPost({ type: "clearinghouseState", user: address }) as Promise<ClearinghouseState>,
      hlPost({ type: "spotClearinghouseState", user: address }) as Promise<SpotState>,
      hlPost({ type: "allMids" }) as Promise<Record<string, string>>,
    ]);

    const perpsUsd = parseFloat(perps.marginSummary.accountValue);

    // Price spot balances using HL mids
    let spotUsd = 0;
    const spotBalances = spot.balances.filter((b) => parseFloat(b.total) > 0);

    for (const bal of spotBalances) {
      const total = parseFloat(bal.total);
      if (bal.coin === "USDC" || bal.coin === "USDH") {
        spotUsd += total;
      } else {
        // Try to find a mid price — coin might be listed as "HYPE" with mid in allMids
        const mid = mids[bal.coin] || mids[`${bal.coin}/USDC`];
        if (mid) {
          spotUsd += total * parseFloat(mid);
        }
        // If no mid found, skip (dust token)
      }
    }

    return {
      success: true,
      data: {
        perpsUsd,
        spotBalances,
        totalUsd: perpsUsd + spotUsd,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch Hyperliquid balance",
    };
  }
}
