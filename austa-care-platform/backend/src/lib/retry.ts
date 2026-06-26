/**
 * Retry Utility Library
 * Generic exponential backoff retry for async operations.
 * Used by WhatsApp (Z-API), notifications, and gamification services.
 */

import { logger } from '../utils/logger';

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2 = exponential) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delay (default: true) */
  jitter?: boolean;
  /** Operation name for logging */
  operationName?: string;
  /** Custom retry condition (return false to stop retrying) */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTimeMs: number;
}

/**
 * Default retry condition: retry on server errors (5xx), network errors, and rate limits (429).
 * Does NOT retry on client errors (4xx except 429).
 */
export function defaultShouldRetry(error: any, _attempt: number): boolean {
  // Network/timeout errors (no response)
  if (!error.response && !error.status) {
    return true;
  }

  // Rate limiting (429)
  const status = error.response?.status || error.status;
  if (status === 429) {
    return true;
  }

  // Server errors (5xx)
  if (status >= 500) {
    return true;
  }

  // Don't retry on client errors (4xx except 429)
  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 *
 * Strategy:
 * - Attempt 1: initialDelay (e.g., 1000ms)
 * - Attempt 2: initialDelay * multiplier (e.g., 2000ms)
 * - Attempt 3: initialDelay * multiplier^2 (e.g., 4000ms)
 * - Capped at maxDelayMs
 * - Optional jitter: ±25% random variation to prevent thundering herd
 */
export function calculateBackoff(
  attempt: number,
  initialDelayMs: number,
  multiplier: number,
  maxDelayMs: number,
  jitter: boolean
): number {
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  if (!jitter) {
    return cappedDelay;
  }

  // Add ±25% jitter to prevent thundering herd
  const jitterRange = cappedDelay * 0.25;
  const jitterAmount = Math.random() * jitterRange * 2 - jitterRange;
  return Math.max(0, Math.round(cappedDelay + jitterAmount));
}

/**
 * Execute an async operation with retry and exponential backoff.
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   { operationName: 'fetchData', maxAttempts: 5 }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitter = true,
    operationName = 'operation',
    shouldRetry = defaultShouldRetry,
  } = options;

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();

      const totalTimeMs = Date.now() - startTime;

      if (attempt > 1) {
        logger.info(`${operationName} succeeded after ${attempt} attempts`, {
          attempts: attempt,
          totalTimeMs,
        });
      }

      return { result, attempts: attempt, totalTimeMs };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const canRetry = shouldRetry(lastError, attempt);

      if (!canRetry || attempt >= maxAttempts) {
        logger.error(`${operationName} failed permanently`, {
          attempt,
          maxAttempts,
          error: lastError.message,
          stack: lastError.stack,
        });
        throw lastError;
      }

      const delay = calculateBackoff(
        attempt,
        initialDelayMs,
        backoffMultiplier,
        maxDelayMs,
        jitter
      );

      logger.warn(`${operationName} attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        attempt,
        nextRetryMs: delay,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript requires it
  throw lastError!;
}

/**
 * Execute with retry, returning just the result (without metadata).
 * Convenience wrapper for most use cases.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { result } = await retryWithBackoff(operation, options);
  return result;
}

/**
 * Check response for success/error patterns.
 * Used to decide if a technically-successful HTTP response should be treated as an error.
 */
export function isApiError(response: any): boolean {
  if (response?.data?.status === 'error') {
    return true;
  }
  if (response?.data?.error) {
    return true;
  }
  if (response?.error) {
    return true;
  }
  return false;
}
