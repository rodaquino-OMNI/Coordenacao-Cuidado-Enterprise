/**
 * Conversation Management Routes
 * RESTful API endpoints for managing conversations and messages
 *
 * All endpoints use real Prisma queries against the PostgreSQL database.
 * LGPD-compliant: soft deletes, no hard deletion of conversation data.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  PrismaClient,
  ConversationStatus,
  MessageDirection,
  MessageType,
} from '@prisma/client';
import { MessageContentType, CommunicationChannel } from '../types/core/enums';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ── Validation schemas (kept as defined in the original routes) ─────────────

const CreateConversationSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  channelType: z.enum(['whatsapp', 'web', 'mobile', 'telegram']),
  metadata: z.record(z.any()).optional()
});

const SendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  content: z.string().min(1, 'Message content is required'),
  messageType: z.enum(['text', 'image', 'document', 'audio', 'video']).default('text'),
  metadata: z.record(z.any()).optional()
});

const ConversationIdSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID')
});

const MessageQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional()
});

const ConversationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  userId: z.string().uuid().optional(),
  channelType: z.enum(['whatsapp', 'web', 'mobile', 'telegram']).optional(),
  status: z.enum(['active', 'archived', 'closed']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'lastMessageAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ── Mapping helpers (bridge route-level strings → Prisma enums) ─────────────

function mapChannelType(channelType?: string): CommunicationChannel {
  const mapping: Record<string, CommunicationChannel> = {
    whatsapp: CommunicationChannel.WHATSAPP,
    web: CommunicationChannel.IN_APP,
    mobile: CommunicationChannel.IN_APP,
    telegram: CommunicationChannel.WHATSAPP,
  };
  return mapping[channelType || 'whatsapp'] || CommunicationChannel.WHATSAPP;
}

function mapStatus(status?: string): ConversationStatus | undefined {
  const mapping: Record<string, ConversationStatus> = {
    active: ConversationStatus.ACTIVE,
    archived: ConversationStatus.ARCHIVED,
    closed: ConversationStatus.COMPLETED,
  };
  return status ? mapping[status] : undefined;
}

function mapMessageType(messageType: string): MessageContentType {
  const mapping: Record<string, MessageContentType> = {
    text: MessageContentType.TEXT,
    image: MessageContentType.IMAGE,
    document: MessageContentType.DOCUMENT,
    audio: MessageContentType.AUDIO,
    video: MessageContentType.VIDEO,
  };
  return mapping[messageType] || MessageContentType.TEXT;
}

// Apply authentication to all routes
router.use(authenticateToken);

// ═════════════════════════════════════════════════════════════════════════════
// POST / — Create new conversation
// ═════════════════════════════════════════════════════════════════════════════
router.post('/',
  defaultRateLimiter,
  validateRequest(CreateConversationSchema),
  async (req, res) => {
    try {
      const { userId, channelType, metadata } = req.body;

      // Get user's organizationId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const conversation = await prisma.conversation.create({
        data: {
          userId,
          whatsappChatId: `conv_${userId}_${Date.now()}`,
          organizationId: user.organizationId,
          channel: mapChannelType(channelType),
          status: ConversationStatus.ACTIVE,
          metadata: metadata || {},
        },
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

      logger.info('Conversation created', { conversationId: conversation.id, userId });
      res.status(201).json(conversation);
    } catch (error) {
      logger.error('Failed to create conversation', { error });
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GET / — List conversations (with filters, pagination, sorting)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/',
  defaultRateLimiter,
  validateQuery(ConversationQuerySchema),
  async (req, res) => {
    try {
      const { page, limit, userId, channelType, status, sortBy, sortOrder } = req.query as any;

      // Non-admin users can only see their own conversations
      const isAdmin = req.user!.roles.includes('admin');
      const filterUserId = isAdmin ? userId : req.user!.id;

      // Build where clause
      const where: any = {};
      if (filterUserId) where.userId = filterUserId;
      if (channelType) where.channel = mapChannelType(channelType);
      if (status) where.status = mapStatus(status);

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);
      const orderBy = { [sortBy]: sortOrder };

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            },
            messages: {
              orderBy: { createdAt: 'desc' as const },
              take: 1,
            },
            _count: {
              select: { messages: true }
            }
          }
        }),
        prisma.conversation.count({ where })
      ]);

      // Format response: hoist messageCount and lastMessage
      const formattedConversations = conversations.map(conv => ({
        ...conv,
        messageCount: conv._count.messages,
        lastMessage: conv.messages[0] || null,
        messages: undefined,
        _count: undefined,
      }));

      res.json({
        conversations: formattedConversations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get conversations', { error });
      res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /:conversationId — Get conversation by ID
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:conversationId',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 100,
          },
          _count: {
            select: { messages: true }
          }
        }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Authorization check: only owner or admin can view
      if (conversation.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        ...conversation,
        messageCount: conversation._count.messages,
        _count: undefined,
      });
    } catch (error) {
      logger.error('Failed to get conversation', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to retrieve conversation' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /:conversationId/messages — Get messages for a conversation
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:conversationId/messages',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  validateQuery(MessageQuerySchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { page, limit, before, after } = req.query as any;

      // Verify conversation exists and user has access
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (conversation.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Build date filters
      const dateFilter: any = {};
      if (before) dateFilter.lt = new Date(before);
      if (after) dateFilter.gt = new Date(after);

      const where: any = { conversationId };
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.message.count({ where })
      ]);

      res.json({
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get messages', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to retrieve messages' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// POST /:conversationId/messages — Send a message in a conversation
// ═════════════════════════════════════════════════════════════════════════════
router.post('/:conversationId/messages',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  validateRequest(SendMessageSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content, messageType, metadata } = req.body;

      // Verify conversation exists and user has access
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true, id: true }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (conversation.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          userId: req.user!.id,
          content,
          type: mapMessageType(messageType),
          direction: MessageDirection.INBOUND,
          metadata: metadata || {},
        }
      });

      // Update conversation's lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() }
      });

      logger.info('Message sent', { messageId: message.id, conversationId });
      res.status(201).json(message);
    } catch (error) {
      logger.error('Failed to send message', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /:conversationId/status — Update conversation status
// ═════════════════════════════════════════════════════════════════════════════
router.patch('/:conversationId/status',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { status } = req.body;

      const validStatuses = ['active', 'archived', 'closed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          validStatuses
        });
      }

      // Verify conversation exists and user has access
      const existing = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: mapStatus(status)! },
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

      logger.info('Conversation status updated', { conversationId, status });
      res.json(conversation);
    } catch (error) {
      logger.error('Failed to update conversation status', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to update conversation status' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /:conversationId — Soft-delete conversation (LGPD compliant)
// ═════════════════════════════════════════════════════════════════════════════
router.delete('/:conversationId',
  strictRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Verify conversation exists and user has access
      const existing = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (existing.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Soft delete: archive the conversation instead of hard deleting (LGPD)
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: ConversationStatus.ARCHIVED }
      });

      logger.info('Conversation archived (soft delete)', { conversationId, userId: req.user!.id });

      res.json({
        message: 'Conversation archived',
        conversationId,
        note: 'Data retained according to LGPD policies'
      });
    } catch (error) {
      logger.error('Failed to delete conversation', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /:conversationId/summary — Get AI-generated conversation summary
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:conversationId/summary',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Verify conversation exists and user has access
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              type: true,
              direction: true,
              createdAt: true,
            }
          },
          _count: {
            select: { messages: true }
          }
        }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (conversation.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Build a synthetic summary from the actual conversation data.
      // In production, this would invoke an AI service; here we derive
      // a data-driven summary from the stored messages and metadata.
      const messageCount = conversation._count.messages;
      const textMessages = conversation.messages.filter(m => m.type === MessageContentType.TEXT);
      const userMessages = textMessages.filter(m => m.direction === MessageDirection.INBOUND);
      const lastMessages = textMessages.slice(-3);

      const summary = {
        conversationId: conversation.id,
        summary: messageCount > 0
          ? `Conversation with ${messageCount} messages across ${conversation.channel} channel`
          : 'No messages in this conversation yet',
        messageCount,
        channel: conversation.channel,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
        recentMessages: lastMessages.map(m => ({
          content: m.content ? (m.content.length > 100 ? m.content.substring(0, 97) + '...' : m.content) : '',
          direction: m.direction,
          timestamp: m.createdAt,
        })),
        userMessageCount: userMessages.length,
        generatedAt: new Date(),
      };

      res.json(summary);
    } catch (error) {
      logger.error('Failed to generate summary', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /stats/overview — Get conversation statistics (admin only)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/stats/overview',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      // Run all aggregate queries in parallel
      const [
        totalConversations,
        activeConversations,
        archivedConversations,
        closedConversations,
        totalMessages,
        channelCounts,
        last24hConversations,
        last24hMessages,
      ] = await Promise.all([
        // Total conversations
        prisma.conversation.count(),

        // Active conversations
        prisma.conversation.count({ where: { status: ConversationStatus.ACTIVE } }),

        // Archived conversations
        prisma.conversation.count({ where: { status: ConversationStatus.ARCHIVED } }),

        // Closed conversations
        prisma.conversation.count({ where: { status: ConversationStatus.COMPLETED } }),

        // Total messages
        prisma.message.count(),

        // Channel distribution (group by channel)
        prisma.conversation.groupBy({
          by: ['channel'],
          _count: { id: true },
          where: { channel: { not: undefined as any } },
        }),

        // New conversations in last 24 hours
        prisma.conversation.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),

        // Messages in last 24 hours
        prisma.message.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
      ]);

      // Build channel distribution map
      const channelDistribution: Record<string, number> = {};
      for (const entry of channelCounts) {
        if (entry.channel) {
          channelDistribution[entry.channel.toLowerCase()] = entry._count.id;
        }
      }

      const averageMessagesPerConversation =
        totalConversations > 0
          ? Math.round((totalMessages / totalConversations) * 10) / 10
          : 0;

      const stats = {
        totalConversations,
        activeConversations,
        archivedConversations,
        closedConversations,
        totalMessages,
        averageMessagesPerConversation,
        channelDistribution,
        last24Hours: {
          newConversations: last24hConversations,
          messages: last24hMessages,
        },
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get conversation stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

export default router;
