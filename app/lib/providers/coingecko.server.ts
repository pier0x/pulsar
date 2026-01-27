/**
 * CoinGecko provider for price data
 * Free tier: 30 calls/minute, no API key required
 * Pro tier: Higher limits with API key
 */

import type { WalletNetwork } from "~/lib/wallet";

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
const COINGECKO_PRO_API_URL = "https://pro-api.coingecko.com/api/v3";

// CoinGecko platform IDs for token contract lookups
const PLATFORM_IDS: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum-one",
  base: "base",
  polygon: "polygon-pos",
  solana: "solana",
};

// Native token CoinGecko IDs
const NATIVE_TOKEN_IDS: Record<WalletNetwork, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  arbitrum: "ethereum", // Arbitrum uses ETH
  base: "ethereum", // Base uses ETH
  polygon: "matic-network",
  solana: "solana",
};

export interface PriceResult {
  success: true;
  priceUsd: number;
}

export interface TokenPriceResult {
  success: true;
  prices: Map<string, number>; // contractAddress -> priceUsd
}

export interface FetchError {
  success: false;
  error: {
    type: "api_error" | "timeout" | "rate_limit" | "not_found";
    message: string;
    details?: unknown;
  };
}

type SinglePriceResult = PriceResult | FetchError;
type MultiPriceResult = TokenPriceResult | FetchError;

/**
 * Make a CoinGecko API request
 */
async function coingeckoFetch(
  endpoint: string,
  apiKey?: string | null
): Promise<unknown> {
  const baseUrl = apiKey ? COINGECKO_PRO_API_URL : COINGECKO_API_URL;
  const url = `${baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  
  if (apiKey) {
    headers["x-cg-pro-api-key"] = apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 429) {
      throw { type: "rate_limit", message: "Rate limited by CoinGecko" };
    }
    if (response.status === 404) {
      throw { type: "not_found", message: "Token not found" };
    }
    throw { type: "api_error", message: `HTTP ${response.status}` };
  }

  return response.json();
}

/**
 * Get price for a native token (BTC, ETH, SOL, MATIC)
 */
export async function getNativeTokenPrice(
  network: WalletNetwork,
  apiKey?: string | null
): Promise<SinglePriceResult> {
  try {
    const coinId = NATIVE_TOKEN_IDS[network];
    const data = await coingeckoFetch(
      `/simple/price?ids=${coinId}&vs_currencies=usd`,
      apiKey
    ) as Record<string, { usd: number }>;

    const price = data[coinId]?.usd;
    if (price === undefined) {
      return {
        success: false,
        error: { type: "not_found", message: `Price not found for ${network}` },
      };
    }

    return { success: true, priceUsd: price };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch native token price",
        details: error,
      },
    };
  }
}

/**
 * Get prices for multiple native tokens at once
 */
export async function getNativeTokenPrices(
  networks: WalletNetwork[],
  apiKey?: string | null
): Promise<Map<WalletNetwork, number>> {
  const uniqueCoinIds = [...new Set(networks.map((n) => NATIVE_TOKEN_IDS[n]))];
  const coinIdsParam = uniqueCoinIds.join(",");

  try {
    const data = await coingeckoFetch(
      `/simple/price?ids=${coinIdsParam}&vs_currencies=usd`,
      apiKey
    ) as Record<string, { usd: number }>;

    const prices = new Map<WalletNetwork, number>();
    for (const network of networks) {
      const coinId = NATIVE_TOKEN_IDS[network];
      const price = data[coinId]?.usd;
      if (price !== undefined) {
        prices.set(network, price);
      }
    }

    return prices;
  } catch {
    return new Map();
  }
}

/**
 * Get prices for ERC-20/SPL tokens by contract address
 */
export async function getTokenPrices(
  network: WalletNetwork,
  contractAddresses: string[],
  apiKey?: string | null
): Promise<MultiPriceResult> {
  if (contractAddresses.length === 0) {
    return { success: true, prices: new Map() };
  }

  const platformId = PLATFORM_IDS[network];
  if (!platformId) {
    return {
      success: false,
      error: { type: "api_error", message: `Unsupported network: ${network}` },
    };
  }

  try {
    // CoinGecko limits to ~100 addresses per request
    const batchSize = 100;
    const prices = new Map<string, number>();

    for (let i = 0; i < contractAddresses.length; i += batchSize) {
      const batch = contractAddresses.slice(i, i + batchSize);
      const addressesParam = batch.join(",");

      const data = await coingeckoFetch(
        `/simple/token_price/${platformId}?contract_addresses=${addressesParam}&vs_currencies=usd`,
        apiKey
      ) as Record<string, { usd: number }>;

      for (const [address, priceData] of Object.entries(data)) {
        if (priceData?.usd !== undefined) {
          // Normalize address to lowercase for consistent lookup
          prices.set(address.toLowerCase(), priceData.usd);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < contractAddresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return { success: true, prices };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch token prices",
        details: error,
      },
    };
  }
}

/**
 * Get all prices needed for a wallet snapshot
 * Returns prices for native token + all provided token addresses
 */
export async function getWalletPrices(
  network: WalletNetwork,
  tokenAddresses: string[],
  apiKey?: string | null
): Promise<{
  nativePrice: SinglePriceResult;
  tokenPrices: MultiPriceResult;
}> {
  const [nativePrice, tokenPrices] = await Promise.all([
    getNativeTokenPrice(network, apiKey),
    getTokenPrices(network, tokenAddresses, apiKey),
  ]);

  return { nativePrice, tokenPrices };
}

/**
 * Test CoinGecko API connection
 */
export async function testCoinGeckoConnection(apiKey?: string | null): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await coingeckoFetch("/ping", apiKey);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || "Connection failed" };
  }
}
