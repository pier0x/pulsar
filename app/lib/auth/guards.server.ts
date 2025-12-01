import { redirect } from "@remix-run/node";
import { getCurrentUser, type AuthUser } from "./auth.server";

/**
 * Require authentication for a route
 * Throws a redirect to login if not authenticated
 *
 * @example
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await requireAuth(request);
 *   return json({ user });
 * }
 */
export async function requireAuth(
  request: Request,
  redirectTo: string = "/auth/login"
): Promise<AuthUser> {
  const user = await getCurrentUser(request);

  if (!user) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams([["redirectTo", url.pathname]]);
    throw redirect(`${redirectTo}?${searchParams}`);
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
