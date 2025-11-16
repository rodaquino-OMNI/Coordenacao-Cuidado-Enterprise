/**
 * E2E Tests for WhatsApp Conversation Flow
 * Tests complete user journey from message receipt to risk assessment
 */

import request from 'supertest';
import { app } from '../../src/server';
import { TestDatabase } from '../helpers/test-database';
import { whatsappService } from '../../src/services/whatsapp.service';

// Mock WhatsApp service
jest.mock('../../src/services/whatsapp.service');

describe('WhatsApp Conversation Flow E2E Tests', () => {
  let testDb: TestDatabase;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.connect();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup();

    // Create test user
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'whatsapp-test@example.com',
        password: 'SecurePassword123!',
        name: 'WhatsApp Test User',
        phone: '5511999999999'
      });

    testUser = signupResponse.body.user;
    authToken = signupResponse.body.token;

    // Mock WhatsApp service responses
    (whatsappService.sendTextMessage as jest.Mock).mockResolvedValue({
      messageId: 'mock_msg_123',
      status: 'sent'
    });

    (whatsappService.getInstanceStatus as jest.Mock).mockResolvedValue({
      connected: true,
      phone: '5511888888888',
      state: 'CONNECTED'
    });
  });

  describe('Initial Contact and Conversation Start', () => {
    it('should create conversation when user sends first message', async () => {
      const webhookPayload = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_001',
          body: 'Olá, preciso de ajuda',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.conversationCreated).toBe(true);
      expect(response.body.conversationId).toBeDefined();
    });

    it('should send welcome message on first contact', async () => {
      const webhookPayload = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_001',
          body: 'Olá',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      await request(app)
        .post('/api/webhooks/whatsapp')
        .send(webhookPayload)
        .expect(200);

      // Verify welcome message was sent
      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: testUser.phone,
          message: expect.stringContaining('Bem-vindo')
        })
      );
    });

    it('should create user if phone number is new', async () => {
      const newPhone = '5511888888888';

      const webhookPayload = {
        instanceId: 'test-instance',
        phone: newPhone,
        message: {
          id: 'msg_001',
          body: 'Primeira mensagem',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.userCreated).toBe(true);

      // Verify user was created
      const user = await testDb.getPrismaClient().user.findFirst({
        where: { phone: newPhone }
      });

      expect(user).toBeDefined();
    });
  });

  describe('Symptom Collection Flow', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Start conversation
      const startResponse = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_start',
            body: 'Preciso de ajuda médica',
            fromMe: false,
            timestamp: Date.now()
          }
        });

      conversationId = startResponse.body.conversationId;
    });

    it('should guide user through symptom questionnaire', async () => {
      // User answers symptom questions
      const symptoms = [
        { message: 'Estou com dor de cabeça', expectedKeyword: 'duração' },
        { message: 'Há 2 dias', expectedKeyword: 'intensidade' },
        { message: 'Forte', expectedKeyword: 'outros sintomas' }
      ];

      for (const symptom of symptoms) {
        const response = await request(app)
          .post('/api/webhooks/whatsapp')
          .send({
            instanceId: 'test-instance',
            phone: testUser.phone,
            message: {
              id: `msg_${Math.random()}`,
              body: symptom.message,
              fromMe: false,
              timestamp: Date.now()
            }
          })
          .expect(200);

        // Verify appropriate follow-up question was sent
        const lastCall = (whatsappService.sendTextMessage as jest.Mock).mock.calls.slice(-1)[0];
        expect(lastCall[0].message.toLowerCase()).toContain(symptom.expectedKeyword);
      }
    });

    it('should detect emergency keywords and escalate immediately', async () => {
      const emergencyMessage = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_emergency',
          body: 'Estou com dor no peito e falta de ar',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(emergencyMessage)
        .expect(200);

      expect(response.body.emergencyDetected).toBe(true);
      expect(response.body.escalationLevel).toBe('immediate');

      // Verify emergency alert was sent
      const lastCall = (whatsappService.sendTextMessage as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0].message).toContain('SAMU');
      expect(lastCall[0].message).toContain('192');
    });

    it('should store all symptom data in conversation context', async () => {
      await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_symptom',
            body: 'Tenho febre, tosse e fadiga',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      // Verify conversation context was updated
      const conversation = await testDb.getPrismaClient().conversation.findUnique({
        where: { id: conversationId },
        include: { messages: true }
      });

      expect(conversation).toBeDefined();
      expect(conversation!.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment Integration', () => {
    it('should trigger risk assessment after collecting symptoms', async () => {
      // Complete symptom questionnaire
      const questionnaireResponses = [
        'Tenho sede excessiva',
        'Sim, também muita fome',
        'E vou muito ao banheiro urinar',
        'Há duas semanas',
        'Perdi 5kg sem fazer dieta'
      ];

      for (const response of questionnaireResponses) {
        await request(app)
          .post('/api/webhooks/whatsapp')
          .send({
            instanceId: 'test-instance',
            phone: testUser.phone,
            message: {
              id: `msg_${Math.random()}`,
              body: response,
              fromMe: false,
              timestamp: Date.now()
            }
          });
      }

      // Trigger assessment
      const assessmentResponse = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_complete',
            body: 'Já respondi tudo',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      expect(assessmentResponse.body.riskAssessmentCompleted).toBe(true);
      expect(assessmentResponse.body.riskLevel).toBeDefined();
    });

    it('should send risk assessment summary to user', async () => {
      // Simulate completed assessment
      const assessment = {
        userId: testUser.id,
        diabetes: {
          riskLevel: 'high',
          classicTriad: { triadComplete: true }
        },
        composite: {
          riskLevel: 'high'
        }
      };

      await testDb.getPrismaClient().riskAssessment.create({
        data: {
          userId: testUser.id,
          assessmentData: JSON.stringify(assessment),
          riskLevel: 'high',
          createdAt: new Date()
        }
      });

      // Request assessment summary
      await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_summary',
            body: 'Qual o resultado?',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      // Verify summary was sent
      const lastCall = (whatsappService.sendTextMessage as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0].message).toContain('avaliação');
      expect(lastCall[0].message).toContain('risco');
    });

    it('should provide recommendations based on risk level', async () => {
      const highRiskAssessment = {
        userId: testUser.id,
        riskLevel: 'critical',
        recommendations: [
          {
            category: 'urgent',
            recommendation: 'Procurar pronto-socorro imediatamente'
          }
        ]
      };

      await testDb.getPrismaClient().riskAssessment.create({
        data: {
          userId: testUser.id,
          assessmentData: JSON.stringify(highRiskAssessment),
          riskLevel: 'critical',
          createdAt: new Date()
        }
      });

      await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_recommendations',
            body: 'O que devo fazer?',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      const lastCall = (whatsappService.sendTextMessage as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0].message).toContain('pronto-socorro');
    });
  });

  describe('Interactive Message Handling', () => {
    it('should handle button responses', async () => {
      const buttonResponse = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_button',
          body: 'Sintomas Respiratórios',
          type: 'button_reply',
          buttonId: 'respiratory_symptoms',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(buttonResponse)
        .expect(200);

      expect(response.body.categorySelected).toBe('respiratory');
    });

    it('should handle list selections', async () => {
      const listResponse = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_list',
          body: 'Diabetes',
          type: 'list_reply',
          listId: 'diabetes_condition',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(listResponse)
        .expect(200);

      expect(response.body.conditionSelected).toBe('diabetes');
    });
  });

  describe('Document and Media Handling', () => {
    it('should receive and process health documents via WhatsApp', async () => {
      const documentMessage = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_document',
          type: 'document',
          document: 'https://example.com/exam.pdf',
          fileName: 'exam_result.pdf',
          mimeType: 'application/pdf',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(documentMessage)
        .expect(200);

      expect(response.body.documentReceived).toBe(true);
      expect(response.body.documentId).toBeDefined();

      // Verify document was saved
      const document = await testDb.getPrismaClient().healthDocument.findFirst({
        where: { userId: testUser.id }
      });

      expect(document).toBeDefined();
      expect(document!.fileName).toBe('exam_result.pdf');
    });

    it('should acknowledge image receipt and inform about processing', async () => {
      const imageMessage = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_image',
          type: 'image',
          image: 'https://example.com/prescription.jpg',
          caption: 'Minha receita médica',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      await request(app)
        .post('/api/webhooks/whatsapp')
        .send(imageMessage)
        .expect(200);

      // Verify acknowledgment message
      const lastCall = (whatsappService.sendTextMessage as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0].message).toContain('recebemos sua imagem');
    });
  });

  describe('Conversation Flow Control', () => {
    it('should handle user requesting to restart questionnaire', async () => {
      const restartMessage = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_restart',
          body: 'Quero recomeçar',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(restartMessage)
        .expect(200);

      expect(response.body.conversationRestarted).toBe(true);
    });

    it('should handle user pausing conversation', async () => {
      const pauseMessage = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_pause',
          body: 'Vou pausar por agora',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(pauseMessage)
        .expect(200);

      expect(response.body.conversationPaused).toBe(true);

      // Verify pause confirmation
      const lastCall = (whatsappService.sendTextMessage as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0].message).toContain('quando quiser continuar');
    });

    it('should resume conversation from where it was paused', async () => {
      // Pause conversation
      await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_pause',
            body: 'Pausar',
            fromMe: false,
            timestamp: Date.now()
          }
        });

      // Resume conversation
      const resumeResponse = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_resume',
            body: 'Continuar',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      expect(resumeResponse.body.conversationResumed).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle WhatsApp service errors gracefully', async () => {
      // Mock WhatsApp service failure
      (whatsappService.sendTextMessage as jest.Mock).mockRejectedValueOnce(
        new Error('WhatsApp service unavailable')
      );

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_error',
            body: 'Test message',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      expect(response.body.queued).toBe(true);
    });

    it('should handle malformed webhook payloads', async () => {
      const malformedPayload = {
        // Missing required fields
        phone: testUser.phone
      };

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(malformedPayload)
        .expect(400);

      expect(response.body.error).toContain('Invalid webhook payload');
    });

    it('should handle duplicate message IDs', async () => {
      const messagePayload = {
        instanceId: 'test-instance',
        phone: testUser.phone,
        message: {
          id: 'msg_duplicate',
          body: 'Test message',
          fromMe: false,
          timestamp: Date.now()
        }
      };

      // Send same message twice
      await request(app)
        .post('/api/webhooks/whatsapp')
        .send(messagePayload)
        .expect(200);

      const duplicateResponse = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(messagePayload)
        .expect(200);

      expect(duplicateResponse.body.duplicate).toBe(true);
    });
  });

  describe('Privacy and Data Protection', () => {
    it('should not store sensitive health data in plain text', async () => {
      await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          instanceId: 'test-instance',
          phone: testUser.phone,
          message: {
            id: 'msg_sensitive',
            body: 'Meu CPF é 123.456.789-00',
            fromMe: false,
            timestamp: Date.now()
          }
        })
        .expect(200);

      // Verify sensitive data was anonymized/encrypted
      const messages = await testDb.getPrismaClient().message.findMany({
        where: { content: { contains: '123.456.789-00' } }
      });

      expect(messages.length).toBe(0); // Should be redacted
    });

    it('should comply with LGPD data retention policies', async () => {
      // Create old conversation
      const oldConversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'completed',
          startedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000), // 91 days ago
          endedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        }
      });

      // Trigger data cleanup
      await request(app)
        .post('/api/admin/cleanup-old-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify old conversation was archived or deleted
      const conversation = await testDb.getPrismaClient().conversation.findUnique({
        where: { id: oldConversation.id }
      });

      expect(conversation?.status).toBe('archived');
    });
  });
});
