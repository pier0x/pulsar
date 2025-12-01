/**
 * Authentication Module
 *
 * This module provides all authentication functionality for the application.
 *
 * @example
 * // In a loader or action:
 * import { requireAuth, getCurrentUser, login, register, logout } from "~/lib/auth";
 */

// Re-export everything for convenience
export {
  // Auth utilities
  login,
  register,
  logout,
  getCurrentUser,
  isAuthenticated,
  createLoginSession,
  validateUsername,
  type AuthUser,
} from "./auth.server";

export {
  // Route guards
  requireAuth,
  redirectIfAuthenticated,
  optionalAuth,
} from "./guards.server";

export {
  // Password utilities
  hashPassword,
  verifyPassword,
  validatePassword,
} from "./password.server";

export {
  // Session utilities
  destroyAllUserSessions,
  cleanupExpiredSessions,
} from "./session.server";
