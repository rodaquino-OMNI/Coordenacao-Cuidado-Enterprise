/**
 * User Management Routes
 * RESTful API endpoints for user operations
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'Other']).optional(),
  roles: z.array(z.string()).default(['user'])
});

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'Other']).optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

const UserIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID format')
});

const UserQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get('/',
  requireRole('admin'),
  defaultRateLimiter,
  validateQuery(UserQuerySchema),
  async (req, res) => {
    try {
      const { page, limit, search, role, status, sortBy, sortOrder } = req.query as any;

      // Mock implementation - replace with actual database query
      const users = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          name: 'John Doe',
          roles: ['user'],
          status: 'active',
          createdAt: new Date(),
          lastLogin: new Date()
        }
      ];

      res.json({
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: users.length,
          totalPages: Math.ceil(users.length / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get users', { error });
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  }
);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:userId',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user can access this profile
      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock implementation
      const user = {
        id: userId,
        email: 'user@example.com',
        name: 'John Doe',
        phone: '+55 11 98765-4321',
        roles: ['user'],
        status: 'active',
        createdAt: new Date(),
        lastLogin: new Date(),
        preferences: {},
        metadata: {}
      };

      res.json(user);
    } catch (error) {
      logger.error('Failed to get user', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve user' });
    }
  }
);

/**
 * @route   POST /api/v1/users
 * @desc    Create new user (admin only)
 * @access  Private (Admin)
 */
router.post('/',
  requireRole('admin'),
  strictRateLimiter,
  validateRequest(CreateUserSchema),
  async (req, res) => {
    try {
      const userData = req.body;

      // Mock implementation
      const newUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...userData,
        password: undefined, // Never return password
        status: 'active',
        createdAt: new Date()
      };

      logger.info('User created', { userId: newUser.id, email: newUser.email });
      res.status(201).json(newUser);
    } catch (error) {
      logger.error('Failed to create user', { error });
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * @route   PUT /api/v1/users/:userId
 * @desc    Update user
 * @access  Private
 */
router.put('/:userId',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  validateRequest(UpdateUserSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Check if user can update this profile
      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock implementation
      const updatedUser = {
        id: userId,
        ...updates,
        updatedAt: new Date()
      };

      logger.info('User updated', { userId, updates: Object.keys(updates) });
      res.json(updatedUser);
    } catch (error) {
      logger.error('Failed to update user', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * @route   PATCH /api/v1/users/:userId/status
 * @desc    Update user status (admin only)
 * @access  Private (Admin)
 */
router.patch('/:userId/status',
  requireRole('admin'),
  strictRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Mock implementation
      const user = {
        id: userId,
        status,
        updatedAt: new Date()
      };

      logger.info('User status updated', { userId, status });
      res.json(user);
    } catch (error) {
      logger.error('Failed to update user status', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    Delete user (soft delete - LGPD compliant)
 * @access  Private (Admin)
 */
router.delete('/:userId',
  requireRole('admin'),
  strictRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Mock implementation - soft delete for LGPD compliance
      logger.info('User deletion requested', { userId, requestedBy: req.user!.id });

      res.json({
        message: 'User deletion scheduled',
        userId,
        note: 'Data will be anonymized according to LGPD retention policies'
      });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

/**
 * @route   GET /api/v1/users/:userId/profile
 * @desc    Get detailed user profile
 * @access  Private
 */
router.get('/:userId/profile',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock implementation with full profile
      const profile = {
        id: userId,
        email: 'user@example.com',
        name: 'John Doe',
        phone: '+55 11 98765-4321',
        cpf: '***.***.***-**', // Masked for security
        dateOfBirth: '1990-01-01',
        gender: 'M',
        address: {
          street: 'Rua Example',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01234-567'
        },
        healthData: {
          bloodType: 'O+',
          allergies: [],
          chronicConditions: []
        },
        preferences: {
          language: 'pt-BR',
          notifications: true,
          theme: 'light'
        },
        statistics: {
          totalConversations: 15,
          totalAssessments: 8,
          lastActivity: new Date()
        }
      };

      res.json(profile);
    } catch (error) {
      logger.error('Failed to get user profile', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve profile' });
    }
  }
);

/**
 * @route   GET /api/v1/users/:userId/activity
 * @desc    Get user activity history
 * @access  Private
 */
router.get('/:userId/activity',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock implementation
      const activities = [
        {
          id: 'activity-1',
          type: 'login',
          timestamp: new Date(),
          metadata: { ip: '192.168.1.1' }
        },
        {
          id: 'activity-2',
          type: 'conversation_started',
          timestamp: new Date(),
          metadata: { conversationId: 'conv-123' }
        }
      ];

      res.json({ activities });
    } catch (error) {
      logger.error('Failed to get user activity', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve activity' });
    }
  }
);

export default router;
