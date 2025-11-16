/**
 * WebSocket Notification Handler
 * Handles real-time notification events for users and organizations
 *
 * @module infrastructure/websocket/handlers/notification
 * @description Production-ready notification handling with:
 * - User-specific notifications
 * - Organization-wide broadcasts
 * - Role-based notifications
 * - Priority-based routing
 */

import { Socket } from 'socket.io';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';
import { redisCluster } from '../../redis/redis.cluster';
import { eventPublisher } from '../../kafka/events/event.publisher';
import {
  NotificationSubscribeData,
  NotificationUnsubscribeData,
  NotificationAcknowledgeData,
  NotificationHistoryData,
  NotificationMarkReadData,
  NotificationUnreadCountData,
  NotificationSubscribedPayload,
  NotificationUnsubscribedPayload,
  NotificationAcknowledgedPayload,
  NotificationMarkedReadPayload,
  NotificationPayload,
  NotificationHistoryResponsePayload,
  NotificationUnreadCountResponsePayload,
} from '../types/websocket-events.types';

/**
 * Type aliases for backward compatibility
 * @deprecated Use imported types from websocket-events.types instead
 */
export type NotificationData = Omit<NotificationPayload, 'timestamp'>;
export type NotificationAckData = NotificationAcknowledgeData;

/**
 * Setup notification event handlers
 *
 * @param socket - Authenticated socket instance
 */
export const setupNotificationHandlers = (socket: Socket): void => {
  const user = socket.data.user;

  /**
   * Subscribe to user notifications
   */
  socket.on('notification:subscribe', async (data?: NotificationSubscribeData) => {
    try {
      const room = `notifications:user:${user.userId}`;
      await socket.join(room);

      // Emit with proper typing
      const subscribedPayload: NotificationSubscribedPayload = {
        userId: user.userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      };
      socket.emit('notification:subscribed', subscribedPayload);

      metrics.websocketEvents.inc({ event: 'notification:subscribe', status: 'success' });
      logger.debug('User subscribed to notifications', { userId: user.userId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'notification:subscribe', status: 'error' });
      logger.error('Failed to subscribe to notifications:', error);

      socket.emit('error', {
        type: 'NOTIFICATION_SUBSCRIBE_FAILED',
        message: 'Failed to subscribe to notifications',
      });
    }
  });

  /**
   * Unsubscribe from user notifications
   */
  socket.on('notification:unsubscribe', async (data?: NotificationUnsubscribeData) => {
    try {
      const room = `notifications:user:${user.userId}`;
      await socket.leave(room);

      // Emit with proper typing
      const unsubscribedPayload: NotificationUnsubscribedPayload = {
        userId: user.userId,
        timestamp: new Date().toISOString(),
      };
      socket.emit('notification:unsubscribed', unsubscribedPayload);

      metrics.websocketEvents.inc({ event: 'notification:unsubscribe', status: 'success' });
      logger.debug('User unsubscribed from notifications', { userId: user.userId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'notification:unsubscribe', status: 'error' });
      logger.error('Failed to unsubscribe from notifications:', error);
    }
  });

  /**
   * Acknowledge notification
   */
  socket.on('notification:acknowledge', async (data: NotificationAcknowledgeData) => {
    try {
      const { notificationId, acknowledgedAt } = data;

      // Store acknowledgment in Redis
      await redisCluster.setCache(
        `notification:${notificationId}:ack:${user.userId}`,
        { acknowledgedAt },
        86400 // 24 hours TTL
      );

      // Publish Kafka event for persistence
      await eventPublisher.publish({
        eventType: 'notification.acknowledged',
        source: 'websocket',
        version: '1.0',
        data: {
          notificationId,
          userId: user.userId,
          acknowledgedAt,
          socketId: socket.id,
        },
      });

      // Emit with proper typing
      const acknowledgedPayload: NotificationAcknowledgedPayload = {
        notificationId,
        acknowledgedAt,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      };
      socket.emit('notification:acknowledged', acknowledgedPayload);

      metrics.websocketEvents.inc({ event: 'notification:acknowledge', status: 'success' });
      logger.debug('Notification acknowledged', { userId: user.userId, notificationId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'notification:acknowledge', status: 'error' });
      logger.error('Failed to acknowledge notification:', error);
    }
  });

  /**
   * Request notification history
   */
  socket.on('notification:history', async (data: NotificationHistoryData) => {
    try {
      const { limit = 50, offset = 0 } = data;

      // Retrieve notification history from Redis
      const historyKey = `notification:history:${user.userId}`;
      const history = await redisCluster.getCache<NotificationPayload[]>(historyKey);

      const paginatedHistory = (history || []).slice(offset, offset + limit);

      // Emit with proper typing
      const historyResponse: NotificationHistoryResponsePayload = {
        notifications: paginatedHistory,
        total: (history || []).length,
        limit,
        offset,
      };
      socket.emit('notification:history-response', historyResponse);

      metrics.websocketEvents.inc({ event: 'notification:history', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'notification:history', status: 'error' });
      logger.error('Failed to retrieve notification history:', error);

      socket.emit('error', {
        type: 'NOTIFICATION_HISTORY_FAILED',
        message: 'Failed to retrieve notification history',
      });
    }
  });

  /**
   * Mark notification as read
   */
  socket.on('notification:mark-read', async (data: NotificationMarkReadData) => {
    try {
      const { notificationId, readAt } = data;
      const actualReadAt = readAt || new Date().toISOString();

      // Store read status in Redis
      await redisCluster.setCache(
        `notification:${notificationId}:read:${user.userId}`,
        { readAt: actualReadAt },
        86400 // 24 hours TTL
      );

      // Publish Kafka event
      await eventPublisher.publish({
        eventType: 'notification.read',
        source: 'websocket',
        version: '1.0',
        data: {
          notificationId,
          userId: user.userId,
          readAt: actualReadAt,
          socketId: socket.id,
        },
      });

      // Emit with proper typing
      const markedReadPayload: NotificationMarkedReadPayload = {
        notificationId,
        readAt: actualReadAt,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      };
      socket.emit('notification:marked-read', markedReadPayload);

      metrics.websocketEvents.inc({ event: 'notification:mark-read', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'notification:mark-read', status: 'error' });
      logger.error('Failed to mark notification as read:', error);
    }
  });

  /**
   * Get unread notification count
   */
  socket.on('notification:unread-count', async (data?: NotificationUnreadCountData) => {
    try {
      // Get unread count from Redis
      const countKey = `notification:unread:${user.userId}`;
      const count = await redisCluster.getCounter(countKey);

      // Emit with proper typing
      const countResponse: NotificationUnreadCountResponsePayload = {
        count,
        timestamp: new Date().toISOString(),
      };
      socket.emit('notification:unread-count-response', countResponse);

      metrics.websocketEvents.inc({ event: 'notification:unread-count', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'notification:unread-count', status: 'error' });
      logger.error('Failed to get unread notification count:', error);
    }
  });
};

export default setupNotificationHandlers;
