/**
 * Kafka Client
 *
 * Main Kafka client for managing producers, consumers, and connections
 */

import { Kafka, Producer, Consumer, Admin, ITopicConfig, KafkaMessage as KafkaJSMessage } from 'kafkajs';
import { Counter, Histogram, Gauge, register } from 'prom-client';
import { getKafkaClientConfig, getKafkaProducerConfig, getKafkaConsumerConfig } from './kafka.config';
import {
  KafkaMessage,
  MessageHandler,
  ProducerMetrics,
  ConsumerMetrics,
  TopicConfig
} from './kafka.types';

/**
 * Prometheus metrics for Kafka operations
 */
const kafkaMessagesPublished = new Counter({
  name: 'kafka_messages_published_total',
  help: 'Total number of messages published to Kafka',
  labelNames: ['topic', 'status'],
});

const kafkaMessagesConsumed = new Counter({
  name: 'kafka_messages_consumed_total',
  help: 'Total number of messages consumed from Kafka',
  labelNames: ['topic', 'status'],
});

const kafkaPublishLatency = new Histogram({
  name: 'kafka_publish_latency_seconds',
  help: 'Latency of Kafka publish operations',
  labelNames: ['topic'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const kafkaConsumeLatency = new Histogram({
  name: 'kafka_consume_latency_seconds',
  help: 'Latency of Kafka consume operations',
  labelNames: ['topic'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const kafkaConnectionStatus = new Gauge({
  name: 'kafka_connection_status',
  help: 'Kafka connection status (1 = connected, 0 = disconnected)',
});

const kafkaConsumerLag = new Gauge({
  name: 'kafka_consumer_lag',
  help: 'Consumer lag per topic partition',
  labelNames: ['topic', 'partition', 'groupId'],
});

/**
 * KafkaClient class for managing Kafka operations
 */
export class KafkaClient {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private admin: Admin | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;

  private producerMetrics: ProducerMetrics = {
    messagesPublished: 0,
    publishErrors: 0,
    avgPublishLatency: 0,
  };

  private consumerMetrics: Map<string, ConsumerMetrics> = new Map();

  constructor() {
    const config = getKafkaClientConfig();
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      retry: config.retry,
      logLevel: config.logLevel,
      ssl: config.ssl,
      sasl: config.sasl,
    });
  }

  /**
   * Connect to Kafka cluster
   */
  async connect(): Promise<void> {
    try {
      console.log('Connecting to Kafka cluster...');

      // Initialize producer
      this.producer = this.kafka.producer(getKafkaProducerConfig());
      await this.producer.connect();

      // Initialize admin client
      this.admin = this.kafka.admin();
      await this.admin.connect();

      this.connected = true;
      this.reconnectAttempts = 0;
      kafkaConnectionStatus.set(1);

      console.log('Successfully connected to Kafka cluster');
    } catch (error) {
      console.error('Failed to connect to Kafka:', error);
      kafkaConnectionStatus.set(0);
      await this.handleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from Kafka cluster
   */
  async disconnect(): Promise<void> {
    try {
      console.log('Disconnecting from Kafka cluster...');

      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        console.log(`Disconnected consumer: ${groupId}`);
      }
      this.consumers.clear();

      // Disconnect producer
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }

      // Disconnect admin
      if (this.admin) {
        await this.admin.disconnect();
        this.admin = null;
      }

      this.connected = false;
      kafkaConnectionStatus.set(0);

      console.log('Successfully disconnected from Kafka cluster');
    } catch (error) {
      console.error('Error disconnecting from Kafka:', error);
      throw error;
    }
  }

  /**
   * Publish a message to a topic
   */
  async publish(topic: string, message: KafkaMessage): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka client not connected');
    }

    const startTime = Date.now();

    try {
      await this.producer.send({
        topic,
        messages: [{
          key: message.key,
          value: typeof message.value === 'string' ? message.value : message.value,
          headers: message.headers,
          partition: message.partition,
          timestamp: message.timestamp,
        }],
      });

      const latency = (Date.now() - startTime) / 1000;

      // Update metrics
      this.producerMetrics.messagesPublished++;
      this.producerMetrics.lastPublishTime = new Date();
      this.producerMetrics.avgPublishLatency =
        (this.producerMetrics.avgPublishLatency * (this.producerMetrics.messagesPublished - 1) + latency)
        / this.producerMetrics.messagesPublished;

      kafkaMessagesPublished.inc({ topic, status: 'success' });
      kafkaPublishLatency.observe({ topic }, latency);

    } catch (error) {
      this.producerMetrics.publishErrors++;
      kafkaMessagesPublished.inc({ topic, status: 'error' });
      console.error(`Error publishing message to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a topic and register message handler
   */
  async subscribe(
    topic: string | string[],
    handler: MessageHandler,
    groupId?: string
  ): Promise<void> {
    const consumerGroupId = groupId || `${topic}-consumer-group`;

    if (this.consumers.has(consumerGroupId)) {
      console.warn(`Consumer for group ${consumerGroupId} already exists`);
      return;
    }

    try {
      const consumer = this.kafka.consumer(getKafkaConsumerConfig(consumerGroupId));
      await consumer.connect();

      const topics = Array.isArray(topic) ? topic : [topic];
      await consumer.subscribe({ topics, fromBeginning: false });

      // Initialize consumer metrics
      this.consumerMetrics.set(consumerGroupId, {
        messagesConsumed: 0,
        consumeErrors: 0,
        avgConsumeLatency: 0,
      });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const startTime = Date.now();
          const metrics = this.consumerMetrics.get(consumerGroupId)!;

          try {
            const kafkaMessage: KafkaMessage = {
              key: message.key?.toString(),
              value: message.value?.toString() || '',
              headers: message.headers ? this.parseHeaders(message.headers) : undefined,
              partition,
              timestamp: message.timestamp,
            };

            await handler(kafkaMessage, topic);

            const latency = (Date.now() - startTime) / 1000;

            // Update metrics
            metrics.messagesConsumed++;
            metrics.lastConsumeTime = new Date();
            metrics.avgConsumeLatency =
              (metrics.avgConsumeLatency * (metrics.messagesConsumed - 1) + latency)
              / metrics.messagesConsumed;

            kafkaMessagesConsumed.inc({ topic, status: 'success' });
            kafkaConsumeLatency.observe({ topic }, latency);

          } catch (error) {
            metrics.consumeErrors++;
            kafkaMessagesConsumed.inc({ topic, status: 'error' });
            console.error(`Error processing message from topic ${topic}:`, error);
            throw error;
          }
        },
      });

      this.consumers.set(consumerGroupId, consumer);
      console.log(`Successfully subscribed to topics: ${topics.join(', ')} with group: ${consumerGroupId}`);

    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Create topics
   */
  async createTopics(topics: TopicConfig[]): Promise<void> {
    if (!this.admin) {
      throw new Error('Admin client not initialized');
    }

    try {
      const topicConfigs: ITopicConfig[] = topics.map(t => ({
        topic: t.topic,
        numPartitions: t.numPartitions || 3,
        replicationFactor: t.replicationFactor || 1,
        configEntries: t.configEntries,
      }));

      await this.admin.createTopics({
        topics: topicConfigs,
        waitForLeaders: true,
      });

      console.log(`Successfully created topics: ${topics.map(t => t.topic).join(', ')}`);
    } catch (error) {
      console.error('Error creating topics:', error);
      throw error;
    }
  }

  /**
   * Get producer metrics
   */
  getProducerMetrics(): ProducerMetrics {
    return { ...this.producerMetrics };
  }

  /**
   * Get consumer metrics
   */
  getConsumerMetrics(groupId?: string): ConsumerMetrics | Map<string, ConsumerMetrics> {
    if (groupId) {
      return this.consumerMetrics.get(groupId) || {
        messagesConsumed: 0,
        consumeErrors: 0,
        avgConsumeLatency: 0,
      };
    }
    return new Map(this.consumerMetrics);
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Parse Kafka message headers
   */
  private parseHeaders(headers: Record<string, Buffer | undefined>): Record<string, string | Buffer> {
    const parsed: Record<string, string | Buffer> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        parsed[key] = value;
      }
    }

    return parsed;
  }
}

// Export singleton instance
let kafkaClientInstance: KafkaClient | null = null;

export const getKafkaClient = (): KafkaClient => {
  if (!kafkaClientInstance) {
    kafkaClientInstance = new KafkaClient();
  }
  return kafkaClientInstance;
};

export default KafkaClient;
