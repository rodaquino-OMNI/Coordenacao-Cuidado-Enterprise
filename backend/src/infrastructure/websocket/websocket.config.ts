/**
 * WebSocket Configuration
 * Provides configuration for WebSocket server
 */

import { ServerOptions } from 'socket.io';

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
  port?: number;
  path?: string;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  options?: Partial<ServerOptions>;
}

/**
 * Get WebSocket configuration from environment
 */
export function getWebSocketConfig(): WebSocketConfig {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

  return {
    port: parseInt(process.env.WEBSOCKET_PORT || '3001', 10),
    path: process.env.WEBSOCKET_PATH || '/socket.io',
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    options: {
      pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || '60000', 10),
      pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '25000', 10),
      maxHttpBufferSize: parseInt(process.env.WEBSOCKET_MAX_BUFFER_SIZE || '1048576', 10),
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    },
  };
}

/**
 * WebSocket room names
 */
export const WEBSOCKET_ROOMS = {
  USER_PREFIX: 'user:',
  CONVERSATION_PREFIX: 'conversation:',
  NOTIFICATION_PREFIX: 'notification:',
} as const;

/**
 * Get user room name
 */
export function getUserRoom(userId: string): string {
  return `${WEBSOCKET_ROOMS.USER_PREFIX}${userId}`;
}

/**
 * Get conversation room name
 */
export function getConversationRoom(conversationId: string): string {
  return `${WEBSOCKET_ROOMS.CONVERSATION_PREFIX}${conversationId}`;
}

/**
 * Get notification room name
 */
export function getNotificationRoom(userId: string): string {
  return `${WEBSOCKET_ROOMS.NOTIFICATION_PREFIX}${userId}`;
}
