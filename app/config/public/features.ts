import { env } from "~/lib/env";

/**
 * Public Feature Flags Configuration
 *
 * Feature toggles that are safe to expose to the client.
 * Use these to enable/disable features across the application.
 */
export default {
  /**
   * Enable dark mode toggle in the UI
   */
  darkMode: env.bool("FEATURE_DARK_MODE", true),

  /**
   * Enable portfolio analytics features
   */
  analytics: env.bool("FEATURE_ANALYTICS", true),

  /**
   * Enable price alerts functionality
   */
  priceAlerts: env.bool("FEATURE_PRICE_ALERTS", false),

  /**
   * Enable multi-wallet support
   */
  multiWallet: env.bool("FEATURE_MULTI_WALLET", true),

  /**
   * Enable transaction history export
   */
  exportHistory: env.bool("FEATURE_EXPORT_HISTORY", true),
} as const;
