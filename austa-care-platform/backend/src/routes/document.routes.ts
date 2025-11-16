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

const router = Router();

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

      // Mock implementation
      const uploadedDocuments = files.map((file, index) => ({
        id: `doc-${Date.now()}-${index}`,
        userId,
        documentType: documentType || 'other',
        title: title || file.originalname,
        description,
        tags: tags ? JSON.parse(tags) : [],
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
        processed: false,
        ocrStatus: 'pending',
        metadata: {}
      }));

      logger.info('Documents uploaded', {
        count: uploadedDocuments.length,
        userId,
        documentIds: uploadedDocuments.map(d => d.id)
      });

      res.status(201).json({
        message: 'Documents uploaded successfully',
        documents: uploadedDocuments
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

      // Mock implementation
      const documents = [
        {
          id: 'doc-1',
          userId,
          documentType: 'prescription',
          title: 'Prescription - Dr. Smith',
          fileName: 'prescription-2024.pdf',
          uploadedAt: new Date(),
          processed: true,
          ocrStatus: 'completed',
          size: 245678
        }
      ];

      res.json({
        documents,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: documents.length,
          totalPages: Math.ceil(documents.length / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get documents', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve documents' });
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

      // Mock implementation
      const document = {
        id: documentId,
        userId: req.user!.id,
        documentType: 'prescription',
        title: 'Prescription - Dr. Smith',
        description: 'Monthly prescription',
        fileName: 'prescription-2024.pdf',
        originalName: 'prescription.pdf',
        mimeType: 'application/pdf',
        size: 245678,
        uploadedAt: new Date(),
        processed: true,
        ocrStatus: 'completed',
        ocrData: {
          text: 'Prescription text extracted...',
          confidence: 0.95
        },
        metadata: {},
        tags: ['prescription', '2024']
      };

      // Check access
      if (document.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(document);
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

      // Mock implementation - in production, stream file from storage
      logger.info('Document download requested', { documentId, userId: req.user!.id });

      // Would implement actual file download here
      res.status(501).json({ error: 'Download not implemented in mock version' });
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

      // Mock implementation
      const updatedDocument = {
        id: documentId,
        title,
        description,
        tags,
        metadata,
        updatedAt: new Date()
      };

      logger.info('Document metadata updated', { documentId });
      res.json(updatedDocument);
    } catch (error) {
      logger.error('Failed to update document', { error, documentId: req.params.documentId });
      res.status(500).json({ error: 'Failed to update document' });
    }
  }
);

/**
 * @route   DELETE /api/v1/documents/:documentId
 * @desc    Delete document
 * @access  Private
 */
router.delete('/:documentId',
  strictRateLimiter,
  validateParams(DocumentIdSchema),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      logger.info('Document deletion requested', { documentId, userId: req.user!.id });

      res.json({
        message: 'Document deleted',
        documentId,
        note: 'File and metadata removed according to LGPD policies'
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

      // Mock implementation
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

      // Mock implementation
      const ocrResult = {
        documentId,
        status: 'completed',
        processedAt: new Date(),
        data: {
          text: 'Extracted text from document...',
          confidence: 0.95,
          entities: [
            { type: 'medication', value: 'Paracetamol 500mg', confidence: 0.98 },
            { type: 'date', value: '2024-01-15', confidence: 0.92 }
          ],
          metadata: {
            pages: 1,
            language: 'pt-BR'
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
      // Mock implementation
      const stats = {
        totalDocuments: 5670,
        processedDocuments: 5200,
        pendingProcessing: 470,
        documentsByType: {
          medical_record: 1800,
          prescription: 1500,
          lab_result: 1200,
          insurance: 800,
          authorization: 270,
          other: 100
        },
        totalStorage: '12.5GB',
        last24Hours: {
          uploaded: 45,
          processed: 52
        },
        ocrSuccess: {
          completed: 5100,
          failed: 100,
          pending: 470
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

export default router;
