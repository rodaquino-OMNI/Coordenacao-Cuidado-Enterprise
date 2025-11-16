/**
 * WebSocket Conversation Handler
 * Handles real-time conversation events including messages, typing indicators, and presence
 *
 * @module infrastructure/websocket/handlers/conversation
 * @description Production-ready conversation event handling with:
 * - Message broadcasting
 * - Typing indicators
 * - Read receipts
 * - User presence
 * - Conversation state management
 */

import { Socket } from 'socket.io';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';
import { redisCluster } from '../../redis/redis.cluster';
import { eventPublisher } from '../../kafka/events/event.publisher';
import {
  ConversationJoinData,
  ConversationLeaveData,
  ConversationTypingData,
  ConversationMessageData,
  ConversationReadReceiptData,
  ConversationPresenceData,
  ConversationJoinedPayload,
  ConversationUserJoinedPayload,
  ConversationUserLeftPayload,
  ConversationTypingIndicatorPayload,
  ConversationMessageNewPayload,
  ConversationMessageReadPayload,
  ConversationPresenceUpdatedPayload,
} from '../types/websocket-events.types';

/**
 * Type aliases for backward compatibility
 * @deprecated Use imported types from websocket-events.types instead
 */
export type JoinConversationData = ConversationJoinData;
export type LeaveConversationData = ConversationLeaveData;
export type TypingIndicatorData = ConversationTypingData;
export type MessageData = ConversationMessageData;
export type ReadReceiptData = ConversationReadReceiptData;

/**
 * Setup conversation event handlers
 *
 * @param socket - Authenticated socket instance
 */
export const setupConversationHandlers = (socket: Socket): void => {
  const user = socket.data.user;

  /**
   * Handle conversation join
   */
  socket.on('conversation:join', async (data: ConversationJoinData) => {
    try {
      const { conversationId, metadata } = data;
      const room = `conversation:${conversationId}`;

      // Join the conversation room
      await socket.join(room);

      // Track subscription in Redis
      await redisCluster.setCache(
        `conversation:${conversationId}:user:${user.userId}`,
        {
          socketId: socket.id,
          joinedAt: new Date().toISOString(),
          metadata,
        },
        3600 // 1 hour TTL
      );

      // Acknowledge join with proper typing
      const joinedPayload: ConversationJoinedPayload = {
        conversationId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      };
      socket.emit('conversation:joined', joinedPayload);

      // Notify others in the conversation with proper typing
      const userJoinedPayload: ConversationUserJoinedPayload = {
        userId: user.userId,
        conversationId,
        userName: user.name,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      };
      socket.to(room).emit('conversation:user-joined', userJoinedPayload);

      // Publish Kafka event
      await eventPublisher.publish({
        eventType: 'conversation.user.joined',
        source: 'websocket',
        version: '1.0',
        data: {
          conversationId,
          userId: user.userId,
          socketId: socket.id,
        },
      });

      metrics.websocketEvents.inc({ event: 'conversation:join', status: 'success' });
      logger.debug('User joined conversation', { userId: user.userId, conversationId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'conversation:join', status: 'error' });
      logger.error('Failed to join conversation:', error);

      socket.emit('error', {
        type: 'CONVERSATION_JOIN_FAILED',
        message: 'Failed to join conversation',
      });
    }
  });

  /**
   * Handle conversation leave
   */
  socket.on('conversation:leave', async (data: ConversationLeaveData) => {
    try {
      const { conversationId } = data;
      const room = `conversation:${conversationId}`;

      // Leave the conversation room
      await socket.leave(room);

      // Remove subscription from Redis
      await redisCluster.deleteCache(`conversation:${conversationId}:user:${user.userId}`);

      // Notify others in the conversation with proper typing
      const userLeftPayload: ConversationUserLeftPayload = {
        userId: user.userId,
        conversationId,
        timestamp: new Date().toISOString(),
      };
      socket.to(room).emit('conversation:user-left', userLeftPayload);

      // Publish Kafka event
      await eventPublisher.publish({
        eventType: 'conversation.user.left',
        source: 'websocket',
        version: '1.0',
        data: {
          conversationId,
          userId: user.userId,
        },
      });

      metrics.websocketEvents.inc({ event: 'conversation:leave', status: 'success' });
      logger.debug('User left conversation', { userId: user.userId, conversationId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'conversation:leave', status: 'error' });
      logger.error('Failed to leave conversation:', error);
    }
  });

  /**
   * Handle typing indicators
   */
  socket.on('conversation:typing', async (data: ConversationTypingData) => {
    try {
      const { conversationId, isTyping } = data;
      const room = `conversation:${conversationId}`;

      // Broadcast typing indicator to others in the room with proper typing
      const typingPayload: ConversationTypingIndicatorPayload = {
        userId: user.userId,
        conversationId,
        isTyping,
        timestamp: new Date().toISOString(),
      };
      socket.to(room).emit('conversation:typing-indicator', typingPayload);

      // Store typing state in Redis with short TTL
      if (isTyping) {
        await redisCluster.setCache(
          `conversation:${conversationId}:typing:${user.userId}`,
          true,
          10 // 10 seconds TTL
        );
      } else {
        await redisCluster.deleteCache(`conversation:${conversationId}:typing:${user.userId}`);
      }

      metrics.websocketEvents.inc({ event: 'conversation:typing', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'conversation:typing', status: 'error' });
      logger.error('Failed to handle typing indicator:', error);
    }
  });

  /**
   * Handle new messages (broadcast only, actual saving done via HTTP API)
   */
  socket.on('conversation:message:sent', async (data: ConversationMessageData) => {
    try {
      const { conversationId, content, messageType, metadata } = data;
      const room = `conversation:${conversationId}`;

      // Broadcast message to conversation participants with proper typing
      const messagePayload: ConversationMessageNewPayload = {
        conversationId,
        senderId: user.userId,
        senderName: user.name,
        content,
        messageType,
        metadata,
        timestamp: new Date().toISOString(),
      };
      socket.to(room).emit('conversation:message:new', messagePayload);

      metrics.websocketEvents.inc({ event: 'conversation:message', status: 'success' });
      logger.debug('Message broadcasted', { userId: user.userId, conversationId });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'conversation:message', status: 'error' });
      logger.error('Failed to broadcast message:', error);
    }
  });

  /**
   * Handle read receipts
   */
  socket.on('conversation:read-receipt', async (data: ConversationReadReceiptData) => {
    try {
      const { conversationId, messageId, readAt } = data;
      const room = `conversation:${conversationId}`;

      // Broadcast read receipt to conversation participants with proper typing
      const readPayload: ConversationMessageReadPayload = {
        conversationId,
        messageId,
        readBy: user.userId,
        readAt,
        socketId: socket.id,
      };
      socket.to(room).emit('conversation:message:read', readPayload);

      // Store read receipt in Redis
      await redisCluster.setCache(
        `conversation:${conversationId}:message:${messageId}:read:${user.userId}`,
        { readAt },
        86400 // 24 hours TTL
      );

      // Publish Kafka event for persistence
      await eventPublisher.publish({
        eventType: 'conversation.message.read',
        source: 'websocket',
        version: '1.0',
        data: {
          conversationId,
          messageId,
          userId: user.userId,
          readAt,
        },
      });

      metrics.websocketEvents.inc({ event: 'conversation:read-receipt', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'conversation:read-receipt', status: 'error' });
      logger.error('Failed to handle read receipt:', error);
    }
  });

  /**
   * Handle presence updates
   */
  socket.on('conversation:presence', async (data: ConversationPresenceData) => {
    try {
      const { conversationId, status } = data;
      const room = `conversation:${conversationId}`;

      // Broadcast presence to conversation participants with proper typing
      const presencePayload: ConversationPresenceUpdatedPayload = {
        userId: user.userId,
        conversationId,
        status,
        timestamp: new Date().toISOString(),
      };
      socket.to(room).emit('conversation:presence-updated', presencePayload);

      // Store presence in Redis
      await redisCluster.setCache(
        `conversation:${conversationId}:presence:${user.userId}`,
        { status, updatedAt: new Date().toISOString() },
        300 // 5 minutes TTL
      );

      metrics.websocketEvents.inc({ event: 'conversation:presence', status: 'success' });
    } catch (error) {
      metrics.websocketEvents.inc({ event: 'conversation:presence', status: 'error' });
      logger.error('Failed to handle presence update:', error);
    }
  });
};

export default setupConversationHandlers;
