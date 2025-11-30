import { env } from "~/lib/env";

/**
 * Application Configuration
 *
 * General application settings like name, environment, debug mode, etc.
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
   * Application port
   */
  port: env.int("PORT", 3000),

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

  /**
   * Application secret key (used for encryption, sessions, etc.)
   */
  key: env("APP_KEY"),
} as const;
