import { redisCluster } from '../redis.cluster';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for grouped invalidation
  compress?: boolean; // Compress large values
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  keys: number;
}

export class RedisCacheService {
  private static instance: RedisCacheService;
  private readonly defaultTTL = 3600; // 1 hour
  private readonly compressionThreshold = 1024; // 1KB

  private constructor() {}

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Set cache value
   */
  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const start = Date.now();
    try {
      const ttl = options.ttl || this.defaultTTL;

      // Store cache data
      await redisCluster.setCache(key, value, ttl);

      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.storeTags(key, options.tags, ttl);
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheSet', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cacheSet' }, duration);

      logger.debug(`Cache set: ${key} with TTL ${ttl}s`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheSet', status: 'error' });
      logger.error(`Failed to set cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get cache value
   */
  async get<T = any>(key: string): Promise<T | null> {
    const start = Date.now();
    try {
      const value = await redisCluster.getCache<T>(key);

      const duration = (Date.now() - start) / 1000;

      if (value === null) {
        metrics.redisOperations.inc({ operation: 'cacheGet', status: 'miss' });
        metrics.redisLatency.observe({ operation: 'cacheGet' }, duration);
        return null;
      }

      metrics.redisOperations.inc({ operation: 'cacheGet', status: 'hit' });
      metrics.redisLatency.observe({ operation: 'cacheGet' }, duration);

      return value;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheGet', status: 'error' });
      logger.error(`Failed to get cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get or set cache value (cache-aside pattern)
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const start = Date.now();
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);

      if (cached !== null) {
        return cached;
      }

      // Not in cache, fetch from source
      const value = await factory();

      // Store in cache
      await this.set(key, value, options);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheGetOrSet', status: 'miss' });
      metrics.redisLatency.observe({ operation: 'cacheGetOrSet' }, duration);

      return value;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheGetOrSet', status: 'error' });
      logger.error(`Failed to get or set cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete cache value
   */
  async delete(key: string): Promise<void> {
    const start = Date.now();
    try {
      await redisCluster.deleteCache(key);

      // Remove from tag sets
      await this.removeFromTags(key);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheDelete', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cacheDelete' }, duration);

      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheDelete', status: 'error' });
      logger.error(`Failed to delete cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete cache by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const start = Date.now();
    try {
      const client = redisCluster.getClient();
      const keys = await client.keys(`cache:${pattern}`);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(...keys);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheDeletePattern', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cacheDeletePattern' }, duration);

      logger.info(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheDeletePattern', status: 'error' });
      logger.error(`Failed to delete cache pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const start = Date.now();
    try {
      const client = redisCluster.getClient();
      let deletedCount = 0;

      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        const keys = await client.smembers(tagKey);

        if (keys.length > 0) {
          // Delete all cache keys with this tag
          const cacheKeys = keys.map(k => `cache:${k}`);
          await client.del(...cacheKeys);

          // Remove from tag sets
          for (const key of keys) {
            await this.removeFromTags(key);
          }

          deletedCount += keys.length;
        }

        // Delete the tag set itself
        await client.del(tagKey);
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheInvalidateByTags', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cacheInvalidateByTags' }, duration);

      logger.info(`Invalidated ${deletedCount} cache keys for tags: ${tags.join(', ')}`);
      return deletedCount;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheInvalidateByTags', status: 'error' });
      logger.error(`Failed to invalidate cache by tags:`, error);
      throw error;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = redisCluster.getClient();
      const result = await client.exists(`cache:${key}`);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check cache existence for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a cache key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const client = redisCluster.getClient();
      return await client.ttl(`cache:${key}`);
    } catch (error) {
      logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Extend TTL for a cache key
   */
  async extendTTL(key: string, additionalSeconds: number): Promise<boolean> {
    try {
      const client = redisCluster.getClient();
      const currentTTL = await this.getTTL(key);

      if (currentTTL < 0) {
        return false;
      }

      const newTTL = currentTTL + additionalSeconds;
      const result = await client.expire(`cache:${key}`, newTTL);

      logger.debug(`Extended TTL for ${key} by ${additionalSeconds}s`);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to extend TTL for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const client = redisCluster.getClient();
      const keys = await client.keys('cache:*');

      // Filter out tag keys
      const cacheKeys = keys.filter(k => !k.startsWith('cache:tag:'));

      // Get hit/miss stats from metrics
      const stats: CacheStats = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        keys: cacheKeys.length,
      };

      // Calculate approximate size
      for (const key of cacheKeys.slice(0, 100)) { // Sample first 100 keys
        const value = await client.get(key);
        if (value) {
          stats.size += Buffer.byteLength(value, 'utf8');
        }
      }

      // Extrapolate size
      if (cacheKeys.length > 100) {
        stats.size = Math.round((stats.size / 100) * cacheKeys.length);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return { hits: 0, misses: 0, hitRate: 0, size: 0, keys: 0 };
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<number> {
    const start = Date.now();
    try {
      const client = redisCluster.getClient();
      const keys = await client.keys('cache:*');

      if (keys.length === 0) {
        return 0;
      }

      await client.del(...keys);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheClear', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cacheClear' }, duration);

      logger.warn(`Cleared all cache: ${keys.length} keys deleted`);
      return keys.length;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheClear', status: 'error' });
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Store tags for a cache key
   */
  private async storeTags(key: string, tags: string[], ttl: number): Promise<void> {
    try {
      const client = redisCluster.getClient();

      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        await client.sadd(tagKey, key);
        await client.expire(tagKey, ttl * 2); // Tags live longer
      }
    } catch (error) {
      logger.error(`Failed to store tags for key ${key}:`, error);
    }
  }

  /**
   * Remove key from all tag sets
   */
  private async removeFromTags(key: string): Promise<void> {
    try {
      const client = redisCluster.getClient();
      const tagKeys = await client.keys('cache:tag:*');

      for (const tagKey of tagKeys) {
        await client.srem(tagKey, key);
      }
    } catch (error) {
      logger.error(`Failed to remove key ${key} from tags:`, error);
    }
  }

  /**
   * Warm up cache with multiple values
   */
  async warmUp<T = any>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>
  ): Promise<number> {
    const start = Date.now();
    try {
      const promises = entries.map(entry =>
        this.set(entry.key, entry.value, entry.options)
      );

      await Promise.all(promises);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cacheWarmUp', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cacheWarmUp' }, duration);

      logger.info(`Cache warmed up with ${entries.length} entries`);
      return entries.length;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cacheWarmUp', status: 'error' });
      logger.error('Failed to warm up cache:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const cacheService = RedisCacheService.getInstance();
