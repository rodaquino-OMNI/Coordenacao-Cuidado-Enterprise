import Redis, { Cluster, ClusterOptions } from 'ioredis';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';
import { metrics } from '../monitoring/prometheus.metrics';

export interface RedisClusterConfig {
  nodes: Array<{ host: string; port: number }>;
  options?: ClusterOptions;
}

export class RedisClusterClient {
  private static instance: RedisClusterClient;
  private cluster: Cluster | null = null;
  private standalone: Redis | null = null;
  private isClusterMode: boolean;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isAvailable: boolean = false;

  private constructor() {
    this.isClusterMode = config.redis?.cluster?.enabled || false;
  }

  static getInstance(): RedisClusterClient {
    if (!RedisClusterClient.instance) {
      RedisClusterClient.instance = new RedisClusterClient();
    }
    return RedisClusterClient.instance;
  }

  // Initialize Redis connection (non-blocking, graceful degradation)
  async connect(): Promise<void> {
    try {
      if (this.isClusterMode) {
        await this.connectCluster();
      } else {
        await this.connectStandalone();
      }

      logger.info('✅ Redis connection established successfully');
      this.isAvailable = true;
      this.setupEventHandlers();
    } catch (error) {
      logger.warn('⚠️  Redis unavailable - server will operate in degraded mode (no caching):', error instanceof Error ? error.message : error);
      this.isAvailable = false;
      this.cluster = null;
      this.standalone = null;
      // DON'T throw - allow server to continue without Redis
    }
  }

  // Connect to Redis cluster
  private async connectCluster(): Promise<void> {
    const clusterConfig: RedisClusterConfig = {
      nodes: config.redis?.cluster?.nodes || [
        { host: 'localhost', port: 7000 },
        { host: 'localhost', port: 7001 },
        { host: 'localhost', port: 7002 },
      ],
      options: {
        enableReadyCheck: true,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        slotsRefreshTimeout: 2000,
        clusterRetryStrategy: (times: number) => {
          if (times > this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached for Redis cluster');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        redisOptions: {
          connectTimeout: 10000,
          commandTimeout: 5000,
          keepAlive: 10000,
        },
      },
    };

    this.cluster = new Redis.Cluster(clusterConfig.nodes, clusterConfig.options);
    
    // Wait for cluster to be ready
    await new Promise<void>((resolve, reject) => {
      this.cluster!.once('ready', resolve);
      this.cluster!.once('error', reject);
    });
  }

  // Connect to standalone Redis (with timeout for faster failure)
  private async connectStandalone(): Promise<void> {
    // Parse Redis URL if provided, otherwise use defaults
    const redisUrl = config.redis?.url || 'redis://localhost:6379';

    this.standalone = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.warn('Redis connection failed after 3 attempts, operating without cache');
          this.isAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
      maxRetriesPerRequest: 3,
      connectTimeout: 3000, // Reduced from 10s to 3s for faster failure detection
      commandTimeout: 5000,
      keepAlive: 10000,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    // Wait for connection with timeout
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        this.standalone!.once('ready', resolve);
        this.standalone!.once('error', reject);
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout after 3s')), 3000)
      )
    ]);
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    if (!this.isAvailable) {
      return; // Skip if Redis is not available
    }

    const client = this.getClient();

    client.on('error', (error: Error) => {
      logger.warn('Redis error (operating in degraded mode):', error.message);
      this.isAvailable = false;
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
      this.reconnectAttempts = 0;
      this.isAvailable = true;
    });

    client.on('reconnecting', () => {
      this.reconnectAttempts++;
      logger.warn(`Redis client reconnecting (attempt ${this.reconnectAttempts})`);
      this.isAvailable = false;
    });

    client.on('end', () => {
      logger.warn('Redis client connection ended - operating without cache');
      this.isAvailable = false;
    });

    if (this.cluster) {
      this.cluster.on('node error', (error: Error, node: string) => {
        logger.warn(`Redis cluster node error (${node}):`, error.message);
      });
    }
  }

  // Get the active Redis client (returns null if unavailable)
  getClient(): Redis | Cluster | null {
    if (!this.isAvailable) {
      return null;
    }
    if (this.isClusterMode && this.cluster) {
      return this.cluster;
    } else if (this.standalone) {
      return this.standalone;
    }
    return null;
  }

  // Check if Redis is available
  isRedisAvailable(): boolean {
    return this.isAvailable && (this.cluster !== null || this.standalone !== null);
  }

  // Session management methods (with graceful degradation)
  async setSession(sessionId: string, data: any, ttl: number = 1800): Promise<void> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - session not cached: ${sessionId}`);
      return; // Graceful fallback - rely on JWT tokens only
    }

    try {
      const key = `session:${sessionId}`;
      const value = JSON.stringify(data);
      await client.setex(key, ttl, value);
      logger.debug(`Session stored: ${sessionId}`);
    } catch (error) {
      logger.warn(`Failed to store session ${sessionId}:`, error);
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - session cache miss: ${sessionId}`);
      return null; // Graceful fallback
    }

    try {
      const key = `session:${sessionId}`;
      const value = await client.get(key);

      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      logger.warn(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - session deletion skipped: ${sessionId}`);
      return;
    }

    try {
      const key = `session:${sessionId}`;
      await client.del(key);
      logger.debug(`Session deleted: ${sessionId}`);
    } catch (error) {
      logger.warn(`Failed to delete session ${sessionId}:`, error);
    }
  }

  async extendSession(sessionId: string, ttl: number = 1800): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - session extension skipped: ${sessionId}`);
      return false;
    }

    try {
      const key = `session:${sessionId}`;
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.warn(`Failed to extend session ${sessionId}:`, error);
      return false;
    }
  }

  // Cache management methods (with graceful degradation)
  async setCache(key: string, value: any, ttl?: number): Promise<void> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - cache set skipped: ${key}`);
      return;
    }

    try {
      const cacheKey = `cache:${key}`;
      const data = JSON.stringify(value);

      if (ttl) {
        await client.setex(cacheKey, ttl, data);
      } else {
        await client.set(cacheKey, data);
      }
    } catch (error) {
      logger.warn(`Failed to set cache ${key}:`, error);
    }
  }

  async getCache<T = any>(key: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - cache miss: ${key}`);
      return null;
    }

    try {
      const cacheKey = `cache:${key}`;
      const value = await client.get(cacheKey);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn(`Failed to get cache ${key}:`, error);
      return null;
    }
  }

  async deleteCache(key: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - cache deletion skipped: ${key}`);
      return;
    }

    try {
      const cacheKey = `cache:${key}`;
      await client.del(cacheKey);
    } catch (error) {
      logger.warn(`Failed to delete cache ${key}:`, error);
    }
  }

  async clearCachePattern(pattern: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      logger.debug(`Redis unavailable - cache pattern clear skipped: ${pattern}`);
      return;
    }

    try {
      if (this.isClusterMode) {
        // For cluster mode, we need to run the command on all nodes
        const nodes = (client as Cluster).nodes('master');
        const promises = nodes.map(async (node) => {
          const keys = await node.keys(`cache:${pattern}`);
          if (keys.length > 0) {
            await node.del(...keys);
          }
        });
        await Promise.all(promises);
      } else {
        const keys = await client.keys(`cache:${pattern}`);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      }
    } catch (error) {
      logger.warn(`Failed to clear cache pattern ${pattern}:`, error);
    }
  }

  // Rate limiting methods
  async checkRateLimit(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const rateLimitKey = `rate:${key}`;
    const now = Date.now();
    const windowStart = now - window * 1000;

    const client = this.getClient();
    
    // Use sliding window rate limiting
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(rateLimitKey, '-inf', windowStart);
    pipeline.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
    pipeline.zcard(rateLimitKey);
    pipeline.expire(rateLimitKey, window);
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Rate limit check failed');
    }
    
    const count = results[2][1] as number;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = now + window * 1000;
    
    return { allowed, remaining, resetAt };
  }

  // Distributed lock methods
  async acquireLock(resource: string, ttl: number = 10000): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const lockId = `${Date.now()}-${Math.random()}`;
    
    const result = await this.getClient().set(lockKey, lockId, 'PX', ttl, 'NX');
    
    if (result === 'OK') {
      return lockId;
    }
    
    return null;
  }

  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await this.getClient().eval(script, 1, lockKey, lockId) as number;
    return result === 1;
  }

  // Real-time metrics
  async incrementCounter(key: string, value: number = 1): Promise<number> {
    const metricsKey = `metrics:${key}`;
    return await this.getClient().incrby(metricsKey, value);
  }

  async getCounter(key: string): Promise<number> {
    const metricsKey = `metrics:${key}`;
    const value = await this.getClient().get(metricsKey);
    return value ? parseInt(value, 10) : 0;
  }

  async recordMetric(key: string, value: number, timestamp?: number): Promise<void> {
    const metricsKey = `metrics:timeseries:${key}`;
    const ts = timestamp || Date.now();
    
    await this.getClient().zadd(metricsKey, ts, `${ts}:${value}`);
    
    // Keep only last 24 hours of data
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    await this.getClient().zremrangebyscore(metricsKey, '-inf', dayAgo);
  }

  // Pub/Sub methods
  async publish(channel: string, message: any): Promise<number> {
    const start = Date.now();
    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      const result = await this.getClient().publish(channel, data);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'publish', status: 'success' });
      metrics.redisLatency.observe({ operation: 'publish' }, duration);

      logger.debug(`Published to channel ${channel}: ${result} subscribers`);
      return result;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'publish', status: 'error' });
      logger.error(`Failed to publish to channel ${channel}:`, error);
      throw error;
    }
  }

  async subscribe(channel: string, handler: (message: string, channel: string) => void): Promise<void> {
    try {
      const subscriber = this.isClusterMode ?
        new Redis.Cluster((this.cluster as Cluster).nodes('master').map(node => ({
          host: node.options.host || 'localhost',
          port: node.options.port || 6379
        }))) :
        new Redis(config.redis?.url || 'redis://localhost:6379');

      await subscriber.subscribe(channel);

      subscriber.on('message', (ch, msg) => {
        if (ch === channel) {
          metrics.redisOperations.inc({ operation: 'receive', status: 'success' });
          handler(msg, ch);
        }
      });

      subscriber.on('error', (error) => {
        logger.error(`Subscription error for channel ${channel}:`, error);
        metrics.redisOperations.inc({ operation: 'receive', status: 'error' });
      });

      logger.info(`Subscribed to channel: ${channel}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'subscribe', status: 'error' });
      logger.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }

  async psubscribe(pattern: string, handler: (message: string, channel: string) => void): Promise<void> {
    try {
      const subscriber = this.isClusterMode ?
        new Redis.Cluster((this.cluster as Cluster).nodes('master').map(node => ({
          host: node.options.host || 'localhost',
          port: node.options.port || 6379
        }))) :
        new Redis(config.redis?.url || 'redis://localhost:6379');

      await subscriber.psubscribe(pattern);

      subscriber.on('pmessage', (pat, ch, msg) => {
        if (pat === pattern) {
          metrics.redisOperations.inc({ operation: 'receive', status: 'success' });
          handler(msg, ch);
        }
      });

      subscriber.on('error', (error) => {
        logger.error(`Pattern subscription error for ${pattern}:`, error);
        metrics.redisOperations.inc({ operation: 'receive', status: 'error' });
      });

      logger.info(`Subscribed to pattern: ${pattern}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'psubscribe', status: 'error' });
      logger.error(`Failed to subscribe to pattern ${pattern}:`, error);
      throw error;
    }
  }

  // Enhanced methods with metrics
  private async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = (Date.now() - start) / 1000;

      metrics.redisOperations.inc({ operation, status: 'success' });
      metrics.redisLatency.observe({ operation }, duration);

      return result;
    } catch (error) {
      metrics.redisOperations.inc({ operation, status: 'error' });
      throw error;
    }
  }

  // Enhanced session methods with metrics
  async setSessionWithMetrics(sessionId: string, data: any, ttl: number = 1800): Promise<void> {
    return this.executeWithMetrics('setSession', () => this.setSession(sessionId, data, ttl));
  }

  async getSessionWithMetrics(sessionId: string): Promise<any | null> {
    return this.executeWithMetrics('getSession', () => this.getSession(sessionId));
  }

  // Enhanced cache methods with metrics
  async setCacheWithMetrics(key: string, value: any, ttl?: number): Promise<void> {
    return this.executeWithMetrics('setCache', () => this.setCache(key, value, ttl));
  }

  async getCacheWithMetrics<T = any>(key: string): Promise<T | null> {
    return this.executeWithMetrics('getCache', () => this.getCache<T>(key));
  }

  // Get connection pool stats
  async getPoolStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  }> {
    const client = this.getClient();

    if (this.isClusterMode) {
      const nodes = (client as Cluster).nodes('all');
      const stats = nodes.reduce((acc, node) => {
        const status = node.status;
        if (status === 'ready') {
          acc.activeConnections++;
        } else {
          acc.idleConnections++;
        }
        acc.totalConnections++;
        return acc;
      }, { totalConnections: 0, activeConnections: 0, idleConnections: 0 });

      return stats;
    } else {
      return {
        totalConnections: 1,
        activeConnections: (client as Redis).status === 'ready' ? 1 : 0,
        idleConnections: (client as Redis).status === 'ready' ? 0 : 1,
      };
    }
  }

  // Get Redis info
  async getInfo(): Promise<{ [key: string]: string }> {
    const start = Date.now();
    try {
      const info = await this.getClient().info();
      const duration = (Date.now() - start) / 1000;

      metrics.redisOperations.inc({ operation: 'info', status: 'success' });
      metrics.redisLatency.observe({ operation: 'info' }, duration);

      // Parse info string into object
      const lines = info.split('\r\n');
      const result: { [key: string]: string } = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key.trim()] = value.trim();
          }
        }
      }

      return result;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'info', status: 'error' });
      logger.error('Failed to get Redis info:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      await client.ping();
      return true;
    } catch (error) {
      logger.warn('Redis health check failed:', error);
      this.isAvailable = false;
      return false;
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    if (this.cluster) {
      await this.cluster.quit();
      this.cluster = null;
    }

    if (this.standalone) {
      await this.standalone.quit();
      this.standalone = null;
    }

    logger.info('Redis connection closed');
  }
}

// Export singleton instance
export const redisCluster = RedisClusterClient.getInstance();