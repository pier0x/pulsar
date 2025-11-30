/**
 * Public Configuration Repository (CLIENT-SAFE)
 *
 * This file exports ONLY public configuration that is safe to use in client code.
 * It can be imported anywhere, including components that run in the browser.
 *
 * DO NOT import private configs here - they would be bundled and sent to the client!
 *
 * Usage with config() helper:
 *   import { config } from "~/lib/config";
 *   config('app.name')        // Get app name
 *   config('features.darkMode') // Get feature flag
 *
 * For server-only config (database, API keys, etc.), use:
 *   import { config } from "~/lib/config.server";
 */

import app from "./public/app";
import features from "./public/features";

/**
 * Public configuration namespaces
 *
 * Only add configs here that are safe to expose to the browser.
 */
export const publicConfig = {
  app,
  features,
} as const;

/**
 * Public configuration type
 */
export type PublicConfig = typeof publicConfig;

/**
 * Get all public config keys
 */
export const publicConfigKeys = Object.keys(
  publicConfig
) as (keyof PublicConfig)[];
