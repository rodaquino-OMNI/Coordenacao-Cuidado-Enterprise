/**
 * MongoDB Types and Interfaces
 * Defines type definitions for MongoDB operations
 */

import { Document, Collection, ChangeStream, ChangeStreamDocument } from 'mongodb';

/**
 * MongoDB configuration options
 */
export interface MongoDBConfig {
  uri: string;
  database: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
    retryWrites?: boolean;
    retryReads?: boolean;
  };
}

/**
 * MongoDB connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

/**
 * Change stream event types
 */
export type ChangeStreamEventType = 'insert' | 'update' | 'replace' | 'delete';

/**
 * Change stream handler callback
 */
export type ChangeStreamHandler<T = Document> = (
  event: ChangeStreamEventType,
  document: T,
  fullDocument?: T
) => void | Promise<void>;

/**
 * MongoDB metrics
 */
export interface MongoDBMetrics {
  connectionState: ConnectionState;
  activeConnections: number;
  totalOperations: number;
  failedOperations: number;
  avgResponseTime: number;
  lastError?: string;
  lastErrorTime?: Date;
}
