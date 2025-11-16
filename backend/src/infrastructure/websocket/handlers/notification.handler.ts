/**
 * Notification WebSocket Handler
 * Handles real-time notification events
 */

import { Socket } from 'socket.io';
import { WebSocketEvent, AuthenticatedSocket } from '../websocket.types';
import { getUserId } from '../middleware/auth.middleware';
import { getNotificationRoom } from '../websocket.config';

/**
 * Notification types
 */
export enum NotificationType {
  MESSAGE = 'message',
  MENTION = 'mention',
  DOCUMENT = 'document',
  SYSTEM = 'system',
}

/**
 * Notification priority
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Notification payload
 */
interface NotificationPayload {
  id?: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: any;
  actionUrl?: string;
}

/**
 * Notification read payload
 */
interface NotificationReadPayload {
  notificationId: string;
}

/**
 * Setup notification event handlers
 */
export function setupNotificationHandlers(socket: Socket): void {
  const authSocket = socket as AuthenticatedSocket;

  /**
   * Subscribe to notifications
   */
  socket.on('notification:subscribe', () => {
    const userId = getUserId(socket);
    const room = getNotificationRoom(userId);

    socket.join(room);

    console.log(`User ${userId} subscribed to notifications`);

    socket.emit('notification:subscribed', {
      userId,
      timestamp: new Date(),
    });
  });

  /**
   * Unsubscribe from notifications
   */
  socket.on('notification:unsubscribe', () => {
    const userId = getUserId(socket);
    const room = getNotificationRoom(userId);

    socket.leave(room);

    console.log(`User ${userId} unsubscribed from notifications`);

    socket.emit('notification:unsubscribed', {
      userId,
      timestamp: new Date(),
    });
  });

  /**
   * Mark notification as read
   */
  socket.on('notification:read', (data: NotificationReadPayload) => {
    const userId = getUserId(socket);

    console.log(`User ${userId} read notification ${data.notificationId}`);

    socket.emit('notification:read', {
      notificationId: data.notificationId,
      timestamp: new Date(),
    });
  });

  /**
   * Mark all notifications as read
   */
  socket.on('notification:read-all', () => {
    const userId = getUserId(socket);

    console.log(`User ${userId} marked all notifications as read`);

    socket.emit('notification:read-all', {
      userId,
      timestamp: new Date(),
    });
  });
}
