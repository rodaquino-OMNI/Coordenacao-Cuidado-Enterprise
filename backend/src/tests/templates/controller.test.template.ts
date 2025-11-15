/**
 * Controller Test Template
 * Copy this file and customize for your controller
 *
 * Replace:
 * - YourController with actual controller name
 * - YourService with actual service name
 * - route paths and test cases
 */

import { Request, Response } from 'express';
import { YourController } from '@controllers/your.controller';
import { YourService } from '@services/your.service';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createAuthenticatedRequest,
} from '@tests/utils/test-helpers';

describe('YourController', () => {
  let controller: YourController;
  let mockService: jest.Mocked<YourService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  // Setup before each test
  beforeEach(() => {
    // Create mock service
    mockService = {
      createEntity: jest.fn(),
      findById: jest.fn(),
      updateEntity: jest.fn(),
      deleteEntity: jest.fn(),
      listEntities: jest.fn(),
    } as any;

    // Initialize controller with mocked dependencies
    controller = new YourController(mockService);

    // Create mock Express objects
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /entities', () => {
    it('should create entity and return 201', async () => {
      // Arrange
      const inputData = {
        name: 'Test Entity',
        value: 123,
      };

      const createdEntity = {
        id: 'test-id',
        ...inputData,
        createdAt: new Date(),
      };

      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        body: inputData,
      });

      mockService.createEntity.mockResolvedValue(createdEntity);

      // Act
      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockService.createEntity).toHaveBeenCalledWith(inputData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdEntity,
      });
    });

    it('should return 400 for invalid input', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        body: {}, // Missing required fields
      });

      // Act
      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('validation'),
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      // Arrange
      mockReq = createMockRequest({
        body: { name: 'Test' },
      });

      // Act
      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockService.createEntity).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        body: { name: 'Test' },
      });

      mockService.createEntity.mockRejectedValue(new Error('Service error'));

      // Act
      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('GET /entities/:id', () => {
    it('should return entity by ID', async () => {
      // Arrange
      const entityId = 'test-id';
      const entity = {
        id: entityId,
        name: 'Test Entity',
      };

      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        params: { id: entityId },
      });

      mockService.findById.mockResolvedValue(entity);

      // Act
      await controller.findOne(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockService.findById).toHaveBeenCalledWith(entityId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: entity,
      });
    });

    it('should return 404 when entity not found', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        params: { id: 'non-existent' },
      });

      mockService.findById.mockResolvedValue(null);

      // Act
      await controller.findOne(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Entity not found',
      });
    });

    it('should return 400 for invalid ID format', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        params: { id: '' },
      });

      // Act
      await controller.findOne(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockService.findById).not.toHaveBeenCalled();
    });
  });

  describe('PUT /entities/:id', () => {
    it('should update entity and return 200', async () => {
      // Arrange
      const entityId = 'test-id';
      const updateData = { name: 'Updated Name' };
      const updatedEntity = {
        id: entityId,
        ...updateData,
        updatedAt: new Date(),
      };

      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        params: { id: entityId },
        body: updateData,
      });

      mockService.updateEntity.mockResolvedValue(updatedEntity);

      // Act
      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockService.updateEntity).toHaveBeenCalledWith(entityId, updateData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedEntity,
      });
    });

    it('should return 404 when entity not found', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        params: { id: 'non-existent' },
        body: { name: 'Updated' },
      });

      mockService.updateEntity.mockResolvedValue(null);

      // Act
      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /entities/:id', () => {
    it('should delete entity and return 204', async () => {
      // Arrange
      const entityId = 'test-id';

      mockReq = createAuthenticatedRequest('user-id', 'admin', {
        params: { id: entityId },
      });

      mockService.deleteEntity.mockResolvedValue(true);

      // Act
      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockService.deleteEntity).toHaveBeenCalledWith(entityId);
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should return 403 for non-admin users', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        params: { id: 'test-id' },
      });

      // Act
      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockService.deleteEntity).not.toHaveBeenCalled();
    });
  });

  describe('GET /entities', () => {
    it('should return paginated list of entities', async () => {
      // Arrange
      const entities = [
        { id: '1', name: 'Entity 1' },
        { id: '2', name: 'Entity 2' },
      ];

      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        query: { page: '1', limit: '10' },
      });

      mockService.listEntities.mockResolvedValue({
        data: entities,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
        },
      });

      // Act
      await controller.findAll(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockService.listEntities).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: entities,
        pagination: expect.any(Object),
      });
    });

    it('should use default pagination values', async () => {
      // Arrange
      mockReq = createAuthenticatedRequest('user-id', 'patient', {
        query: {},
      });

      mockService.listEntities.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0 },
      });

      // Act
      await controller.findAll(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockService.listEntities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });
  });
});
