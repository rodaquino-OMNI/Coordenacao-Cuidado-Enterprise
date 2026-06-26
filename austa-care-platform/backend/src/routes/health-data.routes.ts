/**
 * Health Data Routes
 * RESTful API endpoints for managing user health data
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import prisma from '../config/database';

const router = Router();

// Validation schemas
const CreateHealthDataSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  dataType: z.enum(['vitals', 'medication', 'allergy', 'condition', 'lab_result', 'vaccination']),
  data: z.record(z.any()),
  recordedAt: z.string().datetime().optional(),
  source: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const UpdateHealthDataSchema = z.object({
  data: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  verified: z.boolean().optional()
});

const HealthDataIdSchema = z.object({
  dataId: z.string().uuid('Invalid health data ID')
});

const UserIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID')
});

const HealthDataQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  dataType: z.enum(['vitals', 'medication', 'allergy', 'condition', 'lab_result', 'vaccination']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  verified: z.string().transform(v => v === 'true').optional(),
  sortBy: z.enum(['recordedAt', 'createdAt']).default('recordedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Map route dataType (lowercase) to Prisma HealthDataType enum
 */
const routeTypeToPrisma: Record<string, string> = {
  vitals: 'VITAL_SIGN',
  medication: 'MEDICATION',
  allergy: 'ALLERGY',
  condition: 'CONDITION',
  lab_result: 'LAB_RESULT',
  vaccination: 'IMMUNIZATION',
};

/**
 * Map dataType to the correct JSON field name in HealthData model
 */
const dataTypeToField: Record<string, string> = {
  VITAL_SIGN: 'vitalSigns',
  MEDICATION: 'medications',
  ALLERGY: 'allergies',
  CONDITION: 'conditions',
  LAB_RESULT: 'labResults',
  IMMUNIZATION: 'labResults',
};

/**
 * Extract the "data" payload from the appropriate typed JSON field
 */
function extractData(record: any): any {
  if (record.vitalSigns) return record.vitalSigns;
  if (record.conditions) return record.conditions;
  if (record.medications) return record.medications;
  if (record.allergies) return record.allergies;
  if (record.labResults) return record.labResults;
  if (record.symptoms) return record.symptoms;
  return {};
}

/**
 * Format a HealthData record to the API response shape
 */
function formatRecord(record: any): any {
  return {
    id: record.id,
    userId: record.userId,
    dataType: record.type,
    data: extractData(record),
    recordedAt: record.recordedAt,
    source: record.source,
    verified: record.isVerified,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Common select for HealthData queries
const healthDataSelect = {
  id: true,
  userId: true,
  type: true,
  conditions: true,
  medications: true,
  allergies: true,
  symptoms: true,
  vitalSigns: true,
  labResults: true,
  recordedAt: true,
  source: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * @route   POST /api/v1/health-data
 * @desc    Create new health data record
 * @access  Private
 */
router.post('/',
  defaultRateLimiter,
  validateRequest(CreateHealthDataSchema),
  async (req, res) => {
    try {
      const { userId, dataType, data, recordedAt, source, metadata } = req.body;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get user's organizationId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const prismaType = routeTypeToPrisma[dataType] || 'CONDITION';
      const dataField = dataTypeToField[prismaType] || 'vitalSigns';

      // Merge metadata into the data object if provided
      const mergedData = metadata ? { ...data, _metadata: metadata } : data;

      // Build the create data
      const createData: any = {
        userId,
        organizationId: user.organizationId,
        type: prismaType,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        source: (source || 'USER_REPORTED').toUpperCase().replace(/\s+/g, '_'),
      };

      // Store the merged data in the appropriate JSON field
      createData[dataField] = mergedData;

      const healthData = await prisma.healthData.create({
        data: createData,
        select: healthDataSelect,
      });

      logger.info('Health data created', { dataId: healthData.id, userId, dataType });
      res.status(201).json(formatRecord(healthData));
    } catch (error) {
      logger.error('Failed to create health data', { error });
      res.status(500).json({ error: 'Failed to create health data' });
    }
  }
);

/**
 * @route   GET /api/v1/health-data/user/:userId
 * @desc    Get all health data for user
 * @access  Private
 */
router.get('/user/:userId',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  validateQuery(HealthDataQuerySchema),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page, limit, dataType, startDate, endDate, verified, sortBy, sortOrder } = req.query as any;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId };

      if (dataType) {
        where.type = routeTypeToPrisma[dataType] || dataType;
      }

      if (verified !== undefined) {
        where.isVerified = verified;
      }

      if (startDate || endDate) {
        where.recordedAt = {};
        if (startDate) where.recordedAt.gte = new Date(startDate);
        if (endDate) where.recordedAt.lte = new Date(endDate);
      }

      const [records, total] = await Promise.all([
        prisma.healthData.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { [sortBy]: sortOrder },
          select: healthDataSelect,
        }),
        prisma.healthData.count({ where }),
      ]);

      res.json({
        healthData: records.map(formatRecord),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get health data', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve health data' });
    }
  }
);

/**
 * @route   GET /api/v1/health-data/:dataId
 * @desc    Get specific health data record
 * @access  Private
 */
router.get('/:dataId',
  defaultRateLimiter,
  validateParams(HealthDataIdSchema),
  async (req, res) => {
    try {
      const { dataId } = req.params;

      const healthData = await prisma.healthData.findUnique({
        where: { id: dataId },
        select: healthDataSelect,
      });

      if (!healthData) {
        return res.status(404).json({ error: 'Health data not found' });
      }

      // Check access
      if (healthData.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(formatRecord(healthData));
    } catch (error) {
      logger.error('Failed to get health data', { error, dataId: req.params.dataId });
      res.status(500).json({ error: 'Failed to retrieve health data' });
    }
  }
);

/**
 * @route   PUT /api/v1/health-data/:dataId
 * @desc    Update health data record
 * @access  Private
 */
router.put('/:dataId',
  defaultRateLimiter,
  validateParams(HealthDataIdSchema),
  validateRequest(UpdateHealthDataSchema),
  async (req, res) => {
    try {
      const { dataId } = req.params;
      const updates = req.body;

      const existing = await prisma.healthData.findUnique({
        where: { id: dataId },
        select: { id: true, userId: true, type: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Health data not found' });
      }

      // Check access
      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updateData: any = {};

      if (updates.data !== undefined) {
        // Merge metadata into data if both provided
        const mergedData = updates.metadata ? { ...updates.data, _metadata: updates.metadata } : updates.data;
        const field = dataTypeToField[existing.type] || 'vitalSigns';
        updateData[field] = mergedData;
      }

      if (updates.verified !== undefined) {
        updateData.isVerified = updates.verified;
        if (updates.verified) {
          updateData.verifiedBy = req.user!.id;
          updateData.verifiedAt = new Date();
        }
      }

      const updatedData = await prisma.healthData.update({
        where: { id: dataId },
        data: updateData,
        select: healthDataSelect,
      });

      logger.info('Health data updated', { dataId });
      res.json(formatRecord(updatedData));
    } catch (error) {
      logger.error('Failed to update health data', { error, dataId: req.params.dataId });
      res.status(500).json({ error: 'Failed to update health data' });
    }
  }
);

/**
 * @route   DELETE /api/v1/health-data/:dataId
 * @desc    Delete health data record
 * @access  Private
 */
router.delete('/:dataId',
  strictRateLimiter,
  validateParams(HealthDataIdSchema),
  async (req, res) => {
    try {
      const { dataId } = req.params;

      const existing = await prisma.healthData.findUnique({
        where: { id: dataId },
        select: { id: true, userId: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Health data not found' });
      }

      // Check access
      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Soft delete: set deletedAt and isActive = false (LGPD compliant)
      await prisma.healthData.update({
        where: { id: dataId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        }
      });

      logger.info('Health data deleted', { dataId, userId: req.user!.id });

      res.json({
        message: 'Health data archived',
        dataId,
        note: 'Data retained according to LGPD policies'
      });
    } catch (error) {
      logger.error('Failed to delete health data', { error, dataId: req.params.dataId });
      res.status(500).json({ error: 'Failed to delete health data' });
    }
  }
);

/**
 * @route   GET /api/v1/health-data/user/:userId/summary
 * @desc    Get health data summary for user
 * @access  Private
 */
router.get('/user/:userId/summary',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get counts by type
      const countsByType = await prisma.healthData.groupBy({
        by: ['type'],
        where: { userId, isActive: true },
        _count: { id: true },
      });

      const recordsByType: Record<string, number> = {};
      countsByType.forEach(item => {
        recordsByType[item.type.toLowerCase()] = item._count.id;
      });

      const totalRecords = countsByType.reduce((sum, item) => sum + item._count.id, 0);

      // Get latest vitals
      const latestVitals = await prisma.healthData.findFirst({
        where: { userId, type: 'VITAL_SIGN', isActive: true },
        orderBy: { recordedAt: 'desc' },
        select: { vitalSigns: true, recordedAt: true },
      });

      // Get active medications count
      const activeMedicationsCount = await prisma.healthData.count({
        where: { userId, type: 'MEDICATION', isActive: true },
      });

      // Get known allergies
      const allergies = await prisma.healthData.findMany({
        where: { userId, type: 'ALLERGY', isActive: true },
        select: { allergies: true },
      });

      const knownAllergies = allergies
        .filter(a => a.allergies)
        .flatMap(a => {
          const data = a.allergies as any;
          return Array.isArray(data) ? data : data?.name ? [data.name] : [];
        });

      // Get chronic conditions
      const conditions = await prisma.healthData.findMany({
        where: { userId, type: 'CONDITION', isActive: true },
        select: { conditions: true },
      });

      const chronicConditions = conditions
        .filter(c => c.conditions)
        .flatMap(c => {
          const data = c.conditions as any;
          return Array.isArray(data) ? data : data?.name ? [data.name] : [];
        });

      res.json({
        userId,
        totalRecords,
        lastUpdated: new Date(),
        recordsByType: {
          vitals: recordsByType['vital_sign'] || 0,
          medication: recordsByType['medication'] || 0,
          allergy: recordsByType['allergy'] || 0,
          condition: recordsByType['condition'] || 0,
          lab_result: recordsByType['lab_result'] || 0,
          vaccination: recordsByType['immunization'] || 0,
        },
        recentVitals: latestVitals ? {
          ...(latestVitals.vitalSigns as any),
          recordedAt: latestVitals.recordedAt,
        } : null,
        activeMedications: activeMedicationsCount,
        knownAllergies,
        chronicConditions,
      });
    } catch (error) {
      logger.error('Failed to get health summary', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve health summary' });
    }
  }
);

/**
 * @route   GET /api/v1/health-data/user/:userId/timeline
 * @desc    Get chronological health timeline
 * @access  Private
 */
router.get('/user/:userId/timeline',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  validateQuery(z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    dataTypes: z.string().optional() // comma-separated list
  })),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, dataTypes } = req.query as any;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const where: any = { userId, isActive: true };

      if (startDate || endDate) {
        where.recordedAt = {};
        if (startDate) where.recordedAt.gte = new Date(startDate);
        if (endDate) where.recordedAt.lte = new Date(endDate);
      }

      if (dataTypes) {
        const types = dataTypes.split(',').map((t: string) => routeTypeToPrisma[t.trim()] || t.trim().toUpperCase());
        where.type = { in: types };
      }

      const records = await prisma.healthData.findMany({
        where,
        orderBy: { recordedAt: 'asc' },
        select: {
          id: true,
          type: true,
          vitalSigns: true,
          conditions: true,
          medications: true,
          allergies: true,
          labResults: true,
          recordedAt: true,
        },
      });

      // Group by date
      const groupedByDate: Record<string, any[]> = {};
      records.forEach(record => {
        const dateStr = record.recordedAt.toISOString().split('T')[0];
        if (!groupedByDate[dateStr]) {
          groupedByDate[dateStr] = [];
        }

        const data = extractData(record);
        const description = typeof data === 'object'
          ? (data.name || data.title || JSON.stringify(data).substring(0, 100))
          : String(data);

        groupedByDate[dateStr].push({
          type: record.type.toLowerCase(),
          description,
          id: record.id,
        });
      });

      const timeline = Object.entries(groupedByDate)
        .map(([date, events]) => ({ date: new Date(date), events }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      res.json({ timeline });
    } catch (error) {
      logger.error('Failed to get health timeline', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve health timeline' });
    }
  }
);

/**
 * @route   POST /api/v1/health-data/:dataId/verify
 * @desc    Verify health data (healthcare provider only)
 * @access  Private (Healthcare Provider)
 */
router.post('/:dataId/verify',
  requireRole(['admin', 'healthcare_provider']),
  strictRateLimiter,
  validateParams(HealthDataIdSchema),
  async (req, res) => {
    try {
      const { dataId } = req.params;
      const { notes } = req.body || {};

      const existing = await prisma.healthData.findUnique({
        where: { id: dataId },
        select: { id: true, isVerified: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Health data not found' });
      }

      const updateData: any = {
        isVerified: true,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      };

      // Store verification notes in the riskScore field as metadata
      if (notes) {
        updateData.riskScore = { verificationNotes: notes };
      }

      const updatedData = await prisma.healthData.update({
        where: { id: dataId },
        data: updateData,
        select: {
          id: true,
          isVerified: true,
          verifiedBy: true,
          verifiedAt: true,
          riskScore: true,
        }
      });

      const verifiedData = {
        id: updatedData.id,
        verified: updatedData.isVerified,
        verifiedBy: updatedData.verifiedBy,
        verifiedAt: updatedData.verifiedAt,
        verificationNotes: notes || null,
      };

      logger.info('Health data verified', { dataId, verifiedBy: req.user!.id });
      res.json(verifiedData);
    } catch (error) {
      logger.error('Failed to verify health data', { error, dataId: req.params.dataId });
      res.status(500).json({ error: 'Failed to verify health data' });
    }
  }
);

/**
 * @route   GET /api/v1/health-data/stats/overview
 * @desc    Get health data statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats/overview',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      const [
        totalRecords,
        verifiedRecords,
        recordsByType,
        recordsBySource,
      ] = await Promise.all([
        prisma.healthData.count({ where: { isActive: true } }),
        prisma.healthData.count({ where: { isActive: true, isVerified: true } }),
        prisma.healthData.groupBy({
          by: ['type'],
          where: { isActive: true },
          _count: { id: true },
        }),
        prisma.healthData.groupBy({
          by: ['source'],
          where: { isActive: true },
          _count: { id: true },
        }),
      ]);

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [last24hNew, last24hUpdated] = await Promise.all([
        prisma.healthData.count({
          where: {
            isActive: true,
            createdAt: { gte: last24h },
          },
        }),
        prisma.healthData.count({
          where: {
            isActive: true,
            updatedAt: { gte: last24h },
            createdAt: { lt: last24h },
          },
        }),
      ]);

      const byType: Record<string, number> = {};
      recordsByType.forEach(item => {
        byType[item.type.toLowerCase()] = item._count.id;
      });

      const bySource: Record<string, number> = {};
      recordsBySource.forEach(item => {
        bySource[item.source.toLowerCase()] = item._count.id;
      });

      res.json({
        totalRecords,
        verifiedRecords,
        recordsByType: {
          vitals: byType['vital_sign'] || 0,
          medication: byType['medication'] || 0,
          allergy: byType['allergy'] || 0,
          condition: byType['condition'] || 0,
          lab_result: byType['lab_result'] || 0,
          vaccination: byType['immunization'] || 0,
        },
        recordsBySource: {
          user: bySource['user_reported'] || 0,
          medical_record: bySource['provider_entered'] || 0,
          integration: (bySource['tasy_sync'] || 0) + (bySource['ai_extracted'] || 0),
        },
        last24Hours: {
          newRecords: last24hNew,
          updatedRecords: last24hUpdated,
        }
      });
    } catch (error) {
      logger.error('Failed to get health data stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

export default router;
