/**
 * Mock Data Factory
 * Generates realistic test data for fixtures
 */

import { faker } from '@faker-js/faker';

/**
 * User mock data factory
 */
export class UserFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: faker.helpers.arrayElement(['patient', 'provider', 'coordinator', 'admin']),
      phoneNumber: faker.phone.number(),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }),
      gender: faker.helpers.arrayElement(['male', 'female', 'other', 'prefer_not_to_say']),
      language: faker.helpers.arrayElement(['en', 'pt', 'es']),
      timezone: faker.location.timeZone(),
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createPatient(overrides: Partial<any> = {}): any {
    return this.create({
      role: 'patient',
      ...overrides,
    });
  }

  static createProvider(overrides: Partial<any> = {}): any {
    return this.create({
      role: 'provider',
      ...overrides,
    });
  }

  static createCoordinator(overrides: Partial<any> = {}): any {
    return this.create({
      role: 'coordinator',
      ...overrides,
    });
  }
}

/**
 * Conversation mock data factory
 */
export class ConversationFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      sessionId: faker.string.uuid(),
      title: faker.lorem.sentence(),
      status: faker.helpers.arrayElement(['active', 'paused', 'completed', 'archived']),
      language: faker.helpers.arrayElement(['en', 'pt', 'es']),
      metadata: {
        context: faker.helpers.arrayElement(['health_assessment', 'medication_review', 'symptom_check']),
        priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
        tags: faker.helpers.arrayElements(['chronic-care', 'mental-health', 'nutrition'], 2),
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      lastMessageAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createWithMessages(messageCount: number = 5, overrides: Partial<any> = {}): any {
    const conversation = this.create(overrides);
    conversation.messages = MessageFactory.createMany(messageCount, {
      conversationId: conversation.id,
    });
    return conversation;
  }
}

/**
 * Message mock data factory
 */
export class MessageFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      conversationId: faker.string.uuid(),
      role: faker.helpers.arrayElement(['user', 'assistant', 'system']),
      content: faker.lorem.paragraph(),
      tokens: faker.number.int({ min: 10, max: 500 }),
      metadata: {
        sentiment: faker.helpers.arrayElement(['positive', 'neutral', 'negative']),
        entities: [],
        intent: faker.helpers.arrayElement(['question', 'concern', 'update', 'request']),
      },
      createdAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createConversation(messageCount: number, conversationId: string): any[] {
    const messages = [];
    const baseTime = new Date();

    for (let i = 0; i < messageCount; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      messages.push(
        this.create({
          conversationId,
          role,
          createdAt: new Date(baseTime.getTime() + i * 60000), // 1 minute apart
        })
      );
    }

    return messages;
  }
}

/**
 * Health data mock factory
 */
export class HealthDataFactory {
  static create(overrides: Partial<any> = {}): any {
    const type = overrides.type || faker.helpers.arrayElement([
      'vital_signs',
      'medication',
      'lab_result',
      'symptom',
      'activity',
    ]);

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      type,
      data: this.generateHealthData(type),
      source: faker.helpers.arrayElement(['manual', 'device', 'ehr', 'api']),
      timestamp: faker.date.recent(),
      verified: faker.datatype.boolean(),
      metadata: {
        deviceId: faker.string.alphanumeric(16),
        accuracy: faker.number.float({ min: 0.8, max: 1.0, fractionDigits: 2 }),
      },
      createdAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  private static generateHealthData(type: string): any {
    switch (type) {
      case 'vital_signs':
        return {
          heartRate: faker.number.int({ min: 60, max: 100 }),
          bloodPressure: {
            systolic: faker.number.int({ min: 110, max: 140 }),
            diastolic: faker.number.int({ min: 70, max: 90 }),
          },
          temperature: faker.number.float({ min: 36.1, max: 37.2, fractionDigits: 1 }),
          oxygenSaturation: faker.number.int({ min: 95, max: 100 }),
        };
      case 'medication':
        return {
          name: faker.lorem.word(),
          dosage: `${faker.number.int({ min: 5, max: 500 })}mg`,
          frequency: faker.helpers.arrayElement(['daily', 'twice_daily', 'as_needed']),
          takenAt: faker.date.recent(),
        };
      case 'lab_result':
        return {
          testName: faker.helpers.arrayElement(['Blood Glucose', 'Cholesterol', 'A1C']),
          value: faker.number.float({ min: 70, max: 200, fractionDigits: 1 }),
          unit: faker.helpers.arrayElement(['mg/dL', 'mmol/L', '%']),
          referenceRange: { min: 70, max: 100 },
        };
      case 'symptom':
        return {
          name: faker.helpers.arrayElement(['headache', 'fatigue', 'nausea', 'pain']),
          severity: faker.number.int({ min: 1, max: 10 }),
          duration: faker.number.int({ min: 1, max: 24 }), // hours
          notes: faker.lorem.sentence(),
        };
      case 'activity':
        return {
          type: faker.helpers.arrayElement(['walking', 'running', 'cycling', 'swimming']),
          duration: faker.number.int({ min: 10, max: 120 }), // minutes
          distance: faker.number.float({ min: 0.5, max: 10, fractionDigits: 2 }), // km
          calories: faker.number.int({ min: 50, max: 500 }),
        };
      default:
        return {};
    }
  }

  static createVitalSigns(overrides: Partial<any> = {}): any {
    return this.create({ type: 'vital_signs', ...overrides });
  }

  static createMedication(overrides: Partial<any> = {}): any {
    return this.create({ type: 'medication', ...overrides });
  }
}

/**
 * Document mock factory
 */
export class DocumentFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      filename: faker.system.fileName(),
      mimeType: faker.helpers.arrayElement([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/json',
      ]),
      size: faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
      category: faker.helpers.arrayElement([
        'medical_record',
        'lab_result',
        'prescription',
        'image',
        'document',
      ]),
      s3Key: `documents/${faker.string.uuid()}/${faker.system.fileName()}`,
      s3Bucket: 'austa-documents',
      metadata: {
        uploadedBy: faker.string.uuid(),
        description: faker.lorem.sentence(),
        tags: faker.helpers.arrayElements(['important', 'recent', 'shared'], 2),
      },
      processingStatus: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      extractedText: faker.lorem.paragraphs(2),
      virusScanStatus: faker.helpers.arrayElement(['pending', 'clean', 'infected']),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createMedicalRecord(overrides: Partial<any> = {}): any {
    return this.create({
      category: 'medical_record',
      mimeType: 'application/pdf',
      ...overrides,
    });
  }
}

/**
 * Analytics event mock factory
 */
export class AnalyticsEventFactory {
  static create(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      eventType: faker.helpers.arrayElement([
        'conversation_started',
        'message_sent',
        'health_data_recorded',
        'document_uploaded',
        'login',
        'logout',
      ]),
      eventData: {
        sessionId: faker.string.uuid(),
        source: faker.helpers.arrayElement(['web', 'mobile', 'api']),
        metadata: {},
      },
      timestamp: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

/**
 * JWT token factory
 */
export class TokenFactory {
  static createAccessToken(userId: string, role: string = 'patient'): string {
    // This is a mock token - in real tests, use proper JWT library
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({
        userId,
        role,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        iat: Math.floor(Date.now() / 1000),
      })
    ).toString('base64');
    const signature = Buffer.from('mock-signature').toString('base64');

    return `${header}.${payload}.${signature}`;
  }

  static createRefreshToken(userId: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({
        userId,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
        iat: Math.floor(Date.now() / 1000),
      })
    ).toString('base64');
    const signature = Buffer.from('mock-signature').toString('base64');

    return `${header}.${payload}.${signature}`;
  }
}

// Export all factories
export const Factories = {
  User: UserFactory,
  Conversation: ConversationFactory,
  Message: MessageFactory,
  HealthData: HealthDataFactory,
  Document: DocumentFactory,
  AnalyticsEvent: AnalyticsEventFactory,
  Token: TokenFactory,
};
