/**
 * Blockchain balance and token type definitions
 */

import type { WalletNetwork } from "~/lib/wallet";

/**
 * Native currency balance result from blockchain
 */
export interface NativeBalance {
  network: WalletNetwork;
  address: string;
  balance: string; // Raw amount in smallest unit (satoshis, wei, lamports)
  balanceFormatted: string; // Human-readable with decimals
}

/**
 * Token metadata (ERC-20, SPL)
 */
export interface TokenInfo {
  network: WalletNetwork;
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

/**
 * Token balance result from blockchain
 */
export interface TokenBalanceResult {
  token: TokenInfo;
  balance: string; // Raw amount in smallest unit
  balanceFormatted: string; // Human-readable
}

/**
 * Complete balance result for a wallet
 */
export interface WalletBalanceResult {
  walletId: string;
  address: string;
  network: WalletNetwork;
  nativeBalance: NativeBalance;
  tokenBalances: TokenBalanceResult[];
  fetchedAt: Date;
  error?: string;
}

/**
 * Result of a balance refresh operation
 */
export interface RefreshResult {
  success: boolean;
  walletsProcessed: number;
  errors: RefreshError[];
  startedAt: Date;
  completedAt: Date;
}

/**
 * Error details for balance refresh
 */
export interface RefreshError {
  walletId: string;
  address: string;
  network: WalletNetwork;
  error: string;
}

/**
 * Network-specific configuration
 */
export interface NetworkConfig {
  nativeSymbol: string;
  nativeName: string;
  decimals: number;
  explorerUrl: string;
}

/**
 * Network configurations
 */
export const NETWORK_CONFIG: Record<WalletNetwork, NetworkConfig> = {
  bitcoin: {
    nativeSymbol: "BTC",
    nativeName: "Bitcoin",
    decimals: 8,
    explorerUrl: "https://blockstream.info",
  },
  ethereum: {
    nativeSymbol: "ETH",
    nativeName: "Ethereum",
    decimals: 18,
    explorerUrl: "https://etherscan.io",
  },
  solana: {
    nativeSymbol: "SOL",
    nativeName: "Solana",
    decimals: 9,
    explorerUrl: "https://solscan.io",
  },
};

/**
 * Format a raw balance to human-readable format
 */
export function formatBalance(rawAmount: string, decimals: number): string {
  if (!rawAmount || rawAmount === "0") return "0";

  const amount = BigInt(rawAmount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  // Trim trailing zeros
  const trimmed = fractionalStr.replace(/0+$/, "");

  return `${wholePart}.${trimmed}`;
}

/**
 * Parse a formatted balance back to raw amount
 */
export function parseBalance(formattedAmount: string, decimals: number): string {
  const [whole, fractional = ""] = formattedAmount.split(".");
  const paddedFractional = fractional.padEnd(decimals, "0").slice(0, decimals);
  const combined = whole + paddedFractional;
  return BigInt(combined).toString();
}
