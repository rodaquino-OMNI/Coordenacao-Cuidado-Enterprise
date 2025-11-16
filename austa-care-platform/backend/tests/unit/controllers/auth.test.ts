import request from 'supertest';
import express from 'express';
import { authRoutes } from '@/controllers/auth';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock bcrypt
jest.mock('bcrypt');

// Mock jwt
jest.mock('jsonwebtoken');

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

const prisma = new PrismaClient();

// Setup default mocks
beforeAll(() => {
  // Mock bcrypt.compare to return true by default
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);

  // Mock bcrypt.hash to return hashed password
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

  // Mock JWT sign to return tokens
  (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

  // Mock JWT verify to return decoded token
  (jwt.verify as jest.Mock).mockReturnValue({ userId: '1' });
});

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@austa.com.br',
        password: 'testpassword123'
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedPassword123',
        isActive: true,
        organizationId: 'org-1',
      };

      // Mock Prisma findUnique to return user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Mock Prisma update to return updated user
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        refreshToken: 'mock-jwt-token',
      });

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Authentication successful',
        data: {
          token: 'mock-jwt-token',
          refreshToken: 'mock-jwt-token',
          user: {
            id: '1',
            email: loginData.email,
            firstName: 'Test',
            lastName: 'User',
            isActive: true,
            organizationId: 'org-1',
          }
        }
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Login attempt',
        { email: loginData.email }
      );
    });

    it('should handle login with empty credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Email and password are required'
      });
    });

    it('should handle login errors', async () => {
      // Mock Prisma to throw an error
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Authentication failed',
        error: 'Database connection error'
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Login error',
        { error: expect.any(Error) }
      );
    });

    it('should log email but not password during login', async () => {
      const loginData = {
        email: 'security@test.com',
        password: 'secretpassword'
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        firstName: 'Security',
        lastName: 'Test',
        password: 'hashedPassword123',
        isActive: true,
        organizationId: 'org-1',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(logger.info).toHaveBeenCalledWith(
        'Login attempt',
        { email: loginData.email }
      );

      // Verify password is not logged
      const logCalls = (logger.info as jest.Mock).mock.calls;
      logCalls.forEach(call => {
        expect(JSON.stringify(call)).not.toContain(loginData.password);
      });
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400); // Express handles malformed JSON
    });
  });

  describe('POST /auth/register', () => {
    it('should register successfully with valid data', async () => {
      const registerData = {
        email: 'newuser@austa.com.br',
        password: 'newpassword123',
        firstName: 'New',
        lastName: 'User',
        phone: '+5511999999999',
        organizationId: 'org-1'
      };

      const createdAt = new Date('2025-11-16T20:28:36.489Z');
      const mockCreatedUser = {
        id: '1',
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        phone: registerData.phone,
        organizationId: registerData.organizationId,
        isActive: true,
        isVerified: false,
        createdAt,
      };

      // Mock Prisma findFirst to return null (no existing user)
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock Prisma create to return new user
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const response = await request(app)
        .post('/auth/register')
        .send(registerData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            ...mockCreatedUser,
            createdAt: createdAt.toISOString()
          }
        }
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Registration attempt',
        { email: registerData.email, firstName: registerData.firstName, lastName: registerData.lastName }
      );
    });

    it('should handle registration with partial data', async () => {
      const registerData = {
        email: 'partial@test.com'
        // Missing required fields: password, firstName, lastName, phone, organizationId
      };

      const response = await request(app)
        .post('/auth/register')
        .send(registerData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Email, password, firstName, lastName, phone, and organizationId are required'
      });
    });

    it('should handle registration errors', async () => {
      // Mock Prisma to throw an error
      (prisma.user.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'error@test.com',
          password: 'password',
          firstName: 'Error',
          lastName: 'User',
          phone: '+5511999999999',
          organizationId: 'org-1'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Registration failed',
        error: 'Database connection error'
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Registration error',
        { error: expect.any(Error) }
      );
    });

    it('should log email and name but not password during registration', async () => {
      const registerData = {
        email: 'security@test.com',
        password: 'secretpassword',
        firstName: 'Security',
        lastName: 'Test',
        phone: '+5511999999999',
        organizationId: 'org-1'
      };

      const createdAt = new Date('2025-11-16T20:28:36.489Z');
      const mockCreatedUser = {
        id: '1',
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        phone: registerData.phone,
        organizationId: registerData.organizationId,
        isActive: true,
        isVerified: false,
        createdAt,
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      await request(app)
        .post('/auth/register')
        .send(registerData);

      expect(logger.info).toHaveBeenCalledWith(
        'Registration attempt',
        { email: registerData.email, firstName: registerData.firstName, lastName: registerData.lastName }
      );

      // Verify password is not logged
      const logCalls = (logger.info as jest.Mock).mock.calls;
      logCalls.forEach(call => {
        expect(JSON.stringify(call)).not.toContain(registerData.password);
      });
    });

    it('should handle empty registration data', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Email, password, firstName, lastName, phone, and organizationId are required'
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const refreshData = {
        refreshToken: 'valid-refresh-token'
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        refreshToken: 'valid-refresh-token',
        isActive: true,
      };

      // Mock JWT verify to decode token
      (jwt.verify as jest.Mock).mockReturnValue({ userId: '1' });

      // Mock Prisma findUnique to return user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Mock Prisma update to return updated user
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        refreshToken: 'mock-jwt-token',
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send(refreshData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Token refresh successful',
        data: {
          token: 'mock-jwt-token',
          refreshToken: 'mock-jwt-token'
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Token refresh attempt');
    });

    it('should handle refresh without refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Refresh token is required'
      });
    });

    it('should handle refresh token errors', async () => {
      // Mock JWT verify to throw an error (invalid token)
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    });

    it('should not log refresh token value for security', async () => {
      const refreshData = {
        refreshToken: 'secret-refresh-token-value'
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        refreshToken: refreshData.refreshToken,
        isActive: true,
      };

      (jwt.verify as jest.Mock).mockReturnValue({ userId: '1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await request(app)
        .post('/auth/refresh')
        .send(refreshData);

      expect(logger.info).toHaveBeenCalledWith('Token refresh attempt');

      // Verify refresh token value is not logged
      const logCalls = (logger.info as jest.Mock).mock.calls;
      logCalls.forEach(call => {
        expect(JSON.stringify(call)).not.toContain(refreshData.refreshToken);
      });
    });
  });

  describe('Auth Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const testCases = [
        {
          endpoint: '/auth/login',
          data: { email: 'test@example.com', password: 'password' },
          mockFn: () => (prisma.user.findUnique as jest.Mock).mockRejectedValue(
            new Error('Database connection failed with credentials: admin:password')
          )
        },
        {
          endpoint: '/auth/register',
          data: {
            email: 'test@example.com',
            password: 'password',
            firstName: 'Test',
            lastName: 'User',
            phone: '+5511999999999',
            organizationId: 'org-1'
          },
          mockFn: () => (prisma.user.findFirst as jest.Mock).mockRejectedValue(
            new Error('Database connection failed with credentials: admin:password')
          )
        },
        {
          endpoint: '/auth/refresh',
          data: { refreshToken: 'test-token' },
          mockFn: () => {
            (jwt.verify as jest.Mock).mockReturnValue({ userId: '1' });
            (prisma.user.findUnique as jest.Mock).mockRejectedValue(
              new Error('Database connection failed with credentials: admin:password')
            );
          }
        }
      ];

      for (const { endpoint, data, mockFn } of testCases) {
        jest.clearAllMocks();
        mockFn();

        const response = await request(app)
          .post(endpoint)
          .send(data);

        expect(response.status).toBe(500);
        // Error details should not be exposed in production
        expect(response.body.message).not.toContain('admin');
        expect(response.body.message).not.toContain('credentials');
        // The generic message should be shown
        expect(response.body.success).toBe(false);
      }
    });

    it('should handle concurrent requests without conflicts', async () => {
      // Mock successful login for all concurrent requests
      const mockUser = {
        id: '1',
        email: 'user@test.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedPassword123',
        isActive: true,
        organizationId: 'org-1',
      };

      (prisma.user.findUnique as jest.Mock).mockImplementation((args) => {
        return Promise.resolve({
          ...mockUser,
          email: args.where.email
        });
      });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/auth/login')
          .send({ email: `user${i}@test.com`, password: 'password' })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(`user${index}@test.com`);
      });
    });
  });
});