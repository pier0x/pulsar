/**
 * Balance caching service
 * Manages fetching, caching, and retrieving wallet balances from the database
 */

import { prisma } from "~/lib/db.server";
import { getSetting, setSetting, getSettingWithDefault } from "~/lib/settings.server";
import type { WalletNetwork } from "~/lib/wallet";
import {
  getWalletBalance,
  isNetworkSupported,
  type WalletBalanceResult,
  type RefreshResult,
  type RefreshError,
  NETWORK_CONFIG,
  formatBalance,
} from "~/lib/blockchain/index.server";

// Settings keys
const SETTING_REFRESH_INTERVAL = "balance_refresh_interval";
const SETTING_LAST_REFRESH = "balance_last_refresh";

/**
 * Get the refresh interval in minutes (default: 60)
 */
export async function getRefreshInterval(): Promise<number> {
  const value = await getSettingWithDefault(SETTING_REFRESH_INTERVAL, "60");
  return parseInt(value, 10);
}

/**
 * Set the refresh interval in minutes
 */
export async function setRefreshInterval(minutes: number): Promise<void> {
  await setSetting(SETTING_REFRESH_INTERVAL, minutes.toString());
}

/**
 * Get the last refresh timestamp
 */
export async function getLastRefresh(): Promise<Date | null> {
  const value = await getSetting(SETTING_LAST_REFRESH);
  return value ? new Date(value) : null;
}

/**
 * Check if a refresh is needed based on the interval setting
 */
export async function isRefreshNeeded(): Promise<boolean> {
  const lastRefresh = await getLastRefresh();
  if (!lastRefresh) return true;

  const intervalMinutes = await getRefreshInterval();
  const now = new Date();
  const elapsed = now.getTime() - lastRefresh.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;

  return elapsed >= intervalMs;
}

/**
 * Refresh balance for a single wallet and save to database
 */
export async function refreshWalletBalance(
  walletId: string
): Promise<WalletBalanceResult> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  const network = wallet.network as WalletNetwork;
  const support = isNetworkSupported(network);

  if (!support.supported) {
    return {
      walletId,
      address: wallet.address,
      network,
      nativeBalance: {
        network,
        address: wallet.address,
        balance: "0",
        balanceFormatted: "0",
      },
      tokenBalances: [],
      fetchedAt: new Date(),
      error: support.reason,
    };
  }

  // Fetch balance from blockchain
  const result = await getWalletBalance(walletId, network, wallet.address);

  // Save native balance to database
  if (!result.error) {
    await prisma.balance.upsert({
      where: { walletId },
      create: {
        walletId,
        amount: result.nativeBalance.balance,
      },
      update: {
        amount: result.nativeBalance.balance,
      },
    });

    // Save token balances
    for (const tokenBalance of result.tokenBalances) {
      // Upsert token metadata
      const token = await prisma.token.upsert({
        where: {
          network_contractAddress: {
            network: tokenBalance.token.network,
            contractAddress: tokenBalance.token.contractAddress,
          },
        },
        create: {
          network: tokenBalance.token.network,
          contractAddress: tokenBalance.token.contractAddress,
          symbol: tokenBalance.token.symbol,
          name: tokenBalance.token.name,
          decimals: tokenBalance.token.decimals,
          logoUrl: tokenBalance.token.logoUrl,
        },
        update: {
          symbol: tokenBalance.token.symbol,
          name: tokenBalance.token.name,
          decimals: tokenBalance.token.decimals,
          logoUrl: tokenBalance.token.logoUrl,
        },
      });

      // Upsert token balance
      await prisma.tokenBalance.upsert({
        where: {
          walletId_tokenId: {
            walletId,
            tokenId: token.id,
          },
        },
        create: {
          walletId,
          tokenId: token.id,
          amount: tokenBalance.balance,
        },
        update: {
          amount: tokenBalance.balance,
        },
      });
    }

    // Remove token balances that are no longer held
    const currentTokenIds = await prisma.token
      .findMany({
        where: {
          network,
          contractAddress: {
            in: result.tokenBalances.map((t) => t.token.contractAddress),
          },
        },
        select: { id: true },
      })
      .then((tokens) => tokens.map((t) => t.id));

    await prisma.tokenBalance.deleteMany({
      where: {
        walletId,
        tokenId: { notIn: currentTokenIds },
      },
    });
  }

  return result;
}

/**
 * Refresh balances for all wallets
 */
export async function refreshAllBalances(): Promise<RefreshResult> {
  const startedAt = new Date();
  const errors: RefreshError[] = [];
  let walletsProcessed = 0;

  // Create job record
  const job = await prisma.balanceRefreshJob.create({
    data: {
      status: "running",
    },
  });

  try {
    // Get all wallets
    const wallets = await prisma.wallet.findMany();

    for (const wallet of wallets) {
      try {
        await refreshWalletBalance(wallet.id);
        walletsProcessed++;
      } catch (error) {
        errors.push({
          walletId: wallet.id,
          address: wallet.address,
          network: wallet.network as WalletNetwork,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const completedAt = new Date();

    // Update job record
    await prisma.balanceRefreshJob.update({
      where: { id: job.id },
      data: {
        status: errors.length === 0 ? "completed" : "completed",
        completedAt,
        walletsProcessed,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
      },
    });

    // Update last refresh timestamp
    await setSetting(SETTING_LAST_REFRESH, completedAt.toISOString());

    return {
      success: errors.length === 0,
      walletsProcessed,
      errors,
      startedAt,
      completedAt,
    };
  } catch (error) {
    const completedAt = new Date();

    // Update job record with failure
    await prisma.balanceRefreshJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt,
        walletsProcessed,
        errors: JSON.stringify([
          {
            walletId: "",
            address: "",
            network: "ethereum" as WalletNetwork,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ]),
      },
    });

    throw error;
  }
}

/**
 * Get cached balance for a wallet (does not fetch from blockchain)
 */
export async function getCachedBalance(walletId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: {
      balance: true,
      tokenBalances: {
        include: {
          token: true,
        },
      },
    },
  });

  if (!wallet) {
    return null;
  }

  const network = wallet.network as WalletNetwork;
  const config = NETWORK_CONFIG[network];

  return {
    wallet: {
      id: wallet.id,
      name: wallet.name,
      network,
      address: wallet.address,
    },
    nativeBalance: wallet.balance
      ? {
          amount: wallet.balance.amount,
          formatted: formatBalance(wallet.balance.amount, config.decimals),
          symbol: config.nativeSymbol,
          updatedAt: wallet.balance.updatedAt,
        }
      : null,
    tokenBalances: wallet.tokenBalances.map((tb) => ({
      token: {
        contractAddress: tb.token.contractAddress,
        symbol: tb.token.symbol,
        name: tb.token.name,
        decimals: tb.token.decimals,
        logoUrl: tb.token.logoUrl,
      },
      amount: tb.amount,
      formatted: formatBalance(tb.amount, tb.token.decimals),
      updatedAt: tb.updatedAt,
    })),
  };
}

/**
 * Get all cached balances for a user
 */
export async function getUserBalances(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    include: {
      balance: true,
      tokenBalances: {
        include: {
          token: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return wallets.map((wallet) => {
    const network = wallet.network as WalletNetwork;
    const config = NETWORK_CONFIG[network];

    return {
      wallet: {
        id: wallet.id,
        name: wallet.name,
        network,
        address: wallet.address,
      },
      nativeBalance: wallet.balance
        ? {
            amount: wallet.balance.amount,
            formatted: formatBalance(wallet.balance.amount, config.decimals),
            symbol: config.nativeSymbol,
            updatedAt: wallet.balance.updatedAt,
          }
        : null,
      tokenBalances: wallet.tokenBalances.map((tb) => ({
        token: {
          contractAddress: tb.token.contractAddress,
          symbol: tb.token.symbol,
          name: tb.token.name,
          decimals: tb.token.decimals,
          logoUrl: tb.token.logoUrl,
        },
        amount: tb.amount,
        formatted: formatBalance(tb.amount, tb.token.decimals),
        updatedAt: tb.updatedAt,
      })),
    };
  });
}

/**
 * Get the latest balance refresh job
 */
export async function getLatestRefreshJob() {
  return prisma.balanceRefreshJob.findFirst({
    orderBy: { startedAt: "desc" },
  });
}
