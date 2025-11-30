/**
 * Configuration Helper - Laravel style
 *
 * Access configuration values using dot notation with optional fallback values.
 *
 * Usage:
 *   config('app.name')                      // Get value
 *   config('app.name', 'Default App')       // Get value with fallback
 *   config('database.connections.sqlite')   // Nested access
 *   config('nonexistent.key', 'fallback')   // Returns fallback if not found
 *
 * Advanced usage:
 *   config.get('app.name')                  // Same as config('app.name')
 *   config.has('app.name')                  // Check if key exists
 *   config.all()                            // Get entire configuration object
 */

import { configuration, type Configuration } from "~/config";

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
 * Get a configuration value using dot notation
 *
 * @param key - The configuration key in dot notation (e.g., 'app.name')
 * @param defaultValue - Optional default value if the key doesn't exist
 * @returns The configuration value or the default value
 *
 * @example
 * config('app.name')                    // Returns app name
 * config('app.name', 'My App')          // Returns app name or 'My App' if not set
 * config('database.connections.sqlite') // Nested access
 */
function config<T = unknown>(key: string, defaultValue?: T): T {
  const value = getValueByPath(configuration, key);

  if (value === undefined) {
    return defaultValue as T;
  }

  return value as T;
}

/**
 * Get a configuration value (alias for config())
 */
config.get = function <T = unknown>(key: string, defaultValue?: T): T {
  const value = getValueByPath(configuration, key);
  return (value === undefined ? defaultValue : value) as T;
};

/**
 * Check if a configuration key exists
 *
 * @param key - The configuration key in dot notation
 * @returns True if the key exists, false otherwise
 *
 * @example
 * config.has('app.name')     // true
 * config.has('invalid.key')  // false
 */
config.has = function (key: string): boolean {
  return hasPath(configuration, key);
};

/**
 * Get the entire configuration object
 *
 * @returns The complete configuration object
 *
 * @example
 * const allConfig = config.all();
 * console.log(allConfig.app.name);
 */
config.all = function (): Configuration {
  return configuration;
};

/**
 * Get a configuration section/namespace
 *
 * @param namespace - The top-level configuration namespace
 * @returns The configuration section object
 *
 * @example
 * const appConfig = config.section('app');
 * console.log(appConfig.name);
 */
config.section = function <K extends keyof Configuration>(
  namespace: K
): Configuration[K] {
  return configuration[namespace];
};

export { config };

// Re-export for convenience
export { env } from "./env";
