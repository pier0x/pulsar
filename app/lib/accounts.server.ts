/**
 * CRUD helpers for the Account model (server-only)
 */

import { unlink, existsSync } from "fs";
import { join } from "path";
import { readdir } from "fs/promises";
import { prisma } from "~/lib/db.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountType = "onchain" | "bank" | "brokerage" | "manual";
export type AccountProvider = "alchemy" | "helius" | "hyperliquid" | "simplefin" | "ibkr-flex" | "manual";

export interface CreateOnchainAccountInput {
  userId: string;
  name: string;
  provider: AccountProvider;
  network: string;
  address: string;
}

export interface CreateSimplefinAccountInput {
  userId: string;
  name: string;
  type: "bank" | "brokerage";
  simplefinConnectionId: string;
  simplefinAccountId: string;
}

export interface CreateManualAssetInput {
  userId: string;
  name: string;
  category: string;
  currentValue: number;
  costBasis?: number;
  notes?: string;
  imagePath?: string;
}

export interface UpdateManualAssetDetailsInput {
  name?: string;
  category?: string;
  costBasis?: number | null;
  notes?: string | null;
  imagePath?: string | null;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all accounts for a user with their latest snapshot
 */
export async function getUserAccountsWithLatestSnapshot(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
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
}

/**
 * Get accounts by type for a user
 */
export async function getUserAccountsByType(userId: string, type: AccountType) {
  return prisma.account.findMany({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single account by ID (verifies ownership)
 */
export async function getAccount(userId: string, accountId: string) {
  return prisma.account.findFirst({
    where: { id: accountId, userId },
  });
}

/**
 * Get the latest snapshot for an account
 */
export async function getLatestAccountSnapshot(accountId: string) {
  return prisma.accountSnapshot.findFirst({
    where: { accountId },
    orderBy: { timestamp: "desc" },
    include: { tokenSnapshots: true, holdings: true },
  });
}

/**
 * Get snapshots for an account (for charts)
 */
export async function getAccountSnapshots(accountId: string, limit = 30) {
  return prisma.accountSnapshot.findMany({
    where: { accountId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { tokenSnapshots: true, holdings: true },
  });
}

// ---------------------------------------------------------------------------
// Create helpers
// ---------------------------------------------------------------------------

/**
 * Create a new on-chain wallet account
 */
export async function createOnchainAccount(input: CreateOnchainAccountInput) {
  return prisma.account.create({
    data: {
      userId: input.userId,
      name: input.name,
      type: "onchain",
      provider: input.provider,
      network: input.network,
      address: input.address,
    },
  });
}

/**
 * Create multiple on-chain accounts for one address (e.g., EVM multi-chain)
 */
export async function createOnchainAccountsForAddress(
  userId: string,
  address: string,
  name: string | null,
  networks: Array<{ network: string; provider: AccountProvider }>
) {
  return prisma.account.createMany({
    data: networks.map(({ network, provider }) => ({
      userId,
      name: name || "Wallet",
      type: "onchain" as const,
      provider,
      network,
      address,
    })),
  });
}

/**
 * Create a SimpleFIN-connected account (bank or brokerage)
 */
export async function createSimplefinAccount(input: CreateSimplefinAccountInput) {
  return prisma.account.create({
    data: {
      userId: input.userId,
      name: input.name,
      type: input.type,
      provider: "simplefin",
      simplefinConnectionId: input.simplefinConnectionId,
      simplefinAccountId: input.simplefinAccountId,
    },
  });
}

// ---------------------------------------------------------------------------
// Delete helpers
// ---------------------------------------------------------------------------

/**
 * Delete an account (verifies ownership, cascades snapshots)
 */
export async function deleteAccount(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) {
    throw new Error("Account not found");
  }

  await prisma.account.delete({
    where: { id: accountId },
  });
}

// ---------------------------------------------------------------------------
// Manual asset helpers
// ---------------------------------------------------------------------------

const ASSETS_DIR = join(process.cwd(), "data", "assets");

/**
 * Create a manual physical asset account with an initial snapshot
 */
export async function createManualAsset(input: CreateManualAssetInput) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        userId: input.userId,
        name: input.name,
        type: "manual",
        provider: "manual",
        category: input.category,
        costBasis: input.costBasis ?? null,
        notes: input.notes ?? null,
        imagePath: input.imagePath ?? null,
      },
    });

    await tx.accountSnapshot.create({
      data: {
        accountId: account.id,
        totalUsdValue: input.currentValue,
      },
    });

    return account;
  });
}

/**
 * Update the current value of a manual asset (creates a new snapshot)
 */
export async function updateManualAssetValue(accountId: string, newValue: number) {
  return prisma.accountSnapshot.create({
    data: {
      accountId,
      totalUsdValue: newValue,
    },
  });
}

/**
 * Update metadata of a manual asset (no snapshot created)
 */
export async function updateManualAssetDetails(
  accountId: string,
  updates: UpdateManualAssetDetailsInput
) {
  return prisma.account.update({
    where: { id: accountId },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.costBasis !== undefined && { costBasis: updates.costBasis }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.imagePath !== undefined && { imagePath: updates.imagePath }),
    },
  });
}

/**
 * Delete a manual asset account, its snapshots, and its image file from disk
 */
export async function deleteManualAsset(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, type: "manual" },
  });

  if (!account) {
    throw new Error("Manual asset not found");
  }

  // Delete account (cascades snapshots)
  await prisma.account.delete({ where: { id: accountId } });

  // Delete image file if it exists
  if (account.imagePath) {
    const fullPath = join(process.cwd(), account.imagePath);
    if (existsSync(fullPath)) {
      unlink(fullPath, () => {});
    }
  } else {
    // Try to find by account id prefix
    try {
      const files = await readdir(ASSETS_DIR);
      const match = files.find((f) => f.startsWith(`${accountId}.`));
      if (match) {
        unlink(join(ASSETS_DIR, match), () => {});
      }
    } catch {
      // Ignore errors — directory may not exist
    }
  }
}

/**
 * Delete all on-chain accounts for a given address (e.g., removing an EVM wallet removes all networks)
 */
export async function deleteOnchainAccountsByAddress(
  userId: string,
  address: string
) {
  return prisma.account.deleteMany({
    where: { userId, type: "onchain", address },
  });
}

// ---------------------------------------------------------------------------
// Portfolio summary
// ---------------------------------------------------------------------------

/**
 * Get aggregate portfolio summary across all accounts for a user
 */
export async function getPortfolioSummary(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
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
    return { totalUsdValue: 0, accountCount: 0, lastUpdated: null };
  }

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

  return { totalUsdValue, accountCount: accounts.length, lastUpdated };
}

// ---------------------------------------------------------------------------
// Snapshot creation (used by refresh flow)
// ---------------------------------------------------------------------------

export interface CreateAccountSnapshotInput {
  accountId: string;
  totalUsdValue: number;
  // On-chain
  nativeBalance?: string;
  nativeBalanceUsd?: number;
  nativePriceUsd?: number;
  tokensUsdValue?: number;
  tokens?: Array<{
    contractAddress: string;
    symbol: string;
    name?: string | null;
    decimals: number;
    logoUrl?: string | null;
    balance: string;
    balanceUsd: number;
    priceUsd: number;
  }>;
  // Bank
  availableBalance?: number;
  currentBalance?: number;
  currency?: string;
  // Brokerage
  holdingsValue?: number;
  cashBalance?: number;
  holdings?: Array<{
    ticker: string;
    name?: string | null;
    quantity: number;
    priceUsd: number;
    valueUsd: number;
    costBasis?: number | null;
  }>;
}

/**
 * Create an account snapshot (atomic — all tokens/holdings or none)
 */
export async function createAccountSnapshot(input: CreateAccountSnapshotInput) {
  return prisma.$transaction(async (tx) => {
    return tx.accountSnapshot.create({
      data: {
        accountId: input.accountId,
        totalUsdValue: input.totalUsdValue,
        nativeBalance: input.nativeBalance,
        nativeBalanceUsd: input.nativeBalanceUsd,
        nativePriceUsd: input.nativePriceUsd,
        tokensUsdValue: input.tokensUsdValue,
        availableBalance: input.availableBalance,
        currentBalance: input.currentBalance,
        currency: input.currency,
        holdingsValue: input.holdingsValue,
        cashBalance: input.cashBalance,
        tokenSnapshots: input.tokens?.length
          ? {
              create: input.tokens.map((t) => ({
                contractAddress: t.contractAddress,
                symbol: t.symbol,
                name: t.name,
                decimals: t.decimals,
                logoUrl: t.logoUrl,
                balance: t.balance,
                balanceUsd: t.balanceUsd,
                priceUsd: t.priceUsd,
              })),
            }
          : undefined,
        holdings: input.holdings?.length
          ? {
              create: input.holdings.map((h) => ({
                ticker: h.ticker,
                name: h.name,
                quantity: h.quantity,
                priceUsd: h.priceUsd,
                valueUsd: h.valueUsd,
                costBasis: h.costBasis,
              })),
            }
          : undefined,
      },
    });
  });
}
