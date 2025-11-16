/**
 * MongoDB Configuration
 * Provides configuration for MongoDB connections
 */

import { MongoDBConfig } from './mongodb.types';

/**
 * Get MongoDB configuration from environment
 */
export function getMongoDBConfig(): MongoDBConfig {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const database = process.env.MONGODB_DATABASE || 'coordenacao-cuidado';

  return {
    uri,
    database,
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
      maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '60000', 10),
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000', 10),
      retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
      retryReads: process.env.MONGODB_RETRY_READS !== 'false',
    },
  };
}

/**
 * MongoDB collection names
 */
export const MONGODB_COLLECTIONS = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  DOCUMENTS: 'documents',
  USERS: 'users',
  SESSIONS: 'sessions',
} as const;

/**
 * MongoDB indexes configuration
 */
export const MONGODB_INDEXES = {
  conversations: [
    { key: { userId: 1 }, name: 'userId_1' },
    { key: { createdAt: -1 }, name: 'createdAt_-1' },
  ],
  messages: [
    { key: { conversationId: 1 }, name: 'conversationId_1' },
    { key: { timestamp: -1 }, name: 'timestamp_-1' },
  ],
  documents: [
    { key: { conversationId: 1 }, name: 'conversationId_1' },
    { key: { uploadedAt: -1 }, name: 'uploadedAt_-1' },
  ],
};
