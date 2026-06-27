/**
 * OCR Controller
 * API endpoints for medical document OCR processing
 */

import { Request, Response } from 'express';
import { 
  createMedicalOCRService, 
  createDocumentTypeOCRService,
  createCriticalOCRService 
} from '../services/ocr/utils/factory';
import { 
  validateDocumentUpload, 
  validateBrazilianMedicalDocument 
} from '../services/ocr/utils/validators';
import { 
  formatOCRResults, 
  formatMedicalSummary,
  formatForAuthorizationWorkflow,
  formatForFHIRExport 
} from '../services/ocr/utils/formatters';
import { 
  TextractError, 
  TextractErrorHandler 
} from '../services/ocr/errors/textract.errors';
import { OCROrchestrator } from '../services/ocr/ocr-orchestrator.service';
import { MedicalDocumentType } from '../services/ocr/types/medical-document.types';
import { TEXTRACT_CONFIG } from '../services/ocr/config/textract.config';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  }
});

export class OCRController {
  private ocrService: OCROrchestrator;
  private s3Client: S3Client;

  constructor() {
    this.ocrService = createMedicalOCRService();
    this.s3Client = new S3Client({
      region: TEXTRACT_CONFIG.region,
      credentials: {
        accessKeyId: TEXTRACT_CONFIG.accessKeyId,
        secretAccessKey: TEXTRACT_CONFIG.secretAccessKey,
      },
    });
  }

  /**
   * Upload and process a medical document
   */
  processDocument = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    
    try {
      logger.info('OCR document processing request received', {
        requestId,
        filename: req.file?.originalname,
        fileSize: req.file?.size,
        userId: req.user?.id
      });

      // Validate file upload
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
          requestId
        });
        return;
      }

      // Validate document before processing
      const validation = await validateDocumentUpload(
        req.file.buffer,
        req.file.originalname,
        {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          requireHighQuality: req.body.requireHighQuality === 'true'
        }
      );

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Document validation failed',
          details: validation.errors,
          warnings: validation.warnings,
          requestId
        });
        return;
      }

      // Get processing options from request
      const processingOptions = {
        enableForms: req.body.enableForms !== 'false',
        enableTables: req.body.enableTables !== 'false',
        enableQueries: req.body.enableQueries !== 'false',
        generateFHIR: req.body.generateFHIR !== 'false',
        requireHumanReview: req.body.requireHumanReview === 'true',
        confidenceThreshold: parseFloat(req.body.confidenceThreshold) || 0.85,
        customQueries: req.body.customQueries ? JSON.parse(req.body.customQueries) : undefined
      };

      // Upload to S3 (mock implementation - would use actual S3 service)
      const s3Key = await this.uploadToS3(req.file, requestId);

      // Process document
      const result = await this.ocrService.processDocumentWithRetry(s3Key, processingOptions);

      // Format response based on requested format
      const format = req.query.format as 'summary' | 'detailed' | 'fhir' || 'summary';
      const formattedResult = formatOCRResults(result, format);

      // Add Brazilian medical document validation
      if (result.document.medicalEntities.length > 0) {
        const brazilianValidation = validateBrazilianMedicalDocument(
          result.document.medicalEntities,
          result.document.documentType
        );
        if (brazilianValidation.length > 0) {
          formattedResult.validation.warnings += brazilianValidation.length;
        }
      }

      logger.info('OCR document processing completed successfully', {
        requestId,
        documentId: result.document.id,
        documentType: result.document.documentType,
        confidence: result.document.overallConfidence,
        processingTime: result.processingMetrics.totalTime
      });

      res.status(200).json({
        success: true,
        requestId,
        result: formattedResult,
        processingMetrics: {
          totalTime: result.processingMetrics.totalTime,
          stagesCompleted: result.processingMetrics.stagesCompleted
        }
      });

    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error, { requestId });
      
      logger.error('OCR document processing failed', {
        requestId,
        error: ocrError.message,
        code: ocrError.code,
        severity: ocrError.severity
      });

      const statusCode = this.getStatusCodeForError(ocrError);
      
      res.status(statusCode).json({
        success: false,
        requestId,
        error: ocrError.message,
        code: ocrError.code,
        severity: ocrError.severity,
        details: ocrError.details,
        retryable: TextractErrorHandler.isRetryable(ocrError)
      });
    }
  };

  /**
   * Batch process multiple documents
   */
  batchProcessDocuments = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    
    try {
      logger.info('Batch OCR processing request received', {
        requestId,
        filesCount: req.files?.length || 0,
        userId: req.user?.id
      });

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files uploaded for batch processing',
          requestId
        });
        return;
      }

      if (req.files.length > 10) {
        res.status(400).json({
          success: false,
          error: 'Maximum 10 files allowed for batch processing',
          requestId
        });
        return;
      }

      // Process all files
      const processingPromises = req.files.map(async (file: Express.Multer.File) => {
        try {
          const s3Key = await this.uploadToS3(file, requestId);
          const result = await this.ocrService.processDocument(s3Key);
          return {
            filename: file.originalname,
            success: true,
            result: formatOCRResults(result, 'summary')
          };
        } catch (error) {
          const ocrError = TextractErrorHandler.handle(error);
          return {
            filename: file.originalname,
            success: false,
            error: ocrError.message,
            code: ocrError.code
          };
        }
      });

      const results = await Promise.allSettled(processingPromises);
      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          success: false,
          error: 'Processing failed',
          details: result.reason
        }
      );

      const successful = processedResults.filter(r => r.success).length;
      const failed = processedResults.filter(r => !r.success).length;

      logger.info('Batch OCR processing completed', {
        requestId,
        totalFiles: req.files.length,
        successful,
        failed
      });

      res.status(200).json({
        success: true,
        requestId,
        summary: {
          totalFiles: req.files.length,
          successful,
          failed,
          successRate: successful / req.files.length
        },
        results: processedResults
      });

    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error, { requestId });
      
      logger.error('Batch OCR processing failed', {
        requestId,
        error: ocrError.message
      });

      res.status(500).json({
        success: false,
        requestId,
        error: ocrError.message,
        code: ocrError.code
      });
    }
  };

  /**
   * Get processing status for a document
   */
  getProcessingStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      
      const status = await this.ocrService.getProcessingStatus(documentId);
      
      res.status(200).json({
        success: true,
        documentId,
        status
      });

    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error);
      
      res.status(404).json({
        success: false,
        error: ocrError.message,
        code: ocrError.code
      });
    }
  };

  /**
   * Get medical summary for a processed document
   */
  getMedicalSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      
      // Retrieve the document from the database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          userId: true,
          type: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          extractedText: true,
          metadata: true,
          ocrProcessed: true,
          createdAt: true,
        } as any,
      });

      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found',
        });
        return;
      }

      // Get medical summary from extracted text or metadata
      const summary = formatMedicalSummary({
        documentId: document.id,
        documentType: document.type as any,
        fileName: document.fileName,
        extractedText: document.extractedText || '',
        metadata: document.metadata as any,
        ocrProcessed: document.ocrProcessed,
        createdAt: document.createdAt,
      } as any);

      res.status(200).json({
        success: true,
        documentId,
        summary,
      });
    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error);
      
      res.status(404).json({
        success: false,
        error: ocrError.message,
        code: ocrError.code,
      });
    }
  };

  /**
   * Process document for authorization workflow
   */
  processForAuthorization = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    
    try {
      logger.info('Authorization workflow OCR processing request', {
        requestId,
        filename: req.file?.originalname,
        authorizationId: req.body.authorizationId
      });

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
          requestId
        });
        return;
      }

      // Use critical OCR service for authorization documents
      const criticalOCRService = createCriticalOCRService();
      
      const s3Key = await this.uploadToS3(req.file, requestId);
      const result = await criticalOCRService.processDocumentWithRetry(s3Key, {
        requireHumanReview: true,
        confidenceThreshold: 0.9,
        generateFHIR: true
      });

      // Format for authorization workflow
      const authorizationResult = formatForAuthorizationWorkflow(result.document);

      logger.info('Authorization OCR processing completed', {
        requestId,
        documentId: result.document.id,
        validationStatus: authorizationResult.validationStatus,
        missingFields: authorizationResult.missingFields.length
      });

      res.status(200).json({
        success: true,
        requestId,
        authorizationResult,
        processingMetrics: {
          totalTime: result.processingMetrics.totalTime,
          confidence: result.document.overallConfidence
        }
      });

    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error, { requestId });
      
      logger.error('Authorization OCR processing failed', {
        requestId,
        error: ocrError.message
      });

      res.status(this.getStatusCodeForError(ocrError)).json({
        success: false,
        requestId,
        error: ocrError.message,
        code: ocrError.code
      });
    }
  };

  /**
   * Export document results to FHIR
   */
  exportToFHIR = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      
      // Retrieve the document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          userId: true,
          type: true,
          fileName: true,
          extractedText: true,
          metadata: true,
          ocrProcessed: true,
        } as any,
      });

      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found',
        });
        return;
      }

      if (!document.ocrProcessed) {
        res.status(400).json({
          success: false,
          error: 'Document has not been OCR processed yet',
        });
        return;
      }

      // Generate FHIR bundle from document data
      const fhirBundle = formatForFHIRExport({
        documentId: document.id,
        userId: document.userId,
        documentType: document.type,
        fileName: document.fileName,
        extractedText: document.extractedText || '',
        metadata: (document.metadata as any) || {},
      } as any, [] as any);

      // Store FHIR export event in audit log
      await (prisma.auditLog.create as any)({
        data: {
          userId: document.userId,
          action: 'EXPORT',
          entity: 'fhir_export',
          entityId: documentId,
          organizationId: (document as any).organizationId || 'system',
        },
      });

      res.status(200).json({
        success: true,
        documentId,
        fhirBundle,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error);
      
      res.status(404).json({
        success: false,
        error: ocrError.message,
        code: ocrError.code,
      });
    }
  };

  /**
   * Validate document before processing
   */
  validateDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded for validation'
        });
        return;
      }

      const validation = await validateDocumentUpload(
        req.file.buffer,
        req.file.originalname,
        {
          requireHighQuality: req.body.requireHighQuality === 'true'
        }
      );

      res.status(200).json({
        success: true,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          metadata: validation.metadata
        }
      });

    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error);
      
      res.status(500).json({
        success: false,
        error: ocrError.message,
        code: ocrError.code
      });
    }
  };

  /**
   * Get OCR service health status
   */
  getHealthStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check various service health statuses
      let textractStatus = 'unavailable';
      let s3Status = 'unavailable';
      let dbStatus = 'unavailable';

      // Check S3 connectivity
      try {
        await this.s3Client.config.credentials();
        s3Status = TEXTRACT_CONFIG.accessKeyId ? 'operational' : 'unconfigured';
      } catch {
        s3Status = 'degraded';
      }

      // Check Textract (same credentials as S3)
      textractStatus = TEXTRACT_CONFIG.accessKeyId ? 'operational' : 'unconfigured';

      // Check database
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'operational';
      } catch {
        dbStatus = 'degraded';
      }

      // Get processing statistics from database
      const totalDocuments = await prisma.document.count();
      const processedDocuments = await prisma.document.count({ where: { ocrProcessed: true } as any });

      const healthStatus = {
        status: dbStatus === 'operational' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          textract: textractStatus,
          s3: s3Status,
          fhir: 'operational',
          database: dbStatus,
        },
        performance: {
          averageProcessingTime: 'N/A',
          successRate: totalDocuments > 0 
            ? `${((processedDocuments / totalDocuments) * 100).toFixed(1)}%`
            : 'N/A',
          errorRate: 'N/A',
        },
        statistics: {
          totalDocuments,
          processedDocuments,
          pendingDocuments: totalDocuments - processedDocuments,
        },
      };

      res.status(200).json({
        success: true,
        health: healthStatus,
      });
    } catch (error) {
      const ocrError = TextractErrorHandler.handle(error);
      
      res.status(503).json({
        success: false,
        error: ocrError.message,
        code: ocrError.code,
      });
    }
  };

  /**
   * Helper methods
   */
  private async uploadToS3(file: Express.Multer.File, requestId: string): Promise<string> {
    const s3Key = `ocr-documents/${requestId}/${Date.now()}-${file.originalname}`;
    
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: TEXTRACT_CONFIG.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalFilename: file.originalname,
          uploadedAt: new Date().toISOString(),
          requestId,
        },
      }));

      logger.info('Document uploaded to S3', {
        s3Key,
        bucket: TEXTRACT_CONFIG.bucketName,
        fileSize: file.size,
        contentType: file.mimetype,
      });

      return s3Key;
    } catch (error) {
      logger.error('S3 upload failed', { s3Key, error });
      throw new TextractError(
        'Failed to upload document to S3',
        'S3_UPLOAD_ERROR',
        'CRITICAL'
      );
    }
  }

  private getStatusCodeForError(error: TextractError): number {
    switch (error.code) {
      case 'VALIDATION_ERROR':
      case 'INVALID_FORMAT':
        return 400;
      case 'DOCUMENT_NOT_FOUND':
        return 404;
      case 'TIMEOUT_ERROR':
        return 408;
      case 'TEXTRACT_AWS_ERROR':
        return 502;
      case 'CONFIGURATION_ERROR':
        return 500;
      default:
        return error.severity === 'CRITICAL' ? 500 : 400;
    }
  }
}

// Middleware for file upload
export const uploadMiddleware = upload.single('document');
export const batchUploadMiddleware = upload.array('documents', 10);

// Create controller instance
export const ocrController = new OCRController();