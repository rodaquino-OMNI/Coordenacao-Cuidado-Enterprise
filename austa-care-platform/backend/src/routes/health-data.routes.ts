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

      // Mock implementation
      const healthData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId,
        dataType,
        data,
        recordedAt: recordedAt || new Date(),
        source: source || 'user',
        metadata,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Health data created', { dataId: healthData.id, userId, dataType });
      res.status(201).json(healthData);
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

      // Mock implementation
      const healthRecords = [
        {
          id: 'data-1',
          userId,
          dataType: 'vitals',
          data: {
            bloodPressure: '120/80',
            heartRate: 72,
            temperature: 36.5,
            weight: 70.5
          },
          recordedAt: new Date(),
          source: 'user',
          verified: true,
          createdAt: new Date()
        }
      ];

      res.json({
        healthData: healthRecords,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: healthRecords.length,
          totalPages: Math.ceil(healthRecords.length / Number(limit))
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

      // Mock implementation
      const healthData = {
        id: dataId,
        userId: req.user!.id,
        dataType: 'medication',
        data: {
          name: 'Paracetamol',
          dosage: '500mg',
          frequency: 'Every 8 hours',
          startDate: new Date(),
          endDate: null,
          prescribedBy: 'Dr. Smith'
        },
        recordedAt: new Date(),
        source: 'medical_record',
        verified: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Check access
      if (healthData.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(healthData);
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

      // Mock implementation
      const updatedData = {
        id: dataId,
        ...updates,
        updatedAt: new Date()
      };

      logger.info('Health data updated', { dataId });
      res.json(updatedData);
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

      logger.info('Health data deletion requested', { dataId, userId: req.user!.id });

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

      // Mock implementation
      const summary = {
        userId,
        totalRecords: 45,
        lastUpdated: new Date(),
        recordsByType: {
          vitals: 15,
          medication: 8,
          allergy: 3,
          condition: 5,
          lab_result: 10,
          vaccination: 4
        },
        recentVitals: {
          bloodPressure: '120/80',
          heartRate: 72,
          weight: 70.5,
          recordedAt: new Date()
        },
        activeMedications: 2,
        knownAllergies: ['Penicillin'],
        chronicConditions: ['Hypertension']
      };

      res.json(summary);
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
      const { startDate, endDate, dataTypes } = req.query;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock implementation
      const timeline = [
        {
          date: new Date(),
          events: [
            {
              type: 'vitals',
              description: 'Blood pressure recorded: 120/80',
              id: 'event-1'
            },
            {
              type: 'medication',
              description: 'Started Paracetamol 500mg',
              id: 'event-2'
            }
          ]
        }
      ];

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
      const { notes } = req.body;

      // Mock implementation
      const verifiedData = {
        id: dataId,
        verified: true,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
        verificationNotes: notes
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
      // Mock implementation
      const stats = {
        totalRecords: 15680,
        verifiedRecords: 12450,
        recordsByType: {
          vitals: 5600,
          medication: 3200,
          allergy: 1500,
          condition: 2100,
          lab_result: 2800,
          vaccination: 480
        },
        recordsBySource: {
          user: 8900,
          medical_record: 5200,
          integration: 1580
        },
        last24Hours: {
          newRecords: 156,
          updatedRecords: 45
        }
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get health data stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

export default router;
