import { redisCluster } from '../redis.cluster';
import { getRedisClientOrThrow } from '../utils/client-guard';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';

export interface RateLimitConfig {
  limit: number; // Max requests
  window: number; // Time window in seconds
  blockDuration?: number; // How long to block after limit reached (optional)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds to wait before retry
}

export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed-window',
  SLIDING_WINDOW = 'sliding-window',
  TOKEN_BUCKET = 'token-bucket',
  LEAKY_BUCKET = 'leaky-bucket',
}

export class RedisRateLimiterService {
  private static instance: RedisRateLimiterService;

  private constructor() {}

  static getInstance(): RedisRateLimiterService {
    if (!RedisRateLimiterService.instance) {
      RedisRateLimiterService.instance = new RedisRateLimiterService();
    }
    return RedisRateLimiterService.instance;
  }

  /**
   * Check rate limit using sliding window algorithm (default)
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
    strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW
  ): Promise<RateLimitResult> {
    const start = Date.now();
    try {
      let result: RateLimitResult;

      switch (strategy) {
        case RateLimitStrategy.FIXED_WINDOW:
          result = await this.fixedWindowLimit(key, config);
          break;
        case RateLimitStrategy.SLIDING_WINDOW:
          result = await this.slidingWindowLimit(key, config);
          break;
        case RateLimitStrategy.TOKEN_BUCKET:
          result = await this.tokenBucketLimit(key, config);
          break;
        case RateLimitStrategy.LEAKY_BUCKET:
          result = await this.leakyBucketLimit(key, config);
          break;
        default:
          result = await this.slidingWindowLimit(key, config);
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({
        operation: 'rateLimitCheck',
        status: result.allowed ? 'allowed' : 'blocked',
      });
      metrics.redisLatency.observe({ operation: 'rateLimitCheck' }, duration);

      if (!result.allowed) {
        logger.warn(`Rate limit exceeded for key: ${key}`, {
          remaining: result.remaining,
          resetAt: new Date(result.resetAt).toISOString(),
        });
      }

      return result;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'rateLimitCheck', status: 'error' });
      logger.error('Failed to check rate limit:', error);
      throw error;
    }
  }

  /**
   * Fixed window rate limiting
   */
  private async fixedWindowLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const client = getRedisClientOrThrow();
    const rateLimitKey = `ratelimit:fixed:${key}`;
    const now = Date.now();
    const window = config.window * 1000;

    // Get current window start
    const windowStart = Math.floor(now / window) * window;
    const windowKey = `${rateLimitKey}:${windowStart}`;

    // Increment counter
    const count = await client.incr(windowKey);

    // Set expiry on first request
    if (count === 1) {
      await client.pexpire(windowKey, window);
    }

    const allowed = count <= config.limit;
    const remaining = Math.max(0, config.limit - count);
    const resetAt = windowStart + window;

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
    };
  }

  /**
   * Sliding window rate limiting (more accurate)
   */
  private async slidingWindowLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const client = getRedisClientOrThrow();
    const rateLimitKey = `ratelimit:sliding:${key}`;
    const now = Date.now();
    const window = config.window * 1000;
    const windowStart = now - window;

    // Use pipeline for atomic operations
    const pipeline = client.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(rateLimitKey, '-inf', windowStart);

    // Add current request
    pipeline.zadd(rateLimitKey, now, `${now}-${Math.random()}`);

    // Count requests in window
    pipeline.zcard(rateLimitKey);

    // Set expiry
    pipeline.pexpire(rateLimitKey, window);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Rate limit pipeline failed');
    }

    const count = results[2][1] as number;
    const allowed = count <= config.limit;
    const remaining = Math.max(0, config.limit - count);
    const resetAt = now + window;

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(window / 1000),
    };
  }

  /**
   * Token bucket rate limiting (allows bursts)
   */
  private async tokenBucketLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const client = getRedisClientOrThrow();
    const bucketKey = `ratelimit:token:${key}`;
    const now = Date.now();

    // Get bucket state
    const bucket = await client.hgetall(bucketKey);

    let tokens = parseFloat(bucket.tokens || String(config.limit));
    let lastRefill = parseInt(bucket.lastRefill || String(now), 10);

    // Calculate tokens to add based on time passed
    const timePassed = (now - lastRefill) / 1000;
    const refillRate = config.limit / config.window; // tokens per second
    const tokensToAdd = timePassed * refillRate;

    // Refill tokens
    tokens = Math.min(config.limit, tokens + tokensToAdd);

    // Check if we have tokens
    const allowed = tokens >= 1;

    if (allowed) {
      tokens -= 1;
    }

    // Update bucket state
    await client.hset(bucketKey, {
      tokens: tokens.toString(),
      lastRefill: now.toString(),
    });
    await client.expire(bucketKey, config.window * 2);

    const resetAt = now + ((1 - tokens) / refillRate) * 1000;

    return {
      allowed,
      remaining: Math.floor(tokens),
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((1 / refillRate)),
    };
  }

  /**
   * Leaky bucket rate limiting (smooth rate)
   */
  private async leakyBucketLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const client = getRedisClientOrThrow();
    const bucketKey = `ratelimit:leaky:${key}`;
    const now = Date.now();

    // Get bucket state
    const bucket = await client.hgetall(bucketKey);

    let water = parseFloat(bucket.water || '0');
    let lastLeak = parseInt(bucket.lastLeak || String(now), 10);

    // Calculate water leaked
    const timePassed = (now - lastLeak) / 1000;
    const leakRate = config.limit / config.window; // requests per second
    const leaked = timePassed * leakRate;

    // Leak water
    water = Math.max(0, water - leaked);

    // Try to add new request
    const allowed = water < config.limit;

    if (allowed) {
      water += 1;
    }

    // Update bucket state
    await client.hset(bucketKey, {
      water: water.toString(),
      lastLeak: now.toString(),
    });
    await client.expire(bucketKey, config.window * 2);

    const resetAt = now + ((water - config.limit) / leakRate) * 1000;

    return {
      allowed,
      remaining: Math.max(0, Math.floor(config.limit - water)),
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((1 / leakRate)),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string, strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW): Promise<void> {
    try {
      const client = getRedisClientOrThrow();
      const prefix = this.getKeyPrefix(strategy);
      const rateLimitKey = `${prefix}:${key}`;

      const keys = await client.keys(`${rateLimitKey}*`);

      if (keys.length > 0) {
        await client.del(...keys);
      }

      logger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
      throw error;
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(
    key: string,
    config: RateLimitConfig,
    strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW
  ): Promise<RateLimitResult> {
    try {
      const client = getRedisClientOrThrow();
      const prefix = this.getKeyPrefix(strategy);
      const rateLimitKey = `${prefix}:${key}`;
      const now = Date.now();

      if (strategy === RateLimitStrategy.SLIDING_WINDOW) {
        const window = config.window * 1000;
        const windowStart = now - window;
        const count = await client.zcount(rateLimitKey, windowStart, now);

        return {
          allowed: count < config.limit,
          remaining: Math.max(0, config.limit - count),
          resetAt: now + window,
        };
      } else if (strategy === RateLimitStrategy.TOKEN_BUCKET || strategy === RateLimitStrategy.LEAKY_BUCKET) {
        const bucket = await client.hgetall(rateLimitKey);
        const tokens = parseFloat(bucket.tokens || bucket.water || String(config.limit));

        return {
          allowed: tokens >= 1,
          remaining: Math.floor(tokens),
          resetAt: now + config.window * 1000,
        };
      } else {
        // Fixed window
        const window = config.window * 1000;
        const windowStart = Math.floor(now / window) * window;
        const windowKey = `${rateLimitKey}:${windowStart}`;
        const count = await client.get(windowKey);

        return {
          allowed: !count || parseInt(count, 10) < config.limit,
          remaining: Math.max(0, config.limit - parseInt(count || '0', 10)),
          resetAt: windowStart + window,
        };
      }
    } catch (error) {
      logger.error('Failed to get rate limit status:', error);
      throw error;
    }
  }

  /**
   * Block a key for a specific duration
   */
  async block(key: string, durationSeconds: number): Promise<void> {
    try {
      const client = getRedisClientOrThrow();
      const blockKey = `ratelimit:block:${key}`;

      await client.setex(blockKey, durationSeconds, '1');

      logger.warn(`Blocked key: ${key} for ${durationSeconds} seconds`);
      metrics.redisOperations.inc({ operation: 'rateLimitBlock', status: 'success' });
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'rateLimitBlock', status: 'error' });
      logger.error('Failed to block key:', error);
      throw error;
    }
  }

  /**
   * Check if a key is blocked
   */
  async isBlocked(key: string): Promise<boolean> {
    try {
      const client = getRedisClientOrThrow();
      const blockKey = `ratelimit:block:${key}`;

      const result = await client.exists(blockKey);
      return result === 1;
    } catch (error) {
      logger.error('Failed to check if key is blocked:', error);
      return false;
    }
  }

  /**
   * Unblock a key
   */
  async unblock(key: string): Promise<void> {
    try {
      const client = getRedisClientOrThrow();
      const blockKey = `ratelimit:block:${key}`;

      await client.del(blockKey);

      logger.info(`Unblocked key: ${key}`);
    } catch (error) {
      logger.error('Failed to unblock key:', error);
      throw error;
    }
  }

  /**
   * Get key prefix for strategy
   */
  private getKeyPrefix(strategy: RateLimitStrategy): string {
    switch (strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return 'ratelimit:fixed';
      case RateLimitStrategy.SLIDING_WINDOW:
        return 'ratelimit:sliding';
      case RateLimitStrategy.TOKEN_BUCKET:
        return 'ratelimit:token';
      case RateLimitStrategy.LEAKY_BUCKET:
        return 'ratelimit:leaky';
      default:
        return 'ratelimit:sliding';
    }
  }

  /**
   * Cleanup expired rate limit data
   */
  async cleanup(): Promise<number> {
    try {
      const client = getRedisClientOrThrow();
      const patterns = [
        'ratelimit:fixed:*',
        'ratelimit:sliding:*',
        'ratelimit:token:*',
        'ratelimit:leaky:*',
        'ratelimit:block:*',
      ];

      let cleaned = 0;

      for (const pattern of patterns) {
        const keys = await client.keys(pattern);

        for (const key of keys) {
          const ttl = await client.ttl(key);
          if (ttl < 0) {
            await client.del(key);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired rate limit entries`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup rate limit data:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const rateLimiterService = RedisRateLimiterService.getInstance();
