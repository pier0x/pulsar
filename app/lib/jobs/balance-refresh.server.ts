/**
 * Balance refresh job system
 *
 * Since this is a self-hosted app without external job runners,
 * we use a request-triggered approach:
 * - Check if refresh is needed on dashboard load
 * - If stale, trigger async refresh (fire and forget)
 * - Return cached data immediately
 */

import {
  isRefreshNeeded,
  refreshAllBalances,
  getLastRefresh,
  getRefreshInterval,
} from "~/lib/balance.server";

// Track if a refresh is currently in progress (in-memory flag)
let refreshInProgress = false;

/**
 * Check if a refresh is currently running
 */
export function isRefreshRunning(): boolean {
  return refreshInProgress;
}

/**
 * Maybe trigger a balance refresh if needed
 * This is designed to be called from loaders and will not block the request
 *
 * @returns true if a refresh was triggered, false otherwise
 */
export async function maybeRefreshBalances(): Promise<boolean> {
  // Don't start another refresh if one is already running
  if (refreshInProgress) {
    return false;
  }

  // Check if refresh is needed based on interval
  const needsRefresh = await isRefreshNeeded();
  if (!needsRefresh) {
    return false;
  }

  // Trigger async refresh (fire and forget)
  refreshInProgress = true;

  // Use setImmediate/setTimeout to not block the current request
  setTimeout(async () => {
    try {
      await refreshAllBalances();
    } catch (error) {
      console.error("Background balance refresh failed:", error);
    } finally {
      refreshInProgress = false;
    }
  }, 0);

  return true;
}

/**
 * Force a balance refresh immediately
 * Unlike maybeRefreshBalances, this will wait for the refresh to complete
 */
export async function forceRefreshBalances(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (refreshInProgress) {
    return {
      success: false,
      error: "A refresh is already in progress",
    };
  }

  refreshInProgress = true;

  try {
    const result = await refreshAllBalances();
    return {
      success: result.success,
      error: result.errors.length > 0
        ? `${result.errors.length} wallet(s) failed to refresh`
        : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    refreshInProgress = false;
  }
}

/**
 * Get refresh status information
 */
export async function getRefreshStatus() {
  const [lastRefresh, interval, needsRefresh] = await Promise.all([
    getLastRefresh(),
    getRefreshInterval(),
    isRefreshNeeded(),
  ]);

  let nextRefresh: Date | null = null;
  if (lastRefresh) {
    nextRefresh = new Date(lastRefresh.getTime() + interval * 60 * 1000);
  }

  return {
    lastRefresh,
    nextRefresh,
    intervalMinutes: interval,
    isRefreshing: refreshInProgress,
    needsRefresh,
  };
}
