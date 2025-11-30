/**
 * Full Configuration Helper (SERVER-ONLY)
 *
 * Access ALL configuration values including secrets and credentials.
 * This helper has access to the complete configuration.
 *
 * IMPORTANT: Only import this in server-side code:
 *   - Loaders
 *   - Actions
 *   - Files ending in .server.ts
 *   - Server-only utilities
 *
 * Usage:
 *   import { config } from "~/lib/config.server";
 *
 *   config('app.name')                           // Public config
 *   config('database.connections.sqlite.url')    // Database config
 *   config('services.blockchain.coingecko.apiKey') // API keys
 *   config('secrets.appKey')                     // Application secrets
 */

import { fullConfig, type FullConfig, type PublicConfig } from "~/config/index.server";

/**
 * Get a value from an object using dot notation
 */
function getValueByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let result: unknown = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return undefined;
    }
    if (typeof result !== "object") {
      return undefined;
    }
    result = (result as Record<string, unknown>)[key];
  }

  return result;
}

/**
 * Check if a path exists in an object
 */
function hasPath(obj: unknown, path: string): boolean {
  const keys = path.split(".");
  let result: unknown = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return false;
    }
    if (typeof result !== "object") {
      return false;
    }
    if (!(key in (result as Record<string, unknown>))) {
      return false;
    }
    result = (result as Record<string, unknown>)[key];
  }

  return true;
}

/**
 * Get a configuration value using dot notation (FULL ACCESS)
 *
 * @param key - The configuration key in dot notation
 * @param defaultValue - Optional default value if the key doesn't exist
 * @returns The configuration value or the default value
 *
 * @example
 * config('app.name')                              // Public config
 * config('database.connections.postgresql.password') // Database password
 * config('services.mail.password')                // Mail password
 * config('secrets.appKey')                        // App secret key
 */
function config<T = unknown>(key: string, defaultValue?: T): T {
  const value = getValueByPath(fullConfig, key);

  if (value === undefined) {
    return defaultValue as T;
  }

  return value as T;
}

/**
 * Get a configuration value (alias for config())
 */
config.get = function <T = unknown>(key: string, defaultValue?: T): T {
  const value = getValueByPath(fullConfig, key);
  return (value === undefined ? defaultValue : value) as T;
};

/**
 * Check if a configuration key exists
 */
config.has = function (key: string): boolean {
  return hasPath(fullConfig, key);
};

/**
 * Get the entire configuration object (public + private)
 */
config.all = function (): FullConfig {
  return fullConfig;
};

/**
 * Get a configuration section/namespace
 */
config.section = function <K extends keyof FullConfig>(
  namespace: K
): FullConfig[K] {
  return fullConfig[namespace];
};

/**
 * Get only the public (client-safe) configuration
 * Useful when you need to pass config to the client via loaders
 */
config.public = function (): PublicConfig {
  const { app, features } = fullConfig;
  return { app, features };
};

/**
 * Create a subset of public config to pass to the client
 * This is the recommended way to share config with components
 *
 * @example
 * // In a loader:
 * export const loader = () => {
 *   return json({
 *     config: config.forClient(['app.name', 'features.darkMode'])
 *   });
 * };
 */
config.forClient = function <T extends Record<string, unknown>>(
  keys: string[]
): T {
  const result: Record<string, unknown> = {};

  for (const key of keys) {
    // Only allow public config keys
    if (key.startsWith("app.") || key.startsWith("features.")) {
      result[key] = getValueByPath(fullConfig, key);
    } else {
      console.warn(
        `config.forClient: Skipping non-public key "${key}". Only app.* and features.* keys are allowed.`
      );
    }
  }

  return result as T;
};

export { config };

// Re-export env helper for convenience
export { env } from "./env";
