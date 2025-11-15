/**
 * WebSocket Authentication Middleware
 * JWT-based authentication for Socket.IO connections
 *
 * @module infrastructure/websocket/middleware/auth
 * @description Validates JWT tokens and extracts user information for socket connections
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { verifyToken } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { metrics } from '../../monitoring/prometheus.metrics';

/**
 * User data extracted from JWT token
 */
export interface SocketUser {
  userId: string;
  organizationId: string;
  role: string;
  email?: string;
  name?: string;
}

/**
 * Extended Socket interface with user data
 */
export interface AuthenticatedSocket extends Socket {
  data: {
    user: SocketUser;
  };
}

/**
 * WebSocket authentication middleware
 * Validates JWT token from handshake auth or headers
 *
 * @param socket - Socket.IO socket instance
 * @param next - Next middleware function
 */
export const authMiddleware = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  const startTime = Date.now();

  try {
    // Extract token from handshake auth or headers
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('WebSocket connection attempt without token', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });

      metrics.websocketConnections.inc({ status: 'rejected', reason: 'no_token' });
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = await verifyToken(token);

    if (!decoded || !decoded.userId) {
      logger.warn('WebSocket connection attempt with invalid token', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });

      metrics.websocketConnections.inc({ status: 'rejected', reason: 'invalid_token' });
      return next(new Error('Invalid authentication token'));
    }

    // Attach user data to socket
    socket.data.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    const duration = (Date.now() - startTime) / 1000;
    metrics.websocketAuthDuration.observe(duration);
    metrics.websocketConnections.inc({ status: 'authenticated', role: decoded.role });

    logger.debug('WebSocket connection authenticated', {
      socketId: socket.id,
      userId: decoded.userId,
      role: decoded.role,
    });

    next();
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    metrics.websocketAuthDuration.observe(duration);
    metrics.websocketConnections.inc({ status: 'rejected', reason: 'error' });

    logger.error('WebSocket authentication failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      socketId: socket.id,
      ip: socket.handshake.address,
    });

    next(new Error('Authentication failed'));
  }
};

/**
 * Role-based authorization middleware
 * Ensures socket user has required role(s)
 *
 * @param allowedRoles - Array of allowed roles
 * @returns Middleware function
 */
export const requireRole = (allowedRoles: string[]) => {
  return (socket: Socket, next: (err?: ExtendedError) => void): void => {
    const user = socket.data.user as SocketUser;

    if (!user) {
      logger.warn('Authorization check on unauthenticated socket', {
        socketId: socket.id,
      });
      return next(new Error('Authentication required'));
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn('WebSocket connection rejected due to insufficient role', {
        socketId: socket.id,
        userId: user.userId,
        userRole: user.role,
        requiredRoles: allowedRoles,
      });

      metrics.websocketConnections.inc({ status: 'rejected', reason: 'insufficient_role' });
      return next(new Error('Insufficient permissions'));
    }

    logger.debug('Role authorization successful', {
      socketId: socket.id,
      userId: user.userId,
      role: user.role,
    });

    next();
  };
};

/**
 * Organization-based authorization middleware
 * Ensures socket user belongs to specified organization
 *
 * @param organizationId - Required organization ID
 * @returns Middleware function
 */
export const requireOrganization = (organizationId: string) => {
  return (socket: Socket, next: (err?: ExtendedError) => void): void => {
    const user = socket.data.user as SocketUser;

    if (!user) {
      return next(new Error('Authentication required'));
    }

    if (user.organizationId !== organizationId) {
      logger.warn('WebSocket connection rejected due to organization mismatch', {
        socketId: socket.id,
        userId: user.userId,
        userOrg: user.organizationId,
        requiredOrg: organizationId,
      });

      metrics.websocketConnections.inc({ status: 'rejected', reason: 'wrong_organization' });
      return next(new Error('Organization mismatch'));
    }

    next();
  };
};

export default authMiddleware;
