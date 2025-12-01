import { redirect } from "@remix-run/node";
import { config } from "~/lib/config.server";
import { prisma } from "~/lib/db.server";
import { hashPassword, verifyPassword, validatePassword } from "./password.server";
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
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Validate username meets requirements
 */
export function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  const minLength = config<number>("auth.username.minLength", 3);
  const maxLength = config<number>("auth.username.maxLength", 32);
  const pattern = config<RegExp>("auth.username.pattern", /^[a-zA-Z0-9_]+$/);

  if (!username || username.length < minLength) {
    return {
      valid: false,
      error: `Username must be at least ${minLength} characters`,
    };
  }

  if (username.length > maxLength) {
    return {
      valid: false,
      error: `Username must be at most ${maxLength} characters`,
    };
  }

  if (!pattern.test(username)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }

  return { valid: true };
}

/**
 * Register a new user
 */
export async function register(
  username: string,
  password: string
): Promise<{ user?: AuthUser; error?: string }> {
  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return { error: usernameValidation.error };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { error: passwordValidation.error };
  }

  // Check if username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (existingUser) {
    return { error: "Username already taken" };
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      passwordHash,
    },
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

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
