/**
 * Main balance refresh orchestration
 * Handles fetching balances, prices, and creating atomic snapshots
 */

import { prisma } from "~/lib/db.server";
import {
  getAlchemyApiKey,
  getHeliusApiKey,
  getCoinGeckoApiKey,
  getTokenThresholdUsd,
} from "~/lib/settings.server";
import {
  fetchNativeBalance,
  fetchTokenBalances,
} from "~/lib/providers/alchemy.server";
import {
  fetchSolanaNativeBalance,
  fetchSolanaTokenBalances,
} from "~/lib/providers/helius.server";
import {
  getNativeTokenPrice,
  getTokenPrices,
} from "~/lib/providers/coingecko.server";
import type { WalletNetwork } from "~/lib/wallet";
import type {
  WalletBalanceData,
  WalletFetchResult,
  FetchError,
  RefreshResult,
  TokenData,
} from "./types";
import { Decimal } from "~/generated/prisma/runtime/library";

/**
 * Format raw balance to human-readable number
 */
function formatBalance(rawBalance: string, decimals: number): number {
  const balance = BigInt(rawBalance);
  const divisor = BigInt(10 ** decimals);
  const intPart = balance / divisor;
  const fracPart = balance % divisor;
  
  // Combine integer and fractional parts
  const fracStr = fracPart.toString().padStart(decimals, "0");
  return parseFloat(`${intPart}.${fracStr}`);
}

/**
 * Fetch balance data for a single wallet
 */
async function fetchWalletBalance(
  wallet: { id: string; network: string; address: string },
  alchemyKey: string | null,
  heliusKey: string | null,
  coingeckoKey: string | null,
  tokenThreshold: number
): Promise<WalletFetchResult> {
  const network = wallet.network as WalletNetwork;

  try {
    // 1. Fetch native balance
    let nativeResult;
    let tokensResult;

    if (network === "solana") {
      if (!heliusKey) {
        return {
          success: false,
          error: {
            walletId: wallet.id,
            walletAddress: wallet.address,
            network,
            errorType: "api_error",
            errorMessage: "Helius API key not configured",
          },
        };
      }
      nativeResult = await fetchSolanaNativeBalance(wallet.address, heliusKey);
      tokensResult = await fetchSolanaTokenBalances(wallet.address, heliusKey);
    } else if (network === "bitcoin") {
      // Bitcoin uses Blockstream (no key needed) via Alchemy module
      nativeResult = await fetchNativeBalance(wallet.address, network, alchemyKey || "");
      tokensResult = { success: true as const, tokens: [] }; // BTC has no tokens
    } else {
      // EVM chains
      if (!alchemyKey) {
        return {
          success: false,
          error: {
            walletId: wallet.id,
            walletAddress: wallet.address,
            network,
            errorType: "api_error",
            errorMessage: "Alchemy API key not configured",
          },
        };
      }
      nativeResult = await fetchNativeBalance(wallet.address, network, alchemyKey);
      tokensResult = await fetchTokenBalances(wallet.address, network, alchemyKey);
    }

    // Check for errors
    if (!nativeResult.success) {
      return {
        success: false,
        error: {
          walletId: wallet.id,
          walletAddress: wallet.address,
          network,
          errorType: nativeResult.error.type,
          errorMessage: nativeResult.error.message,
          errorDetails: JSON.stringify(nativeResult.error.details),
        },
      };
    }

    if (!tokensResult.success) {
      return {
        success: false,
        error: {
          walletId: wallet.id,
          walletAddress: wallet.address,
          network,
          errorType: tokensResult.error.type,
          errorMessage: tokensResult.error.message,
          errorDetails: JSON.stringify(tokensResult.error.details),
        },
      };
    }

    // 2. Fetch prices
    const nativePriceResult = await getNativeTokenPrice(network, coingeckoKey);
    if (!nativePriceResult.success) {
      return {
        success: false,
        error: {
          walletId: wallet.id,
          walletAddress: wallet.address,
          network,
          errorType: "price_error",
          errorMessage: `Failed to get native token price: ${nativePriceResult.error.message}`,
        },
      };
    }

    // Get token prices
    const tokenAddresses = tokensResult.tokens.map((t) => t.contractAddress);
    const tokenPricesResult = await getTokenPrices(network, tokenAddresses, coingeckoKey);
    
    // Token prices failing is not fatal - we just skip those tokens
    const tokenPrices = tokenPricesResult.success ? tokenPricesResult.prices : new Map<string, number>();

    // 3. Calculate balances
    const nativeBalanceFormatted = formatBalance(
      nativeResult.balance,
      nativeResult.decimals
    );
    const nativeBalanceUsd = nativeBalanceFormatted * nativePriceResult.priceUsd;

    // Process tokens with prices and filter by threshold
    const tokens: TokenData[] = tokensResult.tokens
      .map((token) => {
        const priceUsd = tokenPrices.get(token.contractAddress.toLowerCase()) || 0;
        const balanceFormatted = formatBalance(token.balance, token.decimals);
        const balanceUsd = balanceFormatted * priceUsd;

        return {
          contractAddress: token.contractAddress,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance,
          balanceFormatted,
          balanceUsd,
          priceUsd,
          logoUrl: token.logoUrl,
        };
      })
      .filter((token) => token.balanceUsd >= tokenThreshold);

    const tokensUsdValue = tokens.reduce((sum, t) => sum + t.balanceUsd, 0);
    const totalUsdValue = nativeBalanceUsd + tokensUsdValue;

    return {
      success: true,
      data: {
        walletId: wallet.id,
        network,
        address: wallet.address,
        nativeBalance: nativeResult.balance,
        nativeBalanceFormatted,
        nativeBalanceUsd,
        nativePriceUsd: nativePriceResult.priceUsd,
        tokens,
        tokensUsdValue,
        totalUsdValue,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        walletId: wallet.id,
        walletAddress: wallet.address,
        network,
        errorType: "unknown",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorDetails: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Main refresh function - fetches all wallets and creates snapshots
 */
export async function refreshAllWallets(
  trigger: "scheduled" | "manual"
): Promise<RefreshResult> {
  const startTime = Date.now();

  // Get API keys and settings
  const [alchemyKey, heliusKey, coingeckoKey, tokenThreshold] = await Promise.all([
    getAlchemyApiKey(),
    getHeliusApiKey(),
    getCoinGeckoApiKey(),
    getTokenThresholdUsd(),
  ]);

  // Get all wallets
  const wallets = await prisma.wallet.findMany({
    select: { id: true, network: true, address: true },
  });

  if (wallets.length === 0) {
    return {
      trigger,
      status: "success",
      walletsAttempted: 0,
      walletsSucceeded: 0,
      walletsFailed: 0,
      durationMs: Date.now() - startTime,
      successfulWallets: [],
      errors: [],
    };
  }

  // Fetch all wallet balances
  const results = new Map<string, WalletFetchResult>();
  const errors: FetchError[] = [];

  for (const wallet of wallets) {
    const result = await fetchWalletBalance(
      wallet,
      alchemyKey,
      heliusKey,
      coingeckoKey,
      tokenThreshold
    );
    results.set(wallet.id, result);

    if (!result.success) {
      errors.push(result.error);
    }
  }

  // Create refresh log
  const refreshLog = await prisma.refreshLog.create({
    data: {
      trigger,
      status:
        errors.length === 0
          ? "success"
          : errors.length === wallets.length
          ? "complete_failure"
          : "partial_failure",
      walletsAttempted: wallets.length,
      walletsSucceeded: wallets.length - errors.length,
      walletsFailed: errors.length,
      durationMs: Date.now() - startTime,
      errors: {
        create: errors.map((e) => ({
          walletId: e.walletId,
          walletAddress: e.walletAddress,
          network: e.network,
          errorType: e.errorType,
          errorMessage: e.errorMessage,
          errorDetails: e.errorDetails,
        })),
      },
    },
  });

  // Create snapshots for successful wallets (atomic per wallet)
  const successfulWallets: WalletBalanceData[] = [];

  for (const [walletId, result] of results) {
    if (!result.success) continue;

    const data = result.data;
    successfulWallets.push(data);

    // Create snapshot with all tokens in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.balanceSnapshot.create({
        data: {
          walletId,
          nativeBalance: data.nativeBalance,
          nativeBalanceUsd: new Decimal(data.nativeBalanceUsd),
          nativePriceUsd: new Decimal(data.nativePriceUsd),
          tokensUsdValue: new Decimal(data.tokensUsdValue),
          totalUsdValue: new Decimal(data.totalUsdValue),
          tokenSnapshots: {
            create: data.tokens.map((token) => ({
              contractAddress: token.contractAddress,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              logoUrl: token.logoUrl,
              balance: token.balance,
              balanceUsd: new Decimal(token.balanceUsd),
              priceUsd: new Decimal(token.priceUsd),
            })),
          },
        },
      });
    });
  }

  return {
    trigger,
    status:
      errors.length === 0
        ? "success"
        : errors.length === wallets.length
        ? "complete_failure"
        : "partial_failure",
    walletsAttempted: wallets.length,
    walletsSucceeded: successfulWallets.length,
    walletsFailed: errors.length,
    durationMs: Date.now() - startTime,
    successfulWallets,
    errors,
  };
}

/**
 * Refresh a single wallet
 */
export async function refreshSingleWallet(walletId: string): Promise<WalletFetchResult> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { id: true, network: true, address: true },
  });

  if (!wallet) {
    return {
      success: false,
      error: {
        walletId,
        walletAddress: "",
        network: "unknown",
        errorType: "api_error",
        errorMessage: "Wallet not found",
      },
    };
  }

  const [alchemyKey, heliusKey, coingeckoKey, tokenThreshold] = await Promise.all([
    getAlchemyApiKey(),
    getHeliusApiKey(),
    getCoinGeckoApiKey(),
    getTokenThresholdUsd(),
  ]);

  const result = await fetchWalletBalance(
    wallet,
    alchemyKey,
    heliusKey,
    coingeckoKey,
    tokenThreshold
  );

  if (result.success) {
    // Create snapshot
    await prisma.balanceSnapshot.create({
      data: {
        walletId,
        nativeBalance: result.data.nativeBalance,
        nativeBalanceUsd: new Decimal(result.data.nativeBalanceUsd),
        nativePriceUsd: new Decimal(result.data.nativePriceUsd),
        tokensUsdValue: new Decimal(result.data.tokensUsdValue),
        totalUsdValue: new Decimal(result.data.totalUsdValue),
        tokenSnapshots: {
          create: result.data.tokens.map((token) => ({
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoUrl: token.logoUrl,
            balance: token.balance,
            balanceUsd: new Decimal(token.balanceUsd),
            priceUsd: new Decimal(token.priceUsd),
          })),
        },
      },
    });
  }

  return result;
}

/**
 * Get the latest snapshot for a wallet
 */
export async function getLatestSnapshot(walletId: string) {
  return prisma.balanceSnapshot.findFirst({
    where: { walletId },
    orderBy: { timestamp: "desc" },
    include: { tokenSnapshots: true },
  });
}

/**
 * Get all snapshots for a wallet (for charts)
 */
export async function getWalletSnapshots(
  walletId: string,
  limit = 30
) {
  return prisma.balanceSnapshot.findMany({
    where: { walletId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { tokenSnapshots: true },
  });
}

/**
 * Get aggregate portfolio data across all wallets
 */
export async function getPortfolioSummary(userId: string) {
  // Get all wallets for user
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    select: { id: true },
  });

  if (wallets.length === 0) {
    return {
      totalUsdValue: 0,
      walletCount: 0,
      lastUpdated: null,
    };
  }

  // Get latest snapshot for each wallet
  const walletIds = wallets.map((w) => w.id);
  
  const latestSnapshots = await prisma.$queryRaw<
    Array<{ walletId: string; totalUsdValue: number; timestamp: Date }>
  >`
    SELECT bs.walletId, bs.totalUsdValue, bs.timestamp
    FROM BalanceSnapshot bs
    INNER JOIN (
      SELECT walletId, MAX(timestamp) as maxTime
      FROM BalanceSnapshot
      WHERE walletId IN (${walletIds.join(",")})
      GROUP BY walletId
    ) latest ON bs.walletId = latest.walletId AND bs.timestamp = latest.maxTime
  `;

  const totalUsdValue = latestSnapshots.reduce(
    (sum, s) => sum + Number(s.totalUsdValue),
    0
  );
  
  const lastUpdated = latestSnapshots.length > 0
    ? new Date(Math.max(...latestSnapshots.map((s) => s.timestamp.getTime())))
    : null;

  return {
    totalUsdValue,
    walletCount: wallets.length,
    lastUpdated,
  };
}
