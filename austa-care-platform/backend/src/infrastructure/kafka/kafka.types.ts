/**
 * Kafka Types and Interfaces
 * Type definitions for Kafka events, consumers, and producers
 */

import { EachMessagePayload, EachBatchPayload, ConsumerRunConfig } from 'kafkajs';

/**
 * Message handler function type
 */
export type MessageHandler = (payload: EachMessagePayload) => Promise<void>;

/**
 * Batch message handler function type
 */
export type BatchMessageHandler = (payload: EachBatchPayload) => Promise<void>;

/**
 * Consumer configuration with handler
 */
export interface ConsumerConfiguration {
  groupId: string;
  topics: string[];
  handler: MessageHandler;
  batchHandler?: BatchMessageHandler;
  options?: {
    autoCommit?: boolean;
    autoCommitInterval?: number;
    autoCommitThreshold?: number;
    eachBatchAutoResolve?: boolean;
    partitionsConsumedConcurrently?: number;
  };
}

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Kafka metrics for Prometheus
 */
export interface KafkaMetrics {
  messagesProduced: number;
  messagesConsumed: number;
  messagesFailed: number;
  producerLatency: number[];
  consumerLatency: number[];
  activeConsumers: number;
  connectionErrors: number;
  circuitBreakerState: CircuitState;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  messageId: string;
  correlationId?: string;
  timestamp: string;
  source: string;
  userId?: string;
  conversationId?: string;
  authorizationId?: string;
  retry?: {
    attempt: number;
    maxAttempts: number;
    lastError?: string;
  };
}

/**
 * Dead letter message
 */
export interface DeadLetterMessage<T = any> {
  originalEvent: T;
  error: {
    message: string;
    stack?: string;
    timestamp: string;
    code?: string;
  };
  metadata: {
    originalTopic: string;
    originalPartition: number;
    originalOffset: string;
    consumerGroup: string;
    retryCount: number;
    firstFailureTimestamp: string;
    lastFailureTimestamp: string;
  };
}

/**
 * Kafka health status
 */
export interface KafkaHealthStatus {
  isHealthy: boolean;
  producer: {
    connected: boolean;
    lastMessageTime?: Date;
  };
  consumers: {
    groupId: string;
    connected: boolean;
    lag?: number;
    lastMessageTime?: Date;
  }[];
  admin: {
    connected: boolean;
  };
  circuitBreaker: {
    state: CircuitState;
    failures: number;
  };
  metrics: {
    messagesProducedLast5Min: number;
    messagesConsumedLast5Min: number;
    averageLatency: number;
  };
}

/**
 * Consumer group state
 */
export interface ConsumerGroupState {
  groupId: string;
  state: 'DEAD' | 'EMPTY' | 'PREPARING_REBALANCE' | 'COMPLETING_REBALANCE' | 'STABLE';
  members: Array<{
    memberId: string;
    clientId: string;
    clientHost: string;
    assignment: {
      topics: string[];
      partitions: number[];
    };
  }>;
  coordinator: {
    id: number;
    host: string;
    port: number;
  };
}

/**
 * Topic partition offset
 */
export interface TopicPartitionOffset {
  topic: string;
  partition: number;
  offset: string;
  high: string;
  low: string;
  lag: number;
}

/**
 * Consumer lag information
 */
export interface ConsumerLag {
  groupId: string;
  topic: string;
  totalLag: number;
  partitions: TopicPartitionOffset[];
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategyConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Message processing result
 */
export interface MessageProcessingResult {
  success: boolean;
  messageId: string;
  processingTime: number;
  error?: {
    message: string;
    code?: string;
    retryable: boolean;
  };
  metadata?: Record<string, any>;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  totalMessages: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
  results: MessageProcessingResult[];
}

/**
 * Kafka admin operations result
 */
export interface AdminOperationResult {
  success: boolean;
  operation: 'CREATE_TOPICS' | 'DELETE_TOPICS' | 'CREATE_PARTITIONS' | 'DELETE_CONSUMER_GROUP' | 'DESCRIBE_CLUSTER';
  details?: any;
  error?: string;
}

/**
 * Topic metadata
 */
export interface TopicMetadata {
  name: string;
  partitions: Array<{
    partitionId: number;
    leader: number;
    replicas: number[];
    isr: number[]; // in-sync replicas
  }>;
  internal: boolean;
}

/**
 * Cluster metadata
 */
export interface ClusterMetadata {
  brokers: Array<{
    nodeId: number;
    host: string;
    port: number;
  }>;
  controller: number;
  clusterId: string;
  topics: TopicMetadata[];
}

/**
 * Message serialization format
 */
export enum MessageFormat {
  JSON = 'JSON',
  AVRO = 'AVRO',
  PROTOBUF = 'PROTOBUF',
  STRING = 'STRING',
  BINARY = 'BINARY',
}

/**
 * Message compression type
 */
export enum CompressionType {
  NONE = 0,
  GZIP = 1,
  SNAPPY = 2,
  LZ4 = 3,
  ZSTD = 4,
}

/**
 * Consumer offset commit strategy
 */
export enum OffsetCommitStrategy {
  AUTO = 'AUTO',
  MANUAL_SYNC = 'MANUAL_SYNC',
  MANUAL_ASYNC = 'MANUAL_ASYNC',
  BATCH = 'BATCH',
}

/**
 * Event processing priority
 */
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Consumer rebalance listener
 */
export interface RebalanceListener {
  onPartitionsAssigned?: (partitions: Array<{ topic: string; partition: number }>) => Promise<void>;
  onPartitionsRevoked?: (partitions: Array<{ topic: string; partition: number }>) => Promise<void>;
}

/**
 * Message filter function
 */
export type MessageFilter = (message: { topic: string; partition: number; value: string }) => boolean;

/**
 * Message transformer function
 */
export type MessageTransformer<T = any, R = any> = (message: T) => Promise<R>;

/**
 * Error handler function
 */
export type ErrorHandler = (error: Error, context: { topic: string; partition: number; offset: string }) => Promise<void>;

/**
 * Prometheus metric labels
 */
export interface MetricLabels {
  topic?: string;
  consumerGroup?: string;
  partition?: string;
  operation?: string;
  status?: 'success' | 'failure';
}

/**
 * Kafka performance metrics
 */
export interface PerformanceMetrics {
  throughput: {
    messagesPerSecond: number;
    bytesPerSecond: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Record<string, number>;
  };
}

/**
 * Idempotency key generator
 */
export type IdempotencyKeyGenerator = (message: any) => string;

/**
 * Message deduplication configuration
 */
export interface DeduplicationConfig {
  enabled: boolean;
  keyGenerator: IdempotencyKeyGenerator;
  ttl: number; // Time-to-live in milliseconds
  storageType: 'REDIS' | 'IN_MEMORY' | 'DATABASE';
}

/**
 * Consumer pause/resume configuration
 */
export interface ConsumerControlConfig {
  pauseOnError: boolean;
  pauseDuration: number;
  maxPauseDuration: number;
  autoResumeOnHealthy: boolean;
}

/**
 * Kafka transaction configuration
 */
export interface TransactionConfig {
  transactionalId: string;
  transactionTimeout: number;
  maxInFlightRequests: number;
}

/**
 * Schema registry configuration
 */
export interface SchemaRegistryConfig {
  url: string;
  auth?: {
    username: string;
    password: string;
  };
  cacheCapacity?: number;
}

/**
 * Message routing rule
 */
export interface RoutingRule {
  condition: (message: any) => boolean;
  targetTopic: string;
  priority: EventPriority;
}

/**
 * Export all types
 */
export type {
  EachMessagePayload,
  EachBatchPayload,
  ConsumerRunConfig,
};
