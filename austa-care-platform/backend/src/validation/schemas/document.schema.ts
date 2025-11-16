import { z } from 'zod';

/**
 * Document type enum
 */
export const DocumentTypeSchema = z.enum([
  'MEDICAL_REPORT',
  'LAB_RESULT',
  'PRESCRIPTION',
  'IMAGING',
  'CONSENT_FORM',
  'INSURANCE_CARD',
  'ID_DOCUMENT',
  'VACCINATION_RECORD',
  'TREATMENT_PLAN',
  'DISCHARGE_SUMMARY',
  'OTHER'
]);

/**
 * Document status enum
 */
export const DocumentStatusSchema = z.enum([
  'PENDING_UPLOAD',
  'UPLOADING',
  'PROCESSING',
  'VERIFIED',
  'REJECTED',
  'ARCHIVED'
]);

/**
 * File size limits (in bytes)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Allowed MIME types
 */
const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Upload document schema
 */
export const uploadDocumentSchema = z.object({
  body: z.object({
    type: DocumentTypeSchema,

    title: z.string()
      .min(1, { message: 'Título é obrigatório' })
      .max(200, { message: 'Título deve ter no máximo 200 caracteres' })
      .trim(),

    description: z.string()
      .max(1000, { message: 'Descrição deve ter no máximo 1000 caracteres' })
      .optional(),

    issueDate: z.string()
      .datetime({ message: 'Data de emissão inválida' })
      .optional(),

    expiryDate: z.string()
      .datetime({ message: 'Data de validade inválida' })
      .optional()
      .refine((date) => {
        if (!date) return true;
        return new Date(date) > new Date();
      }, { message: 'Data de validade deve ser futura' }),

    tags: z.array(z.string().max(50))
      .max(10, { message: 'Máximo de 10 tags' })
      .optional(),

    metadata: z.object({
      issuingInstitution: z.string().max(200).optional(),
      professionalName: z.string().max(100).optional(),
      professionalLicense: z.string()
        .regex(/^CRM\/[A-Z]{2}\s\d{4,6}$/, {
          message: 'Número do CRM inválido. Use o formato: CRM/SP 123456'
        })
        .optional(),
      relatedCondition: z.string().max(100).optional(),
      confidentialityLevel: z.enum(['PUBLIC', 'PRIVATE', 'RESTRICTED']).default('PRIVATE'),
    }).optional(),

    // File information (will be populated by upload middleware)
    file: z.object({
      filename: z.string(),
      originalName: z.string(),
      mimeType: z.string()
        .refine((mime) => allowedMimeTypes.includes(mime), {
          message: 'Tipo de arquivo não permitido. Use: PDF, JPG, PNG, HEIC, DOC, DOCX',
        }),
      size: z.number()
        .positive({ message: 'Tamanho do arquivo inválido' })
        .refine((size) => size <= MAX_FILE_SIZE, {
          message: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        }),
      path: z.string().url().optional(),
    }).optional(),
  }),
});

/**
 * Get document schema
 */
export const getDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),
});

/**
 * List documents schema
 */
export const listDocumentsSchema = z.object({
  query: z.object({
    type: DocumentTypeSchema.optional(),

    status: DocumentStatusSchema.optional(),

    search: z.string()
      .max(100, { message: 'Busca deve ter no máximo 100 caracteres' })
      .optional(),

    tags: z.string()
      .transform((val) => val.split(',').map(tag => tag.trim()))
      .optional(),

    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),

    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('20')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),

    sortBy: z.enum(['createdAt', 'title', 'issueDate']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
});

/**
 * Update document schema
 */
export const updateDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),

  body: z.object({
    title: z.string()
      .min(1, { message: 'Título deve ter no mínimo 1 caractere' })
      .max(200, { message: 'Título deve ter no máximo 200 caracteres' })
      .optional(),

    description: z.string()
      .max(1000, { message: 'Descrição deve ter no máximo 1000 caracteres' })
      .optional(),

    status: DocumentStatusSchema.optional(),

    tags: z.array(z.string().max(50))
      .max(10, { message: 'Máximo de 10 tags' })
      .optional(),

    metadata: z.object({
      issuingInstitution: z.string().max(200).optional(),
      professionalName: z.string().max(100).optional(),
      professionalLicense: z.string()
        .regex(/^CRM\/[A-Z]{2}\s\d{4,6}$/)
        .optional(),
      relatedCondition: z.string().max(100).optional(),
      confidentialityLevel: z.enum(['PUBLIC', 'PRIVATE', 'RESTRICTED']).optional(),
    }).optional(),
  }),
});

/**
 * Delete document schema
 */
export const deleteDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),
});

/**
 * Share document schema
 */
export const shareDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),

  body: z.object({
    recipientEmail: z.string()
      .email({ message: 'Email do destinatário inválido' })
      .toLowerCase(),

    expiresAt: z.string()
      .datetime({ message: 'Data de expiração inválida' })
      .optional()
      .refine((date) => {
        if (!date) return true;
        return new Date(date) > new Date();
      }, { message: 'Data de expiração deve ser futura' }),

    message: z.string()
      .max(500, { message: 'Mensagem deve ter no máximo 500 caracteres' })
      .optional(),

    allowDownload: z.boolean().default(true),

    requirePassword: z.boolean().default(false),
  }),
});

/**
 * Download document schema
 */
export const downloadDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),

  query: z.object({
    token: z.string().optional(),
  }).optional(),
});

/**
 * OCR document schema (extract text from images/PDFs)
 */
export const ocrDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),

  body: z.object({
    language: z.enum(['por', 'eng']).default('por'),
    extractTables: z.boolean().default(false),
  }).optional(),
});

/**
 * Verify document schema
 */
export const verifyDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),

  body: z.object({
    verified: z.boolean(),
    verificationNotes: z.string()
      .max(500, { message: 'Notas devem ter no máximo 500 caracteres' })
      .optional(),
    verifiedBy: z.string().uuid().optional(),
  }),
});

/**
 * Archive document schema
 */
export const archiveDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),
});

/**
 * Restore archived document schema
 */
export const restoreDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID do documento inválido' }),
  }),
});

/**
 * Batch upload documents schema
 */
export const batchUploadDocumentsSchema = z.object({
  body: z.object({
    documents: z.array(
      z.object({
        type: DocumentTypeSchema,
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
      })
    ).min(1).max(10, { message: 'Máximo de 10 documentos por lote' }),
  }),
});

// Export types
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type GetDocumentInput = z.infer<typeof getDocumentSchema>;
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>;
export type ShareDocumentInput = z.infer<typeof shareDocumentSchema>;
export type DownloadDocumentInput = z.infer<typeof downloadDocumentSchema>;
export type OcrDocumentInput = z.infer<typeof ocrDocumentSchema>;
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;
