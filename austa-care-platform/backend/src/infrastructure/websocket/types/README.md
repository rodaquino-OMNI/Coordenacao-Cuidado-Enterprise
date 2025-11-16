# WebSocket Event Type System

## Overview

This module provides a comprehensive, type-safe event system for WebSocket real-time communication in the AUSTA Care Platform. All event types, payloads, and handler interfaces are fully typed to ensure compile-time safety and prevent runtime errors.

## Architecture

### Type System Structure

```
types/
├── websocket-events.types.ts  # Main type definitions
├── index.ts                   # Module exports
└── README.md                  # This file
```

## Event Categories

### 1. Conversation Events

**Client-to-Server:**
- `conversation:join` - Join a conversation room
- `conversation:leave` - Leave a conversation room
- `conversation:typing` - Send typing indicator
- `conversation:message:sent` - Send a message (broadcast only)
- `conversation:read-receipt` - Mark message as read
- `conversation:presence` - Update presence status

**Server-to-Client:**
- `conversation:joined` - Acknowledgment of join with `socketId`
- `conversation:user-joined` - Another user joined (includes `socketId`)
- `conversation:user-left` - Another user left
- `conversation:typing-indicator` - Typing status update
- `conversation:message:new` - New message broadcast
- `conversation:message:read` - Message read receipt (includes `socketId`)
- `conversation:presence-updated` - User presence changed

### 2. Notification Events

**Client-to-Server:**
- `notification:subscribe` - Subscribe to user notifications
- `notification:unsubscribe` - Unsubscribe from notifications
- `notification:acknowledge` - Acknowledge a notification
- `notification:history` - Request notification history
- `notification:mark-read` - Mark notification as read
- `notification:unread-count` - Get unread count

**Server-to-Client:**
- `notification:subscribed` - Subscription confirmed (includes `socketId`)
- `notification:unsubscribed` - Unsubscription confirmed
- `notification:acknowledged` - Acknowledgment confirmed (includes `socketId`, `acknowledgedAt`)
- `notification:marked-read` - Read status confirmed (includes `socketId`, `readAt`)
- `notification:new` - New notification received
- `notification:history-response` - Notification history data
- `notification:unread-count-response` - Unread count data

### 3. Health Monitoring Events

**Client-to-Server:**
- `health:subscribe` - Subscribe to health data updates

**Server-to-Client:**
- `health:subscribed` - Subscription confirmed
- `health:data-updated` - Health data changed

### 4. Authorization Events

**Client-to-Server:**
- `authorization:subscribe` - Subscribe to authorization updates

**Server-to-Client:**
- `authorization:subscribed` - Subscription confirmed
- `authorization:status-changed` - Authorization status changed

### 5. Presence Events

**Client-to-Server:**
- `presence:update` - Update user presence

**Server-to-Client:**
- `presence:updated` - Presence status changed

### 6. Connection Events

**Server-to-Client:**
- `connected` - Initial connection acknowledgment
- `error` - Error notification

## Key Type Interfaces

### Base Interfaces

```typescript
interface WithTimestamp {
  timestamp: string;
}

interface WithSocketId {
  socketId: string;
}
```

All server-to-client events extend these base interfaces to ensure consistent structure.

### Example Event Types

```typescript
// Client sends this
interface ConversationJoinData {
  conversationId: string;
  metadata?: Record<string, any>;
}

// Server responds with this
interface ConversationJoinedPayload extends WithTimestamp, WithSocketId {
  conversationId: string;
}

// Server broadcasts this to other users
interface ConversationUserJoinedPayload extends WithTimestamp, WithSocketId {
  userId: string;
  conversationId: string;
  userName: string;
}
```

## Integration with Kafka Events

The WebSocket event system is integrated with Kafka event schemas. The following events are published to Kafka for persistence:

1. **conversation.user.joined** - Published when a user joins a conversation
2. **conversation.user.left** - Published when a user leaves a conversation
3. **conversation.message.read** - Published when a message is read
4. **notification.acknowledged** - Published when a notification is acknowledged
5. **notification.read** - Published when a notification is marked as read

All Kafka events include:
- Event metadata (eventId, timestamp, source, version)
- Data payload with userId, conversationId/notificationId
- Optional socketId for tracking the originating connection

## Usage Examples

### In Handler Files

```typescript
import {
  ConversationJoinData,
  ConversationJoinedPayload,
  ConversationUserJoinedPayload,
} from '../types/websocket-events.types';

socket.on('conversation:join', async (data: ConversationJoinData) => {
  const { conversationId, metadata } = data;

  // Type-safe payload construction
  const joinedPayload: ConversationJoinedPayload = {
    conversationId,
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  };
  socket.emit('conversation:joined', joinedPayload);

  // Type-safe broadcast
  const userJoinedPayload: ConversationUserJoinedPayload = {
    userId: user.userId,
    conversationId,
    userName: user.name,
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  };
  socket.to(room).emit('conversation:user-joined', userJoinedPayload);
});
```

### Client-Side TypeScript

```typescript
import type {
  ConversationJoinData,
  ConversationJoinedPayload,
  ConversationUserJoinedPayload,
} from './websocket-events.types';

// Type-safe emission
socket.emit('conversation:join', {
  conversationId: '123',
  metadata: { source: 'web' }
} as ConversationJoinData);

// Type-safe listening
socket.on('conversation:joined', (payload: ConversationJoinedPayload) => {
  console.log('Joined conversation:', payload.conversationId);
  console.log('Socket ID:', payload.socketId);
  console.log('At:', payload.timestamp);
});

socket.on('conversation:user-joined', (payload: ConversationUserJoinedPayload) => {
  console.log(`${payload.userName} joined`);
  console.log('Their socket:', payload.socketId);
});
```

## Type Safety Benefits

1. **Compile-Time Validation**: TypeScript catches type mismatches before runtime
2. **Auto-Completion**: IDEs provide full IntelliSense for event types and payloads
3. **Refactoring Safety**: Renaming properties updates all usages
4. **Documentation**: Types serve as inline documentation
5. **Reduced Errors**: Prevents common mistakes like missing required fields

## Migration from Untyped Code

Existing handlers maintain backward compatibility through type aliases:

```typescript
// Deprecated - kept for backward compatibility
export type JoinConversationData = ConversationJoinData;
export type NotificationAckData = NotificationAcknowledgeData;
```

## Testing

All event types can be validated at compile time:

```bash
npx tsc --noEmit src/infrastructure/websocket/**/*.ts
```

## Future Enhancements

1. **Runtime Validation**: Add Zod schemas for runtime type checking
2. **Event Versioning**: Support multiple API versions
3. **Event Documentation**: Generate OpenAPI/AsyncAPI specs from types
4. **Event Monitoring**: Type-safe metrics collection

## Related Files

- **Handlers**: `handlers/conversation.handler.ts`, `handlers/notification.handler.ts`
- **Kafka Events**: `../../kafka/events/event.schemas.ts`
- **Server**: `../websocket.server.ts`

## Contributing

When adding new events:

1. Define data interface (client-to-server)
2. Define payload interface (server-to-client) with `WithTimestamp` and `WithSocketId`
3. Add event type to union types
4. Update event map interfaces
5. If persistent, add Kafka event schema
6. Update this README

## Support

For questions or issues, contact the AUSTA Platform Team.
