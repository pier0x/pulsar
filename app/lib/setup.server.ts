import { redirect } from "@remix-run/node";

/**
 * Setup stubs — kept for backwards compatibility, no setup wizard needed.
 */

export async function requireSetupIncomplete(): Promise<void> {
  throw redirect("/");
}

export async function requireSetupComplete(): Promise<void> {
  // No-op — setup is always complete
}

export async function requireSetupStep(_requiredStep: number): Promise<void> {
  throw redirect("/");
}

export async function getSetupRedirect(): Promise<string | null> {
  return null;
}
