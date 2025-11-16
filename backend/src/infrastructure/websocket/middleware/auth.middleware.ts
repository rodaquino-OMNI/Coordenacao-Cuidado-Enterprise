/**
 * WebSocket Authentication Middleware
 * Validates JWT tokens and attaches user data to socket
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { AuthenticatedSocket } from '../websocket.types';

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  sessionId?: string;
  exp?: number;
}

/**
 * Mock JWT verification (replace with actual implementation)
 */
async function verifyToken(token: string): Promise<JWTPayload> {
  // TODO: Implement actual JWT verification
  // For now, return mock data for development
  if (!token || token === 'invalid') {
    throw new Error('Invalid token');
  }

  return {
    userId: 'user-123',
    sessionId: 'session-456',
  };
}

/**
 * WebSocket authentication middleware
 */
export function authMiddleware(
  socket: Socket,
  next: (err?: ExtendedError) => void
): void {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.replace(/^Bearer\s+/i, '');

  verifyToken(cleanToken)
    .then((payload) => {
      // Attach user data to socket
      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = payload.userId;
      authSocket.sessionId = payload.sessionId;

      next();
    })
    .catch((error) => {
      console.error('WebSocket authentication failed:', error);
      next(new Error('Authentication failed'));
    });
}

/**
 * Get user ID from socket
 */
export function getUserId(socket: Socket): string {
  const authSocket = socket as AuthenticatedSocket;
  if (!authSocket.userId) {
    throw new Error('Socket not authenticated');
  }
  return authSocket.userId;
}

/**
 * Get session ID from socket
 */
export function getSessionId(socket: Socket): string | undefined {
  const authSocket = socket as AuthenticatedSocket;
  return authSocket.sessionId;
}
