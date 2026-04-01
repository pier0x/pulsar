import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { refreshUserWallets, refreshSimplefinAccounts, refreshIbkrHoldings } from "~/lib/balance/refresh.server";
import { NETWORK_INFO, type WalletNetwork } from "~/lib/wallet";

const RATE_LIMIT_MS = 5 * 1000; // 5 seconds

/**
 * Get rate limit key for a user
 */
function getRateLimitKey(userId: string): string {
  return `refresh:manual:${userId}`;
}

/**
 * Check if rate limited
 */
async function checkRateLimit(userId: string): Promise<{ limited: boolean; retryAfterMs?: number }> {
  const key = getRateLimitKey(userId);
  const rateLimit = await prisma.rateLimit.findUnique({
    where: { key },
  });

  if (!rateLimit) {
    return { limited: false };
  }

  const elapsed = Date.now() - rateLimit.lastAction.getTime();
  if (elapsed < RATE_LIMIT_MS) {
    return { limited: true, retryAfterMs: RATE_LIMIT_MS - elapsed };
  }

  return { limited: false };
}

/**
 * Update rate limit timestamp
 */
async function updateRateLimit(userId: string): Promise<void> {
  const key = getRateLimitKey(userId);
  await prisma.rateLimit.upsert({
    where: { key },
    update: { lastAction: new Date() },
    create: { key, lastAction: new Date() },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Require authentication
  const user = await requireAuth(request);

  // Check rate limit (per-user)
  const rateLimitCheck = await checkRateLimit(user.id);
  if (rateLimitCheck.limited) {
    const retryAfterSeconds = Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000);
    return json(
      { 
        error: `Rate limited. Please wait ${retryAfterSeconds} seconds before refreshing again.`,
        retryAfterMs: rateLimitCheck.retryAfterMs,
      },
      { 
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
        },
      }
    );
  }

  // Update rate limit before starting
  await updateRateLimit(user.id);

  try {
    // Get account names for display (on-chain + SimpleFIN)
    const userAccounts = await prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, network: true, address: true, type: true, provider: true },
    });
    const accountMap = new Map(userAccounts.map((a) => [`${a.network}:${a.address}`, a.name]));

    // Run the refresh for this user's accounts
    const result = await refreshUserWallets(user.id, "manual");

    // Also refresh SimpleFIN accounts
    let sfResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] as string[] };
    try {
      sfResult = await refreshSimplefinAccounts(user.id);
      console.log("[refresh] SimpleFIN result:", JSON.stringify(sfResult));
    } catch (err) {
      console.error("[refresh] SimpleFIN failed:", err);
    }

    // Enrich IBKR accounts with Flex Query holdings data
    let ibkrResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] as string[] };
    try {
      ibkrResult = await refreshIbkrHoldings(user.id);
      if (ibkrResult.attempted > 0) {
        console.log("[refresh] IBKR Flex result:", JSON.stringify(ibkrResult));
      }
    } catch (err) {
      console.error("[refresh] IBKR Flex failed:", err);
    }

    return json({
      success: true,
      status: result.status,
      accountsAttempted: result.accountsAttempted + sfResult.attempted + ibkrResult.attempted,
      accountsSucceeded: result.accountsSucceeded + sfResult.succeeded + ibkrResult.succeeded,
      accountsFailed: result.accountsFailed + sfResult.failed + ibkrResult.failed,
      durationMs: result.durationMs,
      accounts: [
        ...result.successfulAccounts.map((w) => ({
          name: accountMap.get(`${w.network}:${w.address}`) || null,
          network: w.network,
          address: w.address,
          status: "success" as const,
          totalUsd: w.totalUsdValue,
        })),
        ...result.errors.map((e) => ({
          name: accountMap.get(`${e.network}:${e.accountAddress}`) || null,
          network: e.network,
          address: e.accountAddress,
          status: "error" as const,
          error: e.errorMessage,
        })),
      ],
    });
  } catch (error) {
    console.error("[API Refresh] Error:", error);
    return json(
      { 
        error: error instanceof Error ? error.message : "Refresh failed",
      },
      { status: 500 }
    );
  }
}

// Only POST allowed
export async function loader() {
  return json({ error: "Method not allowed" }, { status: 405 });
}
