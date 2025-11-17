import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import {
  getUserAchievements,
  awardAchievement,
  completeMission,
  getUserMissions,
  getUserGamificationStats,
  calculateUserLevel
} from '../utils/gamification.helpers';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const createMissionSchema = z.object({
  name: z.string().min(1, 'Nome da missão é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  type: z.enum(['onboarding', 'health_check', 'document_upload', 'questionnaire', 'daily_task', 'achievement'],
    { errorMap: () => ({ message: 'Tipo de missão inválido' }) }),
  points: z.number().int().positive('Pontos devem ser positivos'),
  requiredActions: z.array(z.string()).min(1, 'Pelo menos uma ação é obrigatória'),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const createAchievementSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  missionId: z.string().min(1, 'ID da missão é obrigatório'),
  pointsEarned: z.number().int().positive(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  type: z.string().optional(),
  active: z.string().transform(val => val === 'true').optional(),
  orderBy: z.enum(['createdAt', 'points', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ========== MISSIONS ENDPOINTS ==========

// Create mission
router.post('/missions', async (req: Request, res: Response) => {
  try {
    const validated = createMissionSchema.parse(req.body);

    const mission = await prisma.mission.create({
      data: {
        title: validated.name,
        description: validated.description,
        type: 'DAILY' as any, // TODO: Map to MissionType enum
        category: validated.type as any, // TODO: Map to MissionCategory enum
        difficulty: 'EASY' as any, // TODO: Calculate based on requirements
        points: validated.points,
        requirements: validated.requiredActions,
        endDate: validated.expiresAt ? new Date(validated.expiresAt) : null,
        isActive: true,
      }
    });

    logger.info('Mission created', { missionId: mission.id });

    res.status(201).json({
      success: true,
      message: 'Missão criada com sucesso',
      data: mission
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error creating mission', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao criar missão'
    });
  }
});

// Get all missions
router.get('/missions', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.active !== undefined) where.isActive = query.active;

    const [missions, total] = await Promise.all([
      prisma.mission.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.orderBy]: query.order },
      }),
      prisma.mission.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: missions,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching missions', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar missões'
    });
  }
});

// Get mission by ID
router.get('/missions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const mission = await prisma.mission.findUnique({
      where: { id },
      // No _count available for Mission

    });

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Missão não encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: mission
    });
  } catch (error) {
    logger.error('Error fetching mission', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar missão'
    });
  }
});

// Update mission
router.put('/missions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, points, isActive, requiredActions, expiresAt, metadata } = req.body;

    const existingMission = await prisma.mission.findUnique({ where: { id } });
    if (!existingMission) {
      return res.status(404).json({
        success: false,
        message: 'Missão não encontrada'
      });
    }

    const mission = await prisma.mission.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(points !== undefined && { points }),
        ...(isActive !== undefined && { isActive }),
        ...(requiredActions && { requiredActions }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
        ...(metadata && { metadata }),
      }
    });

    logger.info('Mission updated', { missionId: id });

    res.status(200).json({
      success: true,
      message: 'Missão atualizada com sucesso',
      data: mission
    });
  } catch (error) {
    logger.error('Error updating mission', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar missão'
    });
  }
});

// Delete mission
router.delete('/missions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Missão não encontrada'
      });
    }

    await prisma.mission.delete({ where: { id } });

    logger.info('Mission deleted', { missionId: id });

    res.status(200).json({
      success: true,
      message: 'Missão excluída com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting mission', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir missão'
    });
  }
});

// ========== ACHIEVEMENTS ENDPOINTS ==========

// Create achievement (complete mission)
router.post('/achievements', async (req: Request, res: Response) => {
  try {
    const validated = createAchievementSchema.parse(req.body);

    // Verify mission exists and is active
    const mission = await prisma.mission.findUnique({
      where: { id: validated.missionId }
    });

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Missão não encontrada'
      });
    }

    if (!mission.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Missão não está ativa'
      });
    }

    // Complete mission using helper - it will check for existing achievements
    try {
      const transaction = await completeMission(validated.userId, validated.missionId);

      logger.info('Achievement created', {
        transactionId: transaction.id,
        userId: validated.userId,
        pointsEarned: transaction.points
      });

      res.status(201).json({
        success: true,
        message: 'Conquista registrada com sucesso',
        data: {
          achievement: transaction,
          newHealthScore: transaction.points // Helper already updated health points
        }
      });
    } catch (error: any) {
      if (error.message === 'Mission already completed by user') {
        return res.status(409).json({
          success: false,
          message: 'Usuário já completou esta missão'
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error creating achievement', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar conquista'
    });
  }
});

// Get user achievements
router.get('/users/:userId/achievements', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const achievements = await getUserAchievements(userId);
    const totalPoints = achievements.reduce((sum, achievement) => sum + achievement.points, 0);

    res.status(200).json({
      success: true,
      data: {
        achievements,
        totalAchievements: achievements.length,
        totalPoints
      }
    });
  } catch (error) {
    logger.error('Error fetching user achievements', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar conquistas do usuário'
    });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = '10', period = 'all_time' } = req.query;

    // Use direct Prisma for leaderboard as it requires cross-user aggregation
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }, // TODO: Order by calculated points from HealthPoints
      take: parseInt(limit as string, 10),
      select: {
        id: true,
        firstName: true,
        lastName: true,
      }
    });

    // TODO: Get actual points from HealthPoints model
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      points: 0, // TODO: Calculate from HealthPoints
      achievementsCount: 0 // TODO: Count from PointTransactions
    }));

    res.status(200).json({
      success: true,
      data: leaderboard,
      period
    });
  } catch (error) {
    logger.error('Error fetching leaderboard', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ranking'
    });
  }
});

// Get user progress
router.get('/users/:userId/progress', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Use helper to get comprehensive stats
    const stats = await getUserGamificationStats(userId);
    const totalActiveMissions = await prisma.mission.count({
      where: { isActive: true }
    });

    const progress = {
      userId,
      name: `${user.firstName} ${user.lastName}`,
      completedMissions: stats.achievementsCount, // Using achievementsCount as proxy for completed missions
      totalActiveMissions,
      completionRate: totalActiveMissions > 0 ? (stats.achievementsCount / totalActiveMissions) * 100 : 0,
      totalPoints: stats.currentPoints,
      level: stats.level
    };

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error('Error fetching user progress', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar progresso do usuário'
    });
  }
});

export { router as gamificationRoutes };
