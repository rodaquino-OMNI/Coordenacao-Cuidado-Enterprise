/**
 * Test Redis Setup Utilities
 * Provides isolated Redis instance for testing
 */

import Redis from 'ioredis';

let testRedis: Redis | null = null;

/**
 * Creates and initializes test Redis connection
 */
export async function setupTestRedis(): Promise<Redis> {
  const config = {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
    db: parseInt(process.env.TEST_REDIS_DB || '1'), // Use separate DB for tests
    password: process.env.TEST_REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  testRedis = new Redis(config);

  try {
    // Test connection
    await testRedis.ping();

    // Clear test database
    await testRedis.flushdb();

    console.log('Test Redis connected and ready');
    return testRedis;
  } catch (error) {
    console.error('Failed to setup test Redis:', error);
    throw error;
  }
}

/**
 * Cleans up test Redis connection
 */
export async function cleanupTestRedis(): Promise<void> {
  if (testRedis) {
    // Clear all test data
    await testRedis.flushdb();

    // Disconnect
    await testRedis.quit();
    testRedis = null;

    console.log('Test Redis cleaned up');
  }
}

/**
 * Gets test Redis instance
 */
export function getTestRedis(): Redis | null {
  return testRedis;
}

/**
 * Clears all data from test Redis
 */
export async function clearTestRedis(): Promise<void> {
  if (!testRedis) {
    throw new Error('Test Redis not initialized');
  }

  await testRedis.flushdb();
}

/**
 * Seeds test Redis with fixture data
 */
export async function seedTestRedis(fixtures: Record<string, any>): Promise<void> {
  if (!testRedis) {
    throw new Error('Test Redis not initialized');
  }

  const pipeline = testRedis.pipeline();

  for (const [key, value] of Object.entries(fixtures)) {
    if (typeof value === 'string') {
      pipeline.set(key, value);
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        pipeline.lpush(key, ...value);
      } else {
        pipeline.hmset(key, value);
      }
    }
  }

  await pipeline.exec();
}

/**
 * Mock Redis for unit tests
 */
export class MockRedis {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => this.store.has(key)).length;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return this.store.has(key) ? -1 : -2;
  }

  async flushdb(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }
}

/**
 * Creates a mock Redis instance for unit tests
 */
export function createMockRedis(): MockRedis {
  return new MockRedis();
}
