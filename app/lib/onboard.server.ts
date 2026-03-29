import { redirect } from "@remix-run/node";
import { prisma } from "~/lib/db.server";

/**
 * Check if the app has been set up (at least one user exists).
 */
export async function hasOwner(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}

/**
 * Redirect to /onboard if no users exist.
 * Use in loaders for all routes except /onboard itself.
 */
export async function requireOwnerOrOnboard(): Promise<void> {
  if (!(await hasOwner())) {
    throw redirect("/onboard");
  }
}

/**
 * Redirect away from /onboard if owner already exists.
 */
export async function requireNoOwner(): Promise<void> {
  if (await hasOwner()) {
    throw redirect("/");
  }
}
