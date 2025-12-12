/**
 * Ethereum balance fetching service using Alchemy API
 * Requires ALCHEMY_API_KEY environment variable
 */

import { config } from "~/lib/config.server";
import {
  type NativeBalance,
  type TokenBalanceResult,
  type TokenInfo,
  NETWORK_CONFIG,
  formatBalance,
} from "./types";

interface AlchemyRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: { code: number; message: string };
}

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

interface AlchemyTokenBalancesResponse {
  address: string;
  tokenBalances: AlchemyTokenBalance[];
}

interface AlchemyTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

/**
 * Get Alchemy RPC URL for the configured network
 */
function getAlchemyUrl(): string {
  const apiKey = config<string>("services.blockchain.alchemy.apiKey");
  const network = config<string>("services.blockchain.alchemy.network", "mainnet");

  if (!apiKey) {
    throw new Error("ALCHEMY_API_KEY is not configured");
  }

  return `https://eth-${network}.g.alchemy.com/v2/${apiKey}`;
}

/**
 * Make an Alchemy JSON-RPC call
 */
async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = getAlchemyUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
  }

  const data: AlchemyRpcResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`Alchemy RPC error: ${data.error.message}`);
  }

  return data.result;
}

/**
 * Check if Alchemy is configured
 */
export function isAlchemyConfigured(): boolean {
  return Boolean(config<string>("services.blockchain.alchemy.apiKey"));
}

/**
 * Fetch native ETH balance for an address
 */
export async function getEthereumBalance(address: string): Promise<NativeBalance> {
  // eth_getBalance returns hex string
  const balanceHex = await alchemyRpc<string>("eth_getBalance", [address, "latest"]);

  // Convert hex to decimal string (remove 0x prefix)
  const balanceWei = BigInt(balanceHex).toString();
  const cfg = NETWORK_CONFIG.ethereum;

  return {
    network: "ethereum",
    address,
    balance: balanceWei,
    balanceFormatted: formatBalance(balanceWei, cfg.decimals),
  };
}

/**
 * Fetch all ERC-20 token balances for an address using Alchemy's alchemy_getTokenBalances
 */
export async function getEthereumTokenBalances(
  address: string
): Promise<TokenBalanceResult[]> {
  // Get all token balances
  const response = await alchemyRpc<AlchemyTokenBalancesResponse>(
    "alchemy_getTokenBalances",
    [address, "erc20"]
  );

  // Filter out zero balances and get metadata for non-zero balances
  const nonZeroBalances = response.tokenBalances.filter(
    (t) => t.tokenBalance !== "0x0" && t.tokenBalance !== "0x"
  );

  if (nonZeroBalances.length === 0) {
    return [];
  }

  // Fetch metadata for each token (in parallel, but limited batch size)
  const results: TokenBalanceResult[] = [];
  const batchSize = 10;

  for (let i = 0; i < nonZeroBalances.length; i += batchSize) {
    const batch = nonZeroBalances.slice(i, i + batchSize);

    const metadataPromises = batch.map(async (tokenBalance) => {
      try {
        const metadata = await alchemyRpc<AlchemyTokenMetadata>(
          "alchemy_getTokenMetadata",
          [tokenBalance.contractAddress]
        );

        const balanceRaw = BigInt(tokenBalance.tokenBalance).toString();

        const token: TokenInfo = {
          network: "ethereum",
          contractAddress: tokenBalance.contractAddress.toLowerCase(),
          symbol: metadata.symbol || "UNKNOWN",
          name: metadata.name || "Unknown Token",
          decimals: metadata.decimals || 18,
          logoUrl: metadata.logo || undefined,
        };

        return {
          token,
          balance: balanceRaw,
          balanceFormatted: formatBalance(balanceRaw, token.decimals),
        };
      } catch (error) {
        // Skip tokens that fail metadata lookup
        console.warn(`Failed to fetch metadata for ${tokenBalance.contractAddress}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(metadataPromises);
    results.push(...batchResults.filter((r): r is TokenBalanceResult => r !== null));
  }

  return results;
}
