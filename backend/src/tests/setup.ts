/**
 * Global Test Setup
 * Runs before all tests
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise (optional)
global.console = {
  ...console,
  log: jest.fn(), // Mock console.log
  debug: jest.fn(), // Mock console.debug
  info: jest.fn(), // Mock console.info
  warn: jest.fn(), // Keep warnings visible
  error: jest.fn(), // Keep errors visible
};

// Global test hooks
beforeAll(() => {
  // Global setup logic
});

afterAll(() => {
  // Global cleanup logic
});
