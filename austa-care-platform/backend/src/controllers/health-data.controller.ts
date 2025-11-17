import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import {
  getVitalSigns,
  recordVitalSign,
  getLatestVitals,
  getVitalSignsInRange
} from '../utils/health-data.helpers';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const createVitalSignSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  type: z.enum(['blood_pressure', 'heart_rate', 'temperature', 'weight', 'height', 'blood_glucose', 'oxygen_saturation', 'other'])
    .transform(val => val.toUpperCase() as 'BLOOD_PRESSURE' | 'HEART_RATE' | 'TEMPERATURE' | 'WEIGHT' | 'HEIGHT' | 'BLOOD_GLUCOSE' | 'OXYGEN_SATURATION' | 'OTHER'),
  value: z.number().positive('Valor deve ser positivo'),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  measuredAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const createQuestionnaireResponseSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  questionnaireId: z.string().min(1, 'ID do questionário é obrigatório'),
  responses: z.record(z.any()),
  score: z.number().min(0).max(100).optional(),
  completedAt: z.string().datetime().optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  userId: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  orderBy: z.enum(['measuredAt', 'createdAt']).default('measuredAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ========== VITAL SIGNS ENDPOINTS ==========

// Create vital sign
router.post('/vital-signs', async (req: Request, res: Response) => {
  try {
    const validated = createVitalSignSchema.parse(req.body);

    const vitalSign = await recordVitalSign(validated.userId, {
      type: validated.type,
      value: validated.value,
      unit: validated.unit,
      recordedAt: validated.measuredAt ? new Date(validated.measuredAt) : new Date(),
      notes: validated.notes,
    });

    logger.info('Vital sign created', { vitalSignId: vitalSign.id, userId: validated.userId });

    res.status(201).json({
      success: true,
      message: 'Sinal vital registrado com sucesso',
      data: vitalSign
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error creating vital sign', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar sinal vital'
    });
  }
});

// Get all vital signs (with filters)
router.get('/vital-signs', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);

    if (!query.userId) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }

    let vitalSigns;
    if (query.startDate || query.endDate) {
      // Use range query helper
      vitalSigns = await getVitalSignsInRange(
        query.userId,
        query.startDate ? new Date(query.startDate) : new Date(0),
        query.endDate ? new Date(query.endDate) : new Date()
      );
    } else {
      // Use general query helper
      vitalSigns = await getVitalSigns(query.userId);

      // Filter by type if specified
      if (query.type) {
        vitalSigns = vitalSigns.filter(v => v.type === query.type);
      }
    }

    // Apply pagination
    const skip = (query.page - 1) * query.limit;
    const paginatedSigns = vitalSigns.slice(skip, skip + query.limit);
    const total = vitalSigns.length;

    res.status(200).json({
      success: true,
      data: paginatedSigns,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching vital signs', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar sinais vitais'
    });
  }
});

// Get vital sign by ID
router.get('/vital-signs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use HealthData model directly for single record lookup
    const vitalSign = await prisma.healthData.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Sinal vital não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: vitalSign
    });
  } catch (error) {
    logger.error('Error fetching vital sign', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar sinal vital'
    });
  }
});

// Update vital sign
router.put('/vital-signs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { value, unit, notes, measuredAt } = req.body;

    const existingVitalSign = await prisma.healthData.findUnique({ where: { id } });
    if (!existingVitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Sinal vital não encontrado'
      });
    }

    const vitalSign = await prisma.healthData.update({
      where: { id },
      data: {
        ...(value !== undefined && { value }),
        ...(unit && { unit }),
        ...(notes !== undefined && { metadata: { notes } }),
        ...(measuredAt && { recordedAt: new Date(measuredAt) }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    logger.info('Vital sign updated', { vitalSignId: id });

    res.status(200).json({
      success: true,
      message: 'Sinal vital atualizado com sucesso',
      data: vitalSign
    });
  } catch (error) {
    logger.error('Error updating vital sign', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar sinal vital'
    });
  }
});

// Delete vital sign
router.delete('/vital-signs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vitalSign = await prisma.healthData.findUnique({ where: { id } });
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Sinal vital não encontrado'
      });
    }

    await prisma.healthData.delete({ where: { id } });

    logger.info('Vital sign deleted', { vitalSignId: id });

    res.status(200).json({
      success: true,
      message: 'Sinal vital excluído com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting vital sign', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir sinal vital'
    });
  }
});

// ========== QUESTIONNAIRE RESPONSES ENDPOINTS ==========
// NOTE: QuestionnaireResponse model not yet migrated to new schema
// These endpoints are commented out until the model is added

/*
// Create questionnaire response
router.post('/questionnaires', async (req: Request, res: Response) => {
  try {
    const validated = createQuestionnaireResponseSchema.parse(req.body);

    const questionnaireResponse = await prisma.questionnaireResponse.create({
      data: {
        userId: validated.userId,
        organizationId: 'default-org-id', // TODO: Get from user context
        questionnaireId: validated.questionnaireId,
        questionnaireName: 'General Health Assessment', // TODO: Get from questionnaire
        responses: validated.responses,
        score: validated.score,
        completedAt: validated.completedAt ? new Date(validated.completedAt) : new Date(),
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

    logger.info('Questionnaire response created', {
      responseId: questionnaireResponse.id,
      userId: validated.userId
    });

    res.status(201).json({
      success: true,
      message: 'Resposta do questionário salva com sucesso',
      data: questionnaireResponse
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error creating questionnaire response', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar resposta do questionário'
    });
  }
});

// Get all questionnaire responses
router.get('/questionnaires', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.startDate || query.endDate) {
      where.completedAt = {};
      if (query.startDate) where.completedAt.gte = new Date(query.startDate);
      if (query.endDate) where.completedAt.lte = new Date(query.endDate);
    }

    const [responses, total] = await Promise.all([
      prisma.questionnaireResponse.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { completedAt: query.order },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      prisma.questionnaireResponse.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: responses,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching questionnaire responses', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar respostas de questionários'
    });
  }
});

// Get questionnaire response by ID
router.get('/questionnaires/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await prisma.questionnaireResponse.findUnique({
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

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Resposta do questionário não encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Error fetching questionnaire response', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar resposta do questionário'
    });
  }
});

// Delete questionnaire response
router.delete('/questionnaires/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await prisma.questionnaireResponse.findUnique({ where: { id } });
    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Resposta do questionário não encontrada'
      });
    }

    await prisma.questionnaireResponse.delete({ where: { id } });

    logger.info('Questionnaire response deleted', { responseId: id });

    res.status(200).json({
      success: true,
      message: 'Resposta do questionário excluída com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting questionnaire response', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir resposta do questionário'
    });
  }
});

*/

// Get user health summary
router.get('/users/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const vitalSigns = await getLatestVitals(userId);

    const summary = {
      userId,
      recentVitalSigns: vitalSigns,
      lastUpdated: new Date(),
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error fetching health summary', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar resumo de saúde'
    });
  }
});

export { router as healthDataRoutes };
