import { redirect } from "@remix-run/node";

/**
 * Setup is no longer required in SaaS mode
 * These functions are kept for backwards compatibility but now just redirect
 */

export async function requireSetupIncomplete(): Promise<void> {
  // Setup is no longer used - redirect to home
  throw redirect("/");
}

export async function requireSetupComplete(): Promise<void> {
  // Setup is always "complete" in SaaS mode - no action needed
}

export async function requireSetupStep(_requiredStep: number): Promise<void> {
  // Setup is no longer used - redirect to home
  throw redirect("/");
}

export async function getSetupRedirect(): Promise<string | null> {
  // No setup redirect needed in SaaS mode
  return null;
}
