/**
 * Kafka Types and Interfaces
 *
 * TypeScript type definitions for Kafka messaging infrastructure
 */

import { KafkaConfig, ProducerConfig, ConsumerConfig, logLevel } from 'kafkajs';

/**
 * Kafka message structure
 */
export interface KafkaMessage {
  key?: string;
  value: string | Buffer;
  headers?: Record<string, string | Buffer>;
  partition?: number;
  timestamp?: string;
}

/**
 * Domain event structure for Care Coordination
 */
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  timestamp: Date;
  version: number;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
  };
}

/**
 * Kafka producer configuration
 */
export interface KafkaProducerConfig extends ProducerConfig {
  idempotent?: boolean;
  maxInFlightRequests?: number;
  transactionalId?: string;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    maxRetryTime?: number;
  };
}

/**
 * Kafka consumer configuration
 */
export interface KafkaConsumerConfig extends ConsumerConfig {
  groupId: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxBytesPerPartition?: number;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
  };
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: KafkaMessage, topic: string) => Promise<void>;

/**
 * Kafka client options
 */
export interface KafkaClientOptions {
  clientId: string;
  brokers: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    maxRetryTime?: number;
  };
  logLevel?: logLevel;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

/**
 * Producer metrics
 */
export interface ProducerMetrics {
  messagesPublished: number;
  publishErrors: number;
  avgPublishLatency: number;
  lastPublishTime?: Date;
}

/**
 * Consumer metrics
 */
export interface ConsumerMetrics {
  messagesConsumed: number;
  consumeErrors: number;
  avgConsumeLatency: number;
  lastConsumeTime?: Date;
  lag?: number;
}

/**
 * Kafka topic configuration
 */
export interface TopicConfig {
  topic: string;
  numPartitions?: number;
  replicationFactor?: number;
  configEntries?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Dead letter queue configuration
 */
export interface DLQConfig {
  enabled: boolean;
  topic: string;
  maxRetries: number;
}

export default {
  KafkaMessage,
  DomainEvent,
  KafkaProducerConfig,
  KafkaConsumerConfig,
  MessageHandler,
  KafkaClientOptions,
  ProducerMetrics,
  ConsumerMetrics,
  TopicConfig,
  DLQConfig,
};
