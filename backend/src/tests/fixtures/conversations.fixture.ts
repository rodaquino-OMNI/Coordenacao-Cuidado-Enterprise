/**
 * Conversation Test Fixtures
 * Predefined conversation data for testing
 */

import { ConversationFactory, MessageFactory } from '../utils/mock-factory';
import { testUsers } from './users.fixture';

/**
 * Standard test conversations
 */
export const testConversations = {
  // Active health assessment conversation
  healthAssessment: ConversationFactory.create({
    id: 'test-conv-1',
    userId: testUsers.patient1.id,
    sessionId: 'session-1',
    title: 'Health Assessment - Chronic Care',
    status: 'active',
    language: 'en',
    metadata: {
      context: 'health_assessment',
      priority: 'medium',
      tags: ['chronic-care', 'diabetes'],
    },
  }),

  // Medication review conversation
  medicationReview: ConversationFactory.create({
    id: 'test-conv-2',
    userId: testUsers.patient1.id,
    sessionId: 'session-2',
    title: 'Medication Review',
    status: 'active',
    language: 'en',
    metadata: {
      context: 'medication_review',
      priority: 'high',
      tags: ['medication', 'review'],
    },
  }),

  // Symptom check conversation
  symptomCheck: ConversationFactory.create({
    id: 'test-conv-3',
    userId: testUsers.patient2.id,
    sessionId: 'session-3',
    title: 'Symptom Check - Headache',
    status: 'active',
    language: 'en',
    metadata: {
      context: 'symptom_check',
      priority: 'urgent',
      tags: ['symptom', 'headache'],
    },
  }),

  // Portuguese conversation
  conversationPt: ConversationFactory.create({
    id: 'test-conv-pt',
    userId: testUsers.patientPt.id,
    sessionId: 'session-pt',
    title: 'Avaliação de Saúde',
    status: 'active',
    language: 'pt',
    metadata: {
      context: 'health_assessment',
      priority: 'medium',
      tags: ['saude', 'avaliacao'],
    },
  }),

  // Paused conversation
  pausedConversation: ConversationFactory.create({
    id: 'test-conv-paused',
    userId: testUsers.patient1.id,
    sessionId: 'session-paused',
    title: 'Paused Conversation',
    status: 'paused',
    language: 'en',
    metadata: {
      context: 'health_assessment',
      priority: 'low',
      tags: ['paused'],
    },
  }),

  // Completed conversation
  completedConversation: ConversationFactory.create({
    id: 'test-conv-completed',
    userId: testUsers.patient1.id,
    sessionId: 'session-completed',
    title: 'Completed Assessment',
    status: 'completed',
    language: 'en',
    metadata: {
      context: 'health_assessment',
      priority: 'medium',
      tags: ['completed', 'archived'],
    },
  }),
};

/**
 * Standard test messages
 */
export const testMessages = {
  // Health assessment messages
  healthAssessmentMessages: [
    MessageFactory.create({
      id: 'msg-1',
      conversationId: testConversations.healthAssessment.id,
      role: 'user',
      content: 'I need help managing my diabetes.',
      metadata: {
        sentiment: 'neutral',
        intent: 'request',
        entities: ['diabetes'],
      },
    }),
    MessageFactory.create({
      id: 'msg-2',
      conversationId: testConversations.healthAssessment.id,
      role: 'assistant',
      content: "I'm here to help. Let's start with your current blood sugar levels.",
      metadata: {
        sentiment: 'positive',
        intent: 'question',
        entities: ['blood sugar'],
      },
    }),
    MessageFactory.create({
      id: 'msg-3',
      conversationId: testConversations.healthAssessment.id,
      role: 'user',
      content: 'My fasting blood sugar was 145 this morning.',
      metadata: {
        sentiment: 'neutral',
        intent: 'update',
        entities: ['blood sugar', '145'],
      },
    }),
  ],

  // Medication review messages
  medicationMessages: [
    MessageFactory.create({
      id: 'msg-med-1',
      conversationId: testConversations.medicationReview.id,
      role: 'user',
      content: 'I forgot to take my medication this morning.',
      metadata: {
        sentiment: 'negative',
        intent: 'concern',
        entities: ['medication', 'forgot'],
      },
    }),
    MessageFactory.create({
      id: 'msg-med-2',
      conversationId: testConversations.medicationReview.id,
      role: 'assistant',
      content: 'Take your medication now if it has been less than 12 hours.',
      metadata: {
        sentiment: 'neutral',
        intent: 'instruction',
        entities: ['medication', 'timing'],
      },
    }),
  ],

  // Symptom check messages
  symptomMessages: [
    MessageFactory.create({
      id: 'msg-symp-1',
      conversationId: testConversations.symptomCheck.id,
      role: 'user',
      content: 'I have a severe headache that started 2 hours ago.',
      metadata: {
        sentiment: 'negative',
        intent: 'concern',
        entities: ['headache', 'severe', '2 hours'],
      },
    }),
    MessageFactory.create({
      id: 'msg-symp-2',
      conversationId: testConversations.symptomCheck.id,
      role: 'assistant',
      content: 'On a scale of 1-10, how would you rate the pain?',
      metadata: {
        sentiment: 'neutral',
        intent: 'question',
        entities: ['pain', 'scale'],
      },
    }),
    MessageFactory.create({
      id: 'msg-symp-3',
      conversationId: testConversations.symptomCheck.id,
      role: 'user',
      content: 'About 8 out of 10. It is really painful.',
      metadata: {
        sentiment: 'negative',
        intent: 'update',
        entities: ['pain', '8'],
      },
    }),
  ],
};

/**
 * Conversation with full message history
 */
export const conversationsWithMessages = {
  healthAssessmentFull: {
    ...testConversations.healthAssessment,
    messages: testMessages.healthAssessmentMessages,
  },
  medicationReviewFull: {
    ...testConversations.medicationReview,
    messages: testMessages.medicationMessages,
  },
  symptomCheckFull: {
    ...testConversations.symptomCheck,
    messages: testMessages.symptomMessages,
  },
};

/**
 * Conversation groups for batch testing
 */
export const conversationGroups = {
  activeConversations: [
    testConversations.healthAssessment,
    testConversations.medicationReview,
    testConversations.symptomCheck,
    testConversations.conversationPt,
  ],
  patient1Conversations: [
    testConversations.healthAssessment,
    testConversations.medicationReview,
    testConversations.pausedConversation,
    testConversations.completedConversation,
  ],
  urgentConversations: [testConversations.symptomCheck],
};

/**
 * Helper to get conversation by ID
 */
export function getConversationById(id: string): any {
  return Object.values(testConversations).find(conv => conv.id === id);
}

/**
 * Helper to get conversations by user ID
 */
export function getConversationsByUserId(userId: string): any[] {
  return Object.values(testConversations).filter(conv => conv.userId === userId);
}

/**
 * Helper to get messages by conversation ID
 */
export function getMessagesByConversationId(conversationId: string): any[] {
  return Object.values(testMessages)
    .flat()
    .filter(msg => msg.conversationId === conversationId);
}
