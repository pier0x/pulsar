import { env } from "~/lib/env";

/**
 * Third-party Services Configuration (SERVER-ONLY)
 *
 * API keys and credentials for external services.
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
} as const;
