/**
 * Public Configuration Helper (CLIENT-SAFE)
 *
 * Access PUBLIC configuration values using dot notation.
 * This helper only has access to client-safe configuration.
 *
 * For server-only config (database, API keys, etc.), use:
 *   import { config } from "~/lib/config.server";
 *
 * Usage:
 *   import { config } from "~/lib/config";
 *
 *   config('app.name')                // Get app name
 *   config('app.name', 'Default')     // With fallback
 *   config('features.darkMode')       // Feature flags
 *   config.has('app.name')            // Check if exists
 *   config.all()                      // Get all public config
 */

import { publicConfig, type PublicConfig } from "~/config";

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
 * Get a PUBLIC configuration value using dot notation
 *
 * @param key - The configuration key in dot notation (e.g., 'app.name')
 * @param defaultValue - Optional default value if the key doesn't exist
 * @returns The configuration value or the default value
 *
 * @example
 * config('app.name')           // Returns app name
 * config('app.name', 'My App') // Returns app name or 'My App' if not set
 * config('features.darkMode')  // Feature flag access
 */
function config<T = unknown>(key: string, defaultValue?: T): T {
  const value = getValueByPath(publicConfig, key);

  if (value === undefined) {
    return defaultValue as T;
  }

  return value as T;
}

/**
 * Get a configuration value (alias for config())
 */
config.get = function <T = unknown>(key: string, defaultValue?: T): T {
  const value = getValueByPath(publicConfig, key);
  return (value === undefined ? defaultValue : value) as T;
};

/**
 * Check if a configuration key exists
 */
config.has = function (key: string): boolean {
  return hasPath(publicConfig, key);
};

/**
 * Get the entire public configuration object
 */
config.all = function (): PublicConfig {
  return publicConfig;
};

/**
 * Get a configuration section/namespace
 */
config.section = function <K extends keyof PublicConfig>(
  namespace: K
): PublicConfig[K] {
  return publicConfig[namespace];
};

export { config };

// Re-export env helper for convenience
export { env } from "./env";
