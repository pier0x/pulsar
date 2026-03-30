/**
 * Main balance refresh orchestration
 * Handles fetching balances, prices, and creating atomic snapshots
 */

import { prisma } from "~/lib/db.server";
import {
  getAlchemyApiKey,
  getHeliusApiKey,
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
import { fetchHyperliquidBalance } from "~/lib/providers/hyperliquid.server";
import {
  getNativeTokenPrice,
  getTokenPrices,
} from "~/lib/providers/coingecko.server";
import { getBalances as getPlaidBalances, getInvestmentHoldings } from "~/lib/providers/plaid.server";
import { createAccountSnapshot } from "~/lib/accounts.server";
import type { WalletNetwork } from "~/lib/wallet";
import type {
  AccountBalanceData,
  AccountFetchResult,
  FetchError,
  RefreshResult,
  TokenData,
} from "./types";
// Prisma handles Decimal conversion automatically for PostgreSQL

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
 * Fetch balance data for a single on-chain account
 */
async function fetchAccountBalance(
  account: { id: string; network: string; address: string },
  alchemyKey: string | null,
  heliusKey: string | null,
  tokenThreshold: number
): Promise<AccountFetchResult> {
  const network = account.network as WalletNetwork;

  try {
    // Hyperliquid: special case — returns USD values directly
    if (network === "hyperliquid") {
      const hlResult = await fetchHyperliquidBalance(account.address);
      if (!hlResult.success) {
        return {
          success: false,
          error: {
            accountId: account.id,
            accountAddress: account.address,
            network,
            errorType: "api_error",
            errorMessage: hlResult.error,
          },
        };
      }

      // Store total USD as "native balance" (USDC-denominated)
      const totalUsd = hlResult.data.totalUsd;
      // Use raw balance as string representation of USD cents for storage
      const rawBalance = Math.round(totalUsd * 1e6).toString();

      return {
        success: true,
        data: {
          accountId: account.id,
          network,
          address: account.address,
          nativeBalance: rawBalance,
          nativeBalanceFormatted: totalUsd,
          nativeBalanceUsd: totalUsd,
          nativePriceUsd: 1, // USDC pegged
          tokens: [],
          tokensUsdValue: 0,
          totalUsdValue: totalUsd,
        },
      };
    }

    // 1. Fetch native balance
    let nativeResult;
    let tokensResult;

    if (network === "solana") {
      if (!heliusKey) {
        return {
          success: false,
          error: {
            accountId: account.id,
            accountAddress: account.address,
            network,
            errorType: "api_error",
            errorMessage: "Helius API key not configured",
          },
        };
      }
      nativeResult = await fetchSolanaNativeBalance(account.address, heliusKey);
      tokensResult = await fetchSolanaTokenBalances(account.address, heliusKey);
    } else if (network === "bitcoin") {
      // Bitcoin uses Blockstream (no key needed) via Alchemy module
      nativeResult = await fetchNativeBalance(account.address, network, alchemyKey || "");
      tokensResult = { success: true as const, tokens: [] }; // BTC has no tokens
    } else {
      // EVM chains
      if (!alchemyKey) {
        return {
          success: false,
          error: {
            accountId: account.id,
            accountAddress: account.address,
            network,
            errorType: "api_error",
            errorMessage: "Alchemy API key not configured",
          },
        };
      }
      nativeResult = await fetchNativeBalance(account.address, network, alchemyKey);
      tokensResult = await fetchTokenBalances(account.address, network, alchemyKey);
    }

    // Check for errors
    if (!nativeResult.success) {
      return {
        success: false,
        error: {
          accountId: account.id,
          accountAddress: account.address,
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
          accountId: account.id,
          accountAddress: account.address,
          network,
          errorType: tokensResult.error.type,
          errorMessage: tokensResult.error.message,
          errorDetails: JSON.stringify(tokensResult.error.details),
        },
      };
    }

    // 2. Fetch prices
    const nativePriceResult = await getNativeTokenPrice(network);
    if (!nativePriceResult.success) {
      return {
        success: false,
        error: {
          accountId: account.id,
          accountAddress: account.address,
          network,
          errorType: "price_error",
          errorMessage: `Failed to get native token price: ${nativePriceResult.error.message}`,
        },
      };
    }

    // Get token prices
    const tokenAddresses = tokensResult.tokens.map((t) => t.contractAddress);
    const tokenPricesResult = await getTokenPrices(network, tokenAddresses);

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
        accountId: account.id,
        network,
        address: account.address,
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
        accountId: account.id,
        accountAddress: account.address,
        network,
        errorType: "unknown",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorDetails: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Plaid bank account refresh
// ---------------------------------------------------------------------------

/**
 * Refresh all Plaid bank accounts for a specific user.
 * Fetches live balances from Plaid and creates AccountSnapshot entries.
 */
export async function refreshUserBankAccounts(userId: string): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const bankAccounts = await prisma.account.findMany({
    where: { userId, type: "bank", provider: "plaid" },
    select: {
      id: true,
      plaidAccountId: true,
      plaidConnectionId: true,
      plaidConnection: {
        select: { accessToken: true },
      },
    },
  });

  if (bankAccounts.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  }

  // Group accounts by PlaidConnection to minimize API calls
  const byConnection = new Map<
    string,
    { accessToken: string; accounts: typeof bankAccounts }
  >();

  for (const account of bankAccounts) {
    if (!account.plaidConnectionId || !account.plaidConnection) continue;
    const existing = byConnection.get(account.plaidConnectionId);
    if (existing) {
      existing.accounts.push(account);
    } else {
      byConnection.set(account.plaidConnectionId, {
        accessToken: account.plaidConnection.accessToken,
        accounts: [account],
      });
    }
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { accessToken, accounts } of byConnection.values()) {
    try {
      const result = await getPlaidBalances(accessToken);
      if (!result.success) {
        failed += accounts.length;
        errors.push(`Plaid balance fetch failed: ${result.error}`);
        continue;
      }

      const balanceMap = new Map(result.balances.map((b) => [b.accountId, b]));

      for (const account of accounts) {
        if (!account.plaidAccountId) {
          failed++;
          errors.push(`Account ${account.id} has no plaidAccountId`);
          continue;
        }

        const balance = balanceMap.get(account.plaidAccountId);
        if (!balance) {
          failed++;
          errors.push(
            `No balance found for Plaid account ${account.plaidAccountId}`
          );
          continue;
        }

        try {
          const currentBalance = balance.currentBalance ?? 0;
          const availableBalance = balance.availableBalance ?? currentBalance;

          await prisma.accountSnapshot.create({
            data: {
              accountId: account.id,
              totalUsdValue: currentBalance,
              currentBalance,
              availableBalance,
              currency: balance.currency,
            },
          });
          succeeded++;
        } catch (err) {
          failed++;
          errors.push(
            `Snapshot creation failed for account ${account.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      failed += accounts.length;
      errors.push(
        `Connection error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { attempted: bankAccounts.length, succeeded, failed, errors };
}

// ---------------------------------------------------------------------------
// Plaid brokerage account refresh
// ---------------------------------------------------------------------------

/**
 * Refresh all Plaid brokerage/investment accounts for a specific user.
 * Fetches live holdings from Plaid and creates AccountSnapshot + HoldingSnapshot entries.
 */
export async function refreshUserBrokerageAccounts(userId: string): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const brokerageAccounts = await prisma.account.findMany({
    where: { userId, type: "brokerage", provider: "plaid" },
    select: {
      id: true,
      plaidAccountId: true,
      plaidConnectionId: true,
      plaidConnection: {
        select: { accessToken: true },
      },
    },
  });

  if (brokerageAccounts.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  }

  // Group accounts by PlaidConnection to minimize API calls
  const byConnection = new Map<
    string,
    { accessToken: string; accounts: typeof brokerageAccounts }
  >();

  for (const account of brokerageAccounts) {
    if (!account.plaidConnectionId || !account.plaidConnection) continue;
    const existing = byConnection.get(account.plaidConnectionId);
    if (existing) {
      existing.accounts.push(account);
    } else {
      byConnection.set(account.plaidConnectionId, {
        accessToken: account.plaidConnection.accessToken,
        accounts: [account],
      });
    }
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { accessToken, accounts } of byConnection.values()) {
    try {
      const result = await getInvestmentHoldings(accessToken);
      if (!result.success) {
        failed += accounts.length;
        errors.push(`Plaid investment holdings fetch failed: ${result.error}`);
        continue;
      }

      const { holdings, cashBalance, totalValue } = result;
      const holdingsValue = totalValue - cashBalance;

      // All brokerage accounts on the same connection share the same holdings data
      // (Plaid returns holdings for all accounts on the item)
      for (const account of accounts) {
        try {
          await createAccountSnapshot({
            accountId: account.id,
            totalUsdValue: totalValue,
            holdingsValue,
            cashBalance,
            holdings: holdings
              .filter((h) => h.ticker)
              .map((h) => ({
                ticker: h.ticker!,
                name: h.name,
                quantity: h.quantity,
                priceUsd: h.priceUsd,
                valueUsd: h.valueUsd,
                costBasis: h.costBasis,
              })),
          });
          succeeded++;
        } catch (err) {
          failed++;
          errors.push(
            `Snapshot creation failed for account ${account.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      failed += accounts.length;
      errors.push(
        `Connection error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { attempted: brokerageAccounts.length, succeeded, failed, errors };
}

/**
 * Refresh all on-chain accounts for a specific user
 */
export async function refreshUserWallets(
  userId: string,
  trigger: "scheduled" | "manual"
): Promise<RefreshResult> {
  const startTime = Date.now();

  // Get user's API keys and settings
  const [alchemyKey, heliusKey, tokenThreshold] = await Promise.all([
    getAlchemyApiKey(userId),
    getHeliusApiKey(userId),
    getTokenThresholdUsd(userId),
  ]);

  // Get user's on-chain accounts
  const accounts = await prisma.account.findMany({
    where: { userId, type: "onchain" },
    select: { id: true, network: true, address: true },
  });

  if (accounts.length === 0) {
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

  // Fetch all account balances
  const results = new Map<string, AccountFetchResult>();
  const errors: FetchError[] = [];

  for (const account of accounts) {
    if (!account.network || !account.address) continue;
    const result = await fetchAccountBalance(
      { id: account.id, network: account.network, address: account.address },
      alchemyKey,
      heliusKey,
      tokenThreshold
    );
    results.set(account.id, result);

    if (!result.success) {
      errors.push(result.error);
    }
  }

  // Create snapshots for successful accounts (atomic per account)
  const successfulWallets: AccountBalanceData[] = [];

  for (const [accountId, result] of results) {
    if (!result.success) continue;

    const data = result.data;
    successfulWallets.push(data);

    // Create snapshot with all tokens in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.accountSnapshot.create({
        data: {
          accountId,
          nativeBalance: data.nativeBalance,
          nativeBalanceUsd: data.nativeBalanceUsd,
          nativePriceUsd: data.nativePriceUsd,
          tokensUsdValue: data.tokensUsdValue,
          totalUsdValue: data.totalUsdValue,
          tokenSnapshots: {
            create: data.tokens.map((token) => ({
              contractAddress: token.contractAddress,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              logoUrl: token.logoUrl,
              balance: token.balance,
              balanceUsd: token.balanceUsd,
              priceUsd: token.priceUsd,
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
        : errors.length === accounts.length
        ? "complete_failure"
        : "partial_failure",
    walletsAttempted: accounts.length,
    walletsSucceeded: successfulWallets.length,
    walletsFailed: errors.length,
    durationMs: Date.now() - startTime,
    successfulWallets,
    errors,
  };
}

/**
 * Refresh all on-chain accounts for all users (used by scheduler)
 */
export async function refreshAllWallets(
  trigger: "scheduled" | "manual"
): Promise<RefreshResult> {
  const startTime = Date.now();

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let totalAttempted = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  const allErrors: FetchError[] = [];
  const allSuccessful: AccountBalanceData[] = [];

  // Process each user
  for (const user of users) {
    const result = await refreshUserWallets(user.id, trigger);
    totalAttempted += result.walletsAttempted;
    totalSucceeded += result.walletsSucceeded;
    totalFailed += result.walletsFailed;
    allErrors.push(...result.errors);
    allSuccessful.push(...result.successfulWallets);

    // Also refresh Plaid bank accounts
    try {
      await refreshUserBankAccounts(user.id);
    } catch (err) {
      console.error("[refresh] refreshUserBankAccounts failed:", err);
    }

    // Also refresh Plaid brokerage accounts
    try {
      await refreshUserBrokerageAccounts(user.id);
    } catch (err) {
      console.error("[refresh] refreshUserBrokerageAccounts failed:", err);
    }
  }

  return {
    trigger,
    status:
      allErrors.length === 0
        ? "success"
        : allErrors.length === totalAttempted
        ? "complete_failure"
        : "partial_failure",
    walletsAttempted: totalAttempted,
    walletsSucceeded: totalSucceeded,
    walletsFailed: totalFailed,
    durationMs: Date.now() - startTime,
    successfulWallets: allSuccessful,
    errors: allErrors,
  };
}

/**
 * Refresh a single on-chain account
 */
export async function refreshSingleWallet(
  userId: string,
  accountId: string
): Promise<AccountFetchResult> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, network: true, address: true, userId: true, type: true },
  });

  if (!account) {
    return {
      success: false,
      error: {
        accountId,
        accountAddress: "",
        network: "unknown",
        errorType: "api_error",
        errorMessage: "Account not found",
      },
    };
  }

  // Verify account belongs to user and is on-chain
  if (account.userId !== userId || account.type !== "onchain") {
    return {
      success: false,
      error: {
        accountId,
        accountAddress: "",
        network: "unknown",
        errorType: "api_error",
        errorMessage: "Account not found",
      },
    };
  }

  const [alchemyKey, heliusKey, tokenThreshold] = await Promise.all([
    getAlchemyApiKey(userId),
    getHeliusApiKey(userId),
    getTokenThresholdUsd(userId),
  ]);

  const result = await fetchAccountBalance(
    { id: account.id, network: account.network!, address: account.address! },
    alchemyKey,
    heliusKey,
    tokenThreshold
  );

  if (result.success) {
    // Create snapshot
    await prisma.accountSnapshot.create({
      data: {
        accountId,
        nativeBalance: result.data.nativeBalance,
        nativeBalanceUsd: result.data.nativeBalanceUsd,
        nativePriceUsd: result.data.nativePriceUsd,
        tokensUsdValue: result.data.tokensUsdValue,
        totalUsdValue: result.data.totalUsdValue,
        tokenSnapshots: {
          create: result.data.tokens.map((token) => ({
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoUrl: token.logoUrl,
            balance: token.balance,
            balanceUsd: token.balanceUsd,
            priceUsd: token.priceUsd,
          })),
        },
      },
    });
  }

  return result;
}

/**
 * Get the latest snapshot for an account
 */
export async function getLatestSnapshot(accountId: string) {
  return prisma.accountSnapshot.findFirst({
    where: { accountId },
    orderBy: { timestamp: "desc" },
    include: { tokenSnapshots: true },
  });
}

/**
 * Get all snapshots for an account (for charts)
 */
export async function getAccountSnapshots(accountId: string, limit = 30) {
  return prisma.accountSnapshot.findMany({
    where: { accountId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { tokenSnapshots: true },
  });
}

/**
 * Get aggregate portfolio data across all on-chain accounts for a user
 */
export async function getPortfolioSummary(userId: string) {
  // Get all on-chain accounts for user with their latest snapshot
  const accounts = await prisma.account.findMany({
    where: { userId, type: "onchain" },
    select: {
      id: true,
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: {
          totalUsdValue: true,
          timestamp: true,
        },
      },
    },
  });

  if (accounts.length === 0) {
    return {
      totalUsdValue: 0,
      walletCount: 0,
      lastUpdated: null,
    };
  }

  // Calculate totals from latest snapshots
  let totalUsdValue = 0;
  let lastUpdated: Date | null = null;

  for (const account of accounts) {
    const latestSnapshot = account.snapshots[0];
    if (latestSnapshot) {
      totalUsdValue += Number(latestSnapshot.totalUsdValue);
      const snapshotTime = new Date(latestSnapshot.timestamp);
      if (!lastUpdated || snapshotTime > lastUpdated) {
        lastUpdated = snapshotTime;
      }
    }
  }

  return {
    totalUsdValue,
    walletCount: accounts.length,
    lastUpdated,
  };
}
