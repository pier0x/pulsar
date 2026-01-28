import { redirect } from "@remix-run/node";
import { getCurrentUser, type AuthUser } from "./auth.server";

/**
 * Require authentication for a route
 * Also checks if setup is complete - redirects to setup if not
 *
 * @example
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await requireAuth(request);
 *   return json({ user });
 * }
 */
export async function requireAuth(
  request: Request,
  redirectTo: string = "/"
): Promise<AuthUser> {
  const user = await getCurrentUser(request);

  if (!user) {
    // Redirect to landing page - auth is handled via modal
    throw redirect(redirectTo);
  }

  return user;
}

/**
 * Redirect to a destination if already authenticated
 * Use this on login/register pages to redirect logged-in users
 *
 * @example
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   await redirectIfAuthenticated(request);
 *   return json({});
 * }
 */
export async function redirectIfAuthenticated(
  request: Request,
  redirectTo: string = "/"
): Promise<void> {
  const user = await getCurrentUser(request);

  if (user) {
    throw redirect(redirectTo);
  }
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 * Does not throw or redirect
 *
 * @example
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await optionalAuth(request);
 *   return json({ user }); // user may be null
 * }
 */
export async function optionalAuth(
  request: Request
): Promise<AuthUser | null> {
  return getCurrentUser(request);
}
