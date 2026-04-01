/**
 * SimpleFIN Bridge API client (server-only)
 *
 * How it works:
 *   1. User visits bridge.simplefin.org/simplefin/create → gets a Setup Token (base64 string)
 *   2. Base64-decode the token → POST to the claim URL → receive an Access URL
 *   3. Access URL format: https://user:pass@bridge.simplefin.org/simplefin
 *   4. GET {ACCESS_URL}/accounts?version=2 with Basic Auth (parsed from URL)
 *
 * No API keys required. Rate limit: ≤24 requests/day per Access URL.
 */

import { encryptToken, decryptToken } from "~/lib/crypto.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimplefinAccount {
  id: string;          // unique account ID from SimpleFIN
  name: string;        // "Savings", "Checking"
  connId: string;      // organization/connection ID
  connName: string;    // "Wells Fargo - Pier"
  currency: string;    // "USD"
  balance: number;     // current balance
  availableBalance: number | null;
  balanceDate: Date;   // when balance was last updated
  accountType: "bank" | "brokerage"; // derived from SimpleFIN org info
}

export interface SimplefinConnectionInfo {
  connId: string;
  name: string;    // institution name
  orgId: string;
  orgUrl: string | null;
}

export interface ClaimSetupTokenSuccess {
  success: true;
  accessUrl: string;       // encrypted
  label: string;           // institution name(s) from the accounts response
  accounts: SimplefinAccount[];
}

export interface SimplefinError {
  success: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Raw SimpleFIN API response types
// ---------------------------------------------------------------------------

interface SFOrganization {
  domain?: string;
  "sfin-url"?: string;
  name: string;
  id: string;
  url?: string;
}

interface SFAccount {
  id: string;
  name: string;
  org: SFOrganization;
  currency: string;
  balance: string;
  "available-balance"?: string;
  "balance-date": number; // Unix timestamp
  transactions?: unknown[];
}

interface SFAccountsResponse {
  errors?: Array<{ token?: string; code?: string; message?: string }>;
  accounts: SFAccount[];
}

// ---------------------------------------------------------------------------
// Claim a Setup Token
// ---------------------------------------------------------------------------

/**
 * Claim a SimpleFIN Setup Token.
 * 1. Base64-decode the token → claim URL
 * 2. POST to claim URL → receive Access URL
 * 3. Fetch accounts to get institution label
 * 4. Return encrypted Access URL + accounts
 */
export async function claimSetupToken(
  setupToken: string
): Promise<ClaimSetupTokenSuccess | SimplefinError> {
  try {
    // 1. Base64-decode to get the claim URL
    let claimUrl: string;
    try {
      claimUrl = Buffer.from(setupToken.trim(), "base64").toString("utf8");
    } catch {
      return { success: false, error: "Invalid Setup Token — could not base64 decode" };
    }

    if (!claimUrl.startsWith("http")) {
      return { success: false, error: "Invalid Setup Token — decoded value is not a URL" };
    }

    // 2. POST to claim URL to get Access URL
    const claimResponse = await fetch(claimUrl, {
      method: "POST",
      headers: { "Content-Length": "0" },
    });

    if (!claimResponse.ok) {
      const text = await claimResponse.text();
      return {
        success: false,
        error: `Claim failed (HTTP ${claimResponse.status}): ${text.slice(0, 200)}`,
      };
    }

    const accessUrl = (await claimResponse.text()).trim();

    if (!accessUrl.startsWith("http")) {
      return { success: false, error: "Claim response was not a valid Access URL" };
    }

    // 3. Encrypt the Access URL for storage
    const encryptedAccessUrl = encryptToken(accessUrl);

    // 4. Fetch accounts to get institution label + initial balances
    const accountsResult = await fetchSimplefinAccounts(accessUrl);
    if (!accountsResult.success) {
      return { success: false, error: `Connected but failed to fetch accounts: ${accountsResult.error}` };
    }

    const { accounts, connections } = accountsResult;

    // Build a label from the institution names
    const institutionNames = [...new Set(connections.map((c) => c.name))];
    const label = institutionNames.join(", ") || "Bank";

    return {
      success: true,
      accessUrl: encryptedAccessUrl,
      label,
      accounts,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during token claim";
    console.error("[simplefin] claimSetupToken error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Fetch accounts from a stored (encrypted) Access URL
// ---------------------------------------------------------------------------

export interface GetSimplefinAccountsSuccess {
  success: true;
  accounts: SimplefinAccount[];
  connections: SimplefinConnectionInfo[];
}

/**
 * Fetch all accounts from a SimpleFIN connection.
 * @param encryptedAccessUrl — the encrypted Access URL stored in DB
 */
export async function getSimplefinAccounts(
  encryptedAccessUrl: string
): Promise<GetSimplefinAccountsSuccess | SimplefinError> {
  try {
    const accessUrl = decryptToken(encryptedAccessUrl);
    return fetchSimplefinAccounts(accessUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to decrypt access URL";
    console.error("[simplefin] getSimplefinAccounts error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Internal: fetch accounts from a plaintext Access URL
// ---------------------------------------------------------------------------

async function fetchSimplefinAccounts(
  accessUrl: string
): Promise<GetSimplefinAccountsSuccess | SimplefinError> {
  try {
    // Parse credentials from Access URL (https://user:pass@host/path)
    const parsed = new URL(accessUrl);
    const username = parsed.username;
    const password = parsed.password;

    // Build the accounts endpoint URL (strip credentials from URL)
    parsed.username = "";
    parsed.password = "";
    const accountsUrl = `${parsed.toString()}/accounts?version=2`;

    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(accountsUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `SimpleFIN API error (HTTP ${response.status}): ${text.slice(0, 200)}`,
      };
    }

    const data: SFAccountsResponse = await response.json();

    // Surface any errors from SimpleFIN
    if (data.errors && data.errors.length > 0) {
      const errorMsg = data.errors
        .map((e) => e.message || e.code || JSON.stringify(e))
        .join("; ");
      return { success: false, error: `SimpleFIN reported errors: ${errorMsg}` };
    }

    const connections: SimplefinConnectionInfo[] = [];
    const seenConnIds = new Set<string>();

    const accounts: SimplefinAccount[] = (data.accounts || []).map((a: SFAccount) => {
      // Track unique connections
      if (!seenConnIds.has(a.org.id)) {
        seenConnIds.add(a.org.id);
        connections.push({
          connId: a.org.id,
          name: a.org.name,
          orgId: a.org.id,
          orgUrl: a.org.url ?? null,
        });
      }

      // Determine account type — SimpleFIN doesn't distinguish explicitly,
      // but we can guess from account name / org domain
      const nameLower = a.name.toLowerCase();
      const isBrokerage =
        nameLower.includes("brokerage") ||
        nameLower.includes("investment") ||
        nameLower.includes("portfolio") ||
        nameLower.includes("ira") ||
        nameLower.includes("401k") ||
        nameLower.includes("roth");

      return {
        id: a.id,
        name: a.name,
        connId: a.org.id,
        connName: a.org.name,
        currency: a.currency,
        balance: parseFloat(a.balance) || 0,
        availableBalance:
          a["available-balance"] != null ? parseFloat(a["available-balance"]) : null,
        balanceDate: new Date(a["balance-date"] * 1000),
        accountType: isBrokerage ? "brokerage" : "bank",
      } satisfies SimplefinAccount;
    });

    return { success: true, accounts, connections };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch SimpleFIN accounts";
    console.error("[simplefin] fetchSimplefinAccounts error:", err);
    return { success: false, error: message };
  }
}
