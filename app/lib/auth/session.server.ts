import { createCookieSessionStorage } from "@remix-run/node";
import { config } from "~/lib/config.server";
import { prisma } from "~/lib/db.server";

/**
 * Cookie session storage - stores only the session ID
 */
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: config<string>("auth.session.cookieName", "__session"),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [config<string>("secrets.sessionSecret")],
    secure: config<string>("app.env") === "production",
  },
});

/**
 * Get the session from the request cookie
 */
export async function getSessionFromCookie(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

/**
 * Create a new database session for a user
 * Returns the session ID to store in the cookie
 */
export async function createDatabaseSession(userId: string): Promise<string> {
  const lifetime = config<number>("auth.session.lifetime", 60 * 60 * 24 * 30);
  const expiresAt = new Date(Date.now() + lifetime * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  return session.id;
}

/**
 * Get and validate a database session by ID
 * Returns null if session doesn't exist or is expired
 */
export async function getDatabaseSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: sessionId } });
    return null;
  }

  return session;
}

/**
 * Refresh session if needed (sliding expiration)
 * Only refreshes if last activity was more than refreshThreshold ago
 */
export async function refreshSessionIfNeeded(sessionId: string): Promise<void> {
  const refreshThreshold = config<number>(
    "auth.session.refreshThreshold",
    60 * 60 * 24
  );
  const lifetime = config<number>("auth.session.lifetime", 60 * 60 * 24 * 30);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return;
  }

  const lastActiveMs = session.lastActiveAt.getTime();
  const nowMs = Date.now();
  const thresholdMs = refreshThreshold * 1000;

  // Only refresh if last activity was more than threshold ago
  if (nowMs - lastActiveMs > thresholdMs) {
    const newExpiresAt = new Date(nowMs + lifetime * 1000);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastActiveAt: new Date(),
        expiresAt: newExpiresAt,
      },
    });
  }
}

/**
 * Destroy a session by ID
 */
export async function destroyDatabaseSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  }).catch(() => {
    // Session may already be deleted, ignore error
  });
}

/**
 * Destroy all sessions for a user (logout everywhere)
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Create a session cookie with the session ID
 */
export async function createSessionCookie(
  request: Request,
  sessionId: string
): Promise<string> {
  const session = await getSessionFromCookie(request);
  session.set("sessionId", sessionId);

  return sessionStorage.commitSession(session);
}

/**
 * Destroy the session cookie
 */
export async function destroySessionCookie(request: Request): Promise<string> {
  const session = await getSessionFromCookie(request);
  return sessionStorage.destroySession(session);
}

/**
 * Get the session ID from the cookie
 */
export async function getSessionIdFromCookie(
  request: Request
): Promise<string | null> {
  const session = await getSessionFromCookie(request);
  return session.get("sessionId") || null;
}
