/**
 * Plaid API client wrapper (server-only)
 *
 * Env vars required:
 *   PLAID_CLIENT_ID
 *   PLAID_SECRET
 *   PLAID_ENV  — "sandbox" | "production" (defaults to "sandbox")
 *
 * Env vars for encryption:
 *   ENCRYPTION_SECRET  — 32-char hex key for AES-256-GCM
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type AccountBase,
  type Security,
  type Holding,
} from "plaid";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Plaid client singleton
// ---------------------------------------------------------------------------

let _plaidClient: PlaidApi | null = null;

function getPlaidClient(): PlaidApi | null {
  if (_plaidClient) return _plaidClient;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    return null; // Not configured — callers should handle this
  }

  const envKey = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;
  const baseUrl = PlaidEnvironments[envKey] ?? PlaidEnvironments.sandbox;

  const config = new Configuration({
    basePath: baseUrl,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  _plaidClient = new PlaidApi(config);
  return _plaidClient;
}

// ---------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET env var is not set");
  }
  // Accept hex string (64 chars) or UTF-8 padded to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  // Pad/truncate to 32 bytes
  return Buffer.alloc(32, secret);
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Link token
// ---------------------------------------------------------------------------

export interface CreateLinkTokenResult {
  success: true;
  linkToken: string;
  expiration: string;
}

export interface PlaidError {
  success: false;
  error: string;
}

export async function createLinkToken(
  userId: string
): Promise<CreateLinkTokenResult | PlaidError> {
  const client = getPlaidClient();
  if (!client) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Pulsar",
      products: [Products.Auth],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return {
      success: true,
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Plaid link token creation failed";
    console.error("[plaid] createLinkToken error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Exchange public token
// ---------------------------------------------------------------------------

export interface ExchangeTokenResult {
  success: true;
  accessToken: string; // encrypted
  itemId: string;
}

export async function exchangePublicToken(
  publicToken: string
): Promise<ExchangeTokenResult | PlaidError> {
  const client = getPlaidClient();
  if (!client) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const response = await client.itemPublicTokenExchange({ public_token: publicToken });
    const encryptedToken = encryptToken(response.data.access_token);
    return {
      success: true,
      accessToken: encryptedToken,
      itemId: response.data.item_id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    console.error("[plaid] exchangePublicToken error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Get accounts from an item
// ---------------------------------------------------------------------------

export interface PlaidAccountInfo {
  accountId: string;
  name: string;
  officialName: string | null;
  type: string; // "depository" | "credit" | "investment" | ...
  subtype: string | null; // "checking" | "savings" | ...
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
}

export async function getAccountsForItem(
  encryptedAccessToken: string
): Promise<{ success: true; accounts: PlaidAccountInfo[] } | PlaidError> {
  const client = getPlaidClient();
  if (!client) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const accessToken = decryptToken(encryptedAccessToken);
    const response = await client.accountsGet({ access_token: accessToken });

    const accounts: PlaidAccountInfo[] = response.data.accounts.map((a: AccountBase) => ({
      accountId: a.account_id,
      name: a.name,
      officialName: a.official_name ?? null,
      type: a.type,
      subtype: a.subtype ?? null,
      currentBalance: a.balances.current ?? null,
      availableBalance: a.balances.available ?? null,
      currency: a.balances.iso_currency_code ?? "USD",
    }));

    return { success: true, accounts };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get accounts";
    console.error("[plaid] getAccountsForItem error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Get real-time balances
// ---------------------------------------------------------------------------

export interface PlaidBalanceResult {
  accountId: string;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
}

export async function getBalances(
  encryptedAccessToken: string
): Promise<{ success: true; balances: PlaidBalanceResult[] } | PlaidError> {
  const client = getPlaidClient();
  if (!client) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const accessToken = decryptToken(encryptedAccessToken);
    const response = await client.accountsBalanceGet({ access_token: accessToken });

    const balances: PlaidBalanceResult[] = response.data.accounts.map((a: AccountBase) => ({
      accountId: a.account_id,
      currentBalance: a.balances.current ?? null,
      availableBalance: a.balances.available ?? null,
      currency: a.balances.iso_currency_code ?? "USD",
    }));

    return { success: true, balances };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch balances";
    console.error("[plaid] getBalances error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Get institution info from an item
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Get investment holdings
// ---------------------------------------------------------------------------

export interface PlaidHolding {
  ticker: string | null;
  name: string | null;
  securityId: string;
  quantity: number;
  priceUsd: number;
  valueUsd: number;
  costBasis: number | null;
  isoType: string | null; // "equity", "etf", "mutual fund", "cash", etc.
}

export interface PlaidInvestmentResult {
  success: true;
  holdings: PlaidHolding[];
  cashBalance: number;
  totalValue: number;
}

export async function getInvestmentHoldings(
  encryptedAccessToken: string
): Promise<PlaidInvestmentResult | PlaidError> {
  const client = getPlaidClient();
  if (!client) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const accessToken = decryptToken(encryptedAccessToken);
    const response = await client.investmentsHoldingsGet({ access_token: accessToken });

    // Build a security lookup map
    const securitiesMap = new Map<string, Security>();
    for (const sec of response.data.securities) {
      securitiesMap.set(sec.security_id, sec);
    }

    let cashBalance = 0;
    const holdings: PlaidHolding[] = [];

    for (const holding of response.data.holdings as Holding[]) {
      const security = securitiesMap.get(holding.security_id);
      const isoType = security?.type ?? null;

      // Separate cash/money-market holdings into cashBalance
      if (isoType === "cash" || isoType === "money market") {
        cashBalance += holding.institution_value ?? 0;
        continue;
      }

      holdings.push({
        ticker: security?.ticker_symbol ?? null,
        name: security?.name ?? null,
        securityId: holding.security_id,
        quantity: holding.quantity,
        priceUsd: holding.institution_price ?? 0,
        valueUsd: holding.institution_value ?? holding.quantity * (holding.institution_price ?? 0),
        costBasis: holding.cost_basis ?? null,
        isoType,
      });
    }

    const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0) + cashBalance;

    return { success: true, holdings, cashBalance, totalValue };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get investment holdings";
    console.error("[plaid] getInvestmentHoldings error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Get institution info from an item
// ---------------------------------------------------------------------------

export async function getInstitutionName(
  encryptedAccessToken: string
): Promise<{ success: true; name: string; institutionId: string } | PlaidError> {
  const client = getPlaidClient();
  if (!client) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const accessToken = decryptToken(encryptedAccessToken);
    const itemResponse = await client.itemGet({ access_token: accessToken });
    const institutionId = itemResponse.data.item.institution_id;

    if (!institutionId) {
      return { success: true, name: "Unknown Bank", institutionId: "" };
    }

    const instResponse = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });

    return {
      success: true,
      name: instResponse.data.institution.name,
      institutionId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get institution";
    console.error("[plaid] getInstitutionName error:", err);
    return { success: false, error: message };
  }
}
