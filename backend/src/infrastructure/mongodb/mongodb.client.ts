/**
 * MongoDB Client
 * Provides MongoDB connection and operations with change stream support
 */

import { MongoClient, Db, Collection, Document, ChangeStream, ChangeStreamOptions } from 'mongodb';
import { Counter, Histogram, Gauge } from 'prom-client';
import { MongoDBConfig, ConnectionState, ChangeStreamHandler, MongoDBMetrics } from './mongodb.types';
import { getMongoDBConfig, MONGODB_COLLECTIONS } from './mongodb.config';

/**
 * MongoDB client singleton
 */
export class MongoDBClient {
  private static instance: MongoDBClient;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private config: MongoDBConfig;
  private changeStreams: Map<string, ChangeStream> = new Map();

  // Metrics
  private metrics = {
    operations: new Counter({
      name: 'mongodb_operations_total',
      help: 'Total number of MongoDB operations',
      labelNames: ['operation', 'collection', 'status'],
    }),
    responseTime: new Histogram({
      name: 'mongodb_response_time_ms',
      help: 'MongoDB operation response time in milliseconds',
      labelNames: ['operation', 'collection'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    }),
    connections: new Gauge({
      name: 'mongodb_active_connections',
      help: 'Number of active MongoDB connections',
    }),
    changeStreams: new Gauge({
      name: 'mongodb_change_streams_active',
      help: 'Number of active change streams',
    }),
  };

  private constructor(config?: MongoDBConfig) {
    this.config = config || getMongoDBConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: MongoDBConfig): MongoDBClient {
    if (!MongoDBClient.instance) {
      MongoDBClient.instance = new MongoDBClient(config);
    }
    return MongoDBClient.instance;
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED) {
      return;
    }

    try {
      this.state = ConnectionState.CONNECTING;

      this.client = new MongoClient(this.config.uri, this.config.options);
      await this.client.connect();

      this.db = this.client.db(this.config.database);
      this.state = ConnectionState.CONNECTED;

      this.metrics.connections.set(1);

      console.log(`MongoDB connected to ${this.config.database}`);
    } catch (error) {
      this.state = ConnectionState.ERROR;
      this.metrics.connections.set(0);
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.state === ConnectionState.DISCONNECTED) {
      return;
    }

    try {
      this.state = ConnectionState.DISCONNECTING;

      // Close all change streams
      for (const [key, stream] of this.changeStreams.entries()) {
        await stream.close();
        this.changeStreams.delete(key);
      }

      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
      }

      this.state = ConnectionState.DISCONNECTED;
      this.metrics.connections.set(0);
      this.metrics.changeStreams.set(0);

      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('MongoDB disconnect error:', error);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDatabase(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected');
    }
    return this.db;
  }

  /**
   * Get collection
   */
  getCollection<T extends Document>(name: string): Collection<T> {
    return this.getDatabase().collection<T>(name);
  }

  /**
   * Create change stream for real-time updates
   */
  createChangeStream<T extends Document>(
    collectionName: string,
    handler: ChangeStreamHandler<T>,
    options?: ChangeStreamOptions
  ): ChangeStream {
    const collection = this.getCollection<T>(collectionName);
    const changeStream = collection.watch([], options);

    const streamKey = `${collectionName}-${Date.now()}`;
    this.changeStreams.set(streamKey, changeStream);
    this.metrics.changeStreams.set(this.changeStreams.size);

    changeStream.on('change', async (change) => {
      const startTime = Date.now();

      try {
        const eventType = change.operationType as any;
        const document = change.fullDocument as T;

        await handler(eventType, document, document);

        this.metrics.operations.inc({
          operation: 'change_stream',
          collection: collectionName,
          status: 'success',
        });
      } catch (error) {
        console.error(`Change stream error for ${collectionName}:`, error);
        this.metrics.operations.inc({
          operation: 'change_stream',
          collection: collectionName,
          status: 'error',
        });
      } finally {
        const duration = Date.now() - startTime;
        this.metrics.responseTime.observe(
          { operation: 'change_stream', collection: collectionName },
          duration
        );
      }
    });

    changeStream.on('error', (error) => {
      console.error(`Change stream error for ${collectionName}:`, error);
      this.changeStreams.delete(streamKey);
      this.metrics.changeStreams.set(this.changeStreams.size);
    });

    changeStream.on('close', () => {
      this.changeStreams.delete(streamKey);
      this.metrics.changeStreams.set(this.changeStreams.size);
    });

    return changeStream;
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics(): MongoDBMetrics {
    return {
      connectionState: this.state,
      activeConnections: this.state === ConnectionState.CONNECTED ? 1 : 0,
      totalOperations: 0, // Would need to aggregate from Counter
      failedOperations: 0, // Would need to aggregate from Counter
      avgResponseTime: 0, // Would need to aggregate from Histogram
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        return false;
      }
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const mongoClient = MongoDBClient.getInstance();
