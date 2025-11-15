/**
 * Test Kafka Setup Utilities
 * Provides isolated Kafka instance for testing
 */

import { Kafka, Producer, Consumer, Admin } from 'kafkajs';

let testKafka: Kafka | null = null;
let testProducer: Producer | null = null;
let testConsumer: Consumer | null = null;
let testAdmin: Admin | null = null;

const TEST_TOPICS = [
  'test-health-data',
  'test-conversations',
  'test-notifications',
  'test-analytics',
];

/**
 * Creates and initializes test Kafka connection
 */
export async function setupTestKafka(): Promise<Kafka> {
  const brokers = (process.env.TEST_KAFKA_BROKERS || 'localhost:9092').split(',');

  testKafka = new Kafka({
    clientId: 'austa-test',
    brokers,
    retry: {
      initialRetryTime: 100,
      retries: 3,
    },
    connectionTimeout: 3000,
    requestTimeout: 5000,
  });

  try {
    // Create admin client
    testAdmin = testKafka.admin();
    await testAdmin.connect();

    // Create test topics
    await createTestTopics();

    // Create producer
    testProducer = testKafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
    await testProducer.connect();

    // Create consumer
    testConsumer = testKafka.consumer({
      groupId: 'test-consumer-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    await testConsumer.connect();

    console.log('Test Kafka connected and ready');
    return testKafka;
  } catch (error) {
    console.error('Failed to setup test Kafka:', error);
    throw error;
  }
}

/**
 * Creates test topics
 */
async function createTestTopics(): Promise<void> {
  if (!testAdmin) {
    throw new Error('Test Kafka admin not initialized');
  }

  try {
    // Delete existing test topics
    const existingTopics = await testAdmin.listTopics();
    const testTopicsToDelete = existingTopics.filter(t => t.startsWith('test-'));

    if (testTopicsToDelete.length > 0) {
      await testAdmin.deleteTopics({
        topics: testTopicsToDelete,
        timeout: 5000,
      });
    }

    // Create test topics
    await testAdmin.createTopics({
      topics: TEST_TOPICS.map(topic => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
      waitForLeaders: true,
      timeout: 5000,
    });
  } catch (error) {
    console.error('Failed to create test topics:', error);
    throw error;
  }
}

/**
 * Cleans up test Kafka connection
 */
export async function cleanupTestKafka(): Promise<void> {
  try {
    if (testConsumer) {
      await testConsumer.disconnect();
      testConsumer = null;
    }

    if (testProducer) {
      await testProducer.disconnect();
      testProducer = null;
    }

    if (testAdmin) {
      // Delete test topics
      await testAdmin.deleteTopics({
        topics: TEST_TOPICS,
        timeout: 5000,
      });

      await testAdmin.disconnect();
      testAdmin = null;
    }

    testKafka = null;

    console.log('Test Kafka cleaned up');
  } catch (error) {
    console.error('Failed to cleanup test Kafka:', error);
  }
}

/**
 * Gets test Kafka instance
 */
export function getTestKafka(): Kafka | null {
  return testKafka;
}

/**
 * Gets test producer
 */
export function getTestProducer(): Producer | null {
  return testProducer;
}

/**
 * Gets test consumer
 */
export function getTestConsumer(): Consumer | null {
  return testConsumer;
}

/**
 * Clears all messages from test topics
 */
export async function clearTestTopics(): Promise<void> {
  if (!testAdmin) {
    throw new Error('Test Kafka admin not initialized');
  }

  // Delete and recreate topics
  await testAdmin.deleteTopics({
    topics: TEST_TOPICS,
    timeout: 5000,
  });

  await createTestTopics();
}

/**
 * Publishes test messages
 */
export async function publishTestMessages(
  topic: string,
  messages: Array<{ key?: string; value: any }>
): Promise<void> {
  if (!testProducer) {
    throw new Error('Test Kafka producer not initialized');
  }

  await testProducer.send({
    topic,
    messages: messages.map(msg => ({
      key: msg.key,
      value: JSON.stringify(msg.value),
    })),
  });
}

/**
 * Consumes test messages
 */
export async function consumeTestMessages(
  topic: string,
  timeout: number = 5000
): Promise<any[]> {
  if (!testConsumer) {
    throw new Error('Test Kafka consumer not initialized');
  }

  const messages: any[] = [];

  await testConsumer.subscribe({ topic, fromBeginning: true });

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resolve(messages);
    }, timeout);

    testConsumer!.run({
      eachMessage: async ({ message }) => {
        messages.push(JSON.parse(message.value!.toString()));
        clearTimeout(timeoutId);
        resolve(messages);
      },
    }).catch(reject);
  });
}

/**
 * Mock Kafka for unit tests
 */
export class MockKafka {
  private messages: Map<string, any[]> = new Map();

  async send(topic: string, messages: any[]): Promise<void> {
    if (!this.messages.has(topic)) {
      this.messages.set(topic, []);
    }
    this.messages.get(topic)!.push(...messages);
  }

  async consume(topic: string): Promise<any[]> {
    return this.messages.get(topic) || [];
  }

  async clear(topic?: string): Promise<void> {
    if (topic) {
      this.messages.delete(topic);
    } else {
      this.messages.clear();
    }
  }

  getMessages(topic: string): any[] {
    return this.messages.get(topic) || [];
  }
}

/**
 * Creates a mock Kafka instance for unit tests
 */
export function createMockKafka(): MockKafka {
  return new MockKafka();
}
