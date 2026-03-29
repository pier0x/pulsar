import { redirect } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { verifyPassword } from "./password.server";
import {
  createDatabaseSession,
  createSessionCookie,
  destroyDatabaseSession,
  destroySessionCookie,
  getDatabaseSession,
  getSessionIdFromCookie,
  refreshSessionIfNeeded,
} from "./session.server";

export type AuthUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Attempt to log in a user
 */
export async function login(
  username: string,
  password: string
): Promise<{ user?: AuthUser; error?: string }> {
  // Find user by username
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  // Use generic error message to prevent user enumeration
  if (!user) {
    return { error: "Invalid username or password" };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: "Invalid username or password" };
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

/**
 * Create a login session and return a redirect response with session cookie
 */
export async function createLoginSession(
  request: Request,
  userId: string,
  redirectTo: string = "/"
): Promise<Response> {
  const sessionId = await createDatabaseSession(userId);
  const cookie = await createSessionCookie(request, sessionId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

/**
 * Log out a user and return a redirect response
 */
export async function logout(
  request: Request,
  redirectTo: string = "/auth/login"
): Promise<Response> {
  const sessionId = await getSessionIdFromCookie(request);

  if (sessionId) {
    await destroyDatabaseSession(sessionId);
  }

  const cookie = await destroySessionCookie(request);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

/**
 * Get the current authenticated user from the request
 * Also refreshes the session if needed (sliding expiration)
 */
export async function getCurrentUser(
  request: Request
): Promise<AuthUser | null> {
  const sessionId = await getSessionIdFromCookie(request);

  if (!sessionId) {
    return null;
  }

  const session = await getDatabaseSession(sessionId);

  if (!session) {
    return null;
  }

  // Refresh session if needed (sliding expiration)
  await refreshSessionIfNeeded(sessionId);

  return {
    id: session.user.id,
    username: session.user.username,
    avatarUrl: session.user.avatarUrl,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };
}

/**
 * Check if the current request is authenticated
 */
export async function isAuthenticated(request: Request): Promise<boolean> {
  const user = await getCurrentUser(request);
  return user !== null;
}
