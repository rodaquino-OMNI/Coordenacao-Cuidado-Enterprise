/**
 * Redis Cluster Client
 *
 * High-performance Redis cluster client with connection pooling,
 * pub/sub support, and Prometheus metrics integration
 */

import Redis, { Cluster, ClusterNode, ClusterOptions } from 'ioredis';
import { RedisClusterOptions, RedisNode, RedisOperationResult, PubSubMessage, RedisMetrics } from './redis.types';
import { redisClusterConfig } from './redis.config';
import { logger } from '../../utils/logger';
import { Counter, Histogram, Gauge } from 'prom-client';

/**
 * Prometheus metrics for Redis operations
 */
const redisCommandsTotal = new Counter({
  name: 'redis_commands_total',
  help: 'Total number of Redis commands executed',
  labelNames: ['command', 'status'],
});

const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Redis command execution duration',
  labelNames: ['command'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

const redisConnectionsActive = new Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
});

const redisCacheHits = new Counter({
  name: 'redis_cache_hits_total',
  help: 'Total number of cache hits',
});

const redisCacheMisses = new Counter({
  name: 'redis_cache_misses_total',
  help: 'Total number of cache misses',
});

/**
 * Redis Cluster Client
 */
export class RedisCluster {
  private cluster: Cluster | null = null;
  private subscribers: Map<string, Redis> = new Map();
  private isConnected: boolean = false;
  private config: RedisClusterOptions;

  constructor(config?: Partial<RedisClusterOptions>) {
    this.config = { ...redisClusterConfig, ...config };
  }

  /**
   * Connect to Redis cluster
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Redis cluster already connected');
      return;
    }

    try {
      const clusterNodes: ClusterNode[] = this.config.nodes.map(node => ({
        host: node.host,
        port: node.port,
      }));

      const clusterOptions: ClusterOptions = {
        enableReadyCheck: this.config.enableReadyCheck,
        enableOfflineQueue: this.config.enableOfflineQueue,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        clusterRetryStrategy: this.config.clusterRetryStrategy,
        scaleReads: this.config.scaleReads || 'slave',
        redisOptions: this.config.redisOptions,
      };

      this.cluster = new Redis.Cluster(clusterNodes, clusterOptions);

      await new Promise<void>((resolve, reject) => {
        if (!this.cluster) {
          reject(new Error('Cluster not initialized'));
          return;
        }

        this.cluster.on('ready', () => {
          this.isConnected = true;
          redisConnectionsActive.inc();
          logger.info('Redis cluster connected successfully');
          resolve();
        });

        this.cluster.on('error', (err) => {
          logger.error('Redis cluster error:', err);
          if (!this.isConnected) {
            reject(err);
          }
        });

        this.cluster.on('node error', (err, address) => {
          logger.error(`Redis node error at ${address}:`, err);
        });

        this.cluster.on('reconnecting', () => {
          logger.info('Redis cluster reconnecting...');
        });
      });
    } catch (error) {
      logger.error('Failed to connect to Redis cluster:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis cluster
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      // Close all subscribers
      for (const [channel, subscriber] of this.subscribers.entries()) {
        await subscriber.quit();
        this.subscribers.delete(channel);
      }

      // Close cluster connection
      if (this.cluster) {
        await this.cluster.quit();
        this.cluster = null;
      }

      this.isConnected = false;
      redisConnectionsActive.dec();
      logger.info('Redis cluster disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis cluster:', error);
      throw error;
    }
  }

  /**
   * Execute Redis command with metrics
   */
  private async executeCommand<T>(
    command: string,
    operation: () => Promise<T>
  ): Promise<RedisOperationResult<T>> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = (Date.now() - startTime) / 1000;

      redisCommandsTotal.inc({ command, status: 'success' });
      redisCommandDuration.observe({ command }, duration);

      return { success: true, data: result };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      redisCommandsTotal.inc({ command, status: 'error' });
      redisCommandDuration.observe({ command }, duration);

      logger.error(`Redis ${command} error:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<RedisOperationResult<string | null>> {
    this.ensureConnected();

    const result = await this.executeCommand('GET', async () => {
      const value = await this.cluster!.get(key);
      if (value !== null) {
        redisCacheHits.inc();
      } else {
        redisCacheMisses.inc();
      }
      return value;
    });

    return result;
  }

  /**
   * Set key-value pair with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<RedisOperationResult<string>> {
    this.ensureConnected();

    return this.executeCommand('SET', async () => {
      if (ttl) {
        return await this.cluster!.set(key, value, 'EX', ttl);
      }
      return await this.cluster!.set(key, value);
    });
  }

  /**
   * Delete key
   */
  async del(key: string | string[]): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('DEL', async () => {
      const keys = Array.isArray(key) ? key : [key];
      return await this.cluster!.del(...keys);
    });
  }

  /**
   * Get hash field value
   */
  async hget(key: string, field: string): Promise<RedisOperationResult<string | null>> {
    this.ensureConnected();

    return this.executeCommand('HGET', async () => {
      return await this.cluster!.hget(key, field);
    });
  }

  /**
   * Get all hash fields and values
   */
  async hgetall(key: string): Promise<RedisOperationResult<Record<string, string>>> {
    this.ensureConnected();

    return this.executeCommand('HGETALL', async () => {
      return await this.cluster!.hgetall(key);
    });
  }

  /**
   * Set hash field value
   */
  async hset(key: string, field: string, value: string): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('HSET', async () => {
      return await this.cluster!.hset(key, field, value);
    });
  }

  /**
   * Set multiple hash fields
   */
  async hmset(key: string, data: Record<string, string>): Promise<RedisOperationResult<'OK'>> {
    this.ensureConnected();

    return this.executeCommand('HMSET', async () => {
      return await this.cluster!.hmset(key, data);
    });
  }

  /**
   * Delete hash field
   */
  async hdel(key: string, field: string | string[]): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('HDEL', async () => {
      const fields = Array.isArray(field) ? field : [field];
      return await this.cluster!.hdel(key, ...fields);
    });
  }

  /**
   * Increment value
   */
  async incr(key: string): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('INCR', async () => {
      return await this.cluster!.incr(key);
    });
  }

  /**
   * Increment by amount
   */
  async incrby(key: string, amount: number): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('INCRBY', async () => {
      return await this.cluster!.incrby(key, amount);
    });
  }

  /**
   * Set expiration time
   */
  async expire(key: string, seconds: number): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('EXPIRE', async () => {
      return await this.cluster!.expire(key, seconds);
    });
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<RedisOperationResult<string[]>> {
    this.ensureConnected();

    return this.executeCommand('KEYS', async () => {
      return await this.cluster!.keys(pattern);
    });
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: string): Promise<RedisOperationResult<number>> {
    this.ensureConnected();

    return this.executeCommand('PUBLISH', async () => {
      return await this.cluster!.publish(channel, message);
    });
  }

  /**
   * Subscribe to channel
   */
  async subscribe(
    channel: string,
    callback: (message: PubSubMessage) => void
  ): Promise<RedisOperationResult<void>> {
    this.ensureConnected();

    try {
      // Create dedicated subscriber connection
      const subscriber = this.cluster!.duplicate() as Redis;

      await subscriber.subscribe(channel);

      subscriber.on('message', (ch, data) => {
        callback({
          channel: ch,
          data: this.tryParseJSON(data),
          timestamp: Date.now(),
        });
      });

      this.subscribers.set(channel, subscriber);

      logger.info(`Subscribed to channel: ${channel}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to subscribe to channel ${channel}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string): Promise<RedisOperationResult<void>> {
    const subscriber = this.subscribers.get(channel);

    if (!subscriber) {
      return { success: false, error: 'Not subscribed to channel' };
    }

    try {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
      this.subscribers.delete(channel);

      logger.info(`Unsubscribed from channel: ${channel}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to unsubscribe from channel ${channel}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get Redis metrics
   */
  getMetrics(): RedisMetrics {
    // These would be populated from actual metric collection
    return {
      connections: this.isConnected ? 1 : 0,
      commands: 0, // Would need to track this
      errors: 0, // Would need to track this
      hits: 0, // Would need to track this
      misses: 0, // Would need to track this
      hitRate: 0,
      avgResponseTime: 0,
    };
  }

  /**
   * Get Redis cluster client instance
   * Returns null if not connected
   * Use client-guard utilities for safe access patterns
   */
  getClient(): Cluster | null {
    return this.cluster;
  }

  /**
   * Check if cluster is connected
   */
  isClusterConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Ensure cluster is connected
   */
  private ensureConnected(): void {
    if (!this.isConnected || !this.cluster) {
      throw new Error('Redis cluster is not connected');
    }
  }

  /**
   * Try to parse JSON, return original string if fails
   */
  private tryParseJSON(data: string): any {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
}

/**
 * Singleton instance
 */
export const redisCluster = new RedisCluster();
