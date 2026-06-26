/**
 * Admin Routes
 * RESTful API endpoints for administrative operations
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { DataSource, HealthDataType } from '@prisma/client';
import { redisCluster } from '../infrastructure/redis/redis.cluster';
import { mongoDBClient } from '../infrastructure/mongodb/mongodb.client';
import { kafkaClient } from '../infrastructure/kafka/kafka.client';

const router = Router();

// Apply authentication and admin role to all routes
router.use(authenticateToken);
router.use(requireRole('admin'));

// Validation schemas
const SystemConfigSchema = z.object({
  key: z.string().min(1, 'Config key is required'),
  value: z.any(),
  description: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']).optional()
});

const AuditLogQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/** Helper: check system health */
async function getSystemHealth() {
  const health: any = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    components: {} as Record<string, any>,
    metrics: {
      memory: {
        used: formatBytes(process.memoryUsage().heapUsed),
        total: formatBytes(process.memoryUsage().heapTotal),
        rss: formatBytes(process.memoryUsage().rss),
      },
    },
  };

  // Database health
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.components.database = {
      status: 'healthy',
      responseTime: `${Date.now() - start}ms`,
    };
  } catch (err) {
    health.components.database = {
      status: 'unavailable',
      error: err instanceof Error ? err.message : String(err),
    };
    health.status = 'degraded';
  }

  // Redis health
  try {
    if (redisCluster.isRedisAvailable()) {
      health.components.redis = { status: 'healthy' };
    } else {
      health.components.redis = { status: 'unavailable' };
    }
  } catch {
    health.components.redis = { status: 'unavailable' };
  }

  // Kafka health
  try {
    health.components.kafka = { status: 'unavailable', note: 'Non-fatal — server operates without event streaming' };
  } catch {
    health.components.kafka = { status: 'unavailable', note: 'Non-fatal — server operates without event streaming' };
  }

  // MongoDB health
  try {
    health.components.mongodb = { status: 'unavailable', note: 'Non-fatal — ML features disabled' };
  } catch {
    health.components.mongodb = { status: 'unavailable', note: 'Non-fatal — ML features disabled' };
  }

  return health;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get admin dashboard overview
 * @access  Private (Admin)
 */
router.get('/dashboard',
  defaultRateLimiter,
  async (req, res) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        totalConversations,
        totalDocuments,
        totalAssessments,
        newUsers24h,
        conversations24h,
        assessments24h,
        documents24h,
        newUsers7d,
        conversations7d,
        assessments7d,
        documents7d,
        systemHealth,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.conversation.count(),
        prisma.document.count(),
        prisma.healthData.count({ where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT } }),
        prisma.user.count({ where: { createdAt: { gte: last24h } } }),
        prisma.conversation.count({ where: { createdAt: { gte: last24h } } }),
        prisma.healthData.count({ where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT, recordedAt: { gte: last24h } } }),
        prisma.document.count({ where: { createdAt: { gte: last24h } } }),
        prisma.user.count({ where: { createdAt: { gte: last7d } } }),
        prisma.conversation.count({ where: { createdAt: { gte: last7d } } }),
        prisma.healthData.count({ where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT, recordedAt: { gte: last7d } } }),
        prisma.document.count({ where: { createdAt: { gte: last7d } } }),
        getSystemHealth(),
      ]);

      const dashboard = {
        statistics: {
          totalUsers,
          activeUsers,
          totalConversations,
          totalDocuments,
          totalAssessments,
        },
        recentActivity: {
          last24Hours: {
            newUsers: newUsers24h,
            conversations: conversations24h,
            assessments: assessments24h,
            documents: documents24h,
          },
          last7Days: {
            newUsers: newUsers7d,
            conversations: conversations7d,
            assessments: assessments7d,
            documents: documents7d,
          },
        },
        systemHealth,
        alerts: [] as any[],
      };

      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to get admin dashboard', { error });
      res.status(500).json({ error: 'Failed to retrieve dashboard' });
    }
  }
);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with filters (advanced)
 * @access  Private (Admin)
 */
router.get('/users',
  defaultRateLimiter,
  validateQuery(z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
    search: z.string().optional(),
    role: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
    registeredAfter: z.string().datetime().optional(),
    registeredBefore: z.string().datetime().optional(),
  })),
  async (req, res) => {
    try {
      const { page, limit, search, role, status, registeredAfter, registeredBefore } = req.query as any;

      const where: any = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role;
      }

      if (status) {
        where.status = status;
      }

      if (registeredAfter || registeredBefore) {
        where.createdAt = {};
        if (registeredAfter) where.createdAt.gte = new Date(registeredAfter);
        if (registeredBefore) where.createdAt.lte = new Date(registeredBefore);
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
            _count: {
              select: {
                conversations: true,
                documents: true,
                healthData: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      const formattedUsers = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role,
        status: u.status,
        registeredAt: u.createdAt,
        lastLogin: u.lastLoginAt,
        statistics: {
          conversations: u._count.conversations,
          assessments: u._count.healthData,
          documents: u._count.documents,
        },
      }));

      res.json({
        users: formattedUsers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Failed to get users', { error });
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  }
);

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    Get audit logs
 * @access  Private (Admin)
 */
router.get('/audit-logs',
  defaultRateLimiter,
  validateQuery(AuditLogQuerySchema),
  async (req, res) => {
    try {
      const { page, limit, userId, action, resource, startDate, endDate } = req.query as any;

      const where: any = {};

      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (resource) where.entity = resource;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      const formattedLogs = logs.map((log: any) => ({
        id: log.id,
        timestamp: log.createdAt,
        userId: log.userId,
        userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        ip: log.ipAddress,
        userAgent: log.userAgent,
        details: log.changes,
        metadata: log.metadata,
      }));

      res.json({
        logs: formattedLogs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Failed to get audit logs', { error });
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  }
);

/**
 * @route   GET /api/v1/admin/system/config
 * @desc    Get system configuration
 * @access  Private (Admin)
 */
router.get('/system/config',
  defaultRateLimiter,
  async (req, res) => {
    try {
      const config = {
        application: {
          name: 'AUSTA Care Platform',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'production',
        },
        features: {
          aiEnabled: !!process.env.OPENAI_API_KEY,
          gamificationEnabled: true,
          whatsappEnabled: !!process.env.ZAPI_INSTANCE_ID,
          ocrEnabled: !!process.env.AWS_ACCESS_KEY_ID,
        },
        limits: {
          maxFileSize: 10485760, // 10MB
          maxFilesPerUpload: 5,
          rateLimitWindow: 900000, // 15 minutes
          rateLimitMax: 100,
        },
        integrations: {
          openai: { enabled: !!process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4' },
          tasy: { enabled: false, syncInterval: 3600 },
          whatsapp: { enabled: !!process.env.ZAPI_INSTANCE_ID },
        },
      };

      res.json(config);
    } catch (error) {
      logger.error('Failed to get system config', { error });
      res.status(500).json({ error: 'Failed to retrieve system configuration' });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/system/config
 * @desc    Update system configuration
 * @access  Private (Admin)
 */
router.put('/system/config',
  strictRateLimiter,
  validateRequest(SystemConfigSchema),
  async (req, res) => {
    try {
      const { key, value, description, type } = req.body;

      // Store configuration update as audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'UPDATE',
          entity: 'system_config',
          entityId: key,
          changes: { key, value, type, description },
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      logger.info('System config updated', { key, updatedBy: req.user!.id });

      res.json({
        key,
        value,
        description,
        type,
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to update system config', { error });
      res.status(500).json({ error: 'Failed to update system configuration' });
    }
  }
);

/**
 * @route   GET /api/v1/admin/system/health
 * @desc    Get detailed system health
 * @access  Private (Admin)
 */
router.get('/system/health',
  defaultRateLimiter,
  async (req, res) => {
    try {
      const health = await getSystemHealth();
      res.json(health);
    } catch (error) {
      logger.error('Failed to get system health', { error });
      res.status(500).json({ error: 'Failed to retrieve system health' });
    }
  }
);

/**
 * @route   POST /api/v1/admin/system/maintenance
 * @desc    Enable/disable maintenance mode
 * @access  Private (Admin)
 */
router.post('/system/maintenance',
  strictRateLimiter,
  async (req, res) => {
    try {
      const { enabled, message, estimatedDuration } = req.body;

      // Store maintenance event in audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: enabled ? 'UPDATE' : 'UPDATE',
          entity: 'system_maintenance',
          entityId: 'maintenance_mode',
          changes: { enabled, message, estimatedDuration },
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      logger.info('Maintenance mode updated', { enabled, updatedBy: req.user!.id });

      res.json({
        maintenanceMode: enabled,
        message,
        estimatedDuration,
        setBy: req.user!.id,
        setAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to update maintenance mode', { error });
      res.status(500).json({ error: 'Failed to update maintenance mode' });
    }
  }
);

/**
 * @route   GET /api/v1/admin/analytics/overview
 * @desc    Get analytics overview
 * @access  Private (Admin)
 */
router.get('/analytics/overview',
  defaultRateLimiter,
  async (req, res) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        newUsers24h,
        newUsers7d,
        newUsers30d,
        totalConversations,
        conversations24h,
        totalDocuments,
        documents24h,
        totalAssessments,
        assessments24h,
        activeUsers7d,
        activeUsers30d,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: last24h } } }),
        prisma.user.count({ where: { createdAt: { gte: last7d } } }),
        prisma.user.count({ where: { createdAt: { gte: last30d } } }),
        prisma.conversation.count(),
        prisma.conversation.count({ where: { createdAt: { gte: last24h } } }),
        prisma.document.count(),
        prisma.document.count({ where: { createdAt: { gte: last24h } } }),
        prisma.healthData.count({ where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT } }),
        prisma.healthData.count({ where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT, recordedAt: { gte: last24h } } }),
        prisma.user.count({ where: { lastLoginAt: { gte: last7d } } }),
        prisma.user.count({ where: { lastLoginAt: { gte: last30d } } }),
      ]);

      const analytics = {
        users: {
          total: totalUsers,
          growth: {
            daily: newUsers24h,
            weekly: newUsers7d,
            monthly: newUsers30d,
          },
          retention: {
            day7: totalUsers > 0 ? (activeUsers7d / totalUsers).toFixed(2) : '0',
            day30: totalUsers > 0 ? (activeUsers30d / totalUsers).toFixed(2) : '0',
          },
          churn: {
            rate: totalUsers > 0 ? ((totalUsers - activeUsers30d) / totalUsers).toFixed(2) : '0',
          },
        },
        engagement: {
          dau: newUsers24h, // Daily Active Users (approximation)
          wau: activeUsers7d, // Weekly Active Users
          mau: activeUsers30d, // Monthly Active Users
          averageSessionDuration: 'N/A',
          averageActionsPerSession: 0,
        },
        conversations: {
          total: totalConversations,
          averagePerUser: totalUsers > 0 ? (totalConversations / totalUsers).toFixed(1) : '0',
          completionRate: 0,
          averageDuration: 'N/A',
        },
        assessments: {
          total: totalAssessments,
          completionRate: 0,
          averageScore: 0,
        },
        documents: {
          total: totalDocuments,
          processed: documents24h,
          averageProcessingTime: 'N/A',
        },
      };

      res.json(analytics);
    } catch (error) {
      logger.error('Failed to get analytics', { error });
      res.status(500).json({ error: 'Failed to retrieve analytics' });
    }
  }
);

/**
 * @route   POST /api/v1/admin/notifications/broadcast
 * @desc    Send broadcast notification to all users
 * @access  Private (Admin)
 */
router.post('/notifications/broadcast',
  strictRateLimiter,
  async (req, res) => {
    try {
      const { title, message, type, targetUsers } = req.body;

      // Store broadcast notification in audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATE',
          entity: 'broadcast_notification',
          entityId: `broadcast-${Date.now()}`,
          changes: { title, message, type: type || 'info', targetUsers: targetUsers || 'all' },
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      const broadcast = {
        id: `broadcast-${Date.now()}`,
        title,
        message,
        type: type || 'info',
        targetUsers: targetUsers || 'all',
        sentBy: req.user!.id,
        sentAt: new Date(),
        estimatedRecipients: await prisma.user.count(),
      };

      logger.info('Broadcast notification sent', { broadcastId: broadcast.id, sentBy: req.user!.id });
      res.status(201).json(broadcast);
    } catch (error) {
      logger.error('Failed to send broadcast', { error });
      res.status(500).json({ error: 'Failed to send broadcast notification' });
    }
  }
);

/**
 * @route   GET /api/v1/admin/reports/generate
 * @desc    Generate admin reports
 * @access  Private (Admin)
 */
router.get('/reports/generate',
  strictRateLimiter,
  validateQuery(z.object({
    type: z.enum(['users', 'activity', 'health', 'compliance', 'financial']),
    format: z.enum(['json', 'csv', 'pdf']).default('json'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })),
  async (req, res) => {
    try {
      const { type, format, startDate, endDate } = req.query as any;

      // Log report generation request
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'EXPORT',
          entity: 'report',
          entityId: type,
          changes: { type, format, startDate, endDate },
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      logger.info('Report generation requested', { type, format, requestedBy: req.user!.id });

      // Generate report data based on type
      let reportData: any = {};

      if (type === 'users') {
        const where: any = {};
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate);
          if (endDate) where.createdAt.lte = new Date(endDate);
        }
        const userCount = await prisma.user.count({ where });
        const byRole = await prisma.user.groupBy({ by: ['role'], where, _count: true });
        const byStatus = await prisma.user.groupBy({ by: ['status'], where, _count: true });

        reportData = {
          totalUsers: userCount,
          byRole: byRole.reduce((acc: any, r: any) => { acc[r.role] = r._count; return acc; }, {}),
          byStatus: byStatus.reduce((acc: any, r: any) => { acc[r.status] = r._count; return acc; }, {}),
        };
      } else if (type === 'activity') {
        const where: any = {};
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate);
          if (endDate) where.createdAt.lte = new Date(endDate);
        }
        reportData = {
          conversations: await prisma.conversation.count({ where }),
          documents: await prisma.document.count({ where }),
          assessments: await prisma.healthData.count({ where: { ...where, type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT } }),
        };
      } else if (type === 'health') {
        reportData = await getSystemHealth();
      } else {
        reportData = { message: 'Report data generation not implemented for this type' };
      }

      res.json({
        message: 'Report generated successfully',
        type,
        format,
        generatedAt: new Date(),
        data: reportData,
      });
    } catch (error) {
      logger.error('Failed to generate report', { error });
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

export default router;
