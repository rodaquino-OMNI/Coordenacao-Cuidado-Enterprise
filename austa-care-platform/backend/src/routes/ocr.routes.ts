/**
 * OCR Routes
 * RESTful API endpoints for OCR (Optical Character Recognition) operations
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for OCR image uploads
const storage = multer.memoryStorage(); // Store in memory for processing

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // One file at a time for OCR
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/tiff',
      'application/pdf'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for OCR'));
    }
  }
});

// Validation schemas
const ProcessOCRSchema = z.object({
  documentType: z.enum(['prescription', 'lab_result', 'medical_record', 'insurance', 'general']).default('general'),
  language: z.enum(['pt-BR', 'en-US', 'es-ES']).default('pt-BR'),
  extractEntities: z.boolean().default(true),
  userId: z.string().uuid('Invalid user ID').optional()
});

const JobIdSchema = z.object({
  jobId: z.string().uuid('Invalid job ID')
});

const JobQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  documentType: z.enum(['prescription', 'lab_result', 'medical_record', 'insurance', 'general']).optional()
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/ocr/process
 * @desc    Process image/document with OCR
 * @access  Private
 */
router.post('/process',
  strictRateLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { documentType, language, extractEntities, userId } = req.body;

      // Validate user access
      const targetUserId = userId || req.user!.id;
      if (targetUserId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock implementation - in production, this would trigger actual OCR processing
      const job = {
        id: `ocr-job-${Date.now()}`,
        userId: targetUserId,
        documentType: documentType || 'general',
        language: language || 'pt-BR',
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: 'processing',
        createdAt: new Date(),
        estimatedCompletionTime: new Date(Date.now() + 30000) // 30 seconds
      };

      logger.info('OCR job created', {
        jobId: job.id,
        userId: targetUserId,
        documentType: job.documentType
      });

      res.status(202).json({
        message: 'OCR processing started',
        job
      });
    } catch (error) {
      logger.error('Failed to start OCR processing', { error });
      res.status(500).json({ error: 'Failed to start OCR processing' });
    }
  }
);

/**
 * @route   GET /api/v1/ocr/job/:jobId
 * @desc    Get OCR job status and results
 * @access  Private
 */
router.get('/job/:jobId',
  defaultRateLimiter,
  validateParams(JobIdSchema),
  async (req, res) => {
    try {
      const { jobId } = req.params;

      // Mock implementation
      const job = {
        id: jobId,
        userId: req.user!.id,
        documentType: 'prescription',
        language: 'pt-BR',
        fileName: 'prescription.jpg',
        status: 'completed',
        createdAt: new Date(Date.now() - 60000),
        completedAt: new Date(Date.now() - 30000),
        processingTime: '28.5s',
        result: {
          text: 'PRESCRIÇÃO MÉDICA\n\nPaciente: João Silva\nMedicamento: Paracetamol 500mg\nPosologia: 1 comprimido a cada 8 horas\nDuração: 7 dias',
          confidence: 0.95,
          entities: [
            {
              type: 'medication',
              value: 'Paracetamol 500mg',
              confidence: 0.98,
              position: { start: 65, end: 82 }
            },
            {
              type: 'dosage',
              value: '1 comprimido a cada 8 horas',
              confidence: 0.96,
              position: { start: 95, end: 122 }
            },
            {
              type: 'duration',
              value: '7 dias',
              confidence: 0.94,
              position: { start: 134, end: 140 }
            },
            {
              type: 'patient_name',
              value: 'João Silva',
              confidence: 0.92,
              position: { start: 34, end: 44 }
            }
          ],
          metadata: {
            pageCount: 1,
            detectedLanguage: 'pt-BR',
            imageQuality: 'high',
            textOrientation: 'horizontal'
          }
        }
      };

      // Check access
      if (job.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(job);
    } catch (error) {
      logger.error('Failed to get OCR job', { error, jobId: req.params.jobId });
      res.status(500).json({ error: 'Failed to retrieve OCR job' });
    }
  }
);

/**
 * @route   GET /api/v1/ocr/jobs
 * @desc    Get all OCR jobs for user
 * @access  Private
 */
router.get('/jobs',
  defaultRateLimiter,
  validateQuery(JobQuerySchema),
  async (req, res) => {
    try {
      const { page, limit, status, documentType } = req.query as any;

      // Mock implementation
      const jobs = [
        {
          id: 'ocr-job-1',
          userId: req.user!.id,
          documentType: 'prescription',
          fileName: 'prescription.jpg',
          status: 'completed',
          createdAt: new Date(),
          completedAt: new Date(),
          confidence: 0.95
        },
        {
          id: 'ocr-job-2',
          userId: req.user!.id,
          documentType: 'lab_result',
          fileName: 'lab_results.pdf',
          status: 'processing',
          createdAt: new Date(),
          confidence: null
        }
      ];

      res.json({
        jobs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: jobs.length,
          totalPages: Math.ceil(jobs.length / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get OCR jobs', { error });
      res.status(500).json({ error: 'Failed to retrieve OCR jobs' });
    }
  }
);

/**
 * @route   POST /api/v1/ocr/job/:jobId/retry
 * @desc    Retry failed OCR job
 * @access  Private
 */
router.post('/job/:jobId/retry',
  strictRateLimiter,
  validateParams(JobIdSchema),
  async (req, res) => {
    try {
      const { jobId } = req.params;

      // Mock implementation
      const retriedJob = {
        id: `ocr-job-${Date.now()}`,
        originalJobId: jobId,
        userId: req.user!.id,
        status: 'processing',
        createdAt: new Date(),
        estimatedCompletionTime: new Date(Date.now() + 30000)
      };

      logger.info('OCR job retried', { originalJobId: jobId, newJobId: retriedJob.id });
      res.status(202).json(retriedJob);
    } catch (error) {
      logger.error('Failed to retry OCR job', { error, jobId: req.params.jobId });
      res.status(500).json({ error: 'Failed to retry OCR job' });
    }
  }
);

/**
 * @route   DELETE /api/v1/ocr/job/:jobId
 * @desc    Delete OCR job and results
 * @access  Private
 */
router.delete('/job/:jobId',
  strictRateLimiter,
  validateParams(JobIdSchema),
  async (req, res) => {
    try {
      const { jobId } = req.params;

      logger.info('OCR job deletion requested', { jobId, userId: req.user!.id });

      res.json({
        message: 'OCR job deleted',
        jobId
      });
    } catch (error) {
      logger.error('Failed to delete OCR job', { error, jobId: req.params.jobId });
      res.status(500).json({ error: 'Failed to delete OCR job' });
    }
  }
);

/**
 * @route   POST /api/v1/ocr/batch
 * @desc    Process multiple documents in batch
 * @access  Private
 */
router.post('/batch',
  strictRateLimiter,
  upload.array('files', 10),
  async (req, res) => {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const files = req.files as Express.Multer.File[];
      const { documentType, language } = req.body;

      // Mock implementation
      const batchJob = {
        id: `ocr-batch-${Date.now()}`,
        userId: req.user!.id,
        totalFiles: files.length,
        documentType: documentType || 'general',
        language: language || 'pt-BR',
        status: 'processing',
        jobs: files.map((file, index) => ({
          id: `ocr-job-${Date.now()}-${index}`,
          fileName: file.originalname,
          fileSize: file.size,
          status: 'pending'
        })),
        createdAt: new Date(),
        estimatedCompletionTime: new Date(Date.now() + files.length * 30000)
      };

      logger.info('OCR batch job created', {
        batchId: batchJob.id,
        userId: req.user!.id,
        fileCount: files.length
      });

      res.status(202).json({
        message: 'Batch OCR processing started',
        batch: batchJob
      });
    } catch (error) {
      logger.error('Failed to start batch OCR processing', { error });
      res.status(500).json({ error: 'Failed to start batch OCR processing' });
    }
  }
);

/**
 * @route   GET /api/v1/ocr/stats
 * @desc    Get OCR statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      // Mock implementation
      const stats = {
        totalJobs: 5670,
        completed: 5200,
        processing: 45,
        failed: 425,
        pending: 0,
        jobsByType: {
          prescription: 2100,
          lab_result: 1800,
          medical_record: 1200,
          insurance: 470,
          general: 100
        },
        averageProcessingTime: '28.5s',
        averageConfidence: 0.94,
        last24Hours: {
          total: 156,
          completed: 145,
          failed: 11
        },
        successRate: 0.925
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get OCR stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

/**
 * @route   GET /api/v1/ocr/supported-formats
 * @desc    Get supported file formats and languages
 * @access  Private
 */
router.get('/supported-formats',
  defaultRateLimiter,
  async (req, res) => {
    try {
      const supportedFormats = {
        fileTypes: [
          { type: 'image/jpeg', extension: '.jpg/.jpeg', maxSize: '10MB' },
          { type: 'image/png', extension: '.png', maxSize: '10MB' },
          { type: 'image/tiff', extension: '.tiff', maxSize: '10MB' },
          { type: 'application/pdf', extension: '.pdf', maxSize: '10MB' }
        ],
        languages: [
          { code: 'pt-BR', name: 'Portuguese (Brazil)' },
          { code: 'en-US', name: 'English (US)' },
          { code: 'es-ES', name: 'Spanish (Spain)' }
        ],
        documentTypes: [
          { type: 'prescription', name: 'Medical Prescription' },
          { type: 'lab_result', name: 'Laboratory Result' },
          { type: 'medical_record', name: 'Medical Record' },
          { type: 'insurance', name: 'Insurance Document' },
          { type: 'general', name: 'General Document' }
        ],
        features: [
          'Entity extraction',
          'Confidence scoring',
          'Multi-page support',
          'Language detection',
          'Table extraction'
        ]
      };

      res.json(supportedFormats);
    } catch (error) {
      logger.error('Failed to get supported formats', { error });
      res.status(500).json({ error: 'Failed to retrieve supported formats' });
    }
  }
);

// Error handling middleware for multer
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: 'File upload error', details: error.message });
  }

  if (error.message === 'Invalid file type for OCR') {
    return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, TIFF, and PDF files are allowed.' });
  }

  next(error);
});

export default router;
