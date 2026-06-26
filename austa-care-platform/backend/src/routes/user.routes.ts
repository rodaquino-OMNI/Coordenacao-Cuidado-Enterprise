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
import { prisma } from '../config/database';
import { getUserHealthScore } from '../utils/user.helpers';

const router = Router();

// Safe fields to select for user responses — NEVER include password
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  name: true,
  phone: true,
  cpf: true,
  dateOfBirth: true,
  gender: true,
  isActive: true,
  isVerified: true,
  whatsappId: true,
  preferredLanguage: true,
  timezone: true,
  healthScore: true,
  onboardingComplete: true,
  lastActiveAt: true,
  lastLoginAt: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Helper to format user for API response
function formatUserResponse(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    cpf: user.cpf,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    roles: ['user'], // Roles come from JWT token, not DB
    status: user.isActive ? 'active' : 'inactive',
    isActive: user.isActive,
    isVerified: user.isVerified,
    healthScore: user.healthScore,
    onboardingComplete: user.onboardingComplete,
    preferredLanguage: user.preferredLanguage,
    lastActiveAt: user.lastActiveAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

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

// Map API status to isActive boolean for Prisma queries
function mapStatusToIsActive(status?: string): boolean | undefined {
  if (!status) return undefined;
  return status === 'active';
}

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

      const where: any = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ];
      }

      const isActive = mapStatusToIsActive(status);
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const sortFieldMap: Record<string, string> = {
        'createdAt': 'createdAt',
        'name': 'name',
        'email': 'email',
      };

      const skip = (Number(page) - 1) * Number(limit);
      const orderField = sortFieldMap[sortBy] || 'createdAt';

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: SAFE_USER_SELECT,
          skip,
          take: Number(limit),
          orderBy: { [orderField]: sortOrder },
        }),
        prisma.user.count({ where }),
      ]);

      const enrichedUsers = await Promise.all(
        users.map(async (user) => ({
          ...formatUserResponse(user),
          healthScore: await getUserHealthScore(user.id).catch(() => user.healthScore || 0),
        }))
      );

      res.json({
        users: enrichedUsers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
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

      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: SAFE_USER_SELECT,
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const healthScore = await getUserHealthScore(user.id).catch(() => user.healthScore || 0);

      res.json({
        ...formatUserResponse(user),
        healthScore,
      });
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

      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userData.email },
            ...(userData.phone ? [{ phone: userData.phone }] : []),
          ],
        },
      });

      if (existing) {
        return res.status(409).json({ error: 'User with this email or phone already exists' });
      }

      const nameParts = (userData.name || '').split(' ');
      const firstName = nameParts[0] || userData.name;
      const lastName = nameParts.slice(1).join(' ') || '';

      const newUser = await prisma.user.create({
        data: {
          email: userData.email,
          password: userData.password,
          firstName,
          lastName,
          name: userData.name,
          phone: userData.phone,
          cpf: userData.cpf,
          dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : undefined,
          gender: userData.gender as any,
          isActive: true,
          organizationId: 'default-org-id',
        },
        select: SAFE_USER_SELECT,
      });

      // Initialize health points for new user
      await prisma.healthPoints.create({
        data: {
          userId: newUser.id,
          totalPoints: 0,
          availablePoints: 0,
          spentPoints: 0,
          currentLevel: 1,
          experiencePoints: 0,
          nextLevelAt: 100,
          organizationId: newUser.organizationId,
        },
      }).catch(err => logger.warn('Failed to initialize health points', { userId: newUser.id, error: err }));

      logger.info('User created', { userId: newUser.id, email: newUser.email });

      res.status(201).json(formatUserResponse(newUser));
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

      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (updates.email || updates.phone) {
        const conflictCheck: any = { id: { not: userId } };
        const orConditions: any[] = [];
        if (updates.email) orConditions.push({ email: updates.email });
        if (updates.phone) orConditions.push({ phone: updates.phone });

        if (orConditions.length > 0) {
          const conflict = await prisma.user.findFirst({
            where: { ...conflictCheck, OR: orConditions },
          });
          if (conflict) {
            return res.status(409).json({ error: 'Email or phone already in use' });
          }
        }
      }

      let nameUpdate: any = {};
      if (updates.name) {
        const nameParts = updates.name.split(' ');
        nameUpdate = {
          name: updates.name,
          firstName: nameParts[0] || updates.name,
          lastName: nameParts.slice(1).join(' ') || '',
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(updates.email !== undefined && { email: updates.email }),
          ...(updates.phone !== undefined && { phone: updates.phone }),
          ...(updates.cpf !== undefined && { cpf: updates.cpf }),
          ...(updates.dateOfBirth !== undefined && { dateOfBirth: new Date(updates.dateOfBirth) }),
          ...(updates.gender !== undefined && { gender: updates.gender as any }),
          ...nameUpdate,
        },
        select: SAFE_USER_SELECT,
      });

      logger.info('User updated', { userId, updates: Object.keys(updates) });

      res.json(formatUserResponse(updatedUser));
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

      const validStatuses = ['active', 'inactive', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: status === 'active',
        },
        select: SAFE_USER_SELECT,
      });

      logger.info('User status updated', { userId, status });

      res.json(formatUserResponse(updatedUser));
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

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Soft delete: deactivate and mark as deleted
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      logger.info('User soft-deleted', { userId, requestedBy: req.user!.id });

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

      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: SAFE_USER_SELECT,
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get related data
      const [healthScore, onboarding, healthDataCount, conversationCount, latestActivity] = await Promise.all([
        getUserHealthScore(user.id).catch(() => user.healthScore || 0),
        prisma.onboardingProgress.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        }).catch(() => null),
        prisma.healthData.count({ where: { userId: user.id } }).catch(() => 0),
        prisma.conversation.count({ where: { userId: user.id } }).catch(() => 0),
        prisma.auditLog.findFirst({
          where: { userId: user.id },
          orderBy: { occurredAt: 'desc' },
          select: { action: true, occurredAt: true },
        }).catch(() => null),
      ]);

      const profile = {
        ...formatUserResponse(user),
        healthScore,
        preferences: {
          language: user.preferredLanguage || 'pt-BR',
          notifications: true,
          theme: 'light',
        },
        statistics: {
          totalConversations: conversationCount,
          totalHealthRecords: healthDataCount,
          lastActivity: latestActivity?.occurredAt || user.lastActiveAt,
        },
        onboarding: onboarding ? {
          isComplete: onboarding.status === 'COMPLETED',
          currentStep: onboarding.currentStep,
          totalSteps: onboarding.totalSteps,
          pointsEarned: onboarding.pointsEarned,
          completedAt: onboarding.completedAt,
        } : null,
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

      if (req.user!.id !== userId && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const activities = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          entity: true,
          description: true,
          occurredAt: true,
          metadata: true,
        },
      });

      res.json({
        activities: activities.map(a => ({
          id: a.id,
          type: a.action?.toLowerCase() || 'unknown',
          entity: a.entity,
          description: a.description,
          timestamp: a.occurredAt,
          metadata: a.metadata || {},
        }))
      });
    } catch (error) {
      logger.error('Failed to get user activity', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve activity' });
    }
  }
);

export default router;
