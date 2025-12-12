/**
 * Unified blockchain interface for balance fetching
 * Routes requests to the appropriate network-specific service
 */

import type { WalletNetwork } from "~/lib/wallet";
import {
  type NativeBalance,
  type TokenBalanceResult,
  type WalletBalanceResult,
} from "./types";
import { getBitcoinBalance, getBitcoinTokenBalances } from "./bitcoin.server";
import {
  getEthereumBalance,
  getEthereumTokenBalances,
  isAlchemyConfigured,
} from "./ethereum.server";
import { getSolanaBalance, getSolanaTokenBalances } from "./solana.server";

export * from "./types";

/**
 * Fetch native balance for any supported network
 */
export async function getNativeBalance(
  network: WalletNetwork,
  address: string
): Promise<NativeBalance> {
  switch (network) {
    case "bitcoin":
      return getBitcoinBalance(address);
    case "ethereum":
      if (!isAlchemyConfigured()) {
        throw new Error("Ethereum support requires ALCHEMY_API_KEY to be configured");
      }
      return getEthereumBalance(address);
    case "solana":
      return getSolanaBalance(address);
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

/**
 * Fetch token balances for any supported network
 */
export async function getTokenBalances(
  network: WalletNetwork,
  address: string
): Promise<TokenBalanceResult[]> {
  switch (network) {
    case "bitcoin":
      return getBitcoinTokenBalances(address);
    case "ethereum":
      if (!isAlchemyConfigured()) {
        throw new Error("Ethereum support requires ALCHEMY_API_KEY to be configured");
      }
      return getEthereumTokenBalances(address);
    case "solana":
      return getSolanaTokenBalances(address);
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

/**
 * Fetch complete balance (native + tokens) for a wallet
 */
export async function getWalletBalance(
  walletId: string,
  network: WalletNetwork,
  address: string
): Promise<WalletBalanceResult> {
  const fetchedAt = new Date();

  try {
    // Fetch native and token balances in parallel
    const [nativeBalance, tokenBalances] = await Promise.all([
      getNativeBalance(network, address),
      getTokenBalances(network, address),
    ]);

    return {
      walletId,
      address,
      network,
      nativeBalance,
      tokenBalances,
      fetchedAt,
    };
  } catch (error) {
    return {
      walletId,
      address,
      network,
      nativeBalance: {
        network,
        address,
        balance: "0",
        balanceFormatted: "0",
      },
      tokenBalances: [],
      fetchedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a network is supported/configured
 */
export function isNetworkSupported(network: WalletNetwork): {
  supported: boolean;
  reason?: string;
} {
  switch (network) {
    case "bitcoin":
      return { supported: true };
    case "ethereum":
      if (!isAlchemyConfigured()) {
        return {
          supported: false,
          reason: "ALCHEMY_API_KEY environment variable not set",
        };
      }
      return { supported: true };
    case "solana":
      return { supported: true };
    default:
      return { supported: false, reason: `Unknown network: ${network}` };
  }
}

/**
 * Get list of all supported networks
 */
export function getSupportedNetworks(): WalletNetwork[] {
  const networks: WalletNetwork[] = ["bitcoin", "solana"];

  if (isAlchemyConfigured()) {
    networks.push("ethereum");
  }

  return networks;
}
