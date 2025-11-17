/**
 * Redis Client Guard Utilities - Austa Care Platform
 */

import { Redis, Cluster } from 'ioredis';
import { redisCluster } from '../redis.cluster';
import { logger } from '../../../utils/logger';

export type RedisClient = Redis | Cluster;

export class RedisClientGuardError extends Error {
  public readonly code: string = 'REDIS_CLIENT_UNAVAILABLE';
  public readonly timestamp: number = Date.now();

  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = 'RedisClientGuardError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RedisClientGuardError);
    }
  }
}

export function getRedisClientOrThrow(): RedisClient {
  const client = redisCluster.getClient();
  if (!client) {
    const error = new RedisClientGuardError(
      'Redis client unavailable. Ensure Redis cluster is initialized and connected.',
      { isAvailable: redisCluster.isRedisAvailable(), timestamp: Date.now() }
    );
    logger.error('Redis client access failed', { error: error.message, code: error.code });
    throw error;
  }
  return client;
}

export function getRedisClientSafe(): RedisClient | null {
  return redisCluster.getClient();
}

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
    throw new RedisClientGuardError('Redis client unavailable and no fallback provided');
  }
  try {
    return await operation(client);
  } catch (error) {
    if (fallback) {
      logger.error('Redis operation failed, using fallback', { error });
      return await fallback();
    }
    throw error;
  }
}

export async function withRedisClientBatch<T>(
  operations: Array<(client: RedisClient) => Promise<T>>
): Promise<T[]> {
  const client = getRedisClientOrThrow();
  return await Promise.all(operations.map(op => op(client)));
}

export async function ifRedisAvailable<T>(
  operation: (client: RedisClient) => Promise<T>
): Promise<T | undefined> {
  const client = getRedisClientSafe();
  if (!client) return undefined;
  try {
    return await operation(client);
  } catch (error) {
    logger.warn('Optional Redis operation failed', { error });
    return undefined;
  }
}

export interface RedisHealthStatus {
  isHealthy: boolean;
  hasClient: boolean;
  isAvailable: boolean;
  timestamp: number;
  error?: string;
}

export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const client = redisCluster.getClient();
  const isAvailable = redisCluster.isRedisAvailable();
  if (!client) {
    return { isHealthy: false, hasClient: false, isAvailable, timestamp: Date.now(), error: 'Redis client not initialized' };
  }
  try {
    await client.ping();
    return { isHealthy: true, hasClient: true, isAvailable: true, timestamp: Date.now() };
  } catch (error) {
    return { isHealthy: false, hasClient: true, isAvailable, timestamp: Date.now(), error: String(error) };
  }
}
