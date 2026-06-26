/**
 * Document Management Routes
 * RESTful API endpoints for document upload and management
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { DocumentType, DocumentStatus, DocumentCategory } from '@prisma/client';

const router = Router();

// Map API documentType values to Prisma DocumentType enum
const API_TO_PRISMA_DOC_TYPE: Record<string, DocumentType> = {
  'medical_record': DocumentType.MEDICAL_RECORD,
  'prescription': DocumentType.PRESCRIPTION,
  'lab_result': DocumentType.LAB_RESULT,
  'insurance': DocumentType.INSURANCE_CARD,
  'authorization': DocumentType.OTHER,
  'other': DocumentType.OTHER,
};

// Reverse map for API responses
const PRISMA_TO_API_DOC_TYPE: Record<string, string> = {
  'MEDICAL_RECORD': 'medical_record',
  'PRESCRIPTION': 'prescription',
  'LAB_RESULT': 'lab_result',
  'INSURANCE_CARD': 'insurance',
  'ID_DOCUMENT': 'other',
  'CONSENT_FORM': 'other',
  'DISCHARGE_SUMMARY': 'medical_record',
  'IMAGING_RESULT': 'lab_result',
  'VACCINATION_RECORD': 'medical_record',
  'OTHER': 'other',
};

// Map API sortBy values to Prisma field names
const SORT_FIELD_MAP: Record<string, string> = {
  'uploadedAt': 'uploadedAt',
  'createdAt': 'createdAt',
  'title': 'title',
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Validation schemas
const DocumentMetadataSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  documentType: z.enum(['medical_record', 'prescription', 'lab_result', 'insurance', 'authorization', 'other']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const DocumentIdSchema = z.object({
  documentId: z.string().uuid('Invalid document ID')
});

const UserIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID')
});

const DocumentQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  documentType: z.enum(['medical_record', 'prescription', 'lab_result', 'insurance', 'authorization', 'other']).optional(),
  uploadedAfter: z.string().datetime().optional(),
  uploadedBefore: z.string().datetime().optional(),
  processed: z.string().transform(v => v === 'true').optional(),
  sortBy: z.enum(['uploadedAt', 'createdAt', 'title']).default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Helper to format document for API response
function formatDocumentResponse(doc: any) {
  const extracted = (doc.extractedData as Record<string, any> | null) || {};
  return {
    id: doc.id,
    userId: doc.userId,
    documentType: PRISMA_TO_API_DOC_TYPE[doc.type] || 'other',
    title: doc.title,
    description: doc.description,
    fileName: doc.fileName || doc.filename,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size || doc.fileSize,
    uploadedAt: doc.uploadedAt,
    processed: doc.hasOcr || doc.status === 'COMPLETED',
    ocrStatus: doc.status?.toLowerCase() || 'pending',
    ocrData: doc.hasOcr ? {
      text: doc.ocrText,
      confidence: doc.ocrConfidence,
      entities: extracted.entities || [],
    } : undefined,
    tags: doc.tags || [],
    metadata: extracted,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/documents/upload
 * @desc    Upload documents
 * @access  Private
 */
router.post('/upload',
  strictRateLimiter,
  upload.array('documents', 5),
  async (req, res) => {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const files = req.files as Express.Multer.File[];
      const { userId, documentType, title, description, tags } = req.body;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const prismaDocType = API_TO_PRISMA_DOC_TYPE[documentType] || DocumentType.OTHER;
      const parsedTags: string[] = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];
      const category = mapDocumentTypeToCategory(prismaDocType);

      // Create document records in Prisma
      const createdDocs = await Promise.all(
        files.map(file =>
          prisma.document.create({
            data: {
              userId,
              type: prismaDocType,
              category,
              title: title || file.originalname,
              description: description || undefined,
              tags: parsedTags,
              fileName: file.filename,
              filename: file.filename,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              fileSize: file.size,
              storagePath: file.path,
              storageProvider: 'LOCAL',
              status: DocumentStatus.PENDING,
              organizationId: req.user!.id, // Default to user's org; adjust if multi-tenant
            },
          })
        )
      );

      logger.info('Documents uploaded', {
        count: createdDocs.length,
        userId,
        documentIds: createdDocs.map(d => d.id)
      });

      res.status(201).json({
        message: 'Documents uploaded successfully',
        documents: createdDocs.map(formatDocumentResponse)
      });
    } catch (error) {
      logger.error('Failed to upload documents', { error });
      res.status(500).json({ error: 'Failed to upload documents' });
    }
  }
);

/**
 * @route   GET /api/v1/documents/user/:userId
 * @desc    Get all documents for user
 * @access  Private
 */
router.get('/user/:userId',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  validateQuery(DocumentQuerySchema),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page, limit, documentType, uploadedAfter, uploadedBefore, processed, sortBy, sortOrder } = req.query as any;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Build where clause
      const where: any = { userId, isActive: true };

      if (documentType) {
        where.type = API_TO_PRISMA_DOC_TYPE[documentType] || DocumentType.OTHER;
      }

      if (uploadedAfter) {
        where.uploadedAt = { ...(where.uploadedAt || {}), gte: new Date(uploadedAfter) };
      }

      if (uploadedBefore) {
        where.uploadedAt = { ...(where.uploadedAt || {}), lte: new Date(uploadedBefore) };
      }

      if (processed !== undefined) {
        if (processed) {
          where.status = DocumentStatus.COMPLETED;
        } else {
          where.status = { not: DocumentStatus.COMPLETED };
        }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const orderField = SORT_FIELD_MAP[sortBy] || 'uploadedAt';

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { [orderField]: sortOrder },
        }),
        prisma.document.count({ where }),
      ]);

      res.json({
        documents: documents.map(formatDocumentResponse),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get documents', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve documents' });
    }
  }
);

/**
 * @route   GET /api/v1/documents/stats/overview
 * @desc    Get document statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats/overview',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      const [
        totalDocuments,
        completedDocs,
        processingDocs,
        pendingDocs,
        failedDocs,
        typeBreakdown,
        docsLast24h,
        processedLast24h,
      ] = await Promise.all([
        prisma.document.count({ where: { isActive: true } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.COMPLETED } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.PROCESSING } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.PENDING } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.FAILED } }),
        prisma.document.groupBy({
          by: ['type'],
          where: { isActive: true },
          _count: true,
        }),
        prisma.document.count({
          where: {
            isActive: true,
            uploadedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.document.count({
          where: {
            isActive: true,
            processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      const documentsByType: Record<string, number> = {};
      for (const item of typeBreakdown) {
        const apiType = PRISMA_TO_API_DOC_TYPE[item.type] || 'other';
        documentsByType[apiType] = (documentsByType[apiType] || 0) + item._count;
      }

      const stats = {
        totalDocuments,
        processedDocuments: completedDocs,
        pendingProcessing: pendingDocs,
        failedProcessing: failedDocs,
        documentsByType,
        totalStorage: 'N/A',
        last24Hours: {
          uploaded: docsLast24h,
          processed: processedLast24h,
        },
        ocrStatus: {
          completed: completedDocs,
          failed: failedDocs,
          pending: pendingDocs,
          processing: processingDocs,
        }
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get document stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

/**
 * @route   GET /api/v1/documents/:documentId
 * @desc    Get document details
 * @access  Private
 */
router.get('/:documentId',
  defaultRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check access
      if (document.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(formatDocumentResponse(document));
    } catch (error) {
      logger.error('Failed to get document', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to retrieve document' });
    }
  }
);

/**
 * @route   GET /api/v1/documents/:documentId/download
 * @desc    Download document file
 * @access  Private
 */
router.get('/:documentId/download',
  defaultRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check access
      if (document.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      logger.info('Document download requested', { documentId, userId: req.user!.id });

      // In production, generate a signed S3 URL
      // For now, return the stored file URL or path
      const downloadUrl = document.downloadUrl || document.fileUrl || document.storagePath;

      if (!downloadUrl) {
        return res.status(404).json({ error: 'File not available for download' });
      }

      res.json({
        downloadUrl,
        fileName: document.fileName || document.filename,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size || document.fileSize,
        expiresIn: 3600, // 1 hour for signed URLs
      });
    } catch (error) {
      logger.error('Failed to download document', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to download document' });
    }
  }
);

/**
 * @route   PUT /api/v1/documents/:documentId
 * @desc    Update document metadata
 * @access  Private
 */
router.put('/:documentId',
  defaultRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;
      const { title, description, tags, metadata } = req.body;

      const existing = await prisma.document.findUnique({ where: { id: documentId } });
      if (!existing) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
          ...(metadata !== undefined && { extractedData: metadata }),
        },
      });

      logger.info('Document metadata updated', { documentId });

      res.json(formatDocumentResponse(updatedDocument));
    } catch (error) {
      logger.error('Failed to update document', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to update document' });
    }
  }
);

/**
 * @route   DELETE /api/v1/documents/:documentId
 * @desc    Delete document (soft delete)
 * @access  Private
 */
router.delete('/:documentId',
  strictRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const existing = await prisma.document.findUnique({ where: { id: documentId } });
      if (!existing) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Soft delete: archive the document
      await prisma.document.update({
        where: { id: documentId },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      });

      logger.info('Document archived (soft delete)', { documentId, userId: req.user!.id });

      res.json({
        message: 'Document archived',
        documentId,
        note: 'Document archived according to LGPD policies. Data will be retained per retention schedule.'
      });
    } catch (error) {
      logger.error('Failed to delete document', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

/**
 * @route   POST /api/v1/documents/:documentId/process
 * @desc    Trigger OCR processing for document
 * @access  Private
 */
router.post('/:documentId/process',
  strictRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const existing = await prisma.document.findUnique({ where: { id: documentId } });
      if (!existing) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update status to PROCESSING
      await prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      // Trigger OCR processing asynchronously (fire-and-forget)
      // In production, this would be a background job via a queue
      triggerOCRProcessing(documentId, existing.storagePath).catch(err => {
        logger.error('Background OCR processing failed', { documentId, error: err });
      });

      logger.info('Document processing triggered', { documentId });

      res.json({
        message: 'Document processing started',
        documentId,
        status: 'processing',
        estimatedCompletionTime: new Date(Date.now() + 60000) // 1 minute
      });
    } catch (error) {
      logger.error('Failed to process document', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to process document' });
    }
  }
);

/**
 * @route   GET /api/v1/documents/:documentId/ocr
 * @desc    Get OCR results for document
 * @access  Private
 */
router.get('/:documentId/ocr',
  defaultRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (document.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const extracted = (doc.extractedData as Record<string, any> | null) || {};
      const ocrResult = {
        documentId: document.id,
        status: document.status?.toLowerCase() || 'pending',
        processedAt: document.processedAt,
        data: {
          text: document.ocrText || null,
          confidence: document.ocrConfidence || null,
          entities: extracted.entities || [],
          metadata: {
            pages: extracted.pages || 1,
            language: extracted.language || 'pt-BR',
          }
        }
      };

      res.json(ocrResult);
    } catch (error) {
      logger.error('Failed to get OCR results', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to retrieve OCR results' });
    }
  }
);

/**
 * @route   GET /api/v1/documents/stats/overview
 * @desc    Get document statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats/overview',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      const [
        totalDocuments,
        completedDocs,
        processingDocs,
        pendingDocs,
        failedDocs,
        typeBreakdown,
        docsLast24h,
        processedLast24h,
      ] = await Promise.all([
        prisma.document.count({ where: { isActive: true } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.COMPLETED } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.PROCESSING } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.PENDING } }),
        prisma.document.count({ where: { isActive: true, status: DocumentStatus.FAILED } }),
        prisma.document.groupBy({
          by: ['type'],
          where: { isActive: true },
          _count: true,
        }),
        prisma.document.count({
          where: {
            isActive: true,
            uploadedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.document.count({
          where: {
            isActive: true,
            processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      const documentsByType: Record<string, number> = {};
      for (const item of typeBreakdown) {
        const apiType = PRISMA_TO_API_DOC_TYPE[item.type] || 'other';
        documentsByType[apiType] = (documentsByType[apiType] || 0) + item._count;
      }

      const stats = {
        totalDocuments,
        processedDocuments: completedDocs,
        pendingProcessing: pendingDocs,
        failedProcessing: failedDocs,
        documentsByType,
        totalStorage: 'N/A', // Would need aggregation of file sizes
        last24Hours: {
          uploaded: docsLast24h,
          processed: processedLast24h,
        },
        ocrStatus: {
          completed: completedDocs,
          failed: failedDocs,
          pending: pendingDocs,
          processing: processingDocs,
        }
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get document stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

// Error handling middleware for multer
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB per file.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 5 files per request.' });
    }
    return res.status(400).json({ error: 'File upload error', details: error.message });
  }

  if (error.message === 'Invalid file type') {
    return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, PDF, TIFF, and DOC files are allowed.' });
  }

  next(error);
});

// Helper functions

/** Map DocumentType to DocumentCategory */
function mapDocumentTypeToCategory(docType: DocumentType): DocumentCategory {
  switch (docType) {
    case DocumentType.MEDICAL_RECORD:
    case DocumentType.PRESCRIPTION:
    case DocumentType.DISCHARGE_SUMMARY:
    case DocumentType.VACCINATION_RECORD:
      return DocumentCategory.MEDICAL;
    case DocumentType.LAB_RESULT:
    case DocumentType.IMAGING_RESULT:
      return DocumentCategory.LABORATORY;
    case DocumentType.INSURANCE_CARD:
      return DocumentCategory.INSURANCE;
    case DocumentType.ID_DOCUMENT:
      return DocumentCategory.IDENTIFICATION;
    case DocumentType.CONSENT_FORM:
      return DocumentCategory.LEGAL;
    default:
      return DocumentCategory.ADMINISTRATIVE;
  }
}

/**
 * Trigger OCR processing for a document asynchronously.
 * In production, this would enqueue a job to a worker queue (e.g., Bull, SQS).
 */
async function triggerOCRProcessing(documentId: string, storagePath: string): Promise<void> {
  try {
    // Dynamically import to avoid circular dependencies
    const { OCROrchestrator } = await import('../services/ocr/ocr-orchestrator.service');
    const orchestrator = new OCROrchestrator();

    const result = await orchestrator.processDocument(storagePath);

    // Update document with OCR results
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: result.document.status === 'COMPLETED' ? DocumentStatus.COMPLETED : DocumentStatus.FAILED,
        hasOcr: true,
        ocrText: result.document.blocks?.map(b => b.text).join('\n') || null,
        ocrConfidence: result.document.overallConfidence || result.processingMetrics.confidence,
        extractedData: {
          entities: result.document.medicalEntities || [],
          pages: result.document.pages || 1,
          language: 'pt-BR',
          fhirResources: result.fhirResources,
          validationResults: result.validationResults,
        },
        processedAt: new Date(),
      },
    });

    logger.info('OCR processing completed and saved', { documentId });
  } catch (error) {
    logger.error('OCR processing failed', { documentId, error });

    // Update document status to FAILED
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
      },
    }).catch(err => logger.error('Failed to update document status after OCR failure', { documentId, error: err }));
  }
}

export default router;
