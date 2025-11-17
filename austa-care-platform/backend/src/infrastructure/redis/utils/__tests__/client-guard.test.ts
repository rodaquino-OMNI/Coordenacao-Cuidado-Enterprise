/**
 * Redis Client Guard Utilities - Unit Tests
 *
 * Comprehensive test suite for Redis client access patterns
 * Tests all guard functions and error handling scenarios
 */

import { Cluster } from 'ioredis';
import {
  getRedisClientOrThrow,
  getRedisClientSafe,
  withRedisClient,
  withRedisClientBatch,
  ifRedisAvailable,
  checkRedisHealth,
  RedisClientGuardError,
} from '../client-guard';
import { redisCluster } from '../../redis.cluster';

// Mock the redis cluster
jest.mock('../../redis.cluster', () => ({
  redisCluster: {
    getClient: jest.fn(),
    isClusterConnected: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Redis Client Guard Utilities', () => {
  let mockClient: Partial<Cluster>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client
    mockClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
    };
  });

  describe('getRedisClientOrThrow', () => {
    it('should return client when available', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);

      const client = getRedisClientOrThrow();

      expect(client).toBe(mockClient);
    });

    it('should throw RedisClientGuardError when client unavailable', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(false);

      expect(() => getRedisClientOrThrow()).toThrow(RedisClientGuardError);
    });

    it('should include context in error', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(false);

      try {
        getRedisClientOrThrow();
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(RedisClientGuardError);
        if (error instanceof RedisClientGuardError) {
          expect(error.code).toBe('REDIS_CLIENT_UNAVAILABLE');
          expect(error.context).toBeDefined();
          expect(error.context?.isConnected).toBe(false);
        }
      }
    });

    it('should have proper error name and message', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);

      try {
        getRedisClientOrThrow();
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.name).toBe('RedisClientGuardError');
          expect(error.message).toContain('Redis client unavailable');
        }
      }
    });
  });

  describe('getRedisClientSafe', () => {
    it('should return client when available', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);

      const client = getRedisClientSafe();

      expect(client).toBe(mockClient);
    });

    it('should return null when client unavailable', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);

      const client = getRedisClientSafe();

      expect(client).toBeNull();
    });

    it('should not throw error when client unavailable', () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);

      expect(() => getRedisClientSafe()).not.toThrow();
    });
  });

  describe('withRedisClient', () => {
    it('should execute operation when client available', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      const mockOperation = jest.fn().mockResolvedValue('result');

      const result = await withRedisClient(mockOperation);

      expect(mockOperation).toHaveBeenCalledWith(mockClient);
      expect(result).toBe('result');
    });

    it('should use fallback when client unavailable', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      const mockOperation = jest.fn();
      const mockFallback = jest.fn().mockResolvedValue('fallback-result');

      const result = await withRedisClient(mockOperation, mockFallback);

      expect(mockOperation).not.toHaveBeenCalled();
      expect(mockFallback).toHaveBeenCalled();
      expect(result).toBe('fallback-result');
    });

    it('should throw when client unavailable and no fallback', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(false);
      const mockOperation = jest.fn();

      await expect(withRedisClient(mockOperation)).rejects.toThrow(
        RedisClientGuardError
      );
    });

    it('should use fallback when operation fails', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      const error = new Error('Redis operation failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      const mockFallback = jest.fn().mockResolvedValue('fallback-result');

      const result = await withRedisClient(mockOperation, mockFallback);

      expect(mockOperation).toHaveBeenCalledWith(mockClient);
      expect(mockFallback).toHaveBeenCalled();
      expect(result).toBe('fallback-result');
    });

    it('should throw operation error when no fallback provided', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      const error = new Error('Redis operation failed');
      const mockOperation = jest.fn().mockRejectedValue(error);

      await expect(withRedisClient(mockOperation)).rejects.toThrow(error);
    });
  });

  describe('withRedisClientBatch', () => {
    it('should execute all operations in parallel', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);

      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockResolvedValue('result2');
      const operation3 = jest.fn().mockResolvedValue('result3');

      const results = await withRedisClientBatch([
        operation1,
        operation2,
        operation3,
      ]);

      expect(operation1).toHaveBeenCalledWith(mockClient);
      expect(operation2).toHaveBeenCalledWith(mockClient);
      expect(operation3).toHaveBeenCalledWith(mockClient);
      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should throw when client unavailable', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(false);

      const operations = [jest.fn(), jest.fn()];

      await expect(withRedisClientBatch(operations)).rejects.toThrow(
        RedisClientGuardError
      );
    });

    it('should fail all if one operation fails', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);

      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockRejectedValue(new Error('Failed'));
      const operation3 = jest.fn().mockResolvedValue('result3');

      await expect(
        withRedisClientBatch([operation1, operation2, operation3])
      ).rejects.toThrow('Failed');
    });
  });

  describe('ifRedisAvailable', () => {
    it('should execute operation when Redis available', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      const mockOperation = jest.fn().mockResolvedValue('result');

      const result = await ifRedisAvailable(mockOperation);

      expect(mockOperation).toHaveBeenCalledWith(mockClient);
      expect(result).toBe('result');
    });

    it('should return undefined when Redis unavailable', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      const mockOperation = jest.fn();

      const result = await ifRedisAvailable(mockOperation);

      expect(mockOperation).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should return undefined when operation fails', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      const mockOperation = jest.fn().mockRejectedValue(new Error('Failed'));

      const result = await ifRedisAvailable(mockOperation);

      expect(result).toBeUndefined();
    });

    it('should not throw errors', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      const mockOperation = jest.fn().mockRejectedValue(new Error('Failed'));

      await expect(ifRedisAvailable(mockOperation)).resolves.not.toThrow();
    });
  });

  describe('checkRedisHealth', () => {
    it('should return healthy status when Redis available and responsive', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(mockClient);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(true);

      const health = await checkRedisHealth();

      expect(health.isHealthy).toBe(true);
      expect(health.hasClient).toBe(true);
      expect(health.isConnected).toBe(true);
      expect(health.timestamp).toBeDefined();
      expect(health.error).toBeUndefined();
    });

    it('should return unhealthy when client not initialized', async () => {
      (redisCluster.getClient as jest.Mock).mockReturnValue(null);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(false);

      const health = await checkRedisHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.hasClient).toBe(false);
      expect(health.isConnected).toBe(false);
      expect(health.error).toBe('Redis client not initialized');
    });

    it('should return unhealthy when ping fails', async () => {
      const failingClient = {
        ...mockClient,
        ping: jest.fn().mockRejectedValue(new Error('Connection lost')),
      };
      (redisCluster.getClient as jest.Mock).mockReturnValue(failingClient);
      (redisCluster.isClusterConnected as jest.Mock).mockReturnValue(true);

      const health = await checkRedisHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.hasClient).toBe(true);
      expect(health.error).toBe('Connection lost');
    });
  });

  describe('RedisClientGuardError', () => {
    it('should have correct properties', () => {
      const context = { key: 'value' };
      const error = new RedisClientGuardError('Test error', context);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RedisClientGuardError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('REDIS_CLIENT_UNAVAILABLE');
      expect(error.context).toBe(context);
      expect(error.timestamp).toBeDefined();
    });

    it('should work without context', () => {
      const error = new RedisClientGuardError('Test error');

      expect(error.context).toBeUndefined();
    });

    it('should have stack trace', () => {
      const error = new RedisClientGuardError('Test error');

      expect(error.stack).toBeDefined();
    });
  });
});
