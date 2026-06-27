/**
 * Clinical Score Worker
 * Processes risk-assessment and emergency-detection jobs from the
 * 'clinical-score' queue.
 *
 * Job data shape:
 *   { type: 'risk-assessment' | 'emergency-detection'; payload: any; organizationId?: string }
 */

import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import { logger } from '../utils/logger';
import { AdvancedRiskAssessmentService } from '../services/risk-assessment.service';
import { EmergencyDetectionService } from '../services/emergency-detection.service';

export type ClinicalJobType = 'risk-assessment' | 'emergency-detection';

export interface ClinicalScoreJobData {
  type: ClinicalJobType;
  payload: any;
  organizationId?: string;
}

// Lazily-instantiated services (same pattern used by clinical.routes.ts)
let riskService: AdvancedRiskAssessmentService;
let emergencyService: EmergencyDetectionService;

function getRiskService(): AdvancedRiskAssessmentService {
  if (!riskService) {
    riskService = new AdvancedRiskAssessmentService();
  }
  return riskService;
}

function getEmergencyService(): EmergencyDetectionService {
  if (!emergencyService) {
    emergencyService = new EmergencyDetectionService({
      autoEscalation: true,
      emergencyContacts: [],
      escalationTimeouts: { immediate: 0, critical: 30, high: 120 },
      notificationChannels: [],
    });
  }
  return emergencyService;
}

const clinicalScoreWorker = new Worker<ClinicalScoreJobData>(
  'clinical-score',
  async (job: Job<ClinicalScoreJobData>) => {
    const { type, payload, organizationId } = job.data;

    logger.info('Processing clinical-score job', {
      jobId: job.id,
      type,
    });

    switch (type) {
      case 'risk-assessment': {
        const service = getRiskService();
        const result = await service.assessRisk(payload);
        logger.info('Risk assessment completed', {
          jobId: job.id,
          riskLevel: result.composite.riskLevel,
        });
        return result;
      }

      case 'emergency-detection': {
        const service = getEmergencyService();
        const alerts = await service.detectEmergencies(payload, organizationId);
        logger.info('Emergency detection completed', {
          jobId: job.id,
          alertCount: alerts.length,
        });
        return { alerts, count: alerts.length };
      }

      default:
        throw new Error(`Unknown clinical job type: ${type}`);
    }
  },
  {
    connection,
    concurrency: 3,
    autorun: true,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  }
);

// ---------------------------------------------------------------------------
// Lifecycle events
// ---------------------------------------------------------------------------
clinicalScoreWorker.on('completed', (job: Job) => {
  logger.info('Clinical-score job completed', { jobId: job.id });
});

clinicalScoreWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error('Clinical-score job failed', {
    jobId: job?.id,
    error: err.message,
  });
});

clinicalScoreWorker.on('error', (err: Error) => {
  logger.error('Clinical-score worker error', { error: err.message });
});

export { clinicalScoreWorker };
