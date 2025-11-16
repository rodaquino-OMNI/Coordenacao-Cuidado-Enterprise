/**
 * Conversation Management Routes
 * RESTful API endpoints for managing conversations and messages
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
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

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/conversations
 * @desc    Create new conversation
 * @access  Private
 */
router.post('/',
  defaultRateLimiter,
  validateRequest(CreateConversationSchema),
  async (req, res) => {
    try {
      const { userId, channelType, metadata } = req.body;

      // Mock implementation
      const conversation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId,
        channelType,
        status: 'active',
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 0
      };

      logger.info('Conversation created', { conversationId: conversation.id, userId });
      res.status(201).json(conversation);
    } catch (error) {
      logger.error('Failed to create conversation', { error });
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }
);

/**
 * @route   GET /api/v1/conversations
 * @desc    Get all conversations
 * @access  Private
 */
router.get('/',
  defaultRateLimiter,
  validateQuery(ConversationQuerySchema),
  async (req, res) => {
    try {
      const { page, limit, userId, channelType, status, sortBy, sortOrder } = req.query as any;

      // Filter by user if not admin
      const filterUserId = req.user!.roles.includes('admin') ? userId : req.user!.id;

      // Mock implementation
      const conversations = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: filterUserId,
          channelType: 'whatsapp',
          status: 'active',
          lastMessage: {
            content: 'Olá, como posso ajudar?',
            timestamp: new Date()
          },
          messageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      res.json({
        conversations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: conversations.length,
          totalPages: Math.ceil(conversations.length / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get conversations', { error });
      res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
  }
);

/**
 * @route   GET /api/v1/conversations/:conversationId
 * @desc    Get conversation by ID
 * @access  Private
 */
router.get('/:conversationId',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Mock implementation
      const conversation = {
        id: conversationId,
        userId: req.user!.id,
        channelType: 'whatsapp',
        status: 'active',
        metadata: {},
        messageCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date()
      };

      // Check access
      if (conversation.userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(conversation);
    } catch (error) {
      logger.error('Failed to get conversation', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to retrieve conversation' });
    }
  }
);

/**
 * @route   GET /api/v1/conversations/:conversationId/messages
 * @desc    Get messages for conversation
 * @access  Private
 */
router.get('/:conversationId/messages',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  validateQuery(MessageQuerySchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { page, limit, before, after } = req.query as any;

      // Mock implementation
      const messages = [
        {
          id: 'msg-1',
          conversationId,
          senderId: req.user!.id,
          senderType: 'user',
          content: 'Olá, preciso de ajuda',
          messageType: 'text',
          timestamp: new Date(),
          metadata: {}
        },
        {
          id: 'msg-2',
          conversationId,
          senderId: 'assistant',
          senderType: 'assistant',
          content: 'Olá! Como posso ajudá-lo hoje?',
          messageType: 'text',
          timestamp: new Date(),
          metadata: {}
        }
      ];

      res.json({
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: messages.length,
          totalPages: Math.ceil(messages.length / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get messages', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to retrieve messages' });
    }
  }
);

/**
 * @route   POST /api/v1/conversations/:conversationId/messages
 * @desc    Send message in conversation
 * @access  Private
 */
router.post('/:conversationId/messages',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  validateRequest(SendMessageSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content, messageType, metadata } = req.body;

      // Mock implementation
      const message = {
        id: 'msg-' + Date.now(),
        conversationId,
        senderId: req.user!.id,
        senderType: 'user',
        content,
        messageType,
        metadata,
        timestamp: new Date(),
        status: 'sent'
      };

      logger.info('Message sent', { messageId: message.id, conversationId });
      res.status(201).json(message);
    } catch (error) {
      logger.error('Failed to send message', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

/**
 * @route   PATCH /api/v1/conversations/:conversationId/status
 * @desc    Update conversation status
 * @access  Private
 */
router.patch('/:conversationId/status',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { status } = req.body;

      if (!['active', 'archived', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Mock implementation
      const conversation = {
        id: conversationId,
        status,
        updatedAt: new Date()
      };

      logger.info('Conversation status updated', { conversationId, status });
      res.json(conversation);
    } catch (error) {
      logger.error('Failed to update conversation status', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to update conversation status' });
    }
  }
);

/**
 * @route   DELETE /api/v1/conversations/:conversationId
 * @desc    Delete conversation (soft delete)
 * @access  Private
 */
router.delete('/:conversationId',
  strictRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      logger.info('Conversation deletion requested', { conversationId, userId: req.user!.id });

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

/**
 * @route   GET /api/v1/conversations/:conversationId/summary
 * @desc    Get AI-generated conversation summary
 * @access  Private
 */
router.get('/:conversationId/summary',
  defaultRateLimiter,
  validateParams(ConversationIdSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      // Mock implementation
      const summary = {
        conversationId,
        summary: 'Usuário solicitou informações sobre sintomas de gripe',
        topics: ['saúde', 'sintomas', 'gripe'],
        sentiment: 'neutral',
        keyPoints: [
          'Usuário relatou febre e dor de cabeça',
          'Recomendado consultar médico',
          'Fornecidas orientações de autocuidado'
        ],
        generatedAt: new Date()
      };

      res.json(summary);
    } catch (error) {
      logger.error('Failed to generate summary', { error, conversationId: req.params.conversationId });
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  }
);

/**
 * @route   GET /api/v1/conversations/stats/overview
 * @desc    Get conversation statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats/overview',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      // Mock implementation
      const stats = {
        totalConversations: 1250,
        activeConversations: 45,
        archivedConversations: 1200,
        closedConversations: 5,
        totalMessages: 15680,
        averageMessagesPerConversation: 12.5,
        channelDistribution: {
          whatsapp: 800,
          web: 300,
          mobile: 150
        },
        last24Hours: {
          newConversations: 25,
          messages: 340
        }
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get conversation stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

export default router;
