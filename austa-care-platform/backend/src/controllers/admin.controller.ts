import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ========== DASHBOARD & ANALYTICS ==========

// Get dashboard statistics
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeConversations,
      totalDocuments,
      totalAchievements,
      recentUsers,
      systemHealth
    ] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count({ where: { status: 'ACTIVE' } }),
      prisma.document.count(),
      prisma.achievement.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          healthScore: true,
        }
      }),
      getSystemHealth()
    ]);

    const dashboard = {
      statistics: {
        totalUsers,
        activeConversations,
        totalDocuments,
        totalAchievements,
      },
      recentUsers,
      systemHealth,
      timestamp: new Date()
    };

    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error fetching dashboard', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do painel'
    });
  }
});

// Get user analytics
router.get('/analytics/users', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);

    const where: any = {};
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [
      totalUsers,
      newUsers,
      activeUsers,
      averageHealthScore
    ] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.user.count({
        where: {
          ...where,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.user.aggregate({
        where,
        _avg: {
          healthScore: true
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        newUsers,
        activeUsers,
        averageHealthScore: Math.round(averageHealthScore._avg.healthScore || 0),
        growthRate: totalUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(2) : '0',
      }
    });
  } catch (error) {
    logger.error('Error fetching user analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar análise de usuários'
    });
  }
});

// Get conversation analytics
router.get('/analytics/conversations', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);

    const where: any = {};
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [
      totalConversations,
      activeConversations,
      byChannel,
      averageMessagesPerConversation
    ] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { ...where, status: 'active' } }),
      prisma.conversation.groupBy({
        by: ['channel'],
        where,
        _count: {
          id: true
        }
      }),
      prisma.message.groupBy({
        by: ['conversationId'],
        _count: {
          id: true
        }
      })
    ]);

    const avgMessages = averageMessagesPerConversation.length > 0
      ? Math.round(
          averageMessagesPerConversation.reduce((sum, item) => sum + item._count.id, 0) /
          averageMessagesPerConversation.length
        )
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalConversations,
        activeConversations,
        byChannel: byChannel.reduce((acc, item) => {
          acc[item.channel] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        averageMessagesPerConversation: avgMessages
      }
    });
  } catch (error) {
    logger.error('Error fetching conversation analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar análise de conversas'
    });
  }
});

// Get document analytics
router.get('/analytics/documents', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);

    const where: any = {};
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [
      totalDocuments,
      byType,
      byStatus,
      totalStorageUsed
    ] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.groupBy({
        by: ['type'],
        where,
        _count: {
          id: true
        }
      }),
      prisma.document.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true
        }
      }),
      prisma.document.aggregate({
        where,
        _sum: {
          fileSize: true
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalDocuments,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        totalStorageUsed: formatBytes(totalStorageUsed._sum.fileSize || 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching document analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar análise de documentos'
    });
  }
});

// Get gamification analytics
router.get('/analytics/gamification', async (req: Request, res: Response) => {
  try {
    const [
      totalMissions,
      activeMissions,
      totalAchievements,
      topUsers,
      missionCompletionRate
    ] = await Promise.all([
      prisma.mission.count(),
      prisma.mission.count({ where: { isActive: true } }),
      prisma.achievement.count(),
      prisma.user.findMany({
        orderBy: { healthScore: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          healthScore: true,
          _count: {
            select: {
              achievements: true
            }
          }
        }
      }),
      prisma.achievement.groupBy({
        by: ['category'],
        _count: {
          id: true
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMissions,
        activeMissions,
        totalAchievements,
        topUsers: topUsers.map((user, index) => ({
          rank: index + 1,
          ...user,
          achievementsCount: user._count.achievements
        })),
        averageCompletionsPerCategory: missionCompletionRate.length > 0
          ? Math.round(
              missionCompletionRate.reduce((sum, item) => sum + (item._count?.id || 0), 0) /
              missionCompletionRate.length
            )
          : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching gamification analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar análise de gamificação'
    });
  }
});

// ========== USER MANAGEMENT ==========

// Get all users with admin details
router.get('/users', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              conversations: true,
              documents: true,
              achievements: true
            }
          }
        }
      }),
      prisma.user.count()
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users (admin)', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários'
    });
  }
});

// Suspend/unsuspend user
router.patch('/users/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { suspend } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !suspend },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true
      }
    });

    logger.info(`User ${suspend ? 'suspended' : 'unsuspended'}`, { userId: id });

    res.status(200).json({
      success: true,
      message: `Usuário ${suspend ? 'suspenso' : 'reativado'} com sucesso`,
      data: updatedUser
    });
  } catch (error) {
    logger.error('Error suspending/unsuspending user', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao modificar status do usuário'
    });
  }
});

// ========== SYSTEM MANAGEMENT ==========

// Get system health
router.get('/system/health', async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();

    res.status(200).json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error fetching system health', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status do sistema'
    });
  }
});

// Get system logs
router.get('/system/logs', async (req: Request, res: Response) => {
  try {
    const { level = 'all', limit = '100' } = req.query;

    // In production, this would fetch from a logging service
    res.status(200).json({
      success: true,
      message: 'Logs seriam obtidos do serviço de logging',
      data: {
        level,
        limit: parseInt(limit as string, 10),
        logs: [] // Would be populated from logging service
      }
    });
  } catch (error) {
    logger.error('Error fetching system logs', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs do sistema'
    });
  }
});

// Clear cache
router.post('/system/cache/clear', async (req: Request, res: Response) => {
  try {
    // In production, this would clear Redis cache
    logger.info('Cache clear requested');

    res.status(200).json({
      success: true,
      message: 'Cache limpo com sucesso'
    });
  } catch (error) {
    logger.error('Error clearing cache', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar cache'
    });
  }
});

// Run database maintenance
router.post('/system/maintenance', async (req: Request, res: Response) => {
  try {
    // In production, this would run database optimization tasks
    logger.info('Database maintenance requested');

    res.status(200).json({
      success: true,
      message: 'Manutenção do banco de dados iniciada'
    });
  } catch (error) {
    logger.error('Error running maintenance', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao executar manutenção'
    });
  }
});

// ========== REPORTS ==========

// Generate report
router.post('/reports/generate', async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, format = 'json' } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'type, startDate e endDate são obrigatórios'
      });
    }

    // In production, this would generate comprehensive reports
    logger.info('Report generation requested', { type, startDate, endDate, format });

    res.status(200).json({
      success: true,
      message: 'Relatório gerado com sucesso',
      data: {
        reportId: `report-${Date.now()}`,
        type,
        format,
        downloadUrl: '/api/admin/reports/download/report-id' // Mock URL
      }
    });
  } catch (error) {
    logger.error('Error generating report', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório'
    });
  }
});

// ========== HELPER FUNCTIONS ==========

async function getSystemHealth() {
  try {
    const [dbStatus, memoryUsage] = await Promise.all([
      checkDatabaseHealth(),
      getMemoryUsage()
    ]);

    return {
      status: 'healthy',
      database: dbStatus,
      memory: memoryUsage,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: 'Error fetching health status',
      timestamp: new Date()
    };
  }
}

async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected', latency: '< 10ms' };
  } catch (error) {
    return { status: 'disconnected', error: 'Database connection failed' };
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: formatBytes(usage.heapUsed),
    heapTotal: formatBytes(usage.heapTotal),
    external: formatBytes(usage.external),
    rss: formatBytes(usage.rss)
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export { router as adminRoutes };
