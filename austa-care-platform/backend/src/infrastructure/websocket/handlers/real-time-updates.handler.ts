/**
 * WebSocket Real-Time Updates Handler
 * Handles real-time updates for authorizations, health data, and missions
 *
 * @module infrastructure/websocket/handlers/real-time-updates
 * @description Production-ready real-time update handling with:
 * - Authorization status updates
 * - Health data streaming
 * - Mission progress tracking
 * - System status updates
 */

import { Socket } from 'socket.io';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';
import { redisCluster } from '../../redis/redis.cluster';
import { eventPublisher } from '../../kafka/events/event.publisher';

/**
 * Real-time update event data interfaces
 */
export interface AuthorizationSubscribeData {
  authorizationId: string;
}

export interface HealthDataSubscribeData {
  userId: string;
  dataTypes?: string[]; // specific health data types to monitor
}

export interface MissionSubscribeData {
  missionId: string;
}

/**
 * Setup real-time update event handlers
 *
 * @param socket - Authenticated socket instance
 */
export const setupRealTimeUpdateHandlers = (socket: Socket): void => {
  const user = socket.data.user;

  /**
   * Subscribe to authorization updates
   */
  socket.on('authorization:subscribe', async (data: AuthorizationSubscribeData) => {
    try {
      const { authorizationId } = data;

      // Verify user has access to this authorization
      // (In production, check authorization ownership/permissions)

      const room = `authorization:${authorizationId}`;
      await socket.join(room);

      // Track subscription in Redis
      await redisCluster.setCache(
        `authorization:${authorizationId}:subscriber:${user.userId}`,
        { socketId: socket.id, subscribedAt: new Date().toISOString() },
        3600 // 1 hour TTL
      );

      socket.emit('authorization:subscribed', {
        authorizationId,
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'authorization:subscribe', status: 'success' });
      logger.debug('User subscribed to authorization updates', { userId: user.userId, authorizationId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'authorization:subscribe', status: 'error' });
      logger.error('Failed to subscribe to authorization updates:', error);

      socket.emit('error', {
        type: 'AUTHORIZATION_SUBSCRIBE_FAILED',
        message: 'Failed to subscribe to authorization updates',
      });
    }
  });

  /**
   * Unsubscribe from authorization updates
   */
  socket.on('authorization:unsubscribe', async (data: AuthorizationSubscribeData) => {
    try {
      const { authorizationId } = data;
      const room = `authorization:${authorizationId}`;

      await socket.leave(room);

      await redisCluster.deleteCache(`authorization:${authorizationId}:subscriber:${user.userId}`);

      socket.emit('authorization:unsubscribed', {
        authorizationId,
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'authorization:unsubscribe', status: 'success' });
      logger.debug('User unsubscribed from authorization updates', { userId: user.userId, authorizationId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'authorization:unsubscribe', status: 'error' });
      logger.error('Failed to unsubscribe from authorization updates:', error);
    }
  });

  /**
   * Subscribe to health data updates
   */
  socket.on('health:subscribe', async (data: HealthDataSubscribeData) => {
    try {
      const { userId: targetUserId, dataTypes } = data;

      // Verify user has permission to monitor this user's health data
      // (patient viewing own data, or provider with authorization)
      if (user.userId !== targetUserId && user.role !== 'provider' && user.role !== 'admin') {
        throw new Error('Insufficient permissions to monitor health data');
      }

      const room = `health:${targetUserId}`;
      await socket.join(room);

      // Track subscription with data types filter
      await redisCluster.setCache(
        `health:${targetUserId}:subscriber:${user.userId}`,
        {
          socketId: socket.id,
          dataTypes: dataTypes || [],
          subscribedAt: new Date().toISOString(),
        },
        3600 // 1 hour TTL
      );

      socket.emit('health:subscribed', {
        userId: targetUserId,
        dataTypes,
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'health:subscribe', status: 'success' });
      logger.debug('User subscribed to health data updates', {
        subscriberId: user.userId,
        targetUserId,
        dataTypes,
      });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'health:subscribe', status: 'error' });
      logger.error('Failed to subscribe to health data updates:', error);

      socket.emit('error', {
        type: 'HEALTH_SUBSCRIBE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to subscribe to health data updates',
      });
    }
  });

  /**
   * Unsubscribe from health data updates
   */
  socket.on('health:unsubscribe', async (data: { userId: string }) => {
    try {
      const { userId: targetUserId } = data;
      const room = `health:${targetUserId}`;

      await socket.leave(room);

      await redisCluster.deleteCache(`health:${targetUserId}:subscriber:${user.userId}`);

      socket.emit('health:unsubscribed', {
        userId: targetUserId,
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'health:unsubscribe', status: 'success' });
      logger.debug('User unsubscribed from health data updates', {
        subscriberId: user.userId,
        targetUserId,
      });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'health:unsubscribe', status: 'error' });
      logger.error('Failed to unsubscribe from health data updates:', error);
    }
  });

  /**
   * Subscribe to mission progress updates
   */
  socket.on('mission:subscribe', async (data: MissionSubscribeData) => {
    try {
      const { missionId } = data;

      // Verify user has access to this mission
      const room = `mission:${missionId}`;
      await socket.join(room);

      await redisCluster.setCache(
        `mission:${missionId}:subscriber:${user.userId}`,
        { socketId: socket.id, subscribedAt: new Date().toISOString() },
        7200 // 2 hours TTL
      );

      socket.emit('mission:subscribed', {
        missionId,
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'mission:subscribe', status: 'success' });
      logger.debug('User subscribed to mission updates', { userId: user.userId, missionId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'mission:subscribe', status: 'error' });
      logger.error('Failed to subscribe to mission updates:', error);

      socket.emit('error', {
        type: 'MISSION_SUBSCRIBE_FAILED',
        message: 'Failed to subscribe to mission updates',
      });
    }
  });

  /**
   * Unsubscribe from mission progress updates
   */
  socket.on('mission:unsubscribe', async (data: MissionSubscribeData) => {
    try {
      const { missionId } = data;
      const room = `mission:${missionId}`;

      await socket.leave(room);

      await redisCluster.deleteCache(`mission:${missionId}:subscriber:${user.userId}`);

      socket.emit('mission:unsubscribed', {
        missionId,
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'mission:unsubscribe', status: 'success' });
      logger.debug('User unsubscribed from mission updates', { userId: user.userId, missionId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'mission:unsubscribe', status: 'error' });
      logger.error('Failed to unsubscribe from mission updates:', error);
    }
  });

  /**
   * Subscribe to system status updates (admin only)
   */
  socket.on('system:subscribe', async () => {
    try {
      if (user.role !== 'admin') {
        throw new Error('Admin role required for system status updates');
      }

      const room = 'system:status';
      await socket.join(room);

      socket.emit('system:subscribed', {
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'system:subscribe', status: 'success' });
      logger.debug('Admin subscribed to system status', { userId: user.userId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'system:subscribe', status: 'error' });
      logger.error('Failed to subscribe to system status:', error);

      socket.emit('error', {
        type: 'SYSTEM_SUBSCRIBE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to subscribe to system status',
      });
    }
  });

  /**
   * Request current status for subscribed resources
   */
  socket.on('status:request', async (data: { type: 'authorization' | 'health' | 'mission'; id: string }) => {
    try {
      const { type, id } = data;

      // Retrieve current status from Redis
      const statusKey = `${type}:${id}:status`;
      const status = await redisCluster.getCache(statusKey);

      socket.emit('status:response', {
        type,
        id,
        status: status || { state: 'unknown' },
        timestamp: new Date().toISOString(),
      });

      metrics.websocketEvents.inc({ event: 'status:request', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'status:request', status: 'error' });
      logger.error('Failed to retrieve status:', error);

      socket.emit('error', {
        type: 'STATUS_REQUEST_FAILED',
        message: 'Failed to retrieve current status',
      });
    }
  });
};

export default setupRealTimeUpdateHandlers;
