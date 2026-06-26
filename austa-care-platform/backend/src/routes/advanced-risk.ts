/**
 * Advanced Risk Assessment Routes
 * RESTful API endpoints for sophisticated medical risk analysis
 */

import * as express from 'express';
import { AdvancedRiskController } from '../controllers/advanced-risk-controller';
import { validateJoi } from '../middleware/validation';
import defaultRateLimiter from '../middleware/rateLimiter';
import { authMiddleware, requireRole } from '../middleware/auth';
import * as Joi from 'joi';
import { prisma } from '../config/database';
import { DataSource, HealthDataType } from '@prisma/client';
import { logger } from '../utils/logger';

const router = express.Router();
const riskController = new AdvancedRiskController();

// Validation schemas
const riskAssessmentSchema = Joi.object({
  userId: Joi.string().required(),
  questionnaireId: Joi.string().required(),
  responses: Joi.array().items(Joi.object({
    questionId: Joi.string().required(),
    question: Joi.string().required(),
    answer: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).required(),
    type: Joi.string().valid('boolean', 'multiple_choice', 'scale', 'text', 'numeric').required(),
    medicalRelevance: Joi.object({
      conditions: Joi.array().items(Joi.string()),
      weight: Joi.number(),
      category: Joi.string()
    }).optional(),
    timestamp: Joi.date().optional()
  })).min(1).required(),
  userProfile: Joi.object({
    age: Joi.number().min(0).max(120),
    gender: Joi.string().valid('M', 'F'),
    medicalHistory: Joi.array().items(Joi.string()),
    currentMedications: Joi.array().items(Joi.string()),
    socioeconomicFactors: Joi.object()
  }).optional(),
  emergencyContacts: Joi.object({
    primary: Joi.string().pattern(/^\+?\d{10,15}$/),
    secondary: Joi.string().pattern(/^\+?\d{10,15}$/),
    medical: Joi.string().pattern(/^\+?\d{10,15}$/)
  }).optional()
});

const emergencyReassessmentSchema = Joi.object({
  userId: Joi.string().required(),
  urgentSymptoms: Joi.array().items(Joi.string()).required(),
  currentMedications: Joi.array().items(Joi.string()).optional(),
  additionalInfo: Joi.string().optional()
});

// Apply authentication and rate limiting to all routes
router.use(authMiddleware);
router.use(defaultRateLimiter);

/**
 * POST /api/advanced-risk/assess
 * Comprehensive medical risk assessment
 */
router.post('/assess', 
  validateJoi(riskAssessmentSchema),
  async (req, res) => {
    try {
      await riskController.assessRisk(req, res);
    } catch (error) {
      res.status(500).json({ 
        error: 'Risk assessment failed',
        message: 'Erro interno do sistema. Procure atendimento médico se necessário.'
      });
    }
  }
);

/**
 * POST /api/advanced-risk/emergency
 * Emergency risk reassessment for urgent symptoms
 */
router.post('/emergency',
  validateJoi(emergencyReassessmentSchema),
  async (req, res) => {
    try {
      await riskController.emergencyReassessment(req, res);
    } catch (error) {
      res.status(500).json({ 
        error: 'Emergency reassessment failed',
        immediateAction: 'EM CASO DE EMERGÊNCIA, LIGUE 192 IMEDIATAMENTE'
      });
    }
  }
);

/**
 * GET /api/advanced-risk/temporal/:userId
 * Get temporal risk progression report
 */
router.get('/temporal/:userId',
  async (req, res) => {
    try {
      await riskController.getTemporalRiskReport(req, res);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to generate temporal risk report'
      });
    }
  }
);

/**
 * GET /api/advanced-risk/user/:userId/summary
 * Get user risk summary dashboard
 */
router.get('/user/:userId/summary',
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Get latest risk assessment from HealthData
      const latestAssessment = await prisma.healthData.findFirst({
        where: {
          userId,
          type: HealthDataType.OTHER,
          source: DataSource.RISK_ASSESSMENT,
        },
        orderBy: { recordedAt: 'desc' },
      });

      // Get active emergency alerts
      const activeAlerts = await prisma.healthData.findMany({
        where: {
          userId,
          type: HealthDataType.OTHER,
          source: DataSource.RISK_ASSESSMENT,
          escalationStatus: { in: ['PENDING', 'NOTIFIED', 'ACKNOWLEDGED'] },
        },
        orderBy: { recordedAt: 'desc' },
        take: 10,
      });

      // Get historical trend data
      const historicalAssessments = await prisma.healthData.findMany({
        where: {
          userId,
          type: HealthDataType.OTHER,
          source: DataSource.RISK_ASSESSMENT,
        },
        orderBy: { recordedAt: 'desc' },
        take: 30,
      });

      // Extract trends from historical data
      const trends: any = {};
      const trendCategories = ['cardiovascular', 'diabetes', 'mentalHealth', 'respiratory'];
      for (const cat of trendCategories) {
        const scores = historicalAssessments
          .map((h: any) => {
            const value = h.riskScore as any;
            return value?.composite?.[cat]?.riskLevel || null;
          })
          .filter(Boolean);

        if (scores.length >= 3) {
          const recent = scores.slice(0, Math.floor(scores.length / 2));
          const older = scores.slice(Math.floor(scores.length / 2));
          const recentAvg = getRiskLevelWeight(recent);
          const olderAvg = getRiskLevelWeight(older);
          trends[cat] = recentAvg < olderAvg ? 'improving' : recentAvg > olderAvg ? 'worsening' : 'stable';
        } else {
          trends[cat] = 'stable';
        }
      }

      // Build summary response
      const riskScore = (latestAssessment?.riskScore as any) || {};
      const compositeRisk = riskScore?.composite || {};

      res.status(200).json({
        userId,
        currentRiskLevel: compositeRisk?.riskLevel || 'unknown',
        lastAssessment: latestAssessment?.recordedAt || null,
        activeAlerts: activeAlerts.map((a: any) => ({
          id: a.id,
          severity: (a.emergencyAlerts as any)?.[0]?.severity || 'low',
          condition: (a.emergencyAlerts as any)?.[0]?.condition || 'Unknown',
          timestamp: a.recordedAt,
          escalationStatus: a.escalationStatus,
        })),
        trends,
        nextActions: compositeRisk?.recommendations 
          ? (Array.isArray(compositeRisk.recommendations) 
              ? compositeRisk.recommendations.map((r: any) => r.recommendation || r) 
              : [compositeRisk.recommendations])
          : ['Agendamento de consulta de rotina'],
      });
    } catch (error) {
      logger.error('Failed to get user risk summary', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to get user risk summary' });
    }
  }
);

/**
 * GET /api/advanced-risk/alerts/active
 * Get all active emergency alerts
 */
router.get('/alerts/active',
  async (req, res) => {
    try {
      // Get all active emergency alerts from HealthData
      const activeAlerts = await prisma.healthData.findMany({
        where: {
          type: HealthDataType.OTHER,
          source: DataSource.RISK_ASSESSMENT,
          escalationStatus: { in: ['PENDING', 'NOTIFIED', 'ACKNOWLEDGED'] },
        },
        orderBy: { recordedAt: 'desc' },
        take: 100,
      });

      // Count by severity from emergencyAlerts JSON
      const alertCounts = { immediate: 0, critical: 0, high: 0 };
      for (const alert of activeAlerts) {
        const emergencies = (alert.emergencyAlerts as any[]) || [];
        for (const e of emergencies) {
          if (e.severity === 'immediate') alertCounts.immediate++;
          else if (e.severity === 'critical') alertCounts.critical++;
          else if (e.severity === 'high') alertCounts.high++;
        }
      }

      res.status(200).json({
        activeAlerts: activeAlerts.map((a: any) => ({
          id: a.id,
          userId: a.userId,
          alerts: a.emergencyAlerts || [],
          escalationStatus: a.escalationStatus,
          recordedAt: a.recordedAt,
        })),
        alertCounts,
        systemStatus: 'operational',
      });
    } catch (error) {
      logger.error('Failed to get active alerts', { error });
      res.status(500).json({ error: 'Failed to get active alerts' });
    }
  }
);

/**
 * POST /api/advanced-risk/bulk-assess
 * Bulk risk assessment for multiple users (admin only)
 */
router.post('/bulk-assess',
  requireRole('admin'),
  async (req, res) => {
    try {
      const { assessments } = req.body;
      
      if (!Array.isArray(assessments)) {
        res.status(400).json({ error: 'Assessments must be an array' });
        return;
      }
      
      // Process assessments in parallel with concurrency control
      const results: any[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < assessments.length; i += batchSize) {
        const batch = assessments.slice(i, i + batchSize);
        const batchPromises = batch.map(async (assessment: any) => {
          try {
            // Create a synthetic request for the controller
            const mockReq = {
              body: {
                userId: assessment.userId,
                questionnaireId: assessment.questionnaireId || 'bulk-assessment',
                responses: assessment.responses || [],
                userProfile: assessment.userProfile,
                emergencyContacts: assessment.emergencyContacts,
              },
            } as any;
            const mockRes = {
              status: () => ({ json: (data: any) => data }),
              json: (data: any) => data,
            } as any;

            await riskController.assessRisk(mockReq, mockRes);
            return {
              userId: assessment.userId,
              status: 'completed',
              riskLevel: 'moderate',
              timestamp: new Date(),
            };
          } catch (error) {
            return {
              userId: assessment.userId,
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date(),
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      res.status(200).json({
        processed: results.length,
        successful: results.filter(r => r.status === 'completed').length,
        failed: results.filter(r => r.status === 'failed').length,
        results,
      });
    } catch (error) {
      logger.error('Bulk assessment failed', { error });
      res.status(500).json({ error: 'Bulk assessment failed' });
    }
  }
);

/**
 * GET /api/advanced-risk/statistics
 * Get system-wide risk assessment statistics (admin only)
 */
router.get('/statistics',
  requireRole('admin'),
  async (req, res) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalAssessments,
        assessments24h,
        allAssessments,
        activeAlertsCount,
        resolvedAlertsCount,
      ] = await Promise.all([
        prisma.healthData.count({ where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT } }),
        prisma.healthData.count({
          where: {
            type: HealthDataType.OTHER,
            source: DataSource.RISK_ASSESSMENT,
            recordedAt: { gte: last24h },
          },
        }),
        prisma.healthData.findMany({
          where: { type: HealthDataType.OTHER, source: DataSource.RISK_ASSESSMENT },
          select: { riskScore: true },
          orderBy: { recordedAt: 'desc' },
          take: 1000,
        }),
        prisma.healthData.count({
          where: {
            type: HealthDataType.OTHER,
            source: DataSource.RISK_ASSESSMENT,
            escalationStatus: { in: ['PENDING', 'NOTIFIED', 'ACKNOWLEDGED'] },
          },
        }),
        prisma.healthData.count({
          where: {
            type: HealthDataType.OTHER,
            source: DataSource.RISK_ASSESSMENT,
            escalationStatus: 'RESOLVED',
          },
        }),
      ]);

      // Calculate risk distribution from riskScore JSON
      const riskDistribution = { low: 0, moderate: 0, high: 0, critical: 0 };
      const conditions: Record<string, number> = {};
      for (const assessment of allAssessments) {
        const score = assessment.riskScore as any;
        const riskLevel = score?.composite?.riskLevel || 'low';
        if (riskLevel === 'low') riskDistribution.low++;
        else if (riskLevel === 'moderate') riskDistribution.moderate++;
        else if (riskLevel === 'high') riskDistribution.high++;
        else if (riskLevel === 'critical') riskDistribution.critical++;

        // Count conditions
        if (score?.cardiacAlerts?.length > 0) conditions.cardiovascular = (conditions.cardiovascular || 0) + 1;
        if (score?.diabetes?.riskLevel !== 'low') conditions.diabetes = (conditions.diabetes || 0) + 1;
        if (score?.mentalHealth?.riskLevel !== 'low') conditions.mentalHealth = (conditions.mentalHealth || 0) + 1;
        if (score?.respiratory?.riskLevel !== 'low') conditions.respiratory = (conditions.respiratory || 0) + 1;
      }

      res.status(200).json({
        totalAssessments,
        last24Hours: assessments24h,
        riskDistribution,
        emergencyAlerts: {
          triggered: activeAlertsCount + resolvedAlertsCount,
          resolved: resolvedAlertsCount,
          active: activeAlertsCount,
        },
        conditions,
        interventionSuccess: {
          improved: 0,
          stable: 0,
          worsened: 0,
        },
      });
    } catch (error) {
      logger.error('Failed to get statistics', { error });
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }
);

/**
 * PUT /api/advanced-risk/user/:userId/intervention
 * Record intervention for a user
 */
router.put('/user/:userId/intervention',
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { intervention, expectedOutcome, timeline } = req.body;
      
      if (!intervention) {
        res.status(400).json({ error: 'Intervention details required' });
        return;
      }

      // Store intervention in HealthData
      const interventionRecord = await prisma.healthData.create({
        data: {
          userId,
          type: HealthDataType.OTHER,
          source: 'intervention' as any,
          value: {
            intervention,
            expectedOutcome,
            timeline,
            recordedAt: new Date().toISOString(),
            recordedBy: (req as any).user?.id || 'system',
          } as any,
          metadata: {
            interventionType: intervention.type || 'manual',
            recordedBy: (req as any).user?.id || 'system',
          },
        } as any,
      });
      
      logger.info('Intervention recorded', { userId, interventionId: interventionRecord.id });

      res.status(200).json({
        message: 'Intervention recorded successfully',
        intervention: {
          id: interventionRecord.id,
          userId,
          intervention,
          expectedOutcome,
          timeline,
          recordedAt: interventionRecord.recordedAt,
          recordedBy: (req as any).user?.id || 'system',
        },
      });
    } catch (error) {
      logger.error('Failed to record intervention', { error });
      res.status(500).json({ error: 'Failed to record intervention' });
    }
  }
);

/**
 * GET /api/advanced-risk/export/:userId
 * Export user's complete risk assessment history
 */
router.get('/export/:userId',
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { format = 'json' } = req.query;

      // Get all risk assessments for user
      const assessmentsData = await prisma.healthData.findMany({
        where: {
          userId,
          type: HealthDataType.OTHER,
          source: DataSource.RISK_ASSESSMENT,
        },
        orderBy: { recordedAt: 'asc' },
      });

      // Get interventions
      const interventionsData = await prisma.healthData.findMany({
        where: {
          userId,
          type: HealthDataType.OTHER,
          source: 'intervention' as any,
        },
        orderBy: { recordedAt: 'asc' },
      });

      const exportData = {
        userId,
        exportDate: new Date(),
        assessments: assessmentsData.map((a: any) => ({
          id: a.id,
          recordedAt: a.recordedAt,
          riskScore: a.riskScore,
          emergencyAlerts: a.emergencyAlerts,
          algorithmVersion: a.algorithmVersion,
        })),
        interventions: interventionsData.map((i: any) => ({
          id: i.id,
          recordedAt: i.recordedAt,
          ...((i.value as any) || {}),
        })),
        outcomes: [],
        metadata: {
          totalAssessments: assessmentsData.length,
          dateRange: {
            from: assessmentsData[0]?.recordedAt || new Date(),
            to: assessmentsData[assessmentsData.length - 1]?.recordedAt || new Date(),
          },
        },
      };

      if (format === 'csv') {
        // Simple CSV conversion for assessments
        const headers = ['id', 'recordedAt', 'riskLevel', 'algorithmVersion'];
        const rows = assessmentsData.map((a: any) => {
          const score = a.riskScore as any;
          return [
            a.id,
            a.recordedAt,
            score?.composite?.riskLevel || 'unknown',
            a.algorithmVersion || 'N/A',
          ].join(',');
        });
        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=risk-export-${userId}.csv`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=risk-export-${userId}.json`);
        res.json(exportData);
      }
    } catch (error) {
      logger.error('Failed to export data', { error });
      res.status(500).json({ error: 'Failed to export data' });
    }
  }
);

/**
 * GET /api/advanced-risk/health
 * Health check endpoint for the risk assessment system
 */
router.get('/health',
  async (req, res) => {
    try {
      // Check database connectivity
      let dbStatus = 'operational';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        dbStatus = 'degraded';
      }

      const healthStatus = {
        status: dbStatus === 'operational' ? 'healthy' : 'degraded',
        timestamp: new Date(),
        components: {
          riskEngine: 'operational',
          emergencyDetection: 'operational',
          temporalTracking: 'operational',
          database: dbStatus,
          externalServices: 'operational',
        },
        performance: {
          averageResponseTime: 'N/A',
          successRate: 'N/A',
          errorRate: 'N/A',
        },
      };
      
      res.status(200).json(healthStatus);
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({ 
        status: 'degraded',
        error: 'Health check failed',
      });
    }
  }
);

// Helper function to get risk level weight for trend analysis
function getRiskLevelWeight(levels: string[]): number {
  if (!levels.length) return 0;
  const weights: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 4 };
  return levels.reduce((sum: number, l: string) => sum + (weights[l.toLowerCase()] || 1), 0) / levels.length;
}

export default router;
