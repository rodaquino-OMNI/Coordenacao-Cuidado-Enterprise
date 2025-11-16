/**
 * Kafka Configuration
 *
 * Centralized configuration for Kafka infrastructure
 */

import { logLevel } from 'kafkajs';
import { KafkaClientOptions, KafkaProducerConfig, KafkaConsumerConfig, DLQConfig } from './kafka.types';

/**
 * Get Kafka brokers from environment
 */
const getKafkaBrokers = (): string[] => {
  const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
  return brokers.split(',').map(broker => broker.trim());
};

/**
 * Get Kafka client configuration
 */
export const getKafkaClientConfig = (): KafkaClientOptions => {
  return {
    clientId: process.env.KAFKA_CLIENT_ID || 'care-coordination-backend',
    brokers: getKafkaBrokers(),
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '30000', 10),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
    retry: {
      retries: parseInt(process.env.KAFKA_RETRIES || '5', 10),
      initialRetryTime: parseInt(process.env.KAFKA_INITIAL_RETRY_TIME || '300', 10),
      maxRetryTime: parseInt(process.env.KAFKA_MAX_RETRY_TIME || '30000', 10),
    },
    logLevel: (process.env.KAFKA_LOG_LEVEL as keyof typeof logLevel) || logLevel.INFO,
    ssl: process.env.KAFKA_SSL === 'true',
    ...(process.env.KAFKA_SASL_MECHANISM && {
      sasl: {
        mechanism: process.env.KAFKA_SASL_MECHANISM as 'plain' | 'scram-sha-256' | 'scram-sha-512',
        username: process.env.KAFKA_SASL_USERNAME || '',
        password: process.env.KAFKA_SASL_PASSWORD || '',
      },
    }),
  };
};

/**
 * Get Kafka producer configuration
 */
export const getKafkaProducerConfig = (): KafkaProducerConfig => {
  return {
    idempotent: process.env.KAFKA_PRODUCER_IDEMPOTENT !== 'false',
    maxInFlightRequests: parseInt(process.env.KAFKA_PRODUCER_MAX_IN_FLIGHT || '5', 10),
    retry: {
      retries: parseInt(process.env.KAFKA_PRODUCER_RETRIES || '5', 10),
      initialRetryTime: parseInt(process.env.KAFKA_PRODUCER_INITIAL_RETRY_TIME || '300', 10),
      maxRetryTime: parseInt(process.env.KAFKA_PRODUCER_MAX_RETRY_TIME || '30000', 10),
    },
    transactionTimeout: parseInt(process.env.KAFKA_PRODUCER_TRANSACTION_TIMEOUT || '60000', 10),
  };
};

/**
 * Get Kafka consumer configuration
 */
export const getKafkaConsumerConfig = (groupId?: string): KafkaConsumerConfig => {
  return {
    groupId: groupId || process.env.KAFKA_CONSUMER_GROUP_ID || 'care-coordination-consumer-group',
    sessionTimeout: parseInt(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT || '30000', 10),
    heartbeatInterval: parseInt(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL || '3000', 10),
    maxBytesPerPartition: parseInt(process.env.KAFKA_CONSUMER_MAX_BYTES_PER_PARTITION || '1048576', 10),
    retry: {
      retries: parseInt(process.env.KAFKA_CONSUMER_RETRIES || '5', 10),
      initialRetryTime: parseInt(process.env.KAFKA_CONSUMER_INITIAL_RETRY_TIME || '300', 10),
    },
  };
};

/**
 * Get Dead Letter Queue configuration
 */
export const getDLQConfig = (): DLQConfig => {
  return {
    enabled: process.env.KAFKA_DLQ_ENABLED === 'true',
    topic: process.env.KAFKA_DLQ_TOPIC || 'care-coordination-dlq',
    maxRetries: parseInt(process.env.KAFKA_DLQ_MAX_RETRIES || '3', 10),
  };
};

/**
 * Topic names for Care Coordination domain
 */
export const TOPICS = {
  CARE_PLAN_EVENTS: 'care-plan-events',
  PATIENT_EVENTS: 'patient-events',
  APPOINTMENT_EVENTS: 'appointment-events',
  NOTIFICATION_EVENTS: 'notification-events',
  AUDIT_EVENTS: 'audit-events',
  INTEGRATION_EVENTS: 'integration-events',
  DLQ: 'care-coordination-dlq',
} as const;

export default {
  getKafkaClientConfig,
  getKafkaProducerConfig,
  getKafkaConsumerConfig,
  getDLQConfig,
  TOPICS,
};
