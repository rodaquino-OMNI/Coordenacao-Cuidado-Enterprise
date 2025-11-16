/**
 * Redis Cluster Configuration
 *
 * Configuration for Redis cluster connection and behavior
 */

import { RedisClusterOptions, RedisNode } from './redis.types';

/**
 * Parse Redis cluster nodes from environment variable
 * Format: "host1:port1,host2:port2,host3:port3"
 */
export function parseRedisNodes(nodesString?: string): RedisNode[] {
  if (!nodesString) {
    return [
      { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) }
    ];
  }

  return nodesString.split(',').map(node => {
    const [host, port] = node.trim().split(':');
    return {
      host: host || 'localhost',
      port: parseInt(port || '6379', 10)
    };
  });
}

/**
 * Redis cluster retry strategy
 * Exponential backoff with max delay
 */
export function clusterRetryStrategy(times: number): number | null {
  const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10);
  const retryDelay = parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10);
  const maxDelay = parseInt(process.env.REDIS_MAX_RETRY_DELAY || '10000', 10);

  if (times > maxRetries) {
    return null; // Stop retrying
  }

  // Exponential backoff: delay * 2^(times-1), capped at maxDelay
  return Math.min(retryDelay * Math.pow(2, times - 1), maxDelay);
}

/**
 * Default Redis cluster configuration
 */
export const redisClusterConfig: RedisClusterOptions = {
  nodes: parseRedisNodes(process.env.REDIS_CLUSTER_NODES),
  retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '5', 10),
  retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
  enableReadyCheck: true,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  clusterRetryStrategy,
  scaleReads: (process.env.REDIS_SCALE_READS as 'master' | 'slave' | 'all') || 'slave',
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
    keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10),
    family: 4, // IPv4
  }
};

/**
 * Session configuration
 */
export const sessionConfig = {
  ttl: parseInt(process.env.SESSION_TTL || '86400', 10), // 24 hours default
  keyPrefix: process.env.SESSION_KEY_PREFIX || 'session:',
  maxSessions: parseInt(process.env.MAX_SESSIONS_PER_USER || '10', 10),
};

/**
 * Cache configuration
 */
export const cacheConfig = {
  defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10), // 1 hour default
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'cache:',
  tagPrefix: process.env.CACHE_TAG_PREFIX || 'tag:',
};

/**
 * Rate limiter configuration
 */
export const rateLimiterConfig = {
  keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || 'ratelimit:',
  blockPrefix: process.env.RATE_LIMIT_BLOCK_PREFIX || 'blocked:',
  defaultWindow: parseInt(process.env.RATE_LIMIT_DEFAULT_WINDOW || '60', 10), // 60 seconds
  defaultLimit: parseInt(process.env.RATE_LIMIT_DEFAULT_LIMIT || '100', 10), // 100 requests
};

/**
 * Conversation context configuration
 */
export const conversationConfig = {
  ttl: parseInt(process.env.CONVERSATION_TTL || '3600', 10), // 1 hour default
  keyPrefix: process.env.CONVERSATION_KEY_PREFIX || 'conversation:',
  maxMessages: parseInt(process.env.MAX_CONVERSATION_MESSAGES || '100', 10),
};
