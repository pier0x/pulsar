import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { refreshAllWallets } from "~/lib/balance/refresh.server";

const RATE_LIMIT_KEY = "refresh:manual";
const RATE_LIMIT_MS = 60 * 1000; // 1 minute

/**
 * Check if rate limited
 */
async function checkRateLimit(): Promise<{ limited: boolean; retryAfterMs?: number }> {
  const rateLimit = await prisma.rateLimit.findUnique({
    where: { key: RATE_LIMIT_KEY },
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
async function updateRateLimit(): Promise<void> {
  await prisma.rateLimit.upsert({
    where: { key: RATE_LIMIT_KEY },
    update: { lastAction: new Date() },
    create: { key: RATE_LIMIT_KEY, lastAction: new Date() },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Require authentication
  await requireAuth(request);

  // Check rate limit
  const rateLimitCheck = await checkRateLimit();
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
  await updateRateLimit();

  try {
    // Run the refresh
    const result = await refreshAllWallets("manual");

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
