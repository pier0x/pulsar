/**
 * Alchemy provider for EVM chains and Bitcoin
 * Supports: Ethereum, Arbitrum, Base, Polygon, Bitcoin
 */

import type { WalletNetwork } from "~/lib/wallet";

// Alchemy network identifiers
const ALCHEMY_NETWORKS: Record<string, string> = {
  ethereum: "eth-mainnet",
  arbitrum: "arb-mainnet",
  base: "base-mainnet",
  polygon: "polygon-mainnet",
};

export interface NativeBalanceResult {
  success: true;
  balance: string; // Raw balance in smallest unit (wei, sats)
  decimals: number;
}

export interface TokenInfo {
  contractAddress: string;
  symbol: string;
  name: string | null;
  decimals: number;
  balance: string; // Raw balance in smallest unit
  logoUrl: string | null;
}

export interface TokenBalancesResult {
  success: true;
  tokens: TokenInfo[];
}

export interface FetchError {
  success: false;
  error: {
    type: "api_error" | "timeout" | "rate_limit" | "parse_error" | "network_error";
    message: string;
    details?: unknown;
  };
}

type BalanceResult = NativeBalanceResult | FetchError;
type TokensResult = TokenBalancesResult | FetchError;

/**
 * Build Alchemy RPC URL for a network
 */
function getAlchemyUrl(network: WalletNetwork, apiKey: string): string {
  const alchemyNetwork = ALCHEMY_NETWORKS[network];
  if (!alchemyNetwork) {
    throw new Error(`Unsupported network for Alchemy: ${network}`);
  }
  return `https://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
}

/**
 * Make an Alchemy JSON-RPC request
 */
async function alchemyRpc(
  url: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
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
    if (response.status === 429) {
      throw { type: "rate_limit", message: "Rate limited by Alchemy" };
    }
    throw { type: "api_error", message: `HTTP ${response.status}` };
  }

  const data = await response.json();
  
  if (data.error) {
    throw { type: "api_error", message: data.error.message, details: data.error };
  }

  return data.result;
}

/**
 * Fetch native balance for an EVM address (ETH, MATIC, etc.)
 */
export async function fetchEvmNativeBalance(
  address: string,
  network: WalletNetwork,
  apiKey: string
): Promise<BalanceResult> {
  try {
    const url = getAlchemyUrl(network, apiKey);
    const result = await alchemyRpc(url, "eth_getBalance", [address, "latest"]);
    
    // Result is hex string like "0x1234..."
    const balanceHex = result as string;
    const balanceWei = BigInt(balanceHex).toString();

    return {
      success: true,
      balance: balanceWei,
      decimals: 18, // All EVM native tokens have 18 decimals
    };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch native balance",
        details: error,
      },
    };
  }
}

/**
 * Fetch ERC-20 token balances for an EVM address
 */
export async function fetchEvmTokenBalances(
  address: string,
  network: WalletNetwork,
  apiKey: string
): Promise<TokensResult> {
  try {
    const url = getAlchemyUrl(network, apiKey);
    
    // Get token balances
    const balancesResult = await alchemyRpc(url, "alchemy_getTokenBalances", [
      address,
      "erc20",
    ]) as {
      tokenBalances: Array<{
        contractAddress: string;
        tokenBalance: string | null;
      }>;
    };

    // Filter out zero balances and get metadata for tokens with balances
    const nonZeroTokens = balancesResult.tokenBalances.filter(
      (t) => t.tokenBalance && t.tokenBalance !== "0x0" && t.tokenBalance !== "0x"
    );

    if (nonZeroTokens.length === 0) {
      return { success: true, tokens: [] };
    }

    // Get metadata for all tokens in batch
    const metadataPromises = nonZeroTokens.map((token) =>
      alchemyRpc(url, "alchemy_getTokenMetadata", [token.contractAddress])
    );

    const metadataResults = await Promise.all(metadataPromises);

    const tokens: TokenInfo[] = nonZeroTokens.map((token, index) => {
      const metadata = metadataResults[index] as {
        symbol: string;
        name: string;
        decimals: number;
        logo: string | null;
      };

      return {
        contractAddress: token.contractAddress,
        symbol: metadata.symbol || "???",
        name: metadata.name || null,
        decimals: metadata.decimals || 18,
        balance: BigInt(token.tokenBalance!).toString(),
        logoUrl: metadata.logo || null,
      };
    });

    return { success: true, tokens };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch token balances",
        details: error,
      },
    };
  }
}

// =============================================================================
// Bitcoin Support
// =============================================================================

interface BitcoinUtxo {
  value: number; // In satoshis
}

interface BitcoinAddressResponse {
  balance: number; // In satoshis
  utxo?: BitcoinUtxo[];
}

/**
 * Fetch Bitcoin balance using Alchemy or fallback to Blockstream
 * Note: Alchemy Bitcoin API is in beta, using Blockstream as primary for now
 */
export async function fetchBitcoinBalance(
  address: string,
  _apiKey: string // Reserved for future Alchemy Bitcoin support
): Promise<BalanceResult> {
  try {
    // Using Blockstream API (free, reliable)
    const response = await fetch(
      `https://blockstream.info/api/address/${address}`
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw { type: "rate_limit", message: "Rate limited by Blockstream" };
      }
      throw { type: "api_error", message: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
      mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
    };

    // Calculate balance (confirmed + unconfirmed)
    const confirmedBalance =
      data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    const unconfirmedBalance =
      data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
    const totalBalance = confirmedBalance + unconfirmedBalance;

    return {
      success: true,
      balance: totalBalance.toString(),
      decimals: 8, // Bitcoin has 8 decimals (satoshis)
    };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch Bitcoin balance",
        details: error,
      },
    };
  }
}

/**
 * Bitcoin doesn't have tokens, return empty array
 */
export async function fetchBitcoinTokenBalances(): Promise<TokensResult> {
  return { success: true, tokens: [] };
}

// =============================================================================
// Unified Interface
// =============================================================================

/**
 * Fetch native balance for any supported network
 */
export async function fetchNativeBalance(
  address: string,
  network: WalletNetwork,
  apiKey: string
): Promise<BalanceResult> {
  if (network === "bitcoin") {
    return fetchBitcoinBalance(address, apiKey);
  }
  
  if (network === "solana") {
    throw new Error("Use Helius provider for Solana");
  }

  return fetchEvmNativeBalance(address, network, apiKey);
}

/**
 * Fetch token balances for any supported network
 */
export async function fetchTokenBalances(
  address: string,
  network: WalletNetwork,
  apiKey: string
): Promise<TokensResult> {
  if (network === "bitcoin") {
    return fetchBitcoinTokenBalances();
  }
  
  if (network === "solana") {
    throw new Error("Use Helius provider for Solana");
  }

  return fetchEvmTokenBalances(address, network, apiKey);
}

/**
 * Test Alchemy API key by making a simple request
 */
export async function testAlchemyConnection(apiKey: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const url = getAlchemyUrl("ethereum", apiKey);
    await alchemyRpc(url, "eth_blockNumber", []);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || "Connection failed" };
  }
}
