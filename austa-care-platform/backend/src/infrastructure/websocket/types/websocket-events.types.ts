/**
 * WebSocket Event Type System
 * Comprehensive type-safe event definitions for real-time communication
 *
 * @module infrastructure/websocket/types/websocket-events
 * @description Production-ready WebSocket event types with:
 * - Complete event type coverage
 * - Type-safe payload structures
 * - Server-to-client event definitions
 * - Client-to-server event definitions
 */

/**
 * Base timestamp interface
 */
export interface WithTimestamp {
  timestamp: string;
}

/**
 * Base socket ID interface
 */
export interface WithSocketId {
  socketId: string;
}

/**
 * ======================
 * CONVERSATION EVENTS
 * ======================
 */

/**
 * Client-to-Server Events
 */
export interface ConversationJoinData {
  conversationId: string;
  metadata?: Record<string, any>;
}

export interface ConversationLeaveData {
  conversationId: string;
}

export interface ConversationTypingData {
  conversationId: string;
  isTyping: boolean;
}

export interface ConversationMessageData {
  conversationId: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio';
  metadata?: Record<string, any>;
}

export interface ConversationReadReceiptData {
  conversationId: string;
  messageId: string;
  readAt: string;
}

export interface ConversationPresenceData {
  conversationId: string;
  status: 'active' | 'away';
}

/**
 * Server-to-Client Events
 */
export interface ConversationJoinedPayload extends WithTimestamp, WithSocketId {
  conversationId: string;
}

export interface ConversationUserJoinedPayload extends WithTimestamp, WithSocketId {
  userId: string;
  conversationId: string;
  userName: string;
}

export interface ConversationUserLeftPayload extends WithTimestamp {
  userId: string;
  conversationId: string;
}

export interface ConversationTypingIndicatorPayload extends WithTimestamp {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

export interface ConversationMessageNewPayload extends WithTimestamp {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio';
  metadata?: Record<string, any>;
}

export interface ConversationMessageReadPayload extends WithSocketId {
  conversationId: string;
  messageId: string;
  readBy: string;
  readAt: string;
}

export interface ConversationPresenceUpdatedPayload extends WithTimestamp {
  userId: string;
  conversationId: string;
  status: 'active' | 'away';
}

/**
 * ======================
 * NOTIFICATION EVENTS
 * ======================
 */

/**
 * Client-to-Server Events
 */
export interface NotificationSubscribeData {
  // No additional data needed
}

export interface NotificationUnsubscribeData {
  // No additional data needed
}

export interface NotificationAcknowledgeData {
  notificationId: string;
  acknowledgedAt: string;
}

export interface NotificationHistoryData {
  limit?: number;
  offset?: number;
}

export interface NotificationMarkReadData {
  notificationId: string;
  readAt?: string;
}

export interface NotificationUnreadCountData {
  // No additional data needed
}

/**
 * Server-to-Client Events
 */
export interface NotificationSubscribedPayload extends WithTimestamp, WithSocketId {
  userId: string;
}

export interface NotificationUnsubscribedPayload extends WithTimestamp {
  userId: string;
}

export interface NotificationAcknowledgedPayload extends WithTimestamp, WithSocketId {
  notificationId: string;
  acknowledgedAt: string;
}

export interface NotificationMarkedReadPayload extends WithTimestamp, WithSocketId {
  notificationId: string;
  readAt: string;
}

export interface NotificationPayload extends WithTimestamp {
  notificationId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: string;
}

export interface NotificationHistoryResponsePayload {
  notifications: NotificationPayload[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationUnreadCountResponsePayload extends WithTimestamp {
  count: number;
}

/**
 * ======================
 * HEALTH MONITORING EVENTS
 * ======================
 */

export interface HealthSubscribeData {
  userId: string;
}

export interface HealthSubscribedPayload extends WithTimestamp {
  userId: string;
}

export interface HealthDataUpdatedPayload extends WithTimestamp {
  userId: string;
  dataType: 'CONDITION' | 'MEDICATION' | 'ALLERGY' | 'SYMPTOM' | 'VITAL_SIGN' | 'LAB_RESULT';
  data: any;
}

/**
 * ======================
 * AUTHORIZATION EVENTS
 * ======================
 */

export interface AuthorizationSubscribeData {
  authorizationId: string;
}

export interface AuthorizationSubscribedPayload extends WithTimestamp {
  authorizationId: string;
}

export interface AuthorizationStatusChangedPayload extends WithTimestamp {
  authorizationId: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  reason?: string;
}

/**
 * ======================
 * PRESENCE EVENTS
 * ======================
 */

export interface PresenceUpdateData {
  status: 'online' | 'away' | 'busy';
}

export interface PresenceUpdatedPayload {
  userId: string;
  status: 'online' | 'away' | 'busy';
  lastSeen: string;
}

/**
 * ======================
 * CONNECTION EVENTS
 * ======================
 */

export interface ConnectedPayload extends WithTimestamp {
  socketId: string;
  userId: string;
}

export interface ErrorPayload {
  type: string;
  message: string;
  details?: any;
}

/**
 * ======================
 * CUSTOM EVENTS
 * ======================
 */

export interface CustomEventData {
  event: string;
  payload: any;
  target?: string;
}

export interface CustomEventPayload extends WithTimestamp {
  from: string;
  [key: string]: any;
}

/**
 * ======================
 * EVENT TYPE UNIONS
 * ======================
 */

/**
 * All client-to-server event types
 */
export type ClientToServerEventType =
  | 'conversation:join'
  | 'conversation:leave'
  | 'conversation:typing'
  | 'conversation:message:sent'
  | 'conversation:read-receipt'
  | 'conversation:presence'
  | 'notification:subscribe'
  | 'notification:unsubscribe'
  | 'notification:acknowledge'
  | 'notification:history'
  | 'notification:mark-read'
  | 'notification:unread-count'
  | 'health:subscribe'
  | 'authorization:subscribe'
  | 'presence:update'
  | 'custom:event';

/**
 * All server-to-client event types
 */
export type ServerToClientEventType =
  | 'connected'
  | 'error'
  | 'conversation:joined'
  | 'conversation:user-joined'
  | 'conversation:user-left'
  | 'conversation:typing-indicator'
  | 'conversation:message:new'
  | 'conversation:message:read'
  | 'conversation:presence-updated'
  | 'notification:subscribed'
  | 'notification:unsubscribed'
  | 'notification:acknowledged'
  | 'notification:marked-read'
  | 'notification:new'
  | 'notification:history-response'
  | 'notification:unread-count-response'
  | 'health:subscribed'
  | 'health:data-updated'
  | 'authorization:subscribed'
  | 'authorization:status-changed'
  | 'presence:updated';

/**
 * ======================
 * EVENT MAP INTERFACES
 * ======================
 */

/**
 * Client-to-Server Event Map
 */
export interface ClientToServerEvents {
  'conversation:join': (data: ConversationJoinData) => void;
  'conversation:leave': (data: ConversationLeaveData) => void;
  'conversation:typing': (data: ConversationTypingData) => void;
  'conversation:message:sent': (data: ConversationMessageData) => void;
  'conversation:read-receipt': (data: ConversationReadReceiptData) => void;
  'conversation:presence': (data: ConversationPresenceData) => void;
  'notification:subscribe': (data?: NotificationSubscribeData) => void;
  'notification:unsubscribe': (data?: NotificationUnsubscribeData) => void;
  'notification:acknowledge': (data: NotificationAcknowledgeData) => void;
  'notification:history': (data: NotificationHistoryData) => void;
  'notification:mark-read': (data: NotificationMarkReadData) => void;
  'notification:unread-count': (data?: NotificationUnreadCountData) => void;
  'health:subscribe': (data: HealthSubscribeData) => void;
  'authorization:subscribe': (data: AuthorizationSubscribeData) => void;
  'presence:update': (data: PresenceUpdateData) => void;
  'custom:event': (data: CustomEventData) => void;
}

/**
 * Server-to-Client Event Map
 */
export interface ServerToClientEvents {
  'connected': (payload: ConnectedPayload) => void;
  'error': (payload: ErrorPayload) => void;
  'conversation:joined': (payload: ConversationJoinedPayload) => void;
  'conversation:user-joined': (payload: ConversationUserJoinedPayload) => void;
  'conversation:user-left': (payload: ConversationUserLeftPayload) => void;
  'conversation:typing-indicator': (payload: ConversationTypingIndicatorPayload) => void;
  'conversation:message:new': (payload: ConversationMessageNewPayload) => void;
  'conversation:message:read': (payload: ConversationMessageReadPayload) => void;
  'conversation:presence-updated': (payload: ConversationPresenceUpdatedPayload) => void;
  'notification:subscribed': (payload: NotificationSubscribedPayload) => void;
  'notification:unsubscribed': (payload: NotificationUnsubscribedPayload) => void;
  'notification:acknowledged': (payload: NotificationAcknowledgedPayload) => void;
  'notification:marked-read': (payload: NotificationMarkedReadPayload) => void;
  'notification:new': (payload: NotificationPayload) => void;
  'notification:history-response': (payload: NotificationHistoryResponsePayload) => void;
  'notification:unread-count-response': (payload: NotificationUnreadCountResponsePayload) => void;
  'health:subscribed': (payload: HealthSubscribedPayload) => void;
  'health:data-updated': (payload: HealthDataUpdatedPayload) => void;
  'authorization:subscribed': (payload: AuthorizationSubscribedPayload) => void;
  'authorization:status-changed': (payload: AuthorizationStatusChangedPayload) => void;
  'presence:updated': (payload: PresenceUpdatedPayload) => void;
}

/**
 * Socket.IO typed socket interface
 */
export interface TypedSocket {
  id: string;
  data: {
    user: {
      userId: string;
      organizationId: string;
      role: string;
      name: string;
    };
  };
  emit<K extends ServerToClientEventType>(
    event: K,
    payload: ServerToClientEvents[K] extends (arg: infer P) => void ? P : never
  ): boolean;
  on<K extends ClientToServerEventType>(
    event: K,
    handler: ClientToServerEvents[K]
  ): void;
  to(room: string): TypedSocket;
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
}
