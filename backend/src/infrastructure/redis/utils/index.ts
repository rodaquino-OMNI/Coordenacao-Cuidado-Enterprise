/**
 * Redis Utilities - Barrel Export
 *
 * Centralizes exports for Redis utility modules
 */

export {
  getRedisClientOrThrow,
  getRedisClientSafe,
  withRedisClient,
  withRedisClientBatch,
  ifRedisAvailable,
  checkRedisHealth,
  RedisClientGuardError,
  type RedisHealthStatus,
} from './client-guard';
