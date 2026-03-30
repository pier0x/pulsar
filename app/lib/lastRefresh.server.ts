import { prisma } from "~/lib/db.server";
import type { LastRefreshData, WalletResult } from "~/components/layout/navbar";

/**
 * Get last refresh data from the latest account snapshots.
 * NOTE: RefreshLog was removed in Phase 1. This now synthesizes
 * refresh data from account snapshots. Full rebuild in Phase 2.
 */
export async function getLastRefreshData(userId: string): Promise<LastRefreshData | null> {
  const accounts = await prisma.account.findMany({
    where: { userId, type: "onchain" },
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { totalUsdValue: true, timestamp: true },
      },
    },
  });

  if (accounts.length === 0) return null;

  // Find the most recent snapshot across all accounts
  let latestTimestamp: Date | null = null;
  for (const account of accounts) {
    const snap = account.snapshots[0];
    if (snap) {
      const t = new Date(snap.timestamp);
      if (!latestTimestamp || t > latestTimestamp) {
        latestTimestamp = t;
      }
    }
  }

  if (!latestTimestamp) return null;

  const walletResults: WalletResult[] = accounts.map((a) => {
    const snap = a.snapshots[0];
    return {
      name: a.name,
      network: a.network ?? "unknown",
      address: a.address ?? "",
      status: "success" as const,
      totalUsd: snap ? Number(snap.totalUsdValue) : undefined,
    };
  });

  return {
    timestamp: latestTimestamp.toISOString(),
    walletsSucceeded: walletResults.length,
    walletsAttempted: walletResults.length,
    durationMs: null,
    wallets: walletResults,
  };
}
