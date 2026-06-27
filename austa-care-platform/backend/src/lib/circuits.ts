/**
 * Service-Specific Circuit Breakers
 *
 * Pre-configured circuit breakers for each external API service.
 * Tuned thresholds based on service criticality and expected reliability.
 */

import { CircuitBreaker } from './circuit-breaker';

/**
 * OpenAI GPT-4 circuit breaker
 * - Lower failure threshold (3): AI responses are critical, fail fast
 * - Longer reset timeout (60s): OpenAI is expensive, don't hammer it
 */
export const openaiCircuit = new CircuitBreaker({
  name: 'openai',
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
});

/**
 * Z-API WhatsApp circuit breaker
 * - Standard failure threshold (5): WhatsApp can be flaky
 * - Shorter reset timeout (30s): need to recover quickly for messaging
 */
export const zapiCircuit = new CircuitBreaker({
  name: 'zapi',
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
});

/**
 * Tasy ERP circuit breaker
 * - Standard failure threshold (5): ERP systems may have intermittent issues
 * - Longer reset timeout (60s): avoid overwhelming healthcare ERP
 */
export const tasyCircuit = new CircuitBreaker({
  name: 'tasy',
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
});
