/**
 * WebSocket Types and Interfaces
 * Defines type definitions for WebSocket operations
 */

import { Socket } from 'socket.io';

/**
 * WebSocket event types
 */
export enum WebSocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',

  // Conversation events
  CONVERSATION_CREATED = 'conversation:created',
  CONVERSATION_UPDATED = 'conversation:updated',
  CONVERSATION_DELETED = 'conversation:deleted',

  // Message events
  MESSAGE_SENT = 'message:sent',
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_UPDATED = 'message:updated',
  MESSAGE_DELETED = 'message:deleted',

  // Typing events
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',

  // Notification events
  NOTIFICATION_SENT = 'notification:sent',
  NOTIFICATION_READ = 'notification:read',

  // Document events
  DOCUMENT_UPLOADED = 'document:uploaded',
  DOCUMENT_PROCESSED = 'document:processed',
}

/**
 * Authenticated socket with user data
 */
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

/**
 * WebSocket message payload
 */
export interface WebSocketMessage<T = any> {
  event: WebSocketEvent;
  data: T;
  timestamp: Date;
  userId?: string;
}

/**
 * WebSocket error payload
 */
export interface WebSocketError {
  code: string;
  message: string;
  details?: any;
}

/**
 * WebSocket metrics
 */
export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  failedMessages: number;
  avgLatency: number;
  lastError?: string;
  lastErrorTime?: Date;
}
