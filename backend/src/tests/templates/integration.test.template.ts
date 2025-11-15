/**
 * Integration Test Template
 * Copy this file and customize for your integration tests
 *
 * Integration tests verify that multiple components work together correctly
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '@/app';
import { getTestPool, clearTestDatabase } from '@tests/utils/test-db.setup';
import { getTestRedis, clearTestRedis } from '@tests/utils/test-redis.setup';
import { TokenFactory } from '@tests/utils/mock-factory';
import { testUsers } from '@tests/fixtures/users.fixture';

describe('Your Feature Integration Tests', () => {
  let app: Express;
  let authToken: string;

  // Setup before all tests
  beforeAll(async () => {
    // Initialize app with test configuration
    app = createApp();

    // Generate auth token for authenticated requests
    authToken = TokenFactory.createAccessToken(testUsers.patient1.id, 'patient');
  });

  // Setup before each test
  beforeEach(async () => {
    // Clear database and cache between tests
    await clearTestDatabase();
    await clearTestRedis();
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Close connections
    const pool = getTestPool();
    if (pool) await pool.end();

    const redis = getTestRedis();
    if (redis) await redis.quit();
  });

  describe('POST /api/entities - Create Entity', () => {
    it('should create entity successfully', async () => {
      // Arrange
      const entityData = {
        name: 'Test Entity',
        value: 123,
        description: 'Integration test entity',
      };

      // Act
      const response = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send(entityData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          name: entityData.name,
          value: entityData.value,
          createdAt: expect.any(String),
        }),
      });

      // Verify database state
      const pool = getTestPool();
      const result = await pool!.query('SELECT * FROM entities WHERE id = $1', [
        response.body.data.id,
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(entityData.name);
    });

    it('should return 400 for invalid data', async () => {
      // Act
      const response = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('validation'),
      });
    });

    it('should return 401 without authentication', async () => {
      // Act
      await request(app)
        .post('/api/entities')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/entities/:id - Get Entity', () => {
    it('should retrieve entity by ID', async () => {
      // Arrange - Create entity first
      const createResponse = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Entity', value: 123 })
        .expect(201);

      const entityId = createResponse.body.data.id;

      // Act
      const response = await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: entityId,
          name: 'Test Entity',
        }),
      });
    });

    it('should return 404 for non-existent entity', async () => {
      // Act
      const response = await request(app)
        .get('/api/entities/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found'),
      });
    });

    it('should cache entity in Redis', async () => {
      // Arrange - Create entity
      const createResponse = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cached Entity', value: 456 })
        .expect(201);

      const entityId = createResponse.body.data.id;

      // Act - First request (should cache)
      await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert - Verify Redis cache
      const redis = getTestRedis();
      const cached = await redis!.get(`entity:${entityId}`);
      expect(cached).toBeTruthy();
      expect(JSON.parse(cached!)).toMatchObject({
        id: entityId,
        name: 'Cached Entity',
      });

      // Second request should use cache
      const response = await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: entityId,
        name: 'Cached Entity',
      });
    });
  });

  describe('PUT /api/entities/:id - Update Entity', () => {
    it('should update entity successfully', async () => {
      // Arrange - Create entity first
      const createResponse = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Original Name', value: 100 })
        .expect(201);

      const entityId = createResponse.body.data.id;

      // Act
      const updateResponse = await request(app)
        .put(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name', value: 200 })
        .expect(200);

      // Assert
      expect(updateResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: entityId,
          name: 'Updated Name',
          value: 200,
        }),
      });

      // Verify database state
      const pool = getTestPool();
      const result = await pool!.query('SELECT * FROM entities WHERE id = $1', [entityId]);
      expect(result.rows[0].name).toBe('Updated Name');
    });

    it('should invalidate cache on update', async () => {
      // Arrange - Create and cache entity
      const createResponse = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Original', value: 100 })
        .expect(201);

      const entityId = createResponse.body.data.id;

      // Get to cache
      await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Act - Update
      await request(app)
        .put(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated', value: 200 })
        .expect(200);

      // Assert - Cache should be cleared
      const redis = getTestRedis();
      const cached = await redis!.get(`entity:${entityId}`);
      expect(cached).toBeNull();
    });
  });

  describe('DELETE /api/entities/:id - Delete Entity', () => {
    it('should delete entity successfully', async () => {
      // Arrange - Create entity first
      const createResponse = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'To Delete', value: 100 })
        .expect(201);

      const entityId = createResponse.body.data.id;

      // Act
      await request(app)
        .delete(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Assert - Verify entity is deleted
      await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Verify database state
      const pool = getTestPool();
      const result = await pool!.query('SELECT * FROM entities WHERE id = $1', [entityId]);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('GET /api/entities - List Entities', () => {
    it('should return paginated list', async () => {
      // Arrange - Create multiple entities
      await Promise.all([
        request(app)
          .post('/api/entities')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Entity 1', value: 1 }),
        request(app)
          .post('/api/entities')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Entity 2', value: 2 }),
        request(app)
          .post('/api/entities')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Entity 3', value: 3 }),
      ]);

      // Act
      const response = await request(app)
        .get('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: expect.any(String) }),
        ]),
        pagination: {
          page: 1,
          limit: 2,
          total: 3,
        },
      });
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('End-to-End Workflows', () => {
    it('should handle complete CRUD workflow', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Workflow Test', value: 100 })
        .expect(201);

      const entityId = createResponse.body.data.id;

      // Read
      await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Update
      await request(app)
        .put(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Workflow', value: 200 })
        .expect(200);

      // Delete
      await request(app)
        .delete(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/entities/${entityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
