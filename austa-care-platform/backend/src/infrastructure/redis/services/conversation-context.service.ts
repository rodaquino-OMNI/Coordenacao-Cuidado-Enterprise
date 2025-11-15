import { redisCluster } from '../redis.cluster';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  messages: Message[];
  intent?: string;
  entities?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationOptions {
  maxMessages?: number; // Max messages to keep in context
  ttl?: number; // Time to live in seconds
  summarize?: boolean; // Auto-summarize old messages
}

export class RedisConversationContextService {
  private static instance: RedisConversationContextService;
  private readonly defaultMaxMessages = 50;
  private readonly defaultTTL = 3600; // 1 hour
  private readonly summaryThreshold = 20; // Summarize after this many messages

  private constructor() {}

  static getInstance(): RedisConversationContextService {
    if (!RedisConversationContextService.instance) {
      RedisConversationContextService.instance = new RedisConversationContextService();
    }
    return RedisConversationContextService.instance;
  }

  /**
   * Create or update conversation context
   */
  async setContext(
    conversationId: string,
    context: ConversationContext,
    options: ConversationOptions = {}
  ): Promise<void> {
    const start = Date.now();
    try {
      const ttl = options.ttl || this.defaultTTL;
      const maxMessages = options.maxMessages || this.defaultMaxMessages;

      // Trim messages if needed
      if (context.messages.length > maxMessages) {
        context.messages = context.messages.slice(-maxMessages);
      }

      // Auto-summarize if enabled and threshold reached
      if (options.summarize && context.messages.length > this.summaryThreshold) {
        await this.summarizeContext(conversationId, context);
      }

      context.updatedAt = Date.now();

      const key = `conversation:context:${conversationId}`;
      await redisCluster.getClient().setex(key, ttl, JSON.stringify(context));

      // Index by user
      const userKey = `user:conversations:${context.userId}`;
      await redisCluster.getClient().zadd(userKey, Date.now(), conversationId);
      await redisCluster.getClient().expire(userKey, ttl * 2);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'setConversationContext', status: 'success' });
      metrics.redisLatency.observe({ operation: 'setConversationContext' }, duration);

      logger.debug(`Conversation context set: ${conversationId}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'setConversationContext', status: 'error' });
      logger.error('Failed to set conversation context:', error);
      throw error;
    }
  }

  /**
   * Get conversation context
   */
  async getContext(conversationId: string): Promise<ConversationContext | null> {
    const start = Date.now();
    try {
      const key = `conversation:context:${conversationId}`;
      const data = await redisCluster.getClient().get(key);

      if (!data) {
        metrics.redisOperations.inc({ operation: 'getConversationContext', status: 'miss' });
        return null;
      }

      const context: ConversationContext = JSON.parse(data);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'getConversationContext', status: 'hit' });
      metrics.redisLatency.observe({ operation: 'getConversationContext' }, duration);

      return context;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'getConversationContext', status: 'error' });
      logger.error('Failed to get conversation context:', error);
      throw error;
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string,
    message: Message,
    options: ConversationOptions = {}
  ): Promise<void> {
    const start = Date.now();
    try {
      const context = await this.getContext(conversationId);

      if (!context) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      // Add message with timestamp
      message.timestamp = Date.now();
      context.messages.push(message);

      // Update context
      await this.setContext(conversationId, context, options);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'addConversationMessage', status: 'success' });
      metrics.redisLatency.observe({ operation: 'addConversationMessage' }, duration);

      logger.debug(`Message added to conversation: ${conversationId}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'addConversationMessage', status: 'error' });
      logger.error('Failed to add message to conversation:', error);
      throw error;
    }
  }

  /**
   * Get recent messages from conversation
   */
  async getRecentMessages(conversationId: string, limit = 10): Promise<Message[]> {
    try {
      const context = await this.getContext(conversationId);

      if (!context) {
        return [];
      }

      return context.messages.slice(-limit);
    } catch (error) {
      logger.error('Failed to get recent messages:', error);
      return [];
    }
  }

  /**
   * Update conversation intent
   */
  async updateIntent(conversationId: string, intent: string): Promise<void> {
    try {
      const context = await this.getContext(conversationId);

      if (!context) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      context.intent = intent;
      await this.setContext(conversationId, context);

      logger.debug(`Intent updated for conversation: ${conversationId}`);
    } catch (error) {
      logger.error('Failed to update conversation intent:', error);
      throw error;
    }
  }

  /**
   * Update conversation entities
   */
  async updateEntities(conversationId: string, entities: Record<string, any>): Promise<void> {
    try {
      const context = await this.getContext(conversationId);

      if (!context) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      context.entities = {
        ...context.entities,
        ...entities,
      };

      await this.setContext(conversationId, context);

      logger.debug(`Entities updated for conversation: ${conversationId}`);
    } catch (error) {
      logger.error('Failed to update conversation entities:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string, limit = 10): Promise<ConversationContext[]> {
    const start = Date.now();
    try {
      const userKey = `user:conversations:${userId}`;
      const conversationIds = await redisCluster.getClient().zrevrange(userKey, 0, limit - 1);

      const conversations: ConversationContext[] = [];

      for (const conversationId of conversationIds) {
        const context = await this.getContext(conversationId);
        if (context) {
          conversations.push(context);
        }
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'getUserConversations', status: 'success' });
      metrics.redisLatency.observe({ operation: 'getUserConversations' }, duration);

      return conversations;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'getUserConversations', status: 'error' });
      logger.error('Failed to get user conversations:', error);
      throw error;
    }
  }

  /**
   * Delete conversation context
   */
  async deleteContext(conversationId: string): Promise<void> {
    const start = Date.now();
    try {
      const context = await this.getContext(conversationId);

      if (context) {
        // Remove from user index
        const userKey = `user:conversations:${context.userId}`;
        await redisCluster.getClient().zrem(userKey, conversationId);
      }

      const key = `conversation:context:${conversationId}`;
      await redisCluster.getClient().del(key);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'deleteConversationContext', status: 'success' });
      metrics.redisLatency.observe({ operation: 'deleteConversationContext' }, duration);

      logger.debug(`Conversation context deleted: ${conversationId}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'deleteConversationContext', status: 'error' });
      logger.error('Failed to delete conversation context:', error);
      throw error;
    }
  }

  /**
   * Extend conversation TTL
   */
  async extendTTL(conversationId: string, additionalSeconds = 3600): Promise<boolean> {
    try {
      const key = `conversation:context:${conversationId}`;
      const currentTTL = await redisCluster.getClient().ttl(key);

      if (currentTTL < 0) {
        return false;
      }

      const newTTL = currentTTL + additionalSeconds;
      const result = await redisCluster.getClient().expire(key, newTTL);

      logger.debug(`Extended TTL for conversation: ${conversationId}`);
      return result === 1;
    } catch (error) {
      logger.error('Failed to extend conversation TTL:', error);
      return false;
    }
  }

  /**
   * Get conversation summary
   */
  async getSummary(conversationId: string): Promise<string | null> {
    try {
      const summaryKey = `conversation:summary:${conversationId}`;
      const summary = await redisCluster.getClient().get(summaryKey);

      return summary;
    } catch (error) {
      logger.error('Failed to get conversation summary:', error);
      return null;
    }
  }

  /**
   * Set conversation summary
   */
  async setSummary(conversationId: string, summary: string, ttl = 86400): Promise<void> {
    try {
      const summaryKey = `conversation:summary:${conversationId}`;
      await redisCluster.getClient().setex(summaryKey, ttl, summary);

      logger.debug(`Summary set for conversation: ${conversationId}`);
    } catch (error) {
      logger.error('Failed to set conversation summary:', error);
      throw error;
    }
  }

  /**
   * Auto-summarize conversation context
   */
  private async summarizeContext(conversationId: string, context: ConversationContext): Promise<void> {
    try {
      // Get oldest messages to summarize
      const messagesToSummarize = context.messages.slice(0, this.summaryThreshold);

      // Create summary (this would integrate with AI service in production)
      const summary = this.createSimpleSummary(messagesToSummarize);

      // Store summary
      await this.setSummary(conversationId, summary);

      // Keep only recent messages
      context.messages = context.messages.slice(this.summaryThreshold);

      logger.debug(`Auto-summarized conversation: ${conversationId}`);
    } catch (error) {
      logger.error('Failed to auto-summarize conversation:', error);
    }
  }

  /**
   * Create simple summary (placeholder for AI integration)
   */
  private createSimpleSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;

    return `Conversation summary: ${messages.length} messages (${userMessages} user, ${assistantMessages} assistant)`;
  }

  /**
   * Cleanup expired conversations
   */
  async cleanup(): Promise<number> {
    const start = Date.now();
    try {
      const client = redisCluster.getClient();
      let cleaned = 0;

      // Cleanup user conversation indexes
      const userKeys = await client.keys('user:conversations:*');

      for (const userKey of userKeys) {
        const conversationIds = await client.zrange(userKey, 0, -1);

        for (const conversationId of conversationIds) {
          const contextKey = `conversation:context:${conversationId}`;
          const exists = await client.exists(contextKey);

          if (!exists) {
            await client.zrem(userKey, conversationId);
            cleaned++;
          }
        }
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cleanupConversations', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cleanupConversations' }, duration);

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired conversation references`);
      }

      return cleaned;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cleanupConversations', status: 'error' });
      logger.error('Failed to cleanup conversations:', error);
      return 0;
    }
  }

  /**
   * Get conversation statistics
   */
  async getStats(conversationId: string): Promise<{
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    duration: number;
    lastActivity: number;
  } | null> {
    try {
      const context = await this.getContext(conversationId);

      if (!context) {
        return null;
      }

      const userMessageCount = context.messages.filter(m => m.role === 'user').length;
      const assistantMessageCount = context.messages.filter(m => m.role === 'assistant').length;
      const duration = context.updatedAt - context.createdAt;

      return {
        messageCount: context.messages.length,
        userMessageCount,
        assistantMessageCount,
        duration,
        lastActivity: context.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get conversation stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const conversationContextService = RedisConversationContextService.getInstance();
