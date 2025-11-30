import { env } from "~/lib/env";

/**
 * Third-party Services Configuration (SERVER-ONLY)
 *
 * API keys and credentials for external services.
 * This file has .server.ts suffix as an extra safeguard.
 */
export default {
  /**
   * Blockchain/Crypto APIs
   */
  blockchain: {
    /**
     * CoinGecko API for price data
     */
    coingecko: {
      apiKey: env("COINGECKO_API_KEY"),
      baseUrl: env.string(
        "COINGECKO_BASE_URL",
        "https://api.coingecko.com/api/v3"
      ),
    },

    /**
     * Etherscan API
     */
    etherscan: {
      apiKey: env("ETHERSCAN_API_KEY"),
      baseUrl: env.string("ETHERSCAN_BASE_URL", "https://api.etherscan.io/api"),
    },

    /**
     * Alchemy (Ethereum RPC provider)
     */
    alchemy: {
      apiKey: env("ALCHEMY_API_KEY"),
      network: env.string("ALCHEMY_NETWORK", "mainnet"),
    },

    /**
     * Infura (Ethereum RPC provider)
     */
    infura: {
      projectId: env("INFURA_PROJECT_ID"),
      projectSecret: env("INFURA_PROJECT_SECRET"),
    },
  },

  /**
   * Email service
   */
  mail: {
    driver: env.string("MAIL_DRIVER", "smtp"),
    host: env.string("MAIL_HOST", "localhost"),
    port: env.int("MAIL_PORT", 587),
    username: env("MAIL_USERNAME"),
    password: env("MAIL_PASSWORD"),
    encryption: env.string("MAIL_ENCRYPTION", "tls"),
    from: {
      address: env.string("MAIL_FROM_ADDRESS", "noreply@example.com"),
      name: env.string("MAIL_FROM_NAME", "Pulsar"),
    },
  },
} as const;
