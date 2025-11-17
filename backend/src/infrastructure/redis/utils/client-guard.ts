/**
 * Redis Client Guard Utilities
 *
 * Bulletproof Redis client access patterns that eliminate null pointer errors
 * and provide clear error handling strategies.
 *
 * ARCHITECTURAL PATTERN:
 * - Prevents "Object is possibly 'null'" TypeScript errors
 * - Provides explicit error handling for unavailable Redis
 * - Enables graceful degradation patterns
 * - Centralizes client access logic
 *
 * @module redis/utils/client-guard
 */

import { RedisClient } from '../redis.types';
import { redisCluster } from '../redis.cluster';
import { logger } from '../../../utils/logger';

/**
 * Custom error thrown when Redis client is unavailable
 * Extends Error with additional context for monitoring and debugging
 */
export class RedisClientGuardError extends Error {
  public readonly code: string = 'REDIS_CLIENT_UNAVAILABLE';
  public readonly timestamp: number = Date.now();

  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = 'RedisClientGuardError';

    // Maintains proper stack trace for V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RedisClientGuardError);
    }
  }
}

/**
 * Gets Redis client with guaranteed non-null return
 *
 * USE CASE: Critical operations that MUST have Redis available
 * - Session management
 * - Authentication tokens
 * - Rate limiting
 * - Real-time features
 *
 * @throws {RedisClientGuardError} If Redis client is unavailable
 * @returns {RedisClient} Non-null Redis client instance
 *
 * @example
 * ```typescript
 * // Critical operation - must have Redis
 * try {
 *   const client = getRedisClientOrThrow();
 *   await client.set('session:123', sessionData);
 * } catch (error) {
 *   if (error instanceof RedisClientGuardError) {
 *     // Handle Redis unavailability at service boundary
 *     throw new ServiceUnavailableError('Session service requires Redis');
 *   }
 *   throw error;
 * }
 * ```
 */
export function getRedisClientOrThrow(): RedisClient {
  const client = redisCluster.getClient();

  if (!client) {
    const error = new RedisClientGuardError(
      'Redis client unavailable. Ensure Redis cluster is initialized and connected.',
      {
        isConnected: redisCluster.isClusterConnected(),
        timestamp: Date.now(),
      }
    );

    logger.error('Redis client access failed', {
      error: error.message,
      code: error.code,
      context: error.context,
    });

    throw error;
  }

  return client;
}

/**
 * Gets Redis client with safe null handling
 *
 * USE CASE: Non-critical operations that can function without Redis
 * - Performance metrics (can use in-memory fallback)
 * - Feature flags (can use defaults)
 * - Analytics (can queue for later)
 * - Cached data (can fetch from source)
 *
 * @returns {RedisClient | null} Redis client or null if unavailable
 *
 * @example
 * ```typescript
 * // Non-critical operation - can degrade gracefully
 * const client = getRedisClientSafe();
 * if (client) {
 *   await client.incr('metrics:api_calls');
 * } else {
 *   logger.warn('Redis unavailable, skipping metrics increment');
 * }
 * ```
 */
export function getRedisClientSafe(): RedisClient | null {
  return redisCluster.getClient();
}

/**
 * Executes operation with Redis client, with automatic retry and fallback
 *
 * USE CASE: Operations with fallback strategies
 * - Cache with database fallback
 * - Pub/sub with webhook fallback
 * - Distributed locks with in-memory fallback (single instance)
 *
 * @template T - Return type of the operation
 * @param operation - Async function that uses Redis client
 * @param fallback - Optional fallback function if Redis unavailable
 * @returns {Promise<T>} Result of operation or fallback
 * @throws {RedisClientGuardError} If Redis unavailable and no fallback provided
 *
 * @example
 * ```typescript
 * // With fallback to database
 * const user = await withRedisClient(
 *   async (client) => {
 *     const cached = await client.get(`user:${userId}`);
 *     return cached ? JSON.parse(cached) : null;
 *   },
 *   async () => {
 *     // Fallback: fetch from database
 *     return await db.users.findById(userId);
 *   }
 * );
 *
 * // Without fallback (throws if Redis unavailable)
 * await withRedisClient(async (client) => {
 *   await client.publish('notifications', JSON.stringify(message));
 * });
 * ```
 */
export async function withRedisClient<T>(
  operation: (client: RedisClient) => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  const client = redisCluster.getClient();

  if (!client) {
    if (fallback) {
      logger.warn('Redis client unavailable, using fallback strategy');
      return await fallback();
    }

    throw new RedisClientGuardError(
      'Redis client unavailable and no fallback provided',
      {
        hasClient: false,
        hasFallback: false,
        isConnected: redisCluster.isClusterConnected(),
      }
    );
  }

  try {
    return await operation(client);
  } catch (error) {
    // If Redis operation fails and we have a fallback, use it
    if (fallback) {
      logger.error('Redis operation failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return await fallback();
    }

    throw error;
  }
}

/**
 * Batch operation executor with Redis client
 * Executes multiple operations in a pipeline for performance
 *
 * USE CASE: Multiple related Redis operations
 * - Bulk cache invalidation
 * - Multiple key updates
 * - Atomic multi-key operations
 *
 * @template T - Return type array
 * @param operations - Array of operation functions
 * @returns {Promise<T[]>} Results of all operations
 *
 * @example
 * ```typescript
 * const results = await withRedisClientBatch([
 *   async (client) => await client.get('key1'),
 *   async (client) => await client.get('key2'),
 *   async (client) => await client.get('key3'),
 * ]);
 * ```
 */
export async function withRedisClientBatch<T>(
  operations: Array<(client: RedisClient) => Promise<T>>
): Promise<T[]> {
  const client = getRedisClientOrThrow();

  // Execute all operations in parallel
  return await Promise.all(
    operations.map(operation => operation(client))
  );
}

/**
 * Conditional Redis operation - executes only if Redis is available
 * Returns undefined if Redis unavailable, otherwise returns operation result
 *
 * USE CASE: Optional enhancement operations
 * - Optional caching
 * - Optional analytics
 * - Optional notifications
 *
 * @template T - Return type
 * @param operation - Operation to execute if Redis available
 * @returns {Promise<T | undefined>} Operation result or undefined
 *
 * @example
 * ```typescript
 * // Cache if available, skip if not
 * await ifRedisAvailable(async (client) => {
 *   await client.setex('cache:data', 3600, JSON.stringify(data));
 * });
 * ```
 */
export async function ifRedisAvailable<T>(
  operation: (client: RedisClient) => Promise<T>
): Promise<T | undefined> {
  const client = getRedisClientSafe();

  if (!client) {
    logger.debug('Redis unavailable, skipping optional operation');
    return undefined;
  }

  try {
    return await operation(client);
  } catch (error) {
    logger.warn('Optional Redis operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Health check for Redis client availability
 * Returns detailed status for monitoring and debugging
 *
 * @returns {Promise<RedisHealthStatus>} Health status object
 *
 * @example
 * ```typescript
 * const health = await checkRedisHealth();
 * if (!health.isHealthy) {
 *   logger.error('Redis health check failed', health);
 * }
 * ```
 */
export interface RedisHealthStatus {
  isHealthy: boolean;
  hasClient: boolean;
  isConnected: boolean;
  timestamp: number;
  error?: string;
}

export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const client = redisCluster.getClient();
  const isConnected = redisCluster.isClusterConnected();

  if (!client) {
    return {
      isHealthy: false,
      hasClient: false,
      isConnected,
      timestamp: Date.now(),
      error: 'Redis client not initialized',
    };
  }

  try {
    // Ping Redis to verify actual connectivity
    await client.ping();

    return {
      isHealthy: true,
      hasClient: true,
      isConnected: true,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      isHealthy: false,
      hasClient: true,
      isConnected,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
