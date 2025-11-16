/**
 * WebSocket Server
 * Provides real-time communication using Socket.io
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Counter, Histogram, Gauge } from 'prom-client';
import {
  WebSocketConfig,
  WebSocketEvent,
  WebSocketMessage,
  WebSocketMetrics,
  AuthenticatedSocket
} from './websocket.types';
import { getWebSocketConfig, getUserRoom } from './websocket.config';
import { authMiddleware, getUserId } from './middleware/auth.middleware';
import { setupConversationHandlers } from './handlers/conversation.handler';
import { setupNotificationHandlers } from './handlers/notification.handler';

/**
 * WebSocket server singleton
 */
export class WebSocketServer {
  private static instance: WebSocketServer;
  private io: SocketIOServer | null = null;
  private config: WebSocketConfig;
  private httpServer: HTTPServer | null = null;

  // Metrics
  private metrics = {
    connections: new Counter({
      name: 'websocket_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['status'],
    }),
    activeConnections: new Gauge({
      name: 'websocket_active_connections',
      help: 'Number of active WebSocket connections',
    }),
    messages: new Counter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['event', 'direction', 'status'],
    }),
    latency: new Histogram({
      name: 'websocket_message_latency_ms',
      help: 'WebSocket message latency in milliseconds',
      labelNames: ['event'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    }),
  };

  private constructor(config?: WebSocketConfig) {
    this.config = config || getWebSocketConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: WebSocketConfig): WebSocketServer {
    if (!WebSocketServer.instance) {
      WebSocketServer.instance = new WebSocketServer(config);
    }
    return WebSocketServer.instance;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.httpServer = httpServer;

    this.io = new SocketIOServer(httpServer, {
      path: this.config.path,
      cors: this.config.cors,
      ...this.config.options,
    });

    // Apply authentication middleware
    this.io.use(authMiddleware);

    // Setup connection handlers
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    console.log(`WebSocket server initialized on path ${this.config.path}`);
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    console.log(`WebSocket client connected: ${socket.id} (User: ${userId})`);

    // Update metrics
    this.metrics.connections.inc({ status: 'connected' });
    this.metrics.activeConnections.inc();

    // Join user-specific room
    if (userId) {
      const userRoom = getUserRoom(userId);
      socket.join(userRoom);
    }

    // Setup event handlers
    this.setupEventHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`WebSocket client disconnected: ${socket.id} (Reason: ${reason})`);
      this.metrics.connections.inc({ status: 'disconnected' });
      this.metrics.activeConnections.dec();
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`WebSocket error for ${socket.id}:`, error);
      this.metrics.connections.inc({ status: 'error' });
    });
  }

  /**
   * Setup event handlers for socket
   */
  private setupEventHandlers(socket: Socket): void {
    // Setup domain-specific handlers
    setupConversationHandlers(socket);
    setupNotificationHandlers(socket);

    // Setup generic message tracking
    socket.onAny((event, ...args) => {
      const startTime = Date.now();

      this.metrics.messages.inc({
        event,
        direction: 'incoming',
        status: 'received',
      });

      // Track latency if timestamp provided
      if (args[0]?.timestamp) {
        const latency = startTime - new Date(args[0].timestamp).getTime();
        this.metrics.latency.observe({ event }, latency);
      }
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast<T = any>(event: WebSocketEvent, data: T): void {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }

    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date(),
    };

    this.io.emit(event, message);

    this.metrics.messages.inc({
      event,
      direction: 'outgoing',
      status: 'sent',
    });
  }

  /**
   * Emit message to specific user
   */
  emitToUser<T = any>(userId: string, event: WebSocketEvent, data: T): void {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }

    const room = getUserRoom(userId);
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date(),
      userId,
    };

    this.io.to(room).emit(event, message);

    this.metrics.messages.inc({
      event,
      direction: 'outgoing',
      status: 'sent',
    });
  }

  /**
   * Emit message to room
   */
  emitToRoom<T = any>(room: string, event: WebSocketEvent, data: T): void {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }

    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date(),
    };

    this.io.to(room).emit(event, message);

    this.metrics.messages.inc({
      event,
      direction: 'outgoing',
      status: 'sent',
    });
  }

  /**
   * Get connected socket count
   */
  getConnectionCount(): number {
    if (!this.io) {
      return 0;
    }
    return this.io.engine.clientsCount;
  }

  /**
   * Get metrics
   */
  getMetrics(): WebSocketMetrics {
    return {
      totalConnections: 0, // Would need to aggregate from Counter
      activeConnections: this.getConnectionCount(),
      totalMessages: 0, // Would need to aggregate from Counter
      failedMessages: 0, // Would need to aggregate from Counter
      avgLatency: 0, // Would need to aggregate from Histogram
    };
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      await this.io.close();
      this.io = null;
    }
    console.log('WebSocket server shut down');
  }

  /**
   * Get Socket.IO instance
   */
  getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }
    return this.io;
  }
}

// Export singleton instance
export const websocketServer = WebSocketServer.getInstance();
