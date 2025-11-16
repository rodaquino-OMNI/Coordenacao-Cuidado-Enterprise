import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Zod validation schemas
const createConversationSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  channel: z.enum(['whatsapp', 'web', 'mobile'], { errorMap: () => ({ message: 'Canal inválido' }) }),
  metadata: z.record(z.any()).optional(),
});

const createMessageSchema = z.object({
  content: z.string().min(1, 'Conteúdo da mensagem é obrigatório'),
  direction: z.enum(['inbound', 'outbound']).transform(val => val.toUpperCase() as 'INBOUND' | 'OUTBOUND'),
  type: z.enum(['text', 'audio', 'image', 'document', 'video', 'location', 'contact']).transform(val => val.toUpperCase() as 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'LOCATION' | 'CONTACT').default('text'),
  metadata: z.record(z.any()).optional(),
});

const updateConversationSchema = z.object({
  status: z.enum(['active', 'archived', 'paused', 'completed', 'escalated']).transform(val => val?.toUpperCase() as 'ACTIVE' | 'ARCHIVED' | 'PAUSED' | 'COMPLETED' | 'ESCALATED').optional(),
  metadata: z.record(z.any()).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  userId: z.string().optional(),
  channel: z.string().optional(),
  status: z.string().optional(),
  orderBy: z.enum(['createdAt', 'updatedAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Create conversation
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = createConversationSchema.parse(req.body);

    const conversation = await prisma.conversation.create({
      data: {
        userId: validated.userId,
        organizationId: 'default-org-id', // TODO: Get from user context
        whatsappChatId: `chat_${Date.now()}`, // TODO: Get from WhatsApp webhook
        channel: validated.channel,
        status: 'ACTIVE',
        metadata: validated.metadata || {},
      },
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

    logger.info('Conversation created', { conversationId: conversation.id, userId: validated.userId });

    res.status(201).json({
      success: true,
      message: 'Conversa criada com sucesso',
      data: conversation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error creating conversation', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao criar conversa'
    });
  }
});

// Get all conversations (with pagination and filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.orderBy]: query.order },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      }),
      prisma.conversation.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: conversations,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching conversations', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar conversas'
    });
  }
});

// Get conversation by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100, // Last 100 messages
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error('Error fetching conversation', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar conversa'
    });
  }
});

// Update conversation
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateConversationSchema.parse(req.body);

    const existingConversation = await prisma.conversation.findUnique({ where: { id } });
    if (!existingConversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: validated,
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

    logger.info('Conversation updated', { conversationId: id });

    res.status(200).json({
      success: true,
      message: 'Conversa atualizada com sucesso',
      data: conversation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error updating conversation', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar conversa'
    });
  }
});

// Delete conversation
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    // Soft delete by updating status
    await prisma.conversation.update({
      where: { id },
      data: { status: 'ARCHIVED' } // Soft delete by archiving
    });

    logger.info('Conversation deleted', { conversationId: id });

    res.status(200).json({
      success: true,
      message: 'Conversa excluída com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting conversation', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir conversa'
    });
  }
});

// Add message to conversation
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = createMessageSchema.parse(req.body);

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        userId: conversation.userId,
        content: validated.content,
        direction: validated.direction,
        type: validated.type,
        metadata: validated.metadata || {},
      }
    });

    // Update conversation's updatedAt
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() }
    });

    logger.info('Message added to conversation', { conversationId: id, messageId: message.id });

    res.status(201).json({
      success: true,
      message: 'Mensagem adicionada com sucesso',
      data: message
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    logger.error('Error adding message', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar mensagem'
    });
  }
});

// Get conversation messages
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', before } = req.query;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before as string) } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Return in chronological order
      hasMore: messages.length === parseInt(limit as string, 10)
    });
  } catch (error) {
    logger.error('Error fetching messages', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar mensagens'
    });
  }
});

// Archive conversation
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    await prisma.conversation.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });

    logger.info('Conversation archived', { conversationId: id });

    res.status(200).json({
      success: true,
      message: 'Conversa arquivada com sucesso'
    });
  } catch (error) {
    logger.error('Error archiving conversation', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao arquivar conversa'
    });
  }
});

// Get conversation context/state
router.get('/:id/context', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            healthScore: true,
            onboardingComplete: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 messages for context
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversa não encontrada'
      });
    }

    const context = {
      conversationId: conversation.id,
      userId: conversation.userId,
      userProfile: conversation.user,
      channel: conversation.channel,
      recentMessages: conversation.messages.reverse(),
      metadata: conversation.metadata,
      lastInteraction: conversation.updatedAt,
    };

    res.status(200).json({
      success: true,
      data: context
    });
  } catch (error) {
    logger.error('Error fetching conversation context', { error });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar contexto da conversa'
    });
  }
});

export { router as conversationRoutes };
