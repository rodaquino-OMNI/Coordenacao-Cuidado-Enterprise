import { KafkaConfig, SASLOptions, logLevel } from 'kafkajs';
import { config } from '../../config/config';

/**
 * Kafka Configuration
 * Centralized configuration for Kafka client with support for multiple environments
 */

export interface AustaKafkaConfig {
  brokers: string[];
  clientId: string;
  ssl: boolean;
  sasl?: SASLOptions;
  connectionTimeout: number;
  requestTimeout: number;
  logLevel: logLevel;
  retry: {
    initialRetryTime: number;
    retries: number;
    maxRetryTime: number;
    factor: number;
  };
}

export interface ProducerConfig {
  allowAutoTopicCreation: boolean;
  idempotent: boolean;
  maxInFlightRequests: number;
  transactionalId?: string;
  transactionTimeout?: number;
  acks?: number | 'all';
  timeout?: number;
  compression?: number; // 0=none, 1=gzip, 2=snappy, 3=lz4, 4=zstd
}

export interface ConsumerConfig {
  groupId: string;
  sessionTimeout: number;
  heartbeatInterval: number;
  maxBytesPerPartition: number;
  minBytes?: number;
  maxBytes?: number;
  maxWaitTimeInMs?: number;
  retry: {
    initialRetryTime: number;
    retries: number;
    maxRetryTime?: number;
    multiplier?: number;
  };
  autoCommit?: boolean;
  autoCommitInterval?: number;
  autoCommitThreshold?: number;
}

export interface TopicConfig {
  topic: string;
  numPartitions: number;
  replicationFactor: number;
  configEntries: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Get Kafka client configuration based on environment
 */
export const getKafkaConfig = (): AustaKafkaConfig => {
  const brokers = config.kafka?.brokers || process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

  const kafkaConfig: AustaKafkaConfig = {
    brokers,
    clientId: config.kafka?.clientId || 'austa-care-platform',
    ssl: config.kafka?.ssl || process.env.KAFKA_SSL === 'true',
    connectionTimeout: 30000,
    requestTimeout: 30000,
    logLevel: process.env.NODE_ENV === 'production' ? logLevel.ERROR : logLevel.INFO,
    retry: {
      initialRetryTime: 100,
      retries: 10,
      maxRetryTime: 30000,
      factor: 2,
    },
  };

  // Add SASL authentication if configured
  if (config.kafka?.sasl || process.env.KAFKA_SASL_USERNAME) {
    const mechanism = (process.env.KAFKA_SASL_MECHANISM || 'plain') as 'plain' | 'scram-sha-256' | 'scram-sha-512';
    kafkaConfig.sasl = config.kafka?.sasl || {
      mechanism: mechanism,
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || '',
    } as any;
  }

  return kafkaConfig;
};

/**
 * Default producer configuration
 */
export const getProducerConfig = (): ProducerConfig => ({
  allowAutoTopicCreation: false,
  idempotent: true,
  maxInFlightRequests: 5,
  transactionalId: `austa-producer-${process.env.NODE_ENV || 'development'}`,
  transactionTimeout: 60000,
  acks: -1, // Wait for all in-sync replicas
  timeout: 30000,
  compression: 1, // gzip
});

/**
 * Get consumer configuration for a specific group
 */
export const getConsumerConfig = (groupId: string): ConsumerConfig => ({
  groupId,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576, // 1MB
  minBytes: 1,
  maxBytes: 10485760, // 10MB
  maxWaitTimeInMs: 5000,
  retry: {
    initialRetryTime: 100,
    retries: 10,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  autoCommit: false, // Manual commit for better control
  autoCommitInterval: 5000,
  autoCommitThreshold: 100,
});

/**
 * Topic configurations for AUSTA Care Platform
 */
export const TOPICS = {
  // User events
  USER_REGISTERED: 'austa.care.user.registered',
  USER_UPDATED: 'austa.care.user.updated',
  USER_DELETED: 'austa.care.user.deleted',

  // Conversation events
  CONVERSATION_STARTED: 'austa.care.conversation.started',
  CONVERSATION_ENDED: 'austa.care.conversation.ended',
  MESSAGE_RECEIVED: 'austa.care.message.received',
  MESSAGE_SENT: 'austa.care.message.sent',

  // AI/ML events
  AI_SYMPTOM_ANALYZED: 'austa.care.ai.symptom.analyzed',
  AI_RISK_CALCULATED: 'austa.care.risk.calculated',
  AI_INTENT_DETECTED: 'austa.care.ai.intent.detected',
  ML_PREDICTION_COMPLETED: 'austa.care.ml.prediction.completed',
  ML_PREDICTION_FAILED: 'austa.care.ml.prediction.failed',

  // Authorization events
  AUTHORIZATION_REQUESTED: 'austa.care.authorization.requested',
  AUTHORIZATION_APPROVED: 'austa.care.authorization.approved',
  AUTHORIZATION_DENIED: 'austa.care.authorization.denied',
  AUTHORIZATION_EXPIRED: 'austa.care.authorization.expired',

  // Health data events
  HEALTH_DATA_CREATED: 'austa.care.health.data.created',
  HEALTH_DATA_UPDATED: 'austa.care.health.data.updated',
  HEALTH_DATA_VERIFIED: 'austa.care.health.data.verified',

  // Document events
  DOCUMENT_UPLOADED: 'austa.care.document.uploaded',
  DOCUMENT_PROCESSED: 'austa.care.document.processed',
  DOCUMENT_OCR_COMPLETED: 'austa.care.document.ocr.completed',

  // Integration events
  TASY_SYNC_STARTED: 'austa.care.integration.tasy.sync.started',
  TASY_SYNC_COMPLETED: 'austa.care.integration.tasy.sync.completed',
  TASY_SYNC_FAILED: 'austa.care.integration.tasy.sync.failed',

  // Notification events
  NOTIFICATION_SCHEDULED: 'austa.care.notification.scheduled',
  NOTIFICATION_SENT: 'austa.care.notification.sent',
  NOTIFICATION_FAILED: 'austa.care.notification.failed',

  // FHIR events
  FHIR_RESOURCE_CREATED: 'austa.care.fhir.resource.created',
  FHIR_RESOURCE_UPDATED: 'austa.care.fhir.resource.updated',
  FHIR_RESOURCE_DELETED: 'austa.care.fhir.resource.deleted',

  // Gamification events
  MISSION_STARTED: 'austa.care.mission.started',
  MISSION_COMPLETED: 'austa.care.mission.completed',
  POINTS_AWARDED: 'austa.care.points.awarded',

  // System events
  SYSTEM_HEALTH_CHECK: 'austa.care.system.health.check',
  DEAD_LETTER: 'austa.care.dead-letter',
} as const;

/**
 * Consumer group IDs
 */
export const CONSUMER_GROUPS = {
  MESSAGE_PROCESSOR: 'austa-message-processor',
  AI_ANALYZER: 'austa-ai-analyzer',
  AUTHORIZATION_PROCESSOR: 'austa-authorization-processor',
  NOTIFICATION_SENDER: 'austa-notification-sender',
  TASY_INTEGRATOR: 'austa-tasy-integrator',
  FHIR_SYNC: 'austa-fhir-sync',
  ANALYTICS: 'austa-analytics',
  AUDIT_LOGGER: 'austa-audit-logger',
} as const;

/**
 * Get topic configurations for creation
 */
export const getTopicConfigs = (): TopicConfig[] => {
  const defaultPartitions = process.env.KAFKA_DEFAULT_PARTITIONS
    ? parseInt(process.env.KAFKA_DEFAULT_PARTITIONS, 10)
    : 3;

  const defaultReplication = process.env.KAFKA_DEFAULT_REPLICATION
    ? parseInt(process.env.KAFKA_DEFAULT_REPLICATION, 10)
    : 2;

  return Object.values(TOPICS).map(topic => ({
    topic,
    numPartitions: defaultPartitions,
    replicationFactor: defaultReplication,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'compression.type', value: 'gzip' },
      { name: 'max.message.bytes', value: '1048576' }, // 1MB
      { name: 'min.insync.replicas', value: '1' },
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'segment.ms', value: '86400000' }, // 1 day
    ],
  }));
};

/**
 * Dead letter queue configuration
 */
export const DEAD_LETTER_CONFIG: TopicConfig = {
  topic: TOPICS.DEAD_LETTER,
  numPartitions: 1,
  replicationFactor: 2,
  configEntries: [
    { name: 'retention.ms', value: '2592000000' }, // 30 days
    { name: 'compression.type', value: 'gzip' },
    { name: 'max.message.bytes', value: '5242880' }, // 5MB
    { name: 'cleanup.policy', value: 'delete' },
  ],
};

/**
 * Validate Kafka configuration
 */
export const validateKafkaConfig = (kafkaConfig: AustaKafkaConfig): boolean => {
  if (!kafkaConfig.brokers || kafkaConfig.brokers.length === 0) {
    throw new Error('Kafka brokers must be configured');
  }

  if (!kafkaConfig.clientId) {
    throw new Error('Kafka clientId must be configured');
  }

  if (kafkaConfig.sasl) {
    // Type guard to check if SASL has username/password
    if ('username' in kafkaConfig.sasl && 'password' in kafkaConfig.sasl) {
      if (!kafkaConfig.sasl.username || !kafkaConfig.sasl.password) {
        throw new Error('Kafka SASL credentials must be configured');
      }
    }
  }

  return true;
};

/**
 * Export default configuration
 */
export default {
  kafka: getKafkaConfig(),
  producer: getProducerConfig(),
  topics: TOPICS,
  consumerGroups: CONSUMER_GROUPS,
  getConsumerConfig,
  getTopicConfigs,
  validateKafkaConfig,
};
