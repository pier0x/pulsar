import { env } from "~/lib/env";

/**
 * Database Configuration (SERVER-ONLY)
 *
 * Database connection settings and credentials.
 */
export default {
  /**
   * Default database connection
   */
  default: env.string("DB_CONNECTION", "sqlite"),

  /**
   * Database connections
   */
  connections: {
    sqlite: {
      driver: "sqlite" as const,
      url: env.string("DATABASE_URL", "file:./prisma/data/pulsar.db"),
    },

    // TODO: Potentially support other databases
  },

  /**
   * Prisma-specific settings
   */
  prisma: {
    /**
     * Log level for Prisma queries
     */
    logLevel: env.string("PRISMA_LOG_LEVEL", "warn"),

    /**
     * Enable query logging (useful for debugging)
     */
    logQueries: env.bool("PRISMA_LOG_QUERIES", false),
  },
} as const;
