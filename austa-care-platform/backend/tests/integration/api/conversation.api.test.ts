/**
 * Integration Tests for Conversation API
 * Tests WhatsApp conversation flow end-to-end
 */

import request from 'supertest';
import { app } from '../../../src/server';
import { TestDatabase } from '../../helpers/test-database';
import { TestFactories } from '../../helpers/test-factories';

describe('Conversation API Integration Tests', () => {
  let testDb: TestDatabase;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.connect();
    await testDb.cleanup();

    // Create test user and get auth token
    const userData = TestFactories.createUser();
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send(userData);

    testUser = signupResponse.body.user;
    authToken = signupResponse.body.token;
  });

  afterAll(async () => {
    await testDb.cleanup();
    await testDb.disconnect();
  });

  beforeEach(async () => {
    // Clean conversations before each test
    await testDb.getPrismaClient().conversation.deleteMany({});
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'whatsapp',
          externalId: '5511999999999'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.platform).toBe('whatsapp');
      expect(response.body.status).toBe('active');
    });

    it('should reject conversation creation without authentication', async () => {
      await request(app)
        .post('/api/conversations')
        .send({
          platform: 'whatsapp'
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/conversations', () => {
    it('should get all user conversations', async () => {
      // Create test conversations
      await testDb.getPrismaClient().conversation.createMany({
        data: [
          {
            userId: testUser.id,
            platform: 'whatsapp',
            status: 'active',
            startedAt: new Date()
          },
          {
            userId: testUser.id,
            platform: 'whatsapp',
            status: 'completed',
            startedAt: new Date(),
            endedAt: new Date()
          }
        ]
      });

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations).toHaveLength(2);
      expect(response.body.conversations[0]).toHaveProperty('id');
    });

    it('should filter conversations by status', async () => {
      await testDb.getPrismaClient().conversation.createMany({
        data: [
          {
            userId: testUser.id,
            platform: 'whatsapp',
            status: 'active',
            startedAt: new Date()
          },
          {
            userId: testUser.id,
            platform: 'whatsapp',
            status: 'completed',
            startedAt: new Date(),
            endedAt: new Date()
          }
        ]
      });

      const response = await request(app)
        .get('/api/conversations?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].status).toBe('active');
    });

    it('should paginate conversations', async () => {
      // Create 15 conversations
      const conversations = Array.from({ length: 15 }, () => ({
        userId: testUser.id,
        platform: 'whatsapp',
        status: 'active',
        startedAt: new Date()
      }));

      await testDb.getPrismaClient().conversation.createMany({
        data: conversations
      });

      const response = await request(app)
        .get('/api/conversations?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations).toHaveLength(10);
      expect(response.body.pagination.total).toBe(15);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should get conversation by id', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      const response = await request(app)
        .get(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(conversation.id);
      expect(response.body.userId).toBe(testUser.id);
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app)
        .get('/api/conversations/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should prevent access to other user conversations', async () => {
      // Create another user
      const otherUserData = TestFactories.createUser();
      const otherUserResponse = await request(app)
        .post('/api/auth/signup')
        .send(otherUserData);

      const otherUser = otherUserResponse.body.user;

      // Create conversation for other user
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: otherUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      // Try to access with testUser token
      await request(app)
        .get(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /api/conversations/:id/messages', () => {
    it('should send message in conversation', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      const response = await request(app)
        .post(`/api/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello, this is a test message',
          type: 'text'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.conversationId).toBe(conversation.id);
      expect(response.body.content).toBe('Hello, this is a test message');
      expect(response.body.type).toBe('text');
    });

    it('should validate message content', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      await request(app)
        .post(`/api/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'text'
          // Missing content
        })
        .expect(400);
    });

    it('should reject messages to completed conversations', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'completed',
          startedAt: new Date(),
          endedAt: new Date()
        }
      });

      await request(app)
        .post(`/api/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Test message',
          type: 'text'
        })
        .expect(400);
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    it('should get all messages in conversation', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      // Create messages
      await testDb.getPrismaClient().message.createMany({
        data: [
          {
            conversationId: conversation.id,
            senderId: testUser.id,
            content: 'Message 1',
            type: 'text',
            timestamp: new Date()
          },
          {
            conversationId: conversation.id,
            senderId: testUser.id,
            content: 'Message 2',
            type: 'text',
            timestamp: new Date()
          }
        ]
      });

      const response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].content).toBeDefined();
    });

    it('should paginate messages', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      // Create 25 messages
      const messages = Array.from({ length: 25 }, (_, i) => ({
        conversationId: conversation.id,
        senderId: testUser.id,
        content: `Message ${i + 1}`,
        type: 'text',
        timestamp: new Date()
      }));

      await testDb.getPrismaClient().message.createMany({ data: messages });

      const response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages?page=1&limit=20`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.messages).toHaveLength(20);
      expect(response.body.pagination.total).toBe(25);
    });
  });

  describe('PUT /api/conversations/:id/end', () => {
    it('should end active conversation', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      const response = await request(app)
        .put(`/api/conversations/${conversation.id}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.endedAt).toBeDefined();
    });

    it('should reject ending already completed conversation', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'completed',
          startedAt: new Date(),
          endedAt: new Date()
        }
      });

      await request(app)
        .put(`/api/conversations/${conversation.id}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('DELETE /api/conversations/:id', () => {
    it('should delete conversation', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'completed',
          startedAt: new Date(),
          endedAt: new Date()
        }
      });

      await request(app)
        .delete(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      const deleted = await testDb.getPrismaClient().conversation.findUnique({
        where: { id: conversation.id }
      });

      expect(deleted).toBeNull();
    });

    it('should reject deleting active conversation', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      await request(app)
        .delete(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on message sending', async () => {
      const conversation = await testDb.getPrismaClient().conversation.create({
        data: {
          userId: testUser.id,
          platform: 'whatsapp',
          status: 'active',
          startedAt: new Date()
        }
      });

      // Send multiple messages quickly
      const requests = Array.from({ length: 100 }, () =>
        request(app)
          .post(`/api/conversations/${conversation.id}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: 'Rapid fire message',
            type: 'text'
          })
      );

      const responses = await Promise.all(requests);

      // At least some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
