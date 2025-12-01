/**
 * Authentication Configuration (SERVER-ONLY)
 *
 * Settings for user authentication, sessions, and password policies.
 */
export default {
  /**
   * Session configuration
   */
  session: {
    /**
     * Session lifetime in seconds (30 days)
     */
    lifetime: 60 * 60 * 24 * 30,

    /**
     * Refresh session if last activity was more than this many seconds ago (24 hours)
     * This implements sliding expiration without refreshing on every request
     */
    refreshThreshold: 60 * 60 * 24,

    /**
     * Cookie name for the session
     */
    cookieName: "__session",
  },

  /**
   * Password requirements
   */
  password: {
    /**
     * Minimum password length
     */
    minLength: 8,

    /**
     * bcrypt cost factor (2^12 = 4096 iterations)
     * Higher is more secure but slower
     */
    bcryptRounds: 12,
  },

  /**
   * Username requirements
   */
  username: {
    /**
     * Minimum username length
     */
    minLength: 3,

    /**
     * Maximum username length
     */
    maxLength: 32,

    /**
     * Allowed characters: alphanumeric and underscore
     */
    pattern: /^[a-zA-Z0-9_]+$/,
  },
} as const;
