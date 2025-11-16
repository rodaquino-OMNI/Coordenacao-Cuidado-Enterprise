/**
 * Event Producer
 *
 * Producer for publishing domain events to Kafka topics
 */

import { v4 as uuidv4 } from 'uuid';
import { getKafkaClient } from '../kafka.client';
import { DomainEvent, KafkaMessage } from '../kafka.types';
import { TOPICS } from '../kafka.config';

/**
 * Event Producer class for domain events
 */
export class EventProducer {
  private kafkaClient = getKafkaClient();
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000;

  /**
   * Publish a domain event
   */
  async publishEvent(event: DomainEvent, topic?: string): Promise<void> {
    const targetTopic = topic || this.getTopicForEvent(event.eventType);

    try {
      // Validate event
      this.validateEvent(event);

      // Format event as Kafka message
      const message = this.formatEventAsMessage(event);

      // Publish with retry logic
      await this.publishWithRetry(targetTopic, message);

      console.log(`Published event ${event.eventId} to topic ${targetTopic}`);

    } catch (error) {
      console.error(`Failed to publish event ${event.eventId}:`, error);
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch(events: DomainEvent[], topic?: string): Promise<void> {
    try {
      const publishPromises = events.map(event =>
        this.publishEvent(event, topic)
      );

      await Promise.all(publishPromises);

      console.log(`Published batch of ${events.length} events`);

    } catch (error) {
      console.error('Failed to publish event batch:', error);
      throw error;
    }
  }

  /**
   * Publish care plan event
   */
  async publishCarePlanEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const domainEvent: DomainEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      version: 1,
      ...event,
    };

    await this.publishEvent(domainEvent, TOPICS.CARE_PLAN_EVENTS);
  }

  /**
   * Publish patient event
   */
  async publishPatientEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const domainEvent: DomainEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      version: 1,
      ...event,
    };

    await this.publishEvent(domainEvent, TOPICS.PATIENT_EVENTS);
  }

  /**
   * Publish appointment event
   */
  async publishAppointmentEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const domainEvent: DomainEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      version: 1,
      ...event,
    };

    await this.publishEvent(domainEvent, TOPICS.APPOINTMENT_EVENTS);
  }

  /**
   * Publish notification event
   */
  async publishNotificationEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const domainEvent: DomainEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      version: 1,
      ...event,
    };

    await this.publishEvent(domainEvent, TOPICS.NOTIFICATION_EVENTS);
  }

  /**
   * Publish audit event
   */
  async publishAuditEvent(event: Omit<DomainEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const domainEvent: DomainEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      version: 1,
      ...event,
    };

    await this.publishEvent(domainEvent, TOPICS.AUDIT_EVENTS);
  }

  /**
   * Validate domain event
   */
  private validateEvent(event: DomainEvent): void {
    if (!event.eventId) {
      throw new Error('Event must have an eventId');
    }

    if (!event.eventType) {
      throw new Error('Event must have an eventType');
    }

    if (!event.aggregateId) {
      throw new Error('Event must have an aggregateId');
    }

    if (!event.aggregateType) {
      throw new Error('Event must have an aggregateType');
    }

    if (!event.timestamp) {
      throw new Error('Event must have a timestamp');
    }

    if (event.version < 1) {
      throw new Error('Event version must be greater than 0');
    }
  }

  /**
   * Format domain event as Kafka message
   */
  private formatEventAsMessage(event: DomainEvent): KafkaMessage {
    return {
      key: event.aggregateId,
      value: JSON.stringify(event),
      headers: {
        'event-type': Buffer.from(event.eventType),
        'event-id': Buffer.from(event.eventId),
        'aggregate-type': Buffer.from(event.aggregateType),
        'aggregate-id': Buffer.from(event.aggregateId),
        'event-version': Buffer.from(event.version.toString()),
        'correlation-id': event.metadata?.correlationId
          ? Buffer.from(event.metadata.correlationId)
          : Buffer.from(''),
        'causation-id': event.metadata?.causationId
          ? Buffer.from(event.metadata.causationId)
          : Buffer.from(''),
        'user-id': event.metadata?.userId
          ? Buffer.from(event.metadata.userId)
          : Buffer.from(''),
        'tenant-id': event.metadata?.tenantId
          ? Buffer.from(event.metadata.tenantId)
          : Buffer.from(''),
      },
      timestamp: event.timestamp.toISOString(),
    };
  }

  /**
   * Publish message with retry logic
   */
  private async publishWithRetry(topic: string, message: KafkaMessage, attempt: number = 1): Promise<void> {
    try {
      await this.kafkaClient.publish(topic, message);
    } catch (error) {
      if (attempt >= this.maxRetries) {
        console.error(`Failed to publish message after ${this.maxRetries} attempts`);
        throw error;
      }

      console.warn(`Publish attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`);

      await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));

      return this.publishWithRetry(topic, message, attempt + 1);
    }
  }

  /**
   * Determine topic based on event type
   */
  private getTopicForEvent(eventType: string): string {
    if (eventType.includes('CarePlan')) {
      return TOPICS.CARE_PLAN_EVENTS;
    }

    if (eventType.includes('Patient')) {
      return TOPICS.PATIENT_EVENTS;
    }

    if (eventType.includes('Appointment')) {
      return TOPICS.APPOINTMENT_EVENTS;
    }

    if (eventType.includes('Notification')) {
      return TOPICS.NOTIFICATION_EVENTS;
    }

    if (eventType.includes('Audit')) {
      return TOPICS.AUDIT_EVENTS;
    }

    return TOPICS.INTEGRATION_EVENTS;
  }
}

// Export singleton instance
let eventProducerInstance: EventProducer | null = null;

export const getEventProducer = (): EventProducer => {
  if (!eventProducerInstance) {
    eventProducerInstance = new EventProducer();
  }
  return eventProducerInstance;
};

export default EventProducer;
