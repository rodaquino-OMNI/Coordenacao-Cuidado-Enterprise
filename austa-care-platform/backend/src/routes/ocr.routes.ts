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
import { prisma } from '../config/database';
import { DocumentType, DocumentStatus, DocumentCategory } from '@prisma/client';

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

// Map API documentType to Prisma DocumentType
const API_DOC_TYPE_MAP: Record<string, DocumentType> = {
  'prescription': DocumentType.PRESCRIPTION,
  'lab_result': DocumentType.LAB_RESULT,
  'medical_record': DocumentType.MEDICAL_RECORD,
  'insurance': DocumentType.INSURANCE_CARD,
  'general': DocumentType.OTHER,
};

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

// Map API status to Prisma DocumentStatus
function mapStatusToPrisma(status?: string): DocumentStatus | undefined {
  if (!status) return undefined;
  const map: Record<string, DocumentStatus> = {
    'pending': DocumentStatus.PENDING,
    'processing': DocumentStatus.PROCESSING,
    'completed': DocumentStatus.COMPLETED,
    'failed': DocumentStatus.FAILED,
  };
  return map[status];
}

// Format OCR job for API response
function formatOCRJob(doc: any) {
  return {
    id: doc.id,
    userId: doc.userId,
    documentType: doc.type?.toLowerCase() || 'general',
    language: 'pt-BR', // Stored in extractedData, default for now
    fileName: doc.fileName || doc.filename,
    fileSize: doc.fileSize || doc.size,
    mimeType: doc.mimeType,
    status: doc.status?.toLowerCase() || 'pending',
    createdAt: doc.createdAt,
    completedAt: doc.processedAt || null,
    processingTime: doc.processedAt && doc.createdAt
      ? `${Math.round((doc.processedAt.getTime() - doc.createdAt.getTime()) / 1000)}s`
      : null,
    confidence: doc.ocrConfidence || null,
    result: doc.hasOcr ? {
      text: doc.ocrText || null,
      confidence: doc.ocrConfidence || null,
      entities: doc.extractedData?.entities || [],
      metadata: {
        pageCount: doc.extractedData?.pages || 1,
        detectedLanguage: doc.extractedData?.language || 'pt-BR',
        imageQuality: 'unknown',
        textOrientation: 'horizontal',
      }
    } : null,
  };
}

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

      const prismaDocType = API_DOC_TYPE_MAP[documentType] || DocumentType.OTHER;

      // Create the document record in Prisma
      const document = await prisma.document.create({
        data: {
          userId: targetUserId,
          type: prismaDocType,
          category: DocumentCategory.MEDICAL,
          fileName: req.file.originalname,
          filename: req.file.originalname,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          fileSize: req.file.size,
          storagePath: `memory://${req.file.originalname}`,
          storageProvider: 'LOCAL',
          status: DocumentStatus.PROCESSING,
          title: `OCR: ${req.file.originalname}`,
          organizationId: req.user!.id,
        },
      });

      // Trigger OCR processing asynchronously
      triggerOCRJob(document.id, req.file.buffer, req.file.originalname, {
        documentType: prismaDocType,
        language: language || 'pt-BR',
        extractEntities: extractEntities !== false,
      }).catch(err => {
        logger.error('Background OCR job failed', { documentId: document.id, error: err });
      });

      logger.info('OCR job created', {
        jobId: document.id,
        userId: targetUserId,
        documentType: prismaDocType
      });

      res.status(202).json({
        message: 'OCR processing started',
        job: {
          id: document.id,
          userId: targetUserId,
          documentType: documentType || 'general',
          language: language || 'pt-BR',
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          status: 'processing',
          createdAt: document.createdAt,
          estimatedCompletionTime: new Date(Date.now() + 30000),
        }
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

      const document = await prisma.document.findUnique({
        where: { id: jobId },
      });

      if (!document) {
        return res.status(404).json({ error: 'OCR job not found' });
      }

      // Check access
      if (document.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(formatOCRJob(document));
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

      // Build where clause - only show documents with OCR processing
      const where: any = {
        userId: req.user!.id,
        isActive: true,
      };

      if (status) {
        where.status = mapStatusToPrisma(status);
      }

      if (documentType) {
        where.type = API_DOC_TYPE_MAP[documentType] || DocumentType.OTHER;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.count({ where }),
      ]);

      res.json({
        jobs: documents.map(formatOCRJob),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
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

      const existing = await prisma.document.findUnique({ where: { id: jobId } });
      if (!existing) {
        return res.status(404).json({ error: 'OCR job not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update status to PROCESSING and retry
      await prisma.document.update({
        where: { id: jobId },
        data: {
          status: DocumentStatus.PROCESSING,
          hasOcr: false,
          ocrText: null,
          ocrConfidence: null,
          processedAt: null,
        },
      });

      // Trigger OCR processing asynchronously
      triggerOCRJob(jobId, null, existing.fileName || existing.filename || 'unknown', {
        documentType: existing.type,
        language: 'pt-BR',
        extractEntities: true,
      }).catch(err => {
        logger.error('Background OCR retry failed', { documentId: jobId, error: err });
      });

      logger.info('OCR job retried', { originalJobId: jobId });

      res.status(202).json({
        id: jobId,
        originalJobId: jobId,
        userId: req.user!.id,
        status: 'processing',
        createdAt: new Date(),
        estimatedCompletionTime: new Date(Date.now() + 30000),
      });
    } catch (error) {
      logger.error('Failed to retry OCR job', { error, jobId: req.params.jobId });
      res.status(500).json({ error: 'Failed to retry OCR job' });
    }
  }
);

/**
 * @route   DELETE /api/v1/ocr/job/:jobId
 * @desc    Delete OCR job and results (soft delete)
 * @access  Private
 */
router.delete('/job/:jobId',
  strictRateLimiter,
  validateParams(JobIdSchema),
  async (req, res) => {
    try {
      const { jobId } = req.params;

      const existing = await prisma.document.findUnique({ where: { id: jobId } });
      if (!existing) {
        return res.status(404).json({ error: 'OCR job not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Soft delete: archive the document
      await prisma.document.update({
        where: { id: jobId },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      });

      logger.info('OCR job archived', { jobId, userId: req.user!.id });

      res.json({
        message: 'OCR job archived',
        jobId,
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
      const prismaDocType = API_DOC_TYPE_MAP[documentType] || DocumentType.OTHER;

      // Create document records for all files in batch
      const createdDocs = await Promise.all(
        files.map(file =>
          prisma.document.create({
            data: {
              userId: req.user!.id,
              type: prismaDocType,
              category: DocumentCategory.MEDICAL,
              fileName: file.originalname,
              filename: file.originalname,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              fileSize: file.size,
              storagePath: `memory://${file.originalname}`,
              storageProvider: 'LOCAL',
              status: DocumentStatus.PENDING,
              title: `Batch OCR: ${file.originalname}`,
              organizationId: req.user!.id,
            },
          })
        )
      );

      // Trigger batch OCR processing asynchronously
      triggerBatchOCRJobs(createdDocs.map(d => ({
        id: d.id,
        buffer: files.find(f => f.originalname === d.originalName)?.buffer || null,
        fileName: d.originalName,
      })), {
        documentType: prismaDocType,
        language: language || 'pt-BR',
      } as any).catch(err => {
        logger.error('Background batch OCR failed', { error: err });
      });

      logger.info('OCR batch job created', {
        batchId: `batch-${createdDocs[0]?.id}`,
        userId: req.user!.id,
        fileCount: files.length
      });

      res.status(202).json({
        message: 'Batch OCR processing started',
        batch: {
          id: `batch-${Date.now()}`,
          userId: req.user!.id,
          totalFiles: files.length,
          documentType: documentType || 'general',
          language: language || 'pt-BR',
          status: 'processing',
          jobs: createdDocs.map((doc, index) => ({
            id: doc.id,
            fileName: doc.originalName,
            fileSize: doc.fileSize || doc.size,
            status: 'pending',
          })),
          createdAt: new Date(),
          estimatedCompletionTime: new Date(Date.now() + files.length * 30000),
        }
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
      const [
        totalDocs,
        completed,
        processing,
        failed,
        pending,
        typeBreakdown,
        docsLast24h,
        completedLast24h,
        failedLast24h,
        avgConfidence,
      ] = await Promise.all([
        prisma.document.count({ where: { isActive: true } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.COMPLETED } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.PROCESSING } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.FAILED } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.PENDING } }),
        prisma.document.groupBy({
          by: ['type'],
          where: { isActive: true },
          _count: true,
        }),
        prisma.document.count({
          where: {
            isActive: true,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.document.count({
          where: {
            isActive: true,
            status: DocumentStatus.COMPLETED,
            processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.document.count({
          where: {
            isActive: true,
            status: DocumentStatus.FAILED,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.document.aggregate({
          where: { isActive: true, hasOcr: true, ocrConfidence: { not: null } },
          _avg: { ocrConfidence: true },
        }),
      ]);

      const jobsByType: Record<string, number> = {};
      for (const item of typeBreakdown) {
        const key = item.type?.toLowerCase() || 'general';
        jobsByType[key] = (jobsByType[key] || 0) + item._count;
      }

      const successRate = totalDocs > 0
        ? (completed / totalDocs)
        : 0;

      const stats = {
        totalJobs: totalDocs,
        completed,
        processing,
        failed,
        pending,
        jobsByType,
        averageProcessingTime: 'N/A', // Would need to track processing duration
        averageConfidence: avgConfidence._avg?.ocrConfidence || 0,
        last24Hours: {
          total: docsLast24h,
          completed: completedLast24h,
          failed: failedLast24h,
        },
        successRate: Math.round(successRate * 1000) / 1000,
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
    // Static configuration - no database needed
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

// ============================================
// Background OCR Processing Helpers
// ============================================

interface OCRJobOptions {
  documentType: DocumentType;
  language: string;
  extractEntities: boolean;
}

/**
 * Trigger OCR processing for a single document asynchronously.
 * Uses the OCROrchestrator service for the full pipeline.
 */
async function triggerOCRJob(
  documentId: string,
  fileBuffer: Buffer | null,
  fileName: string,
  options: OCRJobOptions
): Promise<void> {
  try {
    // Update status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PROCESSING },
    });

    // In a production environment, the file would already be in S3.
    // For now, we store the buffer to disk temporarily so the orchestrator can read it.
    let storagePath = '';
    if (fileBuffer) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `ocr-${documentId}-${fileName}`);
      await fs.writeFile(tmpFile, fileBuffer);
      storagePath = tmpFile;
    } else {
      // Retry case: use the existing storage path from the document
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { storagePath: true },
      });
      storagePath = doc?.storagePath || '';
    }

    if (!storagePath) {
      throw new Error('No file available for OCR processing');
    }

    // Run the OCR orchestrator
    const { OCROrchestrator } = await import('../services/ocr/ocr-orchestrator.service');
    const orchestrator = new OCROrchestrator();

    const result = await orchestrator.processDocument(storagePath, {
      language: options.language,
      extractEntities: options.extractEntities,
    } as any);

    // Update document with OCR results
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.COMPLETED,
        hasOcr: true,
        ocrText: result.document.blocks?.map((b: any) => b.text).join('\n') || null,
        ocrConfidence: result.document.overallConfidence || result.processingMetrics.confidence,
        extractedData: {
          entities: result.document.medicalEntities || [],
          pages: result.document.pages || 1,
          language: options.language,
          fhirResources: result.fhirResources,
          validationResults: result.validationResults,
        } as any,
        processedAt: new Date(),
      },
    });

    logger.info('OCR job completed successfully', {
      documentId,
      confidence: result.processingMetrics.confidence,
      processingTime: result.processingMetrics.totalTime,
    });

    // Clean up temp file if we created one
    if (fileBuffer && storagePath) {
      const fs = await import('fs/promises');
      await fs.unlink(storagePath).catch(() => {});
    }
  } catch (error) {
    logger.error('OCR job failed', { documentId, error });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.FAILED },
    }).catch(err => logger.error('Failed to update document status after OCR failure', { documentId, error: err }));
  }
}

/**
 * Trigger batch OCR processing for multiple documents.
 */
async function triggerBatchOCRJobs(
  jobs: Array<{ id: string; buffer: Buffer | null; fileName: string }>,
  options: OCRJobOptions
): Promise<void> {
  // Update all documents to PROCESSING
  await Promise.all(
    jobs.map(job =>
      prisma.document.update({
        where: { id: job.id },
        data: { status: DocumentStatus.PROCESSING },
      }).catch(err => logger.error('Failed to update batch document status', { documentId: job.id, error: err }))
    )
  );

  // Process each document (in production, this would be a queue-based approach)
  const results = await Promise.allSettled(
    jobs.map(job =>
      triggerOCRJob(job.id, job.buffer, job.fileName, options)
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  logger.info('Batch OCR processing completed', {
    total: jobs.length,
    succeeded,
    failed,
  });
}

export default router;
