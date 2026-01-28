/**
 * Balance refresh scheduler using node-cron
 * Runs scheduled refreshes for all users on a fixed schedule
 */

import cron, { type ScheduledTask } from "node-cron";
import { refreshAllWallets } from "./refresh.server";

let scheduledTask: ScheduledTask | null = null;

// Default: 6 times per day (every 4 hours)
const CRON_EXPRESSION = "0 0,4,8,12,16,20 * * *";

/**
 * Run a scheduled refresh for all users
 */
async function runScheduledRefresh(): Promise<void> {
  console.log(`[Scheduler] Starting scheduled balance refresh at ${new Date().toISOString()}`);
  
  try {
    const result = await refreshAllWallets("scheduled");
    
    console.log(
      `[Scheduler] Refresh complete: ${result.status}, ` +
      `${result.walletsSucceeded}/${result.walletsAttempted} wallets, ` +
      `${result.durationMs}ms`
    );
    
    if (result.errors.length > 0) {
      console.log(`[Scheduler] Errors: ${result.errors.map((e) => e.errorMessage).join(", ")}`);
    }
  } catch (error) {
    console.error("[Scheduler] Refresh failed:", error);
  }
}

/**
 * Initialize the scheduler
 * Should be called when the server starts
 */
export async function initializeScheduler(): Promise<void> {
  console.log(`[Scheduler] Initializing with cron: "${CRON_EXPRESSION}" (every 4 hours)`);
  
  // Stop existing task if any
  if (scheduledTask) {
    scheduledTask.stop();
  }
  
  // Create new scheduled task
  scheduledTask = cron.schedule(CRON_EXPRESSION, runScheduledRefresh, {
    timezone: "UTC",
  });
  
  console.log("[Scheduler] Scheduler initialized and running");
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

/**
 * Get the next scheduled refresh time
 */
export function getNextScheduledRefresh(): Date | null {
  if (!scheduledTask) {
    return null;
  }
  
  const now = new Date();
  const hours = [0, 4, 8, 12, 16, 20];
  const currentHour = now.getUTCHours();
  
  // Find next hour
  let nextHour = hours.find((h) => h > currentHour);
  let daysToAdd = 0;
  
  if (nextHour === undefined) {
    // Next refresh is tomorrow at the first hour
    nextHour = hours[0];
    daysToAdd = 1;
  }
  
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + daysToAdd);
  next.setUTCHours(nextHour, 0, 0, 0);
  
  return next;
}

/**
 * Check if the scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
