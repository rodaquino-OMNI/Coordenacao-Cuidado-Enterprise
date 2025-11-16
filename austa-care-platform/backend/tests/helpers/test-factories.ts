/**
 * Test Data Factories
 * Provides mock data generators for all entities
 */

import { faker } from '@faker-js/faker';

export class TestFactories {
  /**
   * Create mock user
   */
  static createUser(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      name: faker.person.fullName(),
      phone: faker.phone.number('11#########'),
      role: 'patient',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Create mock conversation
   */
  static createConversation(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      startedAt: new Date(),
      endedAt: null,
      status: 'active',
      platform: 'whatsapp',
      ...overrides
    };
  }

  /**
   * Create mock message
   */
  static createMessage(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      conversationId: faker.string.uuid(),
      senderId: faker.string.uuid(),
      content: faker.lorem.sentence(),
      type: 'text',
      timestamp: new Date(),
      ...overrides
    };
  }

  /**
   * Create mock questionnaire response
   */
  static createQuestionnaireResponse(overrides: Partial<any> = {}) {
    return {
      userId: faker.string.uuid(),
      questionnaireId: faker.string.uuid(),
      timestamp: new Date(),
      extractedSymptoms: [],
      riskFactors: [],
      emergencyFlags: [],
      responses: [],
      ...overrides
    };
  }

  /**
   * Create mock risk assessment
   */
  static createRiskAssessment(overrides: Partial<any> = {}) {
    return {
      userId: faker.string.uuid(),
      assessmentId: faker.string.uuid(),
      timestamp: new Date(),
      cardiovascular: {
        overallScore: 10,
        riskLevel: 'low',
        factors: {},
        framinghamScore: 5,
        emergencyIndicators: [],
        recommendations: [],
        escalationRequired: false,
        timeToEscalation: 72
      },
      diabetes: {
        overallScore: 10,
        riskLevel: 'low',
        classicTriad: {
          polydipsia: false,
          polyphagia: false,
          polyuria: false,
          triadComplete: false,
          triadScore: 0
        },
        additionalFactors: {},
        ketosisRisk: 0,
        dkaRisk: 0,
        emergencyIndicators: [],
        timeToEscalation: 72
      },
      mentalHealth: {
        overallScore: 5,
        riskLevel: 'low',
        depressionIndicators: { phq9Score: 2 },
        anxietyIndicators: { gad7Score: 3 },
        suicideRisk: {
          riskLevel: 'none',
          riskFactors: [],
          protectiveFactors: [],
          immediateIntervention: false
        },
        escalationRequired: false,
        timeToEscalation: 72
      },
      respiratory: {
        overallScore: 5,
        riskLevel: 'low',
        asthmaIndicators: {},
        copdIndicators: {},
        sleepApneaIndicators: {},
        emergencyIndicators: [],
        timeToEscalation: 72
      },
      composite: {
        overallScore: 10,
        riskLevel: 'low',
        multipleConditionsPenalty: 1,
        synergyFactor: 1,
        ageAdjustment: 1,
        genderAdjustment: 1,
        socioeconomicFactors: 1,
        accessToCareFactor: 1,
        prioritizedConditions: [],
        emergencyEscalation: false,
        urgentEscalation: false,
        routineFollowup: false
      },
      emergencyAlerts: [],
      recommendations: [],
      followupSchedule: {
        immediate: [],
        within24h: [],
        within1week: [],
        within1month: [],
        routine: []
      },
      escalationProtocol: {
        immediate: false,
        urgent: false,
        timeToEscalation: 72,
        escalationLevel: 'ai_only',
        notificationChannels: [],
        automaticScheduling: false
      },
      ...overrides
    };
  }

  /**
   * Create mock health document
   */
  static createHealthDocument(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      type: 'exam',
      fileName: 'test-exam.pdf',
      url: faker.internet.url(),
      uploadedAt: new Date(),
      processedAt: null,
      status: 'pending',
      ...overrides
    };
  }

  /**
   * Create mock appointment
   */
  static createAppointment(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      doctorId: faker.string.uuid(),
      scheduledAt: faker.date.future(),
      duration: 30,
      type: 'consultation',
      status: 'scheduled',
      ...overrides
    };
  }
}
