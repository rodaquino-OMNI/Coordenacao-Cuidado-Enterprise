import { Router, Request, Response } from 'express';
import { PrismaClient, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import {
  getFullName,
  getUserHealthScore,
  isUserActive,
  getUserOnboardingStatus,
  formatUserResponse,
  searchUsers
} from '../utils/user.helpers';
import {
  successResponse,
  errorResponse,
  ErrorCode,
  calculatePagination,
  paginatedResponse
} from '../types/api-responses';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  firstName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Sobrenome deve ter no mínimo 2 caracteres'),
  phone: z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Telefone inválido'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos').optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{10,14}$/).optional(),
  email: z.string().email().optional(),
  // Note: onboardingComplete and healthScore moved to separate tables
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  search: z.string().optional(),
  orderBy: z.enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email']).default('createdAt'),
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
        firstName: validated.firstName,
        lastName: validated.lastName,
        phone: validated.phone,
        cpf: validated.cpf,
        status: UserStatus.ACTIVE,
        organization: {
          connect: { id: 'default-org-id' } // TODO: Get from context or config
        }
      }
    });

    // Initialize health points for the new user
    await prisma.healthPoints.create({
      data: {
        userId: user.id,
        currentPoints: 0,
        lifetimePoints: 0,
        level: 1
      }
    });

    logger.info('User created successfully', { userId: user.id });

    // Format response with health score
    const formattedUser = await formatUserResponse(user, true);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: formattedUser
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
        { firstName: { contains: query.search, mode: 'insensitive' as const } },
        { lastName: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { phone: { contains: query.search } },
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.orderBy]: query.order }
      }),
      prisma.user.count({ where })
    ]);

    // Format all users with health scores
    const formattedUsers = await Promise.all(
      users.map(user => formatUserResponse(user, true))
    );

    const pagination = calculatePagination(query.page, query.limit, total);

    res.status(200).json(paginatedResponse(formattedUsers, pagination));
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
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Format with health score and onboarding status
    const formattedUser = await formatUserResponse(user, true);
    const onboardingStatus = await getUserOnboardingStatus(user.id);

    res.status(200).json({
      success: true,
      data: {
        ...formattedUser,
        onboardingStatus
      }
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
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Format with health score and onboarding status
    const formattedUser = await formatUserResponse(user, true);
    const onboardingStatus = await getUserOnboardingStatus(user.id);

    res.status(200).json({
      success: true,
      data: {
        ...formattedUser,
        onboardingStatus
      }
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
      data: validated
    });

    logger.info('User updated successfully', { userId: id });

    // Format response with health score
    const formattedUser = await formatUserResponse(user, true);

    res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: formattedUser
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
      data: validated
    });

    logger.info('User profile updated', { userId });

    // Format response with health score
    const formattedUser = await formatUserResponse(user, true);

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: formattedUser
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
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Get onboarding status from OnboardingProgress table
    const onboardingStatus = await getUserOnboardingStatus(id);
    const healthScore = await getUserHealthScore(id);

    // TODO: Get completed missions from Mission/Achievement tables when they exist
    const completedMissions: any[] = [];

    const onboardingData = {
      completed: onboardingStatus?.isComplete ?? false,
      currentStep: onboardingStatus?.currentStep ?? 1,
      totalSteps: onboardingStatus?.totalSteps ?? 5,
      stepsCompleted: onboardingStatus?.stepsCompleted ?? 0,
      completionPercentage: onboardingStatus?.completionPercentage ?? 0,
      healthPoints: healthScore,
      completedMissions,
      completedSteps: onboardingStatus?.completedSteps ?? []
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
    const { missionId, responses, pointsEarned, stepCompleted } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Update health points in HealthPoints table
    const healthPoints = await prisma.healthPoints.findUnique({
      where: { userId: id }
    });

    if (healthPoints) {
      const newCurrentPoints = healthPoints.currentPoints + (pointsEarned || 0);
      const newLifetimePoints = healthPoints.lifetimePoints + (pointsEarned || 0);

      await prisma.healthPoints.update({
        where: { userId: id },
        data: {
          currentPoints: newCurrentPoints,
          lifetimePoints: newLifetimePoints,
          lastActivityAt: new Date()
        }
      });
    }

    // Update onboarding progress
    const onboardingProgress = await prisma.onboardingProgress.findUnique({
      where: { userId: id }
    });

    if (onboardingProgress && stepCompleted) {
      const completedSteps = [...(onboardingProgress.completedSteps || []), stepCompleted];
      const totalSteps = 5; // Hardcoded for now
      const isComplete = completedSteps.length >= totalSteps;

      await prisma.onboardingProgress.update({
        where: { userId: id },
        data: {
          completedSteps,
          currentStep: Math.min(completedSteps.length + 1, totalSteps).toString(),
          isCompleted: isComplete,
          completedAt: isComplete ? new Date() : onboardingProgress.completedAt
        }
      });
    }

    // TODO: Create achievement when Mission/Achievement tables exist

    const newHealthScore = await getUserHealthScore(id);
    const onboardingStatus = await getUserOnboardingStatus(id);

    logger.info('Onboarding progress updated', { userId: id, missionId, pointsEarned });

    res.status(200).json({
      success: true,
      message: 'Progresso atualizado com sucesso',
      data: {
        missionId,
        completed: true,
        pointsEarned,
        totalPoints: newHealthScore,
        onboardingComplete: onboardingStatus?.isComplete ?? false,
        currentStep: onboardingStatus?.currentStep ?? 1
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
