import { env } from "~/lib/env";

/**
 * Database Configuration
 *
 * Database connection settings and options.
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

    postgresql: {
      driver: "postgresql" as const,
      url: env("DATABASE_URL"),
      host: env.string("DB_HOST", "127.0.0.1"),
      port: env.int("DB_PORT", 5432),
      database: env.string("DB_DATABASE", "pulsar"),
      username: env.string("DB_USERNAME", "root"),
      password: env("DB_PASSWORD"),
      schema: env.string("DB_SCHEMA", "public"),
    },

    mysql: {
      driver: "mysql" as const,
      url: env("DATABASE_URL"),
      host: env.string("DB_HOST", "127.0.0.1"),
      port: env.int("DB_PORT", 3306),
      database: env.string("DB_DATABASE", "pulsar"),
      username: env.string("DB_USERNAME", "root"),
      password: env("DB_PASSWORD"),
    },
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
