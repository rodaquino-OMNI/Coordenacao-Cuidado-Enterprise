/**
 * WebSocket Server Configuration
 * Centralized configuration for Socket.IO server with Redis adapter support
 *
 * @module infrastructure/websocket/config
 * @description Production-ready WebSocket configuration with:
 * - CORS and authentication settings
 * - Redis adapter for horizontal scaling
 * - Connection management and rate limiting
 * - Namespace and room configuration
 * - Prometheus metrics integration
 */

import { ServerOptions } from 'socket.io';
import { config } from '../../../config/config';

/**
 * WebSocket server configuration interface
 */
export interface WebSocketConfig {
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods?: string[];
  };
  transports: string[];
  pingInterval: number;
  pingTimeout: number;
  maxHttpBufferSize: number;
  allowEIO3: boolean;
  connectionStateRecovery?: {
    maxDisconnectionDuration: number;
    skipMiddlewares: boolean;
  };
}

/**
 * Room configuration
 */
export interface RoomConfig {
  maxOccupancy?: number;
  allowDuplicates: boolean;
  ttl?: number; // Time to live in seconds
}

/**
 * Namespace configuration
 */
export interface NamespaceConfig {
  path: string;
  description: string;
  authentication: boolean;
  rateLimit?: {
    window: number; // seconds
    max: number; // max connections per window
  };
}

/**
 * Get WebSocket server configuration
 */
export const getWebSocketConfig = (): WebSocketConfig => {
  const corsOrigin = config.cors?.origin || process.env.CORS_ORIGIN || '*';

  return {
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000, // 25 seconds
    pingTimeout: 60000, // 60 seconds
    maxHttpBufferSize: 1e8, // 100 MB for large file uploads
    allowEIO3: true, // Allow Engine.IO v3 clients
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
  };
};

/**
 * Namespaces configuration
 */
export const NAMESPACES: Record<string, NamespaceConfig> = {
  NOTIFICATIONS: {
    path: '/notifications',
    description: 'Real-time notifications for users',
    authentication: true,
    rateLimit: {
      window: 60,
      max: 100,
    },
  },
  CONVERSATIONS: {
    path: '/conversations',
    description: 'Real-time chat conversations',
    authentication: true,
    rateLimit: {
      window: 60,
      max: 1000,
    },
  },
  HEALTH_MONITORING: {
    path: '/health',
    description: 'Real-time health data updates',
    authentication: true,
    rateLimit: {
      window: 60,
      max: 200,
    },
  },
  ADMIN: {
    path: '/admin',
    description: 'Administrative events and monitoring',
    authentication: true,
    rateLimit: {
      window: 60,
      max: 50,
    },
  },
};

/**
 * Room configurations by type
 */
export const ROOM_CONFIGS: Record<string, RoomConfig> = {
  user: {
    allowDuplicates: true, // Allow multiple connections per user
    ttl: 3600, // 1 hour
  },
  organization: {
    allowDuplicates: true,
    ttl: 7200, // 2 hours
  },
  conversation: {
    maxOccupancy: 100,
    allowDuplicates: true,
    ttl: 3600,
  },
  authorization: {
    allowDuplicates: true,
    ttl: 1800, // 30 minutes
  },
  health: {
    maxOccupancy: 10, // Patient + care team
    allowDuplicates: false,
    ttl: 1800,
  },
};

/**
 * Rate limiting configuration for events
 */
export interface EventRateLimitConfig {
  window: number; // seconds
  max: number; // max events per window
}

export const EVENT_RATE_LIMITS: Record<string, EventRateLimitConfig> = {
  'conversation:typing': {
    window: 10,
    max: 20,
  },
  'conversation:message': {
    window: 60,
    max: 100,
  },
  'presence:update': {
    window: 60,
    max: 30,
  },
  'health:subscribe': {
    window: 60,
    max: 10,
  },
  'custom:event': {
    window: 60,
    max: 50,
  },
};

/**
 * Connection throttling configuration
 */
export interface ConnectionThrottleConfig {
  maxConnectionsPerIP: number;
  maxConnectionsPerUser: number;
  connectionWindow: number; // seconds
}

export const CONNECTION_THROTTLE: ConnectionThrottleConfig = {
  maxConnectionsPerIP: 20,
  maxConnectionsPerUser: 5,
  connectionWindow: 60,
};

/**
 * Redis adapter configuration
 */
export interface RedisAdapterConfig {
  enabled: boolean;
  pubClient?: {
    host: string;
    port: number;
  };
  subClient?: {
    host: string;
    port: number;
  };
}

export const getRedisAdapterConfig = (): RedisAdapterConfig => {
  return {
    enabled: config.redis?.cluster?.enabled || false,
    pubClient: config.redis?.cluster?.nodes?.[0] || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    subClient: config.redis?.cluster?.nodes?.[1] || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  };
};

/**
 * Export all configurations
 */
export default {
  websocket: getWebSocketConfig(),
  namespaces: NAMESPACES,
  rooms: ROOM_CONFIGS,
  eventRateLimits: EVENT_RATE_LIMITS,
  connectionThrottle: CONNECTION_THROTTLE,
  redisAdapter: getRedisAdapterConfig(),
};
