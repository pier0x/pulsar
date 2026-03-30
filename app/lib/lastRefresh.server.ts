import { prisma } from "~/lib/db.server";
import type { LastRefreshData, WalletResult } from "~/components/layout/navbar";

export async function getLastRefreshData(userId: string): Promise<LastRefreshData | null> {
  const lastLog = await prisma.refreshLog.findFirst({
    orderBy: { timestamp: "desc" },
    include: {
      errors: {
        select: {
          walletId: true,
          walletAddress: true,
          network: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!lastLog) return null;

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { totalUsdValue: true },
      },
    },
  });

  // Build error lookup by walletId
  const errorByWalletId = new Map<string, typeof lastLog.errors[0]>();
  const errorByAddrNetwork = new Map<string, typeof lastLog.errors[0]>();
  for (const err of lastLog.errors) {
    if (err.walletId) {
      errorByWalletId.set(err.walletId, err);
    }
    if (err.walletAddress) {
      errorByAddrNetwork.set(`${err.network}:${err.walletAddress.toLowerCase()}`, err);
    }
  }

  const walletResults: WalletResult[] = wallets.map((w) => {
    const err = errorByWalletId.get(w.id) ||
      errorByAddrNetwork.get(`${w.network}:${w.address.toLowerCase()}`);

    if (err) {
      return {
        name: w.name,
        network: w.network,
        address: w.address,
        status: "error" as const,
        error: err.errorMessage,
      };
    }

    const snap = w.snapshots[0];
    return {
      name: w.name,
      network: w.network,
      address: w.address,
      status: "success" as const,
      totalUsd: snap ? Number(snap.totalUsdValue) : undefined,
    };
  });

  return {
    timestamp: lastLog.timestamp.toISOString(),
    walletsSucceeded: lastLog.walletsSucceeded,
    walletsAttempted: lastLog.walletsAttempted,
    durationMs: lastLog.durationMs,
    wallets: walletResults,
  };
}
