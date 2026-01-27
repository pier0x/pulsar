/**
 * Balance refresh scheduler using node-cron
 * Runs scheduled refreshes based on the refreshesPerDay setting
 */

import cron from "node-cron";
import { getRefreshesPerDay, setLastScheduledRefresh } from "~/lib/settings.server";
import { refreshAllWallets } from "./refresh.server";

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Convert refreshes per day to cron expression
 */
function getCronExpression(refreshesPerDay: number): string {
  switch (refreshesPerDay) {
    case 1:
      // Once a day at noon
      return "0 12 * * *";
    case 3:
      // 3 times: 8am, 2pm, 8pm
      return "0 8,14,20 * * *";
    case 5:
      // 5 times: 6am, 10am, 2pm, 6pm, 10pm
      return "0 6,10,14,18,22 * * *";
    case 10:
      // Every 2.4 hours (approximately 10x per day)
      // Using every 2 hours + specific minutes to get close to 10
      return "0 0,2,5,7,10,12,14,17,19,22 * * *";
    default:
      // Default to 5 times per day
      return "0 6,10,14,18,22 * * *";
  }
}

/**
 * Run a scheduled refresh
 */
async function runScheduledRefresh(): Promise<void> {
  console.log(`[Scheduler] Starting scheduled balance refresh at ${new Date().toISOString()}`);
  
  try {
    const result = await refreshAllWallets("scheduled");
    await setLastScheduledRefresh(new Date());
    
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
  const refreshesPerDay = await getRefreshesPerDay();
  const cronExpression = getCronExpression(refreshesPerDay);
  
  console.log(
    `[Scheduler] Initializing with ${refreshesPerDay} refreshes per day, ` +
    `cron: "${cronExpression}"`
  );
  
  // Stop existing task if any
  if (scheduledTask) {
    scheduledTask.stop();
  }
  
  // Create new scheduled task
  scheduledTask = cron.schedule(cronExpression, runScheduledRefresh, {
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
 * Update the scheduler with new settings
 * Called when refreshesPerDay setting changes
 */
export async function updateScheduler(): Promise<void> {
  await initializeScheduler();
}

/**
 * Get the next scheduled refresh time
 */
export async function getNextScheduledRefresh(): Promise<Date | null> {
  if (!scheduledTask) {
    return null;
  }
  
  // node-cron doesn't expose next run time directly
  // We'll calculate it based on the cron expression
  const refreshesPerDay = await getRefreshesPerDay();
  const now = new Date();
  
  // Get the hours based on refreshesPerDay
  let hours: number[];
  switch (refreshesPerDay) {
    case 1:
      hours = [12];
      break;
    case 3:
      hours = [8, 14, 20];
      break;
    case 5:
      hours = [6, 10, 14, 18, 22];
      break;
    case 10:
      hours = [0, 2, 5, 7, 10, 12, 14, 17, 19, 22];
      break;
    default:
      hours = [6, 10, 14, 18, 22];
  }
  
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
