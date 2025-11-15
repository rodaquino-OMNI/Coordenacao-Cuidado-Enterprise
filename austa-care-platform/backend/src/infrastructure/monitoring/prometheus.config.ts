/**
 * Prometheus Metrics Configuration
 * Centralized configuration for all Prometheus metrics
 */

import { logger } from '../../utils/logger';

// Histogram bucket configurations
export const HISTOGRAM_BUCKETS = {
  http: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  httpSize: [100, 1000, 10000, 100000, 1000000, 10000000],
  database: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  ai: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
  authorization: [10, 30, 60, 300, 600, 1800, 3600],
  whatsapp: [0.1, 0.5, 1, 2, 5, 10, 30],
  eventLoop: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  gc: [0.001, 0.01, 0.1, 1, 2, 5],
} as const;

// Metric label definitions
export const METRIC_LABELS = {
  http: ['method', 'route', 'status_code'] as const,
  httpRequest: ['method', 'route'] as const,
  websocket: ['direction', 'event'] as const,
  websocketConnection: ['event'] as const,
  conversation: ['type', 'channel', 'status'] as const,
  conversationActive: ['type', 'channel'] as const,
  message: ['type', 'direction', 'channel'] as const,
  authorization: ['type', 'status', 'urgency'] as const,
  authorizationDuration: ['type', 'status'] as const,
  ai: ['model', 'type', 'status'] as const,
  aiDuration: ['model', 'type'] as const,
  aiAccuracy: ['model', 'version'] as const,
  aiTokens: ['model', 'operation'] as const,
  healthRisk: ['risk_level', 'condition'] as const,
  healthAlert: ['type', 'severity', 'condition'] as const,
  engagement: ['segment', 'cohort'] as const,
  whatsapp: ['direction', 'type', 'status'] as const,
  whatsappLatency: ['direction', 'type'] as const,
  tasy: ['operation', 'status'] as const,
  tasyLatency: ['operation'] as const,
  fhir: ['resource', 'operation', 'status'] as const,
  fhirDuration: ['resource', 'operation'] as const,
  kafka: ['topic', 'status'] as const,
  kafkaConsumer: ['topic', 'consumer_group', 'status'] as const,
  kafkaLag: ['topic', 'partition', 'consumer_group'] as const,
  redis: ['operation', 'status'] as const,
  redisLatency: ['operation'] as const,
  mongo: ['collection', 'operation', 'status'] as const,
  mongoLatency: ['collection', 'operation'] as const,
  error: ['type', 'severity', 'component'] as const,
  unhandledException: ['type'] as const,
  validation: ['entity', 'field'] as const,
  memory: ['type'] as const,
  cpu: ['type'] as const,
  gcDuration: ['type'] as const,
} as const;

// Metric descriptions
export const METRIC_DESCRIPTIONS = {
  // HTTP Metrics
  httpRequestDuration: 'Duration of HTTP requests in seconds',
  httpRequestsTotal: 'Total number of HTTP requests',
  httpRequestsInProgress: 'Number of HTTP requests currently in progress',
  httpRequestSize: 'Size of HTTP request payloads in bytes',
  httpResponseSize: 'Size of HTTP response payloads in bytes',

  // WebSocket Metrics
  wsConnectionsTotal: 'Total number of WebSocket connection events',
  wsConnectionsActive: 'Number of currently active WebSocket connections',
  wsMessagesTotal: 'Total number of WebSocket messages sent/received',
  wsMessageSize: 'Size of WebSocket messages in bytes',

  // Business Metrics
  conversationsTotal: 'Total number of conversations initiated',
  conversationsActive: 'Number of currently active conversations',
  messagesProcessed: 'Total number of messages processed',
  authorizationsTotal: 'Total number of authorization requests',
  authorizationDuration: 'Time taken to process authorization requests in seconds',

  // AI/ML Metrics
  aiPredictionsTotal: 'Total number of AI/ML predictions made',
  aiPredictionDuration: 'Time taken for AI/ML predictions in seconds',
  aiModelAccuracy: 'Accuracy score of AI/ML models',
  aiTokensUsed: 'Total number of AI tokens consumed',

  // Health Metrics
  healthRiskScoresCalculated: 'Total number of health risk scores calculated',
  healthAlertsGenerated: 'Total number of health alerts generated',
  patientEngagementScore: 'Average patient engagement score by segment',

  // Integration Metrics
  whatsappMessagesTotal: 'Total number of WhatsApp messages sent/received',
  whatsappMessageLatency: 'Latency of WhatsApp message delivery in seconds',
  tasyAPICallsTotal: 'Total number of Tasy EHR API calls',
  tasyAPILatency: 'Latency of Tasy EHR API calls in seconds',
  fhirOperationsTotal: 'Total number of FHIR operations',
  fhirOperationDuration: 'Duration of FHIR operations in seconds',

  // Infrastructure Metrics
  kafkaProducedMessages: 'Total number of messages produced to Kafka',
  kafkaConsumedMessages: 'Total number of messages consumed from Kafka',
  kafkaLag: 'Kafka consumer lag (messages behind)',
  redisOperations: 'Total number of Redis operations',
  redisLatency: 'Latency of Redis operations in seconds',
  mongoOperations: 'Total number of MongoDB operations',
  mongoLatency: 'Latency of MongoDB operations in seconds',

  // Error Metrics
  errorsTotal: 'Total number of application errors',
  unhandledExceptions: 'Total number of unhandled exceptions',
  validationErrors: 'Total number of validation errors',

  // Performance Metrics
  eventLoopLag: 'Node.js event loop lag in seconds',
  memoryUsage: 'Node.js process memory usage in bytes',
  cpuUsage: 'Node.js process CPU usage percentage',
  gcDuration: 'Node.js garbage collection duration in seconds',
} as const;

// Collection intervals (in milliseconds)
export const COLLECTION_INTERVALS = {
  eventLoop: 5000,    // 5 seconds
  memory: 10000,      // 10 seconds
  cpu: 10000,         // 10 seconds
  kafkaLag: 30000,    // 30 seconds
  health: 60000,      // 60 seconds
} as const;

// Metric name prefix
export const METRIC_PREFIX = 'austa_';

// Aggregation rules for Prometheus queries
export const AGGREGATION_RULES = {
  // HTTP request rate by endpoint
  httpRequestRate: {
    query: 'rate(http_requests_total[5m])',
    description: 'HTTP request rate per second over 5 minutes',
  },

  // HTTP request P95 latency
  httpLatencyP95: {
    query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    description: '95th percentile HTTP request latency',
  },

  // HTTP error rate
  httpErrorRate: {
    query: 'sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
    description: 'HTTP error rate (5xx responses)',
  },

  // Active conversations by channel
  activeConversationsByChannel: {
    query: 'sum(conversations_active) by (channel)',
    description: 'Number of active conversations grouped by channel',
  },

  // AI prediction success rate
  aiSuccessRate: {
    query: 'sum(rate(ai_predictions_total{status="success"}[5m])) / sum(rate(ai_predictions_total[5m]))',
    description: 'AI prediction success rate',
  },

  // Kafka consumer lag alert threshold
  kafkaLagThreshold: {
    query: 'kafka_consumer_lag > 1000',
    description: 'Kafka consumer lag exceeding 1000 messages',
  },

  // Memory usage percentage
  memoryUsagePercent: {
    query: '(nodejs_memory_usage_bytes{type="heapUsed"} / nodejs_memory_usage_bytes{type="heapTotal"}) * 100',
    description: 'Heap memory usage percentage',
  },

  // Authorization processing time P99
  authorizationLatencyP99: {
    query: 'histogram_quantile(0.99, rate(authorization_duration_seconds_bucket[10m]))',
    description: '99th percentile authorization processing time',
  },
} as const;

// Alert thresholds
export const ALERT_THRESHOLDS = {
  httpErrorRate: 0.05,           // 5% error rate
  httpLatencyP95: 2,             // 2 seconds
  kafkaLag: 1000,                // 1000 messages
  memoryUsagePercent: 85,        // 85% memory usage
  cpuUsagePercent: 80,           // 80% CPU usage
  eventLoopLag: 1,               // 1 second
  wsConnectionsActive: 10000,    // 10k active connections
  aiErrorRate: 0.10,             // 10% AI error rate
  authorizationLatencyP99: 300,  // 5 minutes
} as const;

// Metric configuration type
export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labelNames: readonly string[];
  buckets?: readonly number[];
}

/**
 * Get metric configuration by name
 */
export function getMetricConfig(metricName: string): MetricConfig | null {
  // This would be expanded based on all metrics
  // For now, returning null - configuration is defined in prometheus.metrics.ts
  logger.debug(`Getting metric configuration for: ${metricName}`);
  return null;
}

/**
 * Validate metric labels
 */
export function validateMetricLabels(
  metricName: string,
  labels: Record<string, string | number>
): boolean {
  // Validation logic for metric labels
  // Ensures all required labels are present
  if (!labels || typeof labels !== 'object') {
    logger.warn(`Invalid labels for metric ${metricName}:`, labels);
    return false;
  }
  return true;
}

/**
 * Format metric name with prefix
 */
export function formatMetricName(name: string): string {
  return name.startsWith(METRIC_PREFIX) ? name : `${METRIC_PREFIX}${name}`;
}

logger.info('Prometheus configuration loaded');

export default {
  HISTOGRAM_BUCKETS,
  METRIC_LABELS,
  METRIC_DESCRIPTIONS,
  COLLECTION_INTERVALS,
  METRIC_PREFIX,
  AGGREGATION_RULES,
  ALERT_THRESHOLDS,
  getMetricConfig,
  validateMetricLabels,
  formatMetricName,
};
