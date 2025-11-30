import { env } from "~/lib/env";

/**
 * Public Application Configuration
 *
 * These settings are safe to expose to the client/browser.
 * DO NOT add any secrets, API keys, or sensitive data here.
 */
export default {
  /**
   * Application name
   */
  name: env.string("APP_NAME", "Pulsar"),

  /**
   * Application environment (development, production, test)
   */
  env: env.string("NODE_ENV", "development"),

  /**
   * Debug mode - enables verbose logging and error details
   */
  debug: env.bool("APP_DEBUG", false),

  /**
   * Application URL (used for generating absolute URLs)
   */
  url: env.string("APP_URL", "http://localhost:3000"),

  /**
   * Timezone for the application
   */
  timezone: env.string("APP_TIMEZONE", "UTC"),

  /**
   * Default locale
   */
  locale: env.string("APP_LOCALE", "en"),

  /**
   * Fallback locale when the current one is not available
   */
  fallbackLocale: env.string("APP_FALLBACK_LOCALE", "en"),
} as const;
