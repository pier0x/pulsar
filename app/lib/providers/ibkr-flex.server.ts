/**
 * IBKR Flex Web Service client (server-only)
 *
 * Two-step async flow:
 *   1. GET /SendRequest?t={TOKEN}&q={QUERY_ID}&v=3 → XML with <ReferenceCode>
 *   2. Wait ~15s
 *   3. GET /GetStatement?t={TOKEN}&q={REFERENCE_CODE}&v=3 → XML report with holdings
 *
 * Env vars:
 *   IBKR_FLEX_TOKEN    — from IBKR Client Portal → Flex Web Service Configuration
 *   IBKR_FLEX_QUERY_ID — from Flex Query info panel
 *
 * Rate limits: 1 req/sec, 10 req/min per token
 * Data updates end-of-day only.
 */

const FLEX_BASE_URL =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
const FLEX_VERSION = "3";
const USER_AGENT = "Pulsar/1.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IbkrHolding {
  symbol: string; // "AAPL", "VTI"
  description: string; // "APPLE INC"
  quantity: number;
  markPrice: number; // current market price
  positionValue: number; // quantity * markPrice
  costBasis: number;
  unrealizedPnl: number;
  assetCategory: string; // "STK", "OPT", "CASH", etc.
  currency: string;
}

export interface IbkrFlexSuccess {
  success: true;
  holdings: IbkrHolding[];
  totalValue: number;
  cashBalance: number;
}

export interface IbkrFlexError {
  success: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getConfig(): { token: string; queryId: string } | null {
  const token = process.env.IBKR_FLEX_TOKEN;
  const queryId = process.env.IBKR_FLEX_QUERY_ID;
  if (!token || !queryId) return null;
  return { token, queryId };
}

/**
 * Check if IBKR Flex is configured
 */
export function isIbkrFlexConfigured(): boolean {
  return getConfig() !== null;
}

// ---------------------------------------------------------------------------
// XML helpers (lightweight, no external dependency)
// ---------------------------------------------------------------------------

function extractXmlTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAllElements(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\s[^>]*/>|<${tag}\\s[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(regex) || [];
}

function extractAttribute(element: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = element.match(regex);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Step 1: Request report generation
// ---------------------------------------------------------------------------

async function requestFlexReport(
  token: string,
  queryId: string
): Promise<{ success: true; referenceCode: string } | IbkrFlexError> {
  try {
    const url = `${FLEX_BASE_URL}/SendRequest?t=${token}&q=${queryId}&v=${FLEX_VERSION}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `IBKR SendRequest HTTP ${response.status}`,
      };
    }

    const xml = await response.text();
    const status = extractXmlTag(xml, "Status");

    if (status !== "Success") {
      const errorCode = extractXmlTag(xml, "ErrorCode") || "unknown";
      const errorMessage =
        extractXmlTag(xml, "ErrorMessage") || "Unknown IBKR error";
      return {
        success: false,
        error: `IBKR SendRequest failed (${errorCode}): ${errorMessage}`,
      };
    }

    const referenceCode = extractXmlTag(xml, "ReferenceCode");
    if (!referenceCode) {
      return {
        success: false,
        error: "IBKR SendRequest succeeded but no ReferenceCode in response",
      };
    }

    return { success: true, referenceCode };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "IBKR SendRequest failed";
    console.error("[ibkr-flex] requestFlexReport error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Fetch the generated report
// ---------------------------------------------------------------------------

async function fetchFlexReport(
  token: string,
  referenceCode: string
): Promise<IbkrFlexSuccess | IbkrFlexError> {
  try {
    const url = `${FLEX_BASE_URL}/GetStatement?t=${token}&q=${referenceCode}&v=${FLEX_VERSION}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `IBKR GetStatement HTTP ${response.status}`,
      };
    }

    const xml = await response.text();

    // Check for error response (still XML with Status=Fail)
    const status = extractXmlTag(xml, "Status");
    if (status === "Fail") {
      const errorCode = extractXmlTag(xml, "ErrorCode") || "unknown";
      const errorMessage =
        extractXmlTag(xml, "ErrorMessage") || "Unknown error";
      return {
        success: false,
        error: `IBKR GetStatement failed (${errorCode}): ${errorMessage}`,
      };
    }

    // Parse OpenPosition elements
    const positionElements = extractAllElements(xml, "OpenPosition");
    const holdings: IbkrHolding[] = [];
    let totalValue = 0;
    let cashBalance = 0;

    for (const el of positionElements) {
      const assetCategory = extractAttribute(el, "assetCategory") || "";
      const symbol = extractAttribute(el, "symbol") || "";
      const description = extractAttribute(el, "description") || "";
      const quantity = parseFloat(extractAttribute(el, "position") || extractAttribute(el, "quantity") || "0");
      const markPrice = parseFloat(extractAttribute(el, "markPrice") || "0");
      const positionValue = parseFloat(
        extractAttribute(el, "positionValue") ||
          extractAttribute(el, "marketValue") ||
          String(quantity * markPrice)
      );
      const costBasis = parseFloat(
        extractAttribute(el, "costBasisMoney") ||
          extractAttribute(el, "costBasis") ||
          "0"
      );
      const unrealizedPnl = parseFloat(
        extractAttribute(el, "fifoPnlUnrealized") ||
          extractAttribute(el, "unrealizedPnL") ||
          "0"
      );
      const currency = extractAttribute(el, "currency") || "USD";

      // Skip cash-like entries from position list
      if (assetCategory === "CASH" || symbol === "USD" || symbol === "") {
        cashBalance += positionValue;
        continue;
      }

      holdings.push({
        symbol,
        description,
        quantity,
        markPrice,
        positionValue,
        costBasis,
        unrealizedPnl,
        assetCategory,
        currency,
      });

      totalValue += positionValue;
    }

    // Also check for CashReport if present
    const cashElements = extractAllElements(xml, "CashReportCurrency");
    for (const el of cashElements) {
      const currency = extractAttribute(el, "currency") || "";
      if (currency === "BASE_SUMMARY" || currency === "USD") {
        const endingCash = parseFloat(
          extractAttribute(el, "endingCash") || "0"
        );
        if (endingCash > 0) {
          cashBalance = endingCash;
        }
      }
    }

    totalValue += cashBalance;

    console.log(
      `[ibkr-flex] Parsed ${holdings.length} holdings, totalValue=$${totalValue.toFixed(2)}, cash=$${cashBalance.toFixed(2)}`
    );

    return { success: true, holdings, totalValue, cashBalance };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "IBKR GetStatement failed";
    console.error("[ibkr-flex] fetchFlexReport error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Combined: request + wait + fetch with retry
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch IBKR holdings via Flex Web Service.
 * Returns null if not configured.
 */
export async function getIbkrHoldings(): Promise<
  IbkrFlexSuccess | IbkrFlexError
> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "IBKR Flex is not configured" };
  }

  const { token, queryId } = config;

  // Step 1: Request report generation
  console.log("[ibkr-flex] Requesting Flex report...");
  const sendResult = await requestFlexReport(token, queryId);
  if (!sendResult.success) {
    return sendResult;
  }

  const { referenceCode } = sendResult;
  console.log(`[ibkr-flex] Got reference code: ${referenceCode}, waiting 15s...`);

  // Step 2: Wait for report generation
  await sleep(15_000);

  // Step 3: Fetch with retries (up to 3 attempts, 5s apart)
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[ibkr-flex] Fetching report (attempt ${attempt}/3)...`);
    const result = await fetchFlexReport(token, referenceCode);

    if (result.success) {
      return result;
    }

    // Check if it's a "not ready" error — retry
    if (
      result.error.includes("1019") ||
      result.error.includes("1001") ||
      result.error.includes("1004")
    ) {
      if (attempt < 3) {
        console.log("[ibkr-flex] Report not ready, waiting 5s...");
        await sleep(5_000);
        continue;
      }
    }

    // Non-retryable error
    return result;
  }

  return {
    success: false,
    error: "IBKR Flex report not available after 3 attempts",
  };
}
