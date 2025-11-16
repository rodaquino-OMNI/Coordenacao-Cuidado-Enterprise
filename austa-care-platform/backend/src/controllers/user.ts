import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Telefone inválido'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos').optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{10,14}$/).optional(),
  email: z.string().email().optional(),
  onboardingComplete: z.boolean().optional(),
  healthScore: z.number().min(0).max(100).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  search: z.string().optional(),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Create user
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validated.email },
          { phone: validated.phone }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Usuário já existe com este email ou telefone'
      });
    }

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: validated.password, // Should be hashed before saving
        firstName: validated.name?.split(' ')[0] || validated.name || '',
        lastName: validated.name?.split(' ').slice(1).join(' ') || '',
        name: validated.name,
        phone: validated.phone,
        cpf: validated.cpf,
        onboardingComplete: false,
        healthScore: 0,
        organization: {
          connect: { id: 'default-org-id' } // TODO: Get from context or config
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        healthScore: true,
        onboardingComplete: true,
        createdAt: true,
      }
    });

    logger.info('User created successfully', { userId: user.id });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error creating user', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário'
    });
  }
});

// Get all users (with pagination and search)
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where = query.search ? {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { phone: { contains: query.search } },
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.orderBy]: query.order },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          healthScore: true,
          onboardingComplete: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.user.count({ where })
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
    logger.error('Error fetching users', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários'
    });
  }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        cpf: true,
        healthScore: true,
        onboardingComplete: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário'
    });
  }
});

// Get user profile (authenticated)
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        cpf: true,
        healthScore: true,
        onboardingComplete: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user profile', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil do usuário'
    });
  }
});

// Update user
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateUserSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Check email/phone uniqueness if being updated
    if (validated.email || validated.phone) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                validated.email ? { email: validated.email } : {},
                validated.phone ? { phone: validated.phone } : {},
              ].filter(obj => Object.keys(obj).length > 0)
            }
          ]
        }
      });

      if (duplicateUser) {
        return res.status(409).json({
          success: false,
          message: 'Email ou telefone já está em uso'
        });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: validated,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        healthScore: true,
        onboardingComplete: true,
        updatedAt: true,
      }
    });

    logger.info('User updated successfully', { userId: id });

    res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error updating user', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário'
    });
  }
});

// Update user profile (authenticated)
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado'
      });
    }

    const validated = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: validated,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        healthScore: true,
        onboardingComplete: true,
        updatedAt: true,
      }
    });

    logger.info('User profile updated', { userId });

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error updating user profile', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil'
    });
  }
});

// Delete user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    await prisma.user.delete({ where: { id } });

    logger.info('User deleted successfully', { userId: id });

    res.status(200).json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting user', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir usuário'
    });
  }
});

// Get user onboarding status
router.get('/:id/onboarding', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        onboardingComplete: true,
        healthScore: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Mock onboarding missions data - should come from database
    const onboardingData = {
      completed: user.onboardingComplete,
      currentStep: user.onboardingComplete ? 5 : 1,
      totalSteps: 5,
      healthPoints: user.healthScore || 0,
      completedMissions: [
        { id: 'mission1', name: 'Me Conhece', points: 100, completed: true },
        { id: 'mission2', name: 'Estilo de Vida', points: 150, completed: (user.healthScore || 0) >= 150 },
        { id: 'mission3', name: 'Bem-estar', points: 200, completed: (user.healthScore || 0) >= 350 },
        { id: 'mission4', name: 'Saúde Atual', points: 250, completed: (user.healthScore || 0) >= 600 },
        { id: 'mission5', name: 'Documentos', points: 300, completed: user.onboardingComplete },
      ]
    };

    res.status(200).json({
      success: true,
      data: onboardingData
    });
  } catch (error) {
    logger.error('Error fetching onboarding status', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status de onboarding'
    });
  }
});

// Update onboarding progress
router.post('/:id/onboarding/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { missionId, responses, pointsEarned } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Update health score
    const newHealthScore = (user.healthScore || 0) + (pointsEarned || 0);
    const onboardingComplete = newHealthScore >= 1000; // Example threshold

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        healthScore: newHealthScore,
        onboardingComplete,
      },
      select: {
        id: true,
        healthScore: true,
        onboardingComplete: true,
      }
    });

    logger.info('Onboarding progress updated', { userId: id, missionId, pointsEarned });

    res.status(200).json({
      success: true,
      message: 'Progresso atualizado com sucesso',
      data: {
        missionId,
        completed: true,
        pointsEarned,
        totalPoints: updatedUser.healthScore,
        onboardingComplete: updatedUser.onboardingComplete,
      }
    });
  } catch (error) {
    logger.error('Error updating onboarding progress', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar progresso'
    });
  }
});

export { router as userRoutes };
