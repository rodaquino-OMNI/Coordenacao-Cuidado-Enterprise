import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const createVitalSignSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  type: z.enum(['blood_pressure', 'heart_rate', 'temperature', 'weight', 'glucose', 'oxygen_saturation'],
    { errorMap: () => ({ message: 'Tipo de sinal vital inválido' }) }),
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

    const vitalSign = await prisma.vitalSign.create({
      data: {
        userId: validated.userId,
        type: validated.type,
        value: validated.value,
        unit: validated.unit,
        measuredAt: validated.measuredAt ? new Date(validated.measuredAt) : new Date(),
        notes: validated.notes,
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
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.type) where.type = query.type;
    if (query.startDate || query.endDate) {
      where.measuredAt = {};
      if (query.startDate) where.measuredAt.gte = new Date(query.startDate);
      if (query.endDate) where.measuredAt.lte = new Date(query.endDate);
    }

    const [vitalSigns, total] = await Promise.all([
      prisma.vitalSign.findMany({
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
      prisma.vitalSign.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: vitalSigns,
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

    const vitalSign = await prisma.vitalSign.findUnique({
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

    const existingVitalSign = await prisma.vitalSign.findUnique({ where: { id } });
    if (!existingVitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Sinal vital não encontrado'
      });
    }

    const vitalSign = await prisma.vitalSign.update({
      where: { id },
      data: {
        ...(value !== undefined && { value }),
        ...(unit && { unit }),
        ...(notes !== undefined && { notes }),
        ...(measuredAt && { measuredAt: new Date(measuredAt) }),
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

    const vitalSign = await prisma.vitalSign.findUnique({ where: { id } });
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Sinal vital não encontrado'
      });
    }

    await prisma.vitalSign.delete({ where: { id } });

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

// Create questionnaire response
router.post('/questionnaires', async (req: Request, res: Response) => {
  try {
    const validated = createQuestionnaireResponseSchema.parse(req.body);

    const questionnaireResponse = await prisma.questionnaireResponse.create({
      data: {
        userId: validated.userId,
        questionnaireId: validated.questionnaireId,
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

    const [vitalSigns, questionnaires] = await Promise.all([
      prisma.vitalSign.findMany({
        where: { userId },
        orderBy: { measuredAt: 'desc' },
        take: 10,
      }),
      prisma.questionnaireResponse.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 5,
      })
    ]);

    const summary = {
      userId,
      healthScore: user.healthScore,
      onboardingComplete: user.onboardingComplete,
      recentVitalSigns: vitalSigns,
      recentQuestionnaires: questionnaires,
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
