import { env } from "~/lib/env";

/**
 * Cache Configuration (SERVER-ONLY)
 *
 * Settings for caching system including Redis credentials.
 * This file has .server.ts suffix as an extra safeguard.
 */
export default {
  /**
   * Default cache driver
   */
  default: env.string("CACHE_DRIVER", "memory"),

  /**
   * Cache key prefix (useful when sharing cache between apps)
   */
  prefix: env.string("CACHE_PREFIX", "pulsar_cache_"),

  /**
   * Default TTL in seconds
   */
  ttl: env.int("CACHE_TTL", 3600),

  /**
   * Cache store configurations
   */
  stores: {
    memory: {
      driver: "memory" as const,
      maxSize: env.int("CACHE_MEMORY_MAX_SIZE", 100),
    },

    redis: {
      driver: "redis" as const,
      url: env("REDIS_URL"),
      host: env.string("REDIS_HOST", "127.0.0.1"),
      port: env.int("REDIS_PORT", 6379),
      password: env("REDIS_PASSWORD"),
      database: env.int("REDIS_DATABASE", 0),
    },
  },
} as const;
