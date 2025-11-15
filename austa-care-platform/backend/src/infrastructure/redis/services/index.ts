/**
 * Redis Services
 *
 * Specialized Redis services for the AUSTA Care Platform:
 * - Session Management
 * - Caching with tag-based invalidation
 * - Rate Limiting (multiple strategies)
 * - Conversation Context for AI chat
 */

export { RedisSessionService, sessionService, SessionData, SessionOptions } from './session.service';
export { RedisCacheService, cacheService, CacheOptions, CacheStats } from './cache.service';
export {
  RedisRateLimiterService,
  rateLimiterService,
  RateLimitConfig,
  RateLimitResult,
  RateLimitStrategy,
} from './rate-limiter.service';
export {
  RedisConversationContextService,
  conversationContextService,
  Message,
  ConversationContext,
  ConversationOptions,
} from './conversation-context.service';
