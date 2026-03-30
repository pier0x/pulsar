/**
 * CoinGecko Pro API provider for price data.
 * Requires COINGECKO_API_KEY env var.
 */

import type { WalletNetwork } from "~/lib/wallet";

const COINGECKO_URL = "https://pro-api.coingecko.com/api/v3";

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
  arbitrum: "ethereum",
  base: "ethereum",
  polygon: "polygon-ecosystem-token",
  solana: "solana",
  hyperliquid: "usd-coin", // Not used — HL refresh returns USD directly
};

export interface PriceResult {
  success: true;
  priceUsd: number;
}

export interface TokenPriceResult {
  success: true;
  prices: Map<string, number>;
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
 * Make a CoinGecko Pro API request.
 */
export async function coingeckoFetch(endpoint: string): Promise<unknown> {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) throw new Error("COINGECKO_API_KEY env var is required");

  const url = `${COINGECKO_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-cg-pro-api-key": apiKey,
    },
  });

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
 * Get price for a native token (BTC, ETH, SOL, etc.)
 */
export async function getNativeTokenPrice(
  network: WalletNetwork,
): Promise<SinglePriceResult> {
  try {
    const coinId = NATIVE_TOKEN_IDS[network];
    const data = await coingeckoFetch(
      `/simple/price?ids=${coinId}&vs_currencies=usd`
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
): Promise<Map<WalletNetwork, number>> {
  const uniqueCoinIds = [...new Set(networks.map((n) => NATIVE_TOKEN_IDS[n]))];
  const coinIdsParam = uniqueCoinIds.join(",");

  try {
    const data = await coingeckoFetch(
      `/simple/price?ids=${coinIdsParam}&vs_currencies=usd`
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
    const batchSize = 100;
    const prices = new Map<string, number>();

    for (let i = 0; i < contractAddresses.length; i += batchSize) {
      const batch = contractAddresses.slice(i, i + batchSize);
      const addressesParam = batch.join(",");

      const data = await coingeckoFetch(
        `/simple/token_price/${platformId}?contract_addresses=${addressesParam}&vs_currencies=usd`
      ) as Record<string, { usd: number }>;

      for (const [address, priceData] of Object.entries(data)) {
        if (priceData?.usd !== undefined) {
          prices.set(address.toLowerCase(), priceData.usd);
        }
      }

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
 */
export async function getWalletPrices(
  network: WalletNetwork,
  tokenAddresses: string[],
): Promise<{
  nativePrice: SinglePriceResult;
  tokenPrices: MultiPriceResult;
}> {
  const [nativePrice, tokenPrices] = await Promise.all([
    getNativeTokenPrice(network),
    getTokenPrices(network, tokenAddresses),
  ]);

  return { nativePrice, tokenPrices };
}
