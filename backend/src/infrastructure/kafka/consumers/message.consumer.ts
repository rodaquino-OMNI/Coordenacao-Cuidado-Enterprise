/**
 * Message Consumer
 *
 * Consumer for processing messages from Kafka topics with error handling and DLQ support
 */

import { getKafkaClient } from '../kafka.client';
import { KafkaMessage, MessageHandler, DomainEvent } from '../kafka.types';
import { getDLQConfig, TOPICS } from '../kafka.config';

/**
 * Handler registration
 */
interface HandlerRegistration {
  topic: string;
  handler: MessageHandler;
  groupId?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Message processing metadata
 */
interface MessageMetadata {
  topic: string;
  partition?: number;
  offset?: string;
  timestamp?: string;
  retryCount: number;
}

/**
 * Message Consumer class
 */
export class MessageConsumer {
  private kafkaClient = getKafkaClient();
  private handlers: Map<string, HandlerRegistration> = new Map();
  private dlqConfig = getDLQConfig();
  private processingErrors: Map<string, number> = new Map();

  /**
   * Register a message handler for a topic
   */
  registerHandler(registration: HandlerRegistration): void {
    const key = `${registration.topic}-${registration.groupId || 'default'}`;

    if (this.handlers.has(key)) {
      console.warn(`Handler for ${key} already registered, overwriting...`);
    }

    this.handlers.set(key, registration);
    console.log(`Registered handler for topic: ${registration.topic}, group: ${registration.groupId || 'default'}`);
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    try {
      console.log('Starting message consumers...');

      for (const [key, registration] of this.handlers) {
        await this.startConsumer(registration);
      }

      console.log(`Started ${this.handlers.size} message consumers`);

    } catch (error) {
      console.error('Failed to start message consumers:', error);
      throw error;
    }
  }

  /**
   * Stop all consumers
   */
  async stop(): Promise<void> {
    try {
      console.log('Stopping message consumers...');
      await this.kafkaClient.disconnect();
      console.log('All message consumers stopped');

    } catch (error) {
      console.error('Failed to stop message consumers:', error);
      throw error;
    }
  }

  /**
   * Register Care Plan event handler
   */
  registerCarePlanHandler(handler: (event: DomainEvent) => Promise<void>, groupId?: string): void {
    this.registerHandler({
      topic: TOPICS.CARE_PLAN_EVENTS,
      handler: async (message, topic) => {
        const event = this.parseEventFromMessage(message);
        await handler(event);
      },
      groupId: groupId || 'care-plan-consumer',
    });
  }

  /**
   * Register Patient event handler
   */
  registerPatientHandler(handler: (event: DomainEvent) => Promise<void>, groupId?: string): void {
    this.registerHandler({
      topic: TOPICS.PATIENT_EVENTS,
      handler: async (message, topic) => {
        const event = this.parseEventFromMessage(message);
        await handler(event);
      },
      groupId: groupId || 'patient-consumer',
    });
  }

  /**
   * Register Appointment event handler
   */
  registerAppointmentHandler(handler: (event: DomainEvent) => Promise<void>, groupId?: string): void {
    this.registerHandler({
      topic: TOPICS.APPOINTMENT_EVENTS,
      handler: async (message, topic) => {
        const event = this.parseEventFromMessage(message);
        await handler(event);
      },
      groupId: groupId || 'appointment-consumer',
    });
  }

  /**
   * Register Notification event handler
   */
  registerNotificationHandler(handler: (event: DomainEvent) => Promise<void>, groupId?: string): void {
    this.registerHandler({
      topic: TOPICS.NOTIFICATION_EVENTS,
      handler: async (message, topic) => {
        const event = this.parseEventFromMessage(message);
        await handler(event);
      },
      groupId: groupId || 'notification-consumer',
    });
  }

  /**
   * Register Audit event handler
   */
  registerAuditHandler(handler: (event: DomainEvent) => Promise<void>, groupId?: string): void {
    this.registerHandler({
      topic: TOPICS.AUDIT_EVENTS,
      handler: async (message, topic) => {
        const event = this.parseEventFromMessage(message);
        await handler(event);
      },
      groupId: groupId || 'audit-consumer',
    });
  }

  /**
   * Start a consumer for a specific handler registration
   */
  private async startConsumer(registration: HandlerRegistration): Promise<void> {
    const wrappedHandler: MessageHandler = async (message, topic) => {
      const metadata: MessageMetadata = {
        topic,
        partition: message.partition,
        timestamp: message.timestamp,
        retryCount: 0,
      };

      await this.processMessageWithRetry(message, topic, registration, metadata);
    };

    await this.kafkaClient.subscribe(
      registration.topic,
      wrappedHandler,
      registration.groupId
    );
  }

  /**
   * Process message with retry logic
   */
  private async processMessageWithRetry(
    message: KafkaMessage,
    topic: string,
    registration: HandlerRegistration,
    metadata: MessageMetadata,
    attempt: number = 1
  ): Promise<void> {
    const maxRetries = registration.maxRetries || this.dlqConfig.maxRetries;
    const retryDelay = registration.retryDelay || 1000;

    try {
      await registration.handler(message, topic);

      // Clear error count on success
      const errorKey = this.getErrorKey(message, topic);
      this.processingErrors.delete(errorKey);

    } catch (error) {
      console.error(`Error processing message from topic ${topic} (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt >= maxRetries) {
        // Send to DLQ if enabled
        if (this.dlqConfig.enabled) {
          await this.sendToDLQ(message, topic, error as Error, metadata);
        }

        // Track error
        const errorKey = this.getErrorKey(message, topic);
        this.processingErrors.set(errorKey, (this.processingErrors.get(errorKey) || 0) + 1);

        throw error;
      }

      // Retry with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));

      metadata.retryCount = attempt;
      return this.processMessageWithRetry(message, topic, registration, metadata, attempt + 1);
    }
  }

  /**
   * Send failed message to Dead Letter Queue
   */
  private async sendToDLQ(
    message: KafkaMessage,
    originalTopic: string,
    error: Error,
    metadata: MessageMetadata
  ): Promise<void> {
    try {
      const dlqMessage: KafkaMessage = {
        key: message.key,
        value: message.value,
        headers: {
          ...message.headers,
          'dlq-original-topic': Buffer.from(originalTopic),
          'dlq-error-message': Buffer.from(error.message),
          'dlq-error-stack': Buffer.from(error.stack || ''),
          'dlq-retry-count': Buffer.from(metadata.retryCount.toString()),
          'dlq-timestamp': Buffer.from(new Date().toISOString()),
        },
        partition: message.partition,
      };

      await this.kafkaClient.publish(this.dlqConfig.topic, dlqMessage);

      console.log(`Sent message to DLQ: ${this.dlqConfig.topic}`);

    } catch (dlqError) {
      console.error('Failed to send message to DLQ:', dlqError);
    }
  }

  /**
   * Parse domain event from Kafka message
   */
  private parseEventFromMessage(message: KafkaMessage): DomainEvent {
    try {
      const value = typeof message.value === 'string' ? message.value : message.value.toString();
      const event = JSON.parse(value) as DomainEvent;

      // Convert timestamp string back to Date
      if (typeof event.timestamp === 'string') {
        event.timestamp = new Date(event.timestamp);
      }

      return event;

    } catch (error) {
      console.error('Failed to parse event from message:', error);
      throw new Error('Invalid event format');
    }
  }

  /**
   * Generate error tracking key
   */
  private getErrorKey(message: KafkaMessage, topic: string): string {
    return `${topic}-${message.key || 'no-key'}-${message.partition || 0}`;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Map<string, number> {
    return new Map(this.processingErrors);
  }

  /**
   * Clear error statistics
   */
  clearErrorStats(): void {
    this.processingErrors.clear();
  }
}

// Export singleton instance
let messageConsumerInstance: MessageConsumer | null = null;

export const getMessageConsumer = (): MessageConsumer => {
  if (!messageConsumerInstance) {
    messageConsumerInstance = new MessageConsumer();
  }
  return messageConsumerInstance;
};

export default MessageConsumer;
