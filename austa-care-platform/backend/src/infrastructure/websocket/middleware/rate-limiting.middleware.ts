/**
 * WebSocket Rate Limiting Middleware
 * Per-socket and per-event rate limiting for abuse prevention
 *
 * @module infrastructure/websocket/middleware/rate-limiting
 * @description Implements sliding window rate limiting for WebSocket events
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';
import { redisCluster } from '../../redis/redis.cluster';
import { EVENT_RATE_LIMITS, CONNECTION_THROTTLE } from '../config/websocket.config';

/**
 * Rate limit status
 */
interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Connection throttling check
 * Prevents too many connections from same IP or user
 *
 * @param socket - Socket.IO socket instance
 * @param next - Next middleware function
 */
export const connectionThrottle = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    const ip = socket.handshake.address;
    const userId = socket.data.user?.userId;

    // Check IP-based throttling
    const ipKey = `throttle:ip:${ip}`;
    const ipStatus = await redisCluster.checkRateLimit(
      ipKey,
      CONNECTION_THROTTLE.maxConnectionsPerIP,
      CONNECTION_THROTTLE.connectionWindow
    );

    if (!ipStatus.allowed) {
      logger.warn('Connection rejected due to IP throttling', {
        ip,
        socketId: socket.id,
      });

      metrics.websocketRateLimitHits.inc({ type: 'connection', reason: 'ip_throttle' });
      return next(new Error('Too many connections from this IP'));
    }

    // Check user-based throttling (if authenticated)
    if (userId) {
      const userKey = `throttle:user:${userId}`;
      const userStatus = await redisCluster.checkRateLimit(
        userKey,
        CONNECTION_THROTTLE.maxConnectionsPerUser,
        CONNECTION_THROTTLE.connectionWindow
      );

      if (!userStatus.allowed) {
        logger.warn('Connection rejected due to user throttling', {
          userId,
          socketId: socket.id,
        });

        metrics.websocketRateLimitHits.inc({ type: 'connection', reason: 'user_throttle' });
        return next(new Error('Too many connections for this user'));
      }
    }

    next();
  } catch (error) {
    logger.error('Connection throttling check failed:', error);
    // On error, allow connection but log the issue
    next();
  }
};

/**
 * Event rate limiting
 * Limits specific events per socket/user
 *
 * @param eventName - Name of the event to rate limit
 * @returns Middleware function that checks rate limit
 */
export const eventRateLimit = (eventName: string) => {
  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    try {
      const userId = socket.data.user?.userId;

      if (!userId) {
        // Skip rate limiting for unauthenticated sockets
        return next();
      }

      const config = EVENT_RATE_LIMITS[eventName];

      if (!config) {
        // No rate limit configured for this event
        return next();
      }

      const key = `event:${eventName}:${userId}`;
      const status = await redisCluster.checkRateLimit(
        key,
        config.max,
        config.window
      );

      if (!status.allowed) {
        logger.warn('Event rate limit exceeded', {
          eventName,
          userId,
          socketId: socket.id,
          limit: config.max,
          window: config.window,
        });

        metrics.websocketRateLimitHits.inc({ type: 'event', event: eventName });

        // Emit rate limit error to client
        socket.emit('rate_limit_exceeded', {
          event: eventName,
          limit: config.max,
          window: config.window,
          resetAt: new Date(status.resetAt).toISOString(),
        });

        return next(new Error('Rate limit exceeded'));
      }

      // Attach rate limit info to socket for client awareness
      socket.emit('rate_limit_info', {
        event: eventName,
        remaining: status.remaining,
        limit: config.max,
        resetAt: new Date(status.resetAt).toISOString(),
      });

      next();
    } catch (error) {
      logger.error('Event rate limiting check failed:', error);
      // On error, allow event but log the issue
      next();
    }
  };
};

/**
 * Global event rate limiter wrapper
 * Wraps event handlers with rate limiting
 *
 * @param socket - Socket.IO socket instance
 * @param eventName - Name of the event
 * @param handler - Original event handler
 * @returns Wrapped handler with rate limiting
 */
export const wrapWithRateLimit = (
  socket: Socket,
  eventName: string,
  handler: (...args: any[]) => void
) => {
  return async (...args: any[]): Promise<void> => {
    const startTime = Date.now();

    try {
      const userId = socket.data.user?.userId;

      if (!userId) {
        // No rate limiting for unauthenticated events
        return handler(...args);
      }

      const config = EVENT_RATE_LIMITS[eventName];

      if (!config) {
        // No rate limit configured for this event
        return handler(...args);
      }

      const key = `event:${eventName}:${userId}`;
      const status = await redisCluster.checkRateLimit(
        key,
        config.max,
        config.window
      );

      if (!status.allowed) {
        logger.warn('Event rate limit exceeded', {
          eventName,
          userId,
          socketId: socket.id,
        });

        metrics.websocketRateLimitHits.inc({ type: 'event', event: eventName });

        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for event: ${eventName}`,
          limit: config.max,
          window: config.window,
          resetAt: new Date(status.resetAt).toISOString(),
        });

        return;
      }

      // Record event processing time
      const duration = (Date.now() - startTime) / 1000;
      metrics.websocketEventDuration.observe({ event: eventName }, duration);

      // Execute original handler
      return handler(...args);
    } catch (error) {
      logger.error('Rate limit wrapper error:', error);
      // On error, still execute handler
      return handler(...args);
    }
  };
};

/**
 * Burst protection
 * Prevents burst of events in very short time window
 *
 * @param maxEvents - Maximum events allowed in burst window
 * @param burstWindow - Burst window in milliseconds
 * @returns Middleware function
 */
export const burstProtection = (maxEvents: number = 10, burstWindow: number = 1000) => {
  const eventCounts = new Map<string, { count: number; resetAt: number }>();

  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    const userId = socket.data.user?.userId;

    if (!userId) {
      return next();
    }

    const now = Date.now();
    const key = userId;
    const current = eventCounts.get(key);

    if (current && current.resetAt > now) {
      if (current.count >= maxEvents) {
        logger.warn('Burst protection triggered', {
          userId,
          socketId: socket.id,
          count: current.count,
          maxEvents,
        });

        metrics.websocketRateLimitHits.inc({ type: 'burst', reason: 'too_many_events' });

        socket.emit('error', {
          type: 'BURST_LIMIT_EXCEEDED',
          message: 'Too many events in short time',
          retryAfter: current.resetAt - now,
        });

        return next(new Error('Burst limit exceeded'));
      }

      current.count++;
    } else {
      eventCounts.set(key, { count: 1, resetAt: now + burstWindow });
    }

    // Cleanup old entries
    if (eventCounts.size > 10000) {
      const toDelete: string[] = [];
      eventCounts.forEach((value, key) => {
        if (value.resetAt <= now) {
          toDelete.push(key);
        }
      });
      toDelete.forEach(key => eventCounts.delete(key));
    }

    next();
  };
};

export default {
  connectionThrottle,
  eventRateLimit,
  wrapWithRateLimit,
  burstProtection,
};
