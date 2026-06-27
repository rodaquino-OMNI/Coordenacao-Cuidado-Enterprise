/**
 * Circuit Breaker Pattern Implementation
 *
 * Protects external API calls from cascading failures.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED or OPEN
 *
 * Healthcare invariants compliance:
 *   - INV-7: All external API calls use circuit breaker protection.
 *   - Falls back gracefully when service is unavailable.
 */

import { logger } from '../utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Human-readable name for logging (e.g., 'openai', 'zapi') */
  name: string;
  /** Consecutive failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Milliseconds before attempting half-open (default: 30000) */
  resetTimeout?: number;
  /** Successful attempts needed in half-open to close circuit (default: 3) */
  halfOpenMaxAttempts?: number;
  /** Milliseconds between health checks (default: 10000) */
  monitorInterval?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxAttempts: 3,
      monitorInterval: 10000,
      ...config,
    };
  }

  /**
   * Get current circuit state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Execute an operation with circuit breaker protection.
   *
   * - CLOSED: executes normally, tracks failures
   * - OPEN: throws immediately unless reset timeout elapsed
   * - HALF_OPEN: allows limited attempts to test recovery
   *
   * @param fn - Async operation to execute
   * @returns Result of the operation
   * @throws Error if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        logger.info(`Circuit ${this.config.name} entering HALF_OPEN`);
      } else {
        throw new Error(
          `Circuit ${this.config.name} is OPEN — service unavailable`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation.
   * In HALF_OPEN: counts toward recovery threshold.
   * In CLOSED: resets failure counter.
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      this.successCount++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(
          `Circuit ${this.config.name} CLOSED — service recovered after ${this.halfOpenAttempts} successful attempts`
        );
      }
    } else {
      // CLOSED: reset failure count on any success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed operation.
   * Transitions to OPEN when threshold is exceeded.
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      logger.warn(
        `Circuit ${this.config.name} OPEN (half-open attempt failed)`
      );
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.error(
        `Circuit ${this.config.name} OPEN after ${this.failureCount} consecutive failures`
      );
    }
  }

  /**
   * Check if enough time has elapsed since last failure to attempt reset.
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }
}
