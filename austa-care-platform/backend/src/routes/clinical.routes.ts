import { Router, Request, Response } from 'express';
import { AdvancedRiskAssessmentService } from '../services/risk-assessment.service';
import { EmergencyDetectionService } from '../services/emergency-detection.service';
import { clinicalScoreQueue } from '../lib/queue';
import { getAlgorithmVersion, ALGORITHM_VERSIONS } from '../lib/algorithm-registry';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// --------------- Singleton service references ---------------
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

// ----------------------------------------------------------------

/**
 * @route   GET /api/v1/clinical/algorithm-versions
 * @desc    Return all registered clinical algorithm versions
 * @access  Public
 */
router.get('/algorithm-versions', (_req: Request, res: Response) => {
  res.json({
    algorithms: ALGORITHM_VERSIONS,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   GET /api/v1/clinical/algorithm-version/:name
 * @desc    Return the version of a specific algorithm
 * @access  Public
 */
router.get('/algorithm-version/:name', (req: Request, res: Response) => {
  const name = req.params.name as keyof typeof ALGORITHM_VERSIONS;
  if (!(name in ALGORITHM_VERSIONS)) {
    return res.status(404).json({
      error: { code: 'UNKNOWN_ALGORITHM', message: `Algorithm '${name}' is not registered` },
    });
  }
  res.json({ name, version: getAlgorithmVersion(name) });
});

/**
 * @route   POST /api/v1/clinical/risk-assessment
 * @desc    Enqueue advanced risk-assessment pipeline (async via BullMQ)
 * @access  Private
 */
router.post('/risk-assessment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const job = await clinicalScoreQueue.add('risk-assessment', {
      type: 'risk-assessment',
      payload: req.body,
    });

    return res.status(202).json({
      status: 'queued',
      jobId: job.id,
      estimatedTime: '30s',
      algorithmVersion: getAlgorithmVersion('risk-assessment'),
    });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: 'RISK_ASSESSMENT_FAILED', message: error?.message ?? 'Internal error' },
    });
  }
});

/**
 * @route   POST /api/v1/clinical/emergency-detection
 * @desc    Enqueue emergency detection pipeline (async via BullMQ)
 * @access  Private
 */
router.post('/emergency-detection', authenticateToken, async (req: Request, res: Response) => {
  try {
    const job = await clinicalScoreQueue.add('emergency-detection', {
      type: 'emergency-detection',
      payload: req.body,
      organizationId: req.body.organizationId,
    });

    return res.status(202).json({
      status: 'queued',
      jobId: job.id,
      estimatedTime: '30s',
      algorithmVersion: getAlgorithmVersion('emergency-detection'),
    });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: 'EMERGENCY_DETECTION_FAILED', message: error?.message ?? 'Internal error' },
    });
  }
});

export const clinicalRoutes = router;
