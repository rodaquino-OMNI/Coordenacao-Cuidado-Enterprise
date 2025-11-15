import { redisCluster } from '../redis.cluster';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';

export interface SessionData {
  userId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, any>;
}

export interface SessionOptions {
  ttl?: number; // Time to live in seconds (default: 30 minutes)
  slidingExpiration?: boolean; // Auto-extend on activity
  maxSessions?: number; // Max sessions per user
}

export class RedisSessionService {
  private static instance: RedisSessionService;
  private readonly defaultTTL = 1800; // 30 minutes
  private readonly defaultMaxSessions = 5;

  private constructor() {}

  static getInstance(): RedisSessionService {
    if (!RedisSessionService.instance) {
      RedisSessionService.instance = new RedisSessionService();
    }
    return RedisSessionService.instance;
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    data: SessionData,
    options: SessionOptions = {}
  ): Promise<void> {
    const start = Date.now();
    try {
      const ttl = options.ttl || this.defaultTTL;
      const sessionData: SessionData = {
        ...data,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      // Store session data
      await redisCluster.setSession(sessionId, sessionData, ttl);

      // Add to user's session list
      const userSessionsKey = `user:sessions:${data.userId}`;
      await redisCluster.getClient().zadd(userSessionsKey, Date.now(), sessionId);
      await redisCluster.getClient().expire(userSessionsKey, ttl * 2);

      // Enforce max sessions per user
      if (options.maxSessions) {
        await this.enforceMaxSessions(data.userId, options.maxSessions);
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'createSession', status: 'success' });
      metrics.redisLatency.observe({ operation: 'createSession' }, duration);

      logger.debug(`Session created: ${sessionId} for user ${data.userId}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'createSession', status: 'error' });
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string, updateActivity = true): Promise<SessionData | null> {
    const start = Date.now();
    try {
      const data = await redisCluster.getSession(sessionId);

      if (!data) {
        metrics.redisOperations.inc({ operation: 'getSession', status: 'miss' });
        return null;
      }

      // Update last activity timestamp
      if (updateActivity) {
        data.lastActivity = Date.now();
        const ttl = await redisCluster.getClient().ttl(`session:${sessionId}`);
        if (ttl > 0) {
          await redisCluster.setSession(sessionId, data, ttl);
        }
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'getSession', status: 'hit' });
      metrics.redisLatency.observe({ operation: 'getSession' }, duration);

      return data;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'getSession', status: 'error' });
      logger.error('Failed to get session:', error);
      throw error;
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const start = Date.now();
    try {
      const existing = await this.getSession(sessionId, false);

      if (!existing) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const updated = {
        ...existing,
        ...updates,
        lastActivity: Date.now(),
      };

      const ttl = await redisCluster.getClient().ttl(`session:${sessionId}`);
      await redisCluster.setSession(sessionId, updated, ttl > 0 ? ttl : this.defaultTTL);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'updateSession', status: 'success' });
      metrics.redisLatency.observe({ operation: 'updateSession' }, duration);

      logger.debug(`Session updated: ${sessionId}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'updateSession', status: 'error' });
      logger.error('Failed to update session:', error);
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const start = Date.now();
    try {
      const session = await this.getSession(sessionId, false);

      if (session) {
        // Remove from user's session list
        const userSessionsKey = `user:sessions:${session.userId}`;
        await redisCluster.getClient().zrem(userSessionsKey, sessionId);
      }

      await redisCluster.deleteSession(sessionId);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'deleteSession', status: 'success' });
      metrics.redisLatency.observe({ operation: 'deleteSession' }, duration);

      logger.debug(`Session deleted: ${sessionId}`);
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'deleteSession', status: 'error' });
      logger.error('Failed to delete session:', error);
      throw error;
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string, additionalSeconds = 1800): Promise<boolean> {
    const start = Date.now();
    try {
      const currentTTL = await redisCluster.getClient().ttl(`session:${sessionId}`);

      if (currentTTL < 0) {
        metrics.redisOperations.inc({ operation: 'extendSession', status: 'notfound' });
        return false;
      }

      const newTTL = currentTTL + additionalSeconds;
      const result = await redisCluster.extendSession(sessionId, newTTL);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'extendSession', status: 'success' });
      metrics.redisLatency.observe({ operation: 'extendSession' }, duration);

      return result;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'extendSession', status: 'error' });
      logger.error('Failed to extend session:', error);
      throw error;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const start = Date.now();
    try {
      const userSessionsKey = `user:sessions:${userId}`;
      const sessionIds = await redisCluster.getClient().zrange(userSessionsKey, 0, -1);

      const sessions: SessionData[] = [];

      for (const sessionId of sessionIds) {
        const data = await this.getSession(sessionId, false);
        if (data) {
          sessions.push(data);
        }
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'getUserSessions', status: 'success' });
      metrics.redisLatency.observe({ operation: 'getUserSessions' }, duration);

      return sessions;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'getUserSessions', status: 'error' });
      logger.error('Failed to get user sessions:', error);
      throw error;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    const start = Date.now();
    try {
      const sessions = await this.getUserSessions(userId);

      for (const session of sessions) {
        const sessionId = await this.findSessionId(userId, session.deviceId);
        if (sessionId) {
          await this.deleteSession(sessionId);
        }
      }

      // Clear user sessions list
      const userSessionsKey = `user:sessions:${userId}`;
      await redisCluster.getClient().del(userSessionsKey);

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'deleteUserSessions', status: 'success' });
      metrics.redisLatency.observe({ operation: 'deleteUserSessions' }, duration);

      logger.info(`Deleted ${sessions.length} sessions for user ${userId}`);
      return sessions.length;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'deleteUserSessions', status: 'error' });
      logger.error('Failed to delete user sessions:', error);
      throw error;
    }
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceMaxSessions(userId: string, maxSessions: number): Promise<void> {
    try {
      const userSessionsKey = `user:sessions:${userId}`;
      const count = await redisCluster.getClient().zcard(userSessionsKey);

      if (count > maxSessions) {
        // Remove oldest sessions
        const toRemove = count - maxSessions;
        const oldest = await redisCluster.getClient().zrange(userSessionsKey, 0, toRemove - 1);

        for (const sessionId of oldest) {
          await this.deleteSession(sessionId);
        }

        logger.info(`Enforced max sessions for user ${userId}: removed ${toRemove} old sessions`);
      }
    } catch (error) {
      logger.error('Failed to enforce max sessions:', error);
    }
  }

  /**
   * Find session ID by user and device
   */
  private async findSessionId(userId: string, deviceId?: string): Promise<string | null> {
    try {
      const userSessionsKey = `user:sessions:${userId}`;
      const sessionIds = await redisCluster.getClient().zrange(userSessionsKey, 0, -1);

      for (const sessionId of sessionIds) {
        const data = await this.getSession(sessionId, false);
        if (data && (!deviceId || data.deviceId === deviceId)) {
          return sessionId;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find session ID:', error);
      return null;
    }
  }

  /**
   * Get session count for a user
   */
  async getSessionCount(userId: string): Promise<number> {
    try {
      const userSessionsKey = `user:sessions:${userId}`;
      return await redisCluster.getClient().zcard(userSessionsKey);
    } catch (error) {
      logger.error('Failed to get session count:', error);
      return 0;
    }
  }

  /**
   * Cleanup expired sessions (should be called periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const start = Date.now();
    try {
      const pattern = 'user:sessions:*';
      const client = redisCluster.getClient();
      let cleaned = 0;

      const keys = await client.keys(pattern);

      for (const key of keys) {
        const sessionIds = await client.zrange(key, 0, -1);

        for (const sessionId of sessionIds) {
          const exists = await client.exists(`session:${sessionId}`);
          if (!exists) {
            await client.zrem(key, sessionId);
            cleaned++;
          }
        }
      }

      const duration = (Date.now() - start) / 1000;
      metrics.redisOperations.inc({ operation: 'cleanupSessions', status: 'success' });
      metrics.redisLatency.observe({ operation: 'cleanupSessions' }, duration);

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired session references`);
      }

      return cleaned;
    } catch (error) {
      metrics.redisOperations.inc({ operation: 'cleanupSessions', status: 'error' });
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const sessionService = RedisSessionService.getInstance();
