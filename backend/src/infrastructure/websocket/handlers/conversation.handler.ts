/**
 * Conversation WebSocket Handler
 * Handles real-time conversation and message events
 */

import { Socket } from 'socket.io';
import { WebSocketEvent, AuthenticatedSocket } from '../websocket.types';
import { getUserId } from '../middleware/auth.middleware';
import { getConversationRoom } from '../websocket.config';

/**
 * Conversation event payload
 */
interface ConversationEventPayload {
  conversationId: string;
  title?: string;
  status?: string;
}

/**
 * Message event payload
 */
interface MessageEventPayload {
  conversationId: string;
  messageId?: string;
  role: string;
  content: string;
  metadata?: any;
}

/**
 * Typing event payload
 */
interface TypingEventPayload {
  conversationId: string;
  isTyping: boolean;
}

/**
 * Setup conversation event handlers
 */
export function setupConversationHandlers(socket: Socket): void {
  const authSocket = socket as AuthenticatedSocket;

  /**
   * Join conversation room
   */
  socket.on('conversation:join', (data: { conversationId: string }) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    socket.join(room);

    console.log(`User ${userId} joined conversation ${data.conversationId}`);

    socket.emit('conversation:joined', {
      conversationId: data.conversationId,
      timestamp: new Date(),
    });
  });

  /**
   * Leave conversation room
   */
  socket.on('conversation:leave', (data: { conversationId: string }) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    socket.leave(room);

    console.log(`User ${userId} left conversation ${data.conversationId}`);

    socket.emit('conversation:left', {
      conversationId: data.conversationId,
      timestamp: new Date(),
    });
  });

  /**
   * Send message
   */
  socket.on('message:send', async (data: MessageEventPayload) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    try {
      // Broadcast to conversation room
      socket.to(room).emit(WebSocketEvent.MESSAGE_RECEIVED, {
        ...data,
        userId,
        timestamp: new Date(),
      });

      // Acknowledge sender
      socket.emit('message:sent', {
        conversationId: data.conversationId,
        messageId: data.messageId,
        timestamp: new Date(),
      });
    } catch (error) {
      socket.emit('error', {
        code: 'MESSAGE_SEND_FAILED',
        message: 'Failed to send message',
        details: error,
      });
    }
  });

  /**
   * Typing indicator
   */
  socket.on('typing:start', (data: TypingEventPayload) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    socket.to(room).emit(WebSocketEvent.TYPING_START, {
      conversationId: data.conversationId,
      userId,
      timestamp: new Date(),
    });
  });

  socket.on('typing:stop', (data: TypingEventPayload) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    socket.to(room).emit(WebSocketEvent.TYPING_STOP, {
      conversationId: data.conversationId,
      userId,
      timestamp: new Date(),
    });
  });

  /**
   * Update message
   */
  socket.on('message:update', (data: MessageEventPayload) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    socket.to(room).emit(WebSocketEvent.MESSAGE_UPDATED, {
      ...data,
      userId,
      timestamp: new Date(),
    });
  });

  /**
   * Delete message
   */
  socket.on('message:delete', (data: { conversationId: string; messageId: string }) => {
    const userId = getUserId(socket);
    const room = getConversationRoom(data.conversationId);

    socket.to(room).emit(WebSocketEvent.MESSAGE_DELETED, {
      ...data,
      userId,
      timestamp: new Date(),
    });
  });
}
