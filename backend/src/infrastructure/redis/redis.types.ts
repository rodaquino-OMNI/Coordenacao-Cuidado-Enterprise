/**
 * Redis Type Definitions
 *
 * TypeScript interfaces and types for Redis cluster operations
 */

import { Cluster } from 'ioredis';

/**
 * Redis client type (ioredis Cluster instance)
 * Used for type-safe client access across the application
 */
export type RedisClient = Cluster;

/**
 * Redis cluster node configuration
 */
export interface RedisNode {
  host: string;
  port: number;
}

/**
 * Redis cluster connection options
 */
export interface RedisClusterOptions {
  nodes: RedisNode[];
  retryAttempts?: number;
  retryDelay?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
  clusterRetryStrategy?: (times: number) => number | null;
  scaleReads?: 'master' | 'slave' | 'all';
  redisOptions?: {
    password?: string;
    db?: number;
    connectTimeout?: number;
    commandTimeout?: number;
    keepAlive?: number;
    family?: 4 | 6;
  };
}

/**
 * Redis operation result
 */
export interface RedisOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Session data structure
 */
export interface SessionData {
  userId: string;
  sessionId: string;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    device?: string;
  };
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T = any> {
  value: T;
  ttl?: number;
  tags?: string[];
  createdAt: number;
}

/**
 * Rate limit strategy types
 */
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  key: string;
  limit: number;
  window: number; // seconds
  strategy?: RateLimitStrategy;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Conversation context structure
 */
export interface ConversationContext {
  conversationId: string;
  userId: string;
  messages: ConversationMessage[];
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Pub/Sub message
 */
export interface PubSubMessage {
  channel: string;
  pattern?: string;
  data: any;
  timestamp: number;
}

/**
 * Redis metrics
 */
export interface RedisMetrics {
  connections: number;
  commands: number;
  errors: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
}
