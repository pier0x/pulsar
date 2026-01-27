/**
 * Types for balance fetching and snapshot system
 */

import type { WalletNetwork } from "~/lib/wallet";

export interface TokenData {
  contractAddress: string;
  symbol: string;
  name: string | null;
  decimals: number;
  balance: string; // Raw balance in smallest unit
  balanceFormatted: number; // Human-readable balance
  balanceUsd: number;
  priceUsd: number;
  logoUrl: string | null;
}

export interface WalletBalanceData {
  walletId: string;
  network: WalletNetwork;
  address: string;
  
  // Native balance
  nativeBalance: string; // Raw balance in smallest unit
  nativeBalanceFormatted: number; // Human-readable
  nativeBalanceUsd: number;
  nativePriceUsd: number;
  
  // Tokens (filtered by threshold)
  tokens: TokenData[];
  tokensUsdValue: number;
  
  // Total
  totalUsdValue: number;
}

export interface FetchError {
  walletId: string;
  walletAddress: string;
  network: string;
  errorType: "api_error" | "timeout" | "rate_limit" | "parse_error" | "price_error" | "unknown";
  errorMessage: string;
  errorDetails?: string;
}

export interface RefreshResult {
  trigger: "scheduled" | "manual";
  status: "success" | "partial_failure" | "complete_failure";
  walletsAttempted: number;
  walletsSucceeded: number;
  walletsFailed: number;
  durationMs: number;
  successfulWallets: WalletBalanceData[];
  errors: FetchError[];
}

export type WalletFetchResult =
  | { success: true; data: WalletBalanceData }
  | { success: false; error: FetchError };
