/**
 * Full Configuration Repository (SERVER-ONLY)
 *
 * This file exports ALL configuration including secrets and credentials.
 * It should ONLY be imported in server-side code (loaders, actions, .server.ts files).
 *
 * Remix guarantees that .server.ts files are never bundled for the client.
 *
 * Usage with config() helper:
 *   import { config } from "~/lib/config.server";
 *   config('app.name')                      // Public config
 *   config('database.connections.sqlite')   // Private config
 *   config('services.blockchain.coingecko.apiKey') // API keys
 */

// Re-export public config
import { publicConfig, type PublicConfig } from "./index";
export { publicConfig, type PublicConfig };

// Import private configs
import secrets from "./private/secrets.server";
import database from "./private/database.server";
import cache from "./private/cache.server";
import services from "./private/services.server";

/**
 * Private configuration namespaces
 */
export const privateConfig = {
  secrets,
  database,
  cache,
  services,
} as const;

/**
 * Private configuration type
 */
export type PrivateConfig = typeof privateConfig;

/**
 * Full configuration (public + private)
 *
 * This is the complete configuration object available on the server.
 */
export const fullConfig = {
  ...publicConfig,
  ...privateConfig,
} as const;

/**
 * Full configuration type
 */
export type FullConfig = typeof fullConfig;

/**
 * Get all config keys
 */
export const fullConfigKeys = Object.keys(fullConfig) as (keyof FullConfig)[];
