/**
 * E2E Test Setup
 * Sets up full application environment for end-to-end tests
 */

import { setupTestDatabase, cleanupTestDatabase } from './utils/test-db.setup';
import { setupTestRedis, cleanupTestRedis } from './utils/test-redis.setup';
import { setupTestKafka, cleanupTestKafka } from './utils/test-kafka.setup';

// Increase timeout for E2E tests
jest.setTimeout(60000);

beforeAll(async () => {
  // Set up full test environment
  await setupTestDatabase();
  await setupTestRedis();
  await setupTestKafka();

  // Additional E2E setup (e.g., start test server)
  console.log('E2E Test Environment Ready');
});

afterAll(async () => {
  // Clean up full test environment
  await cleanupTestKafka();
  await cleanupTestRedis();
  await cleanupTestDatabase();

  console.log('E2E Test Environment Cleaned Up');
});
