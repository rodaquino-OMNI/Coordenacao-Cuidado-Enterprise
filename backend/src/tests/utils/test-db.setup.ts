/**
 * Test Database Setup Utilities
 * Provides isolated PostgreSQL database for testing
 */

import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let testPool: Pool | null = null;
let testClient: PoolClient | null = null;

/**
 * Creates and initializes test database
 */
export async function setupTestDatabase(): Promise<Pool> {
  const config = {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'austa_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  testPool = new Pool(config);

  try {
    // Test connection
    testClient = await testPool.connect();

    // Run migrations (if needed)
    await runTestMigrations(testClient);

    console.log('Test database connected and ready');
    return testPool;
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Runs database migrations for tests
 */
async function runTestMigrations(client: PoolClient): Promise<void> {
  // Clear existing schema
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');

  // Grant permissions
  await client.query('GRANT ALL ON SCHEMA public TO postgres');
  await client.query('GRANT ALL ON SCHEMA public TO public');

  // Run migration files (to be created by backend developers)
  // const migrationPath = join(__dirname, '../../migrations');
  // Example: await client.query(readFileSync(join(migrationPath, '001_init.sql'), 'utf-8'));
}

/**
 * Cleans up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (testClient) {
    testClient.release();
    testClient = null;
  }

  if (testPool) {
    await testPool.end();
    testPool = null;
  }

  console.log('Test database cleaned up');
}

/**
 * Gets test database pool
 */
export function getTestPool(): Pool | null {
  return testPool;
}

/**
 * Clears all data from test database (for cleanup between tests)
 */
export async function clearTestDatabase(): Promise<void> {
  if (!testPool) {
    throw new Error('Test database not initialized');
  }

  const client = await testPool.connect();

  try {
    // Disable foreign key checks temporarily
    await client.query('SET session_replication_role = replica');

    // Get all tables
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    // Truncate all tables
    for (const row of result.rows) {
      await client.query(`TRUNCATE TABLE ${row.tablename} CASCADE`);
    }

    // Re-enable foreign key checks
    await client.query('SET session_replication_role = DEFAULT');
  } finally {
    client.release();
  }
}

/**
 * Seeds test database with fixture data
 */
export async function seedTestDatabase(fixtures: any[]): Promise<void> {
  if (!testPool) {
    throw new Error('Test database not initialized');
  }

  const client = await testPool.connect();

  try {
    await client.query('BEGIN');

    for (const fixture of fixtures) {
      // Insert fixture data
      // Implementation depends on fixture structure
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a transaction for isolated tests
 */
export async function createTestTransaction(): Promise<PoolClient> {
  if (!testPool) {
    throw new Error('Test database not initialized');
  }

  const client = await testPool.connect();
  await client.query('BEGIN');

  return client;
}

/**
 * Rolls back test transaction
 */
export async function rollbackTestTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}
