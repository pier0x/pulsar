import { env } from "~/lib/env";

/**
 * Application Secrets Configuration (SERVER-ONLY)
 *
 * Sensitive application settings that must never be exposed to the client.
 */
export default {
  /**
   * Application secret key (used for encryption, sessions, etc.)
   */
  appKey: env("APP_KEY"),

  /**
   * Session secret for cookie signing
   */
  sessionSecret: env("SESSION_SECRET"),
} as const;
