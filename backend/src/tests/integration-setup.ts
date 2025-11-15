/**
 * Integration Test Setup
 * Sets up real database connections for integration tests
 */

import { setupTestDatabase, cleanupTestDatabase } from './utils/test-db.setup';
import { setupTestRedis, cleanupTestRedis } from './utils/test-redis.setup';
import { setupTestKafka, cleanupTestKafka } from './utils/test-kafka.setup';

beforeAll(async () => {
  // Set up test database
  await setupTestDatabase();

  // Set up test Redis
  await setupTestRedis();

  // Set up test Kafka
  await setupTestKafka();
});

afterAll(async () => {
  // Clean up in reverse order
  await cleanupTestKafka();
  await cleanupTestRedis();
  await cleanupTestDatabase();
});

// Clean up between tests
afterEach(async () => {
  // Clear Redis cache between tests
  const { getTestRedis } = require('./utils/test-redis.setup');
  const redis = getTestRedis();
  if (redis) {
    await redis.flushdb();
  }
});
