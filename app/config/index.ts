/**
 * Configuration Repository
 *
 * This file aggregates all configuration files into a single object.
 * Add new config files here to make them available via the config() helper.
 *
 * Usage with config() helper:
 *   config('app.name')           // Get app name
 *   config('database.default')   // Get default database connection
 *   config('services.mail.host') // Get nested config value
 */

import app from "./app";
import database from "./database";
import cache from "./cache";
import services from "./services";

/**
 * All configuration namespaces
 *
 * To add a new config file:
 * 1. Create the file in app/config/ (e.g., app/config/myconfig.ts)
 * 2. Import it here
 * 3. Add it to the configuration object below
 */
export const configuration = {
  app,
  database,
  cache,
  services,
} as const;

/**
 * Configuration type for TypeScript support
 */
export type Configuration = typeof configuration;

/**
 * Get all config keys (useful for debugging)
 */
export const configKeys = Object.keys(configuration) as (keyof Configuration)[];
