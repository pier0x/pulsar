import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { refreshUserWallets } from "~/lib/balance/refresh.server";

const RATE_LIMIT_MS = 60 * 1000; // 1 minute

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
    // Run the refresh for this user's wallets
    const result = await refreshUserWallets(user.id, "manual");

    return json({
      success: true,
      status: result.status,
      walletsAttempted: result.walletsAttempted,
      walletsSucceeded: result.walletsSucceeded,
      walletsFailed: result.walletsFailed,
      durationMs: result.durationMs,
      errors: result.errors.map((e) => ({
        network: e.network,
        message: e.errorMessage,
      })),
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
