/**
 * Environment variable helper
 *
 * Provides type-safe access to environment variables with defaults and type casting.
 *
 * Usage:
 *   env('APP_NAME')                    // Returns string | undefined
 *   env('APP_NAME', 'Pulsar')          // Returns string with fallback
 *   env.string('APP_NAME', 'Pulsar')   // Explicitly returns string
 *   env.int('PORT', 3000)              // Returns number
 *   env.bool('APP_DEBUG', false)       // Returns boolean
 *   env.array('ALLOWED_HOSTS', [])     // Returns array (comma-separated)
 */

/**
 * Get an environment variable value
 */
function env(key: string): string | undefined;
function env<T>(key: string, defaultValue: T): string | T;
function env<T>(key: string, defaultValue?: T): string | T | undefined {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : defaultValue;
}

/**
 * Get environment variable as string
 */
env.string = function (key: string, defaultValue: string = ""): string {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : defaultValue;
};

/**
 * Get environment variable as integer
 */
env.int = function (key: string, defaultValue: number = 0): number {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Get environment variable as float
 */
env.float = function (key: string, defaultValue: number = 0): number {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Get environment variable as boolean
 * Truthy values: 'true', '1', 'yes', 'on'
 * Falsy values: 'false', '0', 'no', 'off', '' (empty)
 */
env.bool = function (key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const truthy = ["true", "1", "yes", "on"];
  const falsy = ["false", "0", "no", "off"];

  const lower = value.toLowerCase();
  if (truthy.includes(lower)) return true;
  if (falsy.includes(lower)) return false;
  return defaultValue;
};

/**
 * Get environment variable as array (comma-separated values)
 */
env.array = function (key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
};

/**
 * Check if an environment variable is set (not undefined and not empty)
 */
env.has = function (key: string): boolean {
  const value = process.env[key];
  return value !== undefined && value !== "";
};

/**
 * Get environment variable, throw if not set
 */
env.required = function (key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Required environment variable "${key}" is not set`);
  }
  return value;
};

export { env };
