import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import multer from 'multer';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, JPEG ou PNG.'));
    }
  }
});

// Zod validation schemas
const createDocumentSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  type: z.enum(['prescription', 'exam_result', 'medical_report', 'insurance_card', 'id_document', 'other'],
    { errorMap: () => ({ message: 'Tipo de documento inválido' }) }),
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  metadata: z.record(z.any()).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  userId: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  orderBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Create document (upload)
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const validated = createDocumentSchema.parse(req.body);

    // In production, upload to S3 or cloud storage
    const fileUrl = `uploads/${Date.now()}-${req.file.originalname}`;

    const document = await prisma.document.create({
      data: {
        userId: validated.userId,
        type: validated.type,
        title: validated.title,
        description: validated.description,
        fileName: req.file.originalname,
        fileUrl,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        status: 'completed',
        metadata: validated.metadata || {},
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    logger.info('Document uploaded', { documentId: document.id, userId: validated.userId });

    res.status(201).json({
      success: true,
      message: 'Documento enviado com sucesso',
      data: document
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message === 'File too large' ? 'Arquivo muito grande (máximo 10MB)' : error.message
      });
    }
    logger.error('Error uploading document', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar documento'
    });
  }
});

// Get all documents (with pagination and filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
        { fileName: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.orderBy]: query.order },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      prisma.document.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: documents,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching documents', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar documentos'
    });
  }
});

// Get document by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error('Error fetching document', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar documento'
    });
  }
});

// Update document metadata
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateDocumentSchema.parse(req.body);

    const existingDocument = await prisma.document.findUnique({ where: { id } });
    if (!existingDocument) {
      return res.status(404).json({
        success: false,
        message: 'Documento não encontrado'
      });
    }

    const document = await prisma.document.update({
      where: { id },
      data: validated,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    logger.info('Document updated', { documentId: id });

    res.status(200).json({
      success: true,
      message: 'Documento atualizado com sucesso',
      data: document
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error updating document', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar documento'
    });
  }
});

// Delete document
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento não encontrado'
      });
    }

    // In production, also delete file from storage (S3, etc.)
    await prisma.document.delete({ where: { id } });

    logger.info('Document deleted', { documentId: id });

    res.status(200).json({
      success: true,
      message: 'Documento excluído com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting document', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir documento'
    });
  }
});

// Download document
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento não encontrado'
      });
    }

    // In production, generate signed URL for S3 or stream file
    res.status(200).json({
      success: true,
      message: 'URL de download gerada',
      data: {
        downloadUrl: document.fileUrl, // Would be signed S3 URL in production
        fileName: document.fileName,
        mimeType: document.mimeType,
        expiresIn: '3600', // 1 hour
      }
    });
  } catch (error) {
    logger.error('Error downloading document', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao baixar documento'
    });
  }
});

// Get documents by user
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type, limit = '20' } = req.query;

    const where: any = { userId };
    if (type) where.type = type;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.status(200).json({
      success: true,
      data: documents,
      total: documents.length
    });
  } catch (error) {
    logger.error('Error fetching user documents', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar documentos do usuário'
    });
  }
});

// Batch upload documents
router.post('/batch', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const { userId, type, description } = req.body;

    if (!userId || !type) {
      return res.status(400).json({
        success: false,
        message: 'userId e type são obrigatórios'
      });
    }

    const uploadedDocuments = await Promise.all(
      req.files.map(async (file) => {
        const fileUrl = `uploads/${Date.now()}-${file.originalname}`;

        return prisma.document.create({
          data: {
            userId,
            type,
            title: file.originalname,
            description: description || '',
            fileName: file.originalname,
            fileUrl,
            mimeType: file.mimetype,
            fileSize: file.size,
            status: 'completed',
            metadata: {},
          }
        });
      })
    );

    logger.info('Batch documents uploaded', { count: uploadedDocuments.length, userId });

    res.status(201).json({
      success: true,
      message: `${uploadedDocuments.length} documentos enviados com sucesso`,
      data: uploadedDocuments
    });
  } catch (error) {
    logger.error('Error batch uploading documents', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar documentos em lote'
    });
  }
});

export { router as documentRoutes };
