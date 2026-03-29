/**
 * Authentication Module
 *
 * @example
 * import { requireAuth, getCurrentUser, login, logout } from "~/lib/auth";
 */

export {
  login,
  logout,
  getCurrentUser,
  isAuthenticated,
  createLoginSession,
  type AuthUser,
} from "./auth.server";

export {
  requireAuth,
  redirectIfAuthenticated,
  optionalAuth,
} from "./guards.server";

export {
  hashPassword,
  validatePassword,
} from "./password.server";

export {
  destroyAllUserSessions,
  cleanupExpiredSessions,
} from "./session.server";
