/**
 * Common Test Helpers and Utilities
 */

import { Request, Response } from 'express';
import { UserFactory, TokenFactory } from './mock-factory';

/**
 * Creates a mock Express request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    method: 'GET',
    url: '/',
    path: '/',
    get: jest.fn((header: string) => {
      return overrides.headers?.[header.toLowerCase()];
    }),
    ...overrides,
  };
}

/**
 * Creates a mock Express response object
 */
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Creates a mock next function for middleware testing
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

/**
 * Creates an authenticated request with JWT token
 */
export function createAuthenticatedRequest(
  userId: string,
  role: string = 'patient',
  overrides: Partial<Request> = {}
): Partial<Request> {
  const token = TokenFactory.createAccessToken(userId, role);

  return createMockRequest({
    headers: {
      authorization: `Bearer ${token}`,
    },
    user: {
      userId,
      role,
    },
    ...overrides,
  });
}

/**
 * Sleep helper for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Suppress console output during tests
 */
export function suppressConsole(): void {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'info').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
}

/**
 * Restore console output
 */
export function restoreConsole(): void {
  jest.restoreAllMocks();
}

/**
 * Assert error thrown with specific message
 */
export async function expectError(
  fn: () => Promise<any>,
  errorMessage?: string
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error: any) {
    if (errorMessage && !error.message.includes(errorMessage)) {
      throw new Error(`Expected error message to include "${errorMessage}", got "${error.message}"`);
    }
  }
}

/**
 * Mock Date.now() for consistent timestamps
 */
export function mockDate(timestamp: number | Date): void {
  const dateValue = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  jest.spyOn(Date, 'now').mockReturnValue(dateValue);
}

/**
 * Restore Date.now()
 */
export function restoreDate(): void {
  jest.restoreAllMocks();
}

/**
 * Create a spy that tracks calls
 */
export function createSpy<T extends (...args: any[]) => any>(
  implementation?: T
): jest.Mock<ReturnType<T>, Parameters<T>> {
  return jest.fn(implementation);
}

/**
 * Assert that a spy was called with specific arguments
 */
export function assertCalledWith(
  spy: jest.Mock,
  ...expectedArgs: any[]
): void {
  expect(spy).toHaveBeenCalledWith(...expectedArgs);
}

/**
 * Assert that a spy was called n times
 */
export function assertCalledTimes(spy: jest.Mock, times: number): void {
  expect(spy).toHaveBeenCalledTimes(times);
}

/**
 * Reset all mocks
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
}

/**
 * Create a partial mock of an object
 */
export function createPartialMock<T>(partial: Partial<T>): T {
  return partial as T;
}

/**
 * Deep clone an object for test isolation
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * Generate random number in range
 */
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Assert object matches partial
 */
export function assertObjectMatches<T extends object>(
  actual: T,
  expected: Partial<T>
): void {
  expect(actual).toMatchObject(expected);
}

/**
 * Assert array contains item
 */
export function assertArrayContains<T>(array: T[], item: T): void {
  expect(array).toContain(item);
}

/**
 * Assert array has length
 */
export function assertArrayLength<T>(array: T[], length: number): void {
  expect(array).toHaveLength(length);
}

/**
 * Mock environment variables
 */
export function mockEnv(env: Record<string, string>): void {
  Object.assign(process.env, env);
}

/**
 * Restore environment variables
 */
export function restoreEnv(keys: string[]): void {
  keys.forEach(key => delete process.env[key]);
}

/**
 * Create a timeout promise
 */
export function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
}

/**
 * Race with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([promise, timeout(ms)]);
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 100
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

/**
 * Test performance of a function
 */
export async function measurePerformance<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  return { result, duration };
}

/**
 * Assert performance meets threshold
 */
export async function assertPerformance<T>(
  fn: () => Promise<T>,
  maxDuration: number
): Promise<void> {
  const { duration } = await measurePerformance(fn);
  expect(duration).toBeLessThan(maxDuration);
}
