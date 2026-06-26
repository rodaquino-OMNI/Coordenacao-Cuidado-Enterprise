/**
 * WhatsApp Routes
 * RESTful API endpoints for WhatsApp integration
 * Production implementation with Prisma + Z-API
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateRequest, validateQuery } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter, lenientRateLimiter } from '../middleware/rateLimiter';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../database/prisma';
import { whatsappService } from '../services/whatsapp.service';

const router = Router();

// Validation schemas
const WebhookVerificationSchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string()
});

const SendMessageSchema = z.object({
  to: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone number'),
  type: z.enum(['text', 'template', 'interactive']).default('text'),
  text: z.object({
    body: z.string().min(1, 'Message body is required')
  }).optional(),
  template: z.object({
    name: z.string(),
    language: z.object({
      code: z.string()
    }),
    components: z.array(z.any()).optional()
  }).optional(),
  interactive: z.object({
    type: z.string(),
    body: z.object({
      text: z.string()
    }),
    action: z.any()
  }).optional()
});

const MessageQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
  phoneNumber: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']).optional()
});

/**
 * @route   GET /api/v1/webhooks/whatsapp/webhook
 * @desc    WhatsApp webhook verification
 * @access  Public
 */
router.get('/webhook',
  lenientRateLimiter,
  async (req, res) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Verify token (should match configured VERIFY_TOKEN)
      const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'austa_care_verify_token';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('WhatsApp webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        logger.warn('WhatsApp webhook verification failed', { mode, token });
        res.sendStatus(403);
      }
    } catch (error) {
      logger.error('WhatsApp webhook verification error', { error });
      res.sendStatus(500);
    }
  }
);

/**
 * @route   POST /api/v1/webhooks/whatsapp/webhook
 * @desc    WhatsApp webhook for receiving messages
 * @access  Public
 */
router.post('/webhook',
  lenientRateLimiter,
  async (req, res) => {
    try {
      const { entry } = req.body;

      if (!entry || !Array.isArray(entry)) {
        return res.sendStatus(400);
      }

      // Process each webhook entry
      for (const webhookEntry of entry) {
        const changes = webhookEntry.changes || [];

        for (const change of changes) {
          if (change.field === 'messages') {
            const value = change.value;

            if (value.messages) {
              for (const message of value.messages) {
                logger.info('WhatsApp message received', {
                  from: message.from,
                  type: message.type,
                  timestamp: message.timestamp
                });

                // Persist inbound message to database
                try {
                  const user = await prisma.user.findFirst({
                    where: { phone: message.from },
                  });

                  // Find or create conversation
                  let conversation = await prisma.conversation.findFirst({
                    where: {
                      userId: user?.id,
                      channel: 'WHATSAPP',
                      status: 'ACTIVE',
                    },
                  });

                  if (!conversation && user) {
                    conversation = await prisma.conversation.create({
                      data: {
                        userId: user.id,
                        channel: 'WHATSAPP',
                        status: 'ACTIVE',
                        lastMessageAt: new Date(),
                      },
                    });
                  }

                  if (conversation) {
                    await prisma.message.create({
                      data: {
                        conversationId: conversation.id,
                        userId: user?.id,
                        whatsappMessageId: message.id,
                        content: message.text?.body || message.type,
                        type: message.type?.toUpperCase() as any || 'TEXT',
                        direction: 'INBOUND',
                        status: 'DELIVERED',
                        sentAt: new Date(parseInt(message.timestamp) * 1000 || Date.now()),
                      },
                    });

                    // Update lastMessageAt on conversation
                    await prisma.conversation.update({
                      where: { id: conversation.id },
                      data: { lastMessageAt: new Date() },
                    });
                  }
                } catch (dbError) {
                  logger.error('Failed to persist inbound WhatsApp message', { error: dbError });
                  // Don't fail the webhook response — the message was received
                }
              }
            }

            if (value.statuses) {
              for (const status of value.statuses) {
                logger.info('WhatsApp message status update', {
                  id: status.id,
                  status: status.status,
                  timestamp: status.timestamp
                });

                // Update message status in database
                try {
                  const statusMap: Record<string, string> = {
                    sent: 'SENT',
                    delivered: 'DELIVERED',
                    read: 'READ',
                    failed: 'FAILED',
                  };

                  const dbStatus = statusMap[status.status];
                  if (dbStatus) {
                    const updateData: any = { status: dbStatus };
                    if (status.status === 'delivered') {
                      updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000 || Date.now());
                    }
                    if (status.status === 'read') {
                      updateData.readAt = new Date(parseInt(status.timestamp) * 1000 || Date.now());
                    }

                    await prisma.message.updateMany({
                      where: { whatsappMessageId: status.id },
                      data: updateData,
                    });
                  }
                } catch (dbError) {
                  logger.error('Failed to update message status', { error: dbError });
                }
              }
            }
          }
        }
      }

      // Acknowledge receipt immediately
      res.sendStatus(200);
    } catch (error) {
      logger.error('WhatsApp webhook processing error', { error });
      res.sendStatus(500);
    }
  }
);

/**
 * @route   POST /api/v1/webhooks/whatsapp/send
 * @desc    Send WhatsApp message
 * @access  Private
 */
router.post('/send',
  authenticateToken,
  strictRateLimiter,
  validateRequest(SendMessageSchema),
  async (req, res) => {
    try {
      const { to, type, text, template, interactive } = req.body;

      if (type === 'text' && !text?.body) {
        return res.status(400).json({ error: 'Message body is required for text messages' });
      }

      let result: any;

      if (type === 'text') {
        result = await whatsappService.sendTextMessage({
          phone: to,
          message: text!.body,
        });
      } else if (type === 'template') {
        if (!template?.name) {
          return res.status(400).json({ error: 'Template name is required' });
        }
        result = await whatsappService.sendTemplateMessage({
          phone: to,
          templateName: template.name,
          language: template.language?.code || 'pt_BR',
          variables: template.components?.map((c: any) => c.text).filter(Boolean) || [],
        });
      } else if (type === 'interactive') {
        // For interactive messages, fall back to text since the interactive format varies
        result = await whatsappService.sendTextMessage({
          phone: to,
          message: interactive?.body?.text || 'Interactive message',
        });
      } else {
        return res.status(400).json({ error: `Unsupported message type: ${type}` });
      }

      // Persist outbound message to database
      try {
        const user = await prisma.user.findFirst({
          where: { phone: to },
        });

        let conversation = user
          ? await prisma.conversation.findFirst({
              where: {
                userId: user.id,
                channel: 'WHATSAPP',
                status: 'ACTIVE',
              },
            })
          : null;

        if (!conversation && user) {
          conversation = await prisma.conversation.create({
            data: {
              userId: user.id,
              channel: 'WHATSAPP',
              status: 'ACTIVE',
              lastMessageAt: new Date(),
            },
          });
        }

        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              userId: user?.id,
              whatsappMessageId: result.messageId,
              content: text?.body || template?.name || 'Message',
              type: type === 'text' ? 'TEXT' : 'TEXT',
              direction: 'OUTBOUND',
              status: 'SENT',
              sentAt: new Date(),
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          });
        }
      } catch (dbError) {
        logger.error('Failed to persist outbound message', { error: dbError });
        // Don't fail the response — the message was sent via Z-API
      }

      logger.info('WhatsApp message sent', { messageId: result.messageId, to, type });
      res.status(201).json({
        id: result.messageId,
        to,
        type,
        status: 'sent',
        timestamp: new Date(),
        sentBy: req.user!.id,
        zapiResponse: result,
      });
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message', { error: error.message });
      res.status(500).json({
        error: 'Failed to send message',
        details: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/webhooks/whatsapp/messages
 * @desc    Get WhatsApp message history
 * @access  Private
 */
router.get('/messages',
  authenticateToken,
  defaultRateLimiter,
  validateQuery(MessageQuerySchema),
  async (req, res) => {
    try {
      const { page, limit, phoneNumber, startDate, endDate, status } = req.query as any;

      // Build where clause
      const where: any = {};

      // Filter by phone number through conversation -> user
      if (phoneNumber) {
        const users = await prisma.user.findMany({
          where: { phone: phoneNumber },
          select: { id: true },
        });
        const userIds = users.map(u => u.id);

        const conversations = await prisma.conversation.findMany({
          where: {
            userId: { in: userIds },
            channel: 'WHATSAPP',
          },
          select: { id: true },
        });
        const conversationIds = conversations.map(c => c.id);

        if (conversationIds.length === 0) {
          return res.json({
            messages: [],
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total: 0,
              totalPages: 0,
            },
          });
        }

        where.conversationId = { in: conversationIds };
      } else {
        // If not filtering by phone, only show WhatsApp channel messages
        where.conversation = {
          channel: 'WHATSAPP',
        };
      }

      // Filter by date range
      if (startDate || endDate) {
        where.sentAt = {};
        if (startDate) where.sentAt.gte = new Date(startDate);
        if (endDate) where.sentAt.lte = new Date(endDate);
      }

      // Filter by status
      if (status) {
        const statusMapping: Record<string, string> = {
          sent: 'SENT',
          delivered: 'DELIVERED',
          read: 'READ',
          failed: 'FAILED',
        };
        where.status = statusMapping[status] || status.toUpperCase();
      }

      // Get total count for pagination
      const total = await prisma.message.count({ where });

      // Query messages with pagination
      const messages = await prisma.message.findMany({
        where,
        include: {
          conversation: {
            include: {
              user: {
                select: {
                  phone: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      });

      // Map to response format
      const mappedMessages = messages.map(msg => ({
        id: msg.whatsappMessageId || msg.id,
        from: msg.direction === 'INBOUND'
          ? msg.conversation?.user?.phone || 'unknown'
          : 'system',
        to: msg.direction === 'OUTBOUND'
          ? msg.conversation?.user?.phone || 'unknown'
          : 'system',
        type: msg.contentType.toLowerCase(),
        text: { body: msg.content },
        timestamp: msg.sentAt,
        status: msg.status.toLowerCase(),
        direction: msg.direction.toLowerCase(),
      }));

      res.json({
        messages: mappedMessages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Failed to get WhatsApp messages', { error });
      res.status(500).json({ error: 'Failed to retrieve messages' });
    }
  }
);

/**
 * @route   GET /api/v1/webhooks/whatsapp/templates
 * @desc    Get available WhatsApp message templates
 * @access  Private
 */
router.get('/templates',
  authenticateToken,
  defaultRateLimiter,
  async (req, res) => {
    try {
      // Templates are managed in WhatsApp Business Manager, not via Z-API.
      // Return a standard set of templates available for the platform.
      // In production, these would be synced from WhatsApp Business API.
      const templates = [
        {
          name: 'welcome_message',
          language: 'pt_BR',
          category: 'UTILITY',
          components: [
            {
              type: 'BODY',
              text: 'Olá {{1}}! Bem-vindo ao AUSTA Care. Como posso ajudá-lo hoje?'
            }
          ],
          status: 'APPROVED'
        },
        {
          name: 'appointment_reminder',
          language: 'pt_BR',
          category: 'UTILITY',
          components: [
            {
              type: 'BODY',
              text: 'Lembrete: Você tem uma consulta agendada para {{1}} às {{2}}.'
            }
          ],
          status: 'APPROVED'
        },
        {
          name: 'health_tip',
          language: 'pt_BR',
          category: 'UTILITY',
          components: [
            {
              type: 'BODY',
              text: '💡 Dica de saúde: {{1}}'
            }
          ],
          status: 'APPROVED'
        },
        {
          name: 'medication_reminder',
          language: 'pt_BR',
          category: 'UTILITY',
          components: [
            {
              type: 'BODY',
              text: '⏰ Hora de tomar {{1}}. Não se esqueça!'
            }
          ],
          status: 'APPROVED'
        },
      ];

      res.json({ templates });
    } catch (error) {
      logger.error('Failed to get WhatsApp templates', { error });
      res.status(500).json({ error: 'Failed to retrieve templates' });
    }
  }
);

/**
 * @route   POST /api/v1/webhooks/whatsapp/mark-read
 * @desc    Mark WhatsApp message as read
 * @access  Private
 */
router.post('/mark-read',
  authenticateToken,
  defaultRateLimiter,
  async (req, res) => {
    try {
      const { messageId, phone } = req.body;

      if (!messageId) {
        return res.status(400).json({ error: 'Message ID is required' });
      }

      // Update status in database
      const dbUpdate = await prisma.message.updateMany({
        where: { whatsappMessageId: messageId },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });

      // If a phone number is provided, also mark as read via Z-API
      let zapiResult: any = null;
      if (phone) {
        try {
          zapiResult = await whatsappService.markAsRead(phone, messageId);
        } catch (zapiError: any) {
          logger.warn('Z-API markAsRead failed (non-critical)', {
            messageId,
            phone,
            error: zapiError.message,
          });
        }
      } else {
        // Try to find the phone from database
        const message = await prisma.message.findFirst({
          where: { whatsappMessageId: messageId },
          include: {
            conversation: {
              include: { user: { select: { phone: true } } },
            },
          },
        });

        if (message?.conversation?.user?.phone) {
          try {
            zapiResult = await whatsappService.markAsRead(
              message.conversation.user.phone,
              messageId
            );
          } catch (zapiError: any) {
            logger.warn('Z-API markAsRead failed (non-critical)', {
              messageId,
              error: zapiError.message,
            });
          }
        }
      }

      logger.info('WhatsApp message marked as read', {
        messageId,
        dbUpdated: dbUpdate.count,
        zapiResult,
      });

      res.json({
        success: true,
        messageId,
        status: 'read',
        dbUpdated: dbUpdate.count > 0,
      });
    } catch (error) {
      logger.error('Failed to mark message as read', { error });
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }
);

/**
 * @route   GET /api/v1/webhooks/whatsapp/stats
 * @desc    Get WhatsApp statistics
 * @access  Private (Admin)
 */
router.get('/stats',
  authenticateToken,
  defaultRateLimiter,
  async (req, res) => {
    try {
      // Get all WhatsApp messages via conversations
      const whatsappConversationIds = await prisma.conversation.findMany({
        where: { channel: 'WHATSAPP' },
        select: { id: true },
      });
      const conversationIds = whatsappConversationIds.map(c => c.id);

      const baseWhere = conversationIds.length > 0
        ? { conversationId: { in: conversationIds } }
        : {};

      // Total messages by direction
      const [totalMessages, inboundCount, outboundCount] = await Promise.all([
        prisma.message.count({ where: baseWhere }),
        prisma.message.count({ where: { ...baseWhere, direction: 'INBOUND' } }),
        prisma.message.count({ where: { ...baseWhere, direction: 'OUTBOUND' } }),
      ]);

      // Last 24 hours stats
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [last24Total, last24Inbound, last24Outbound] = await Promise.all([
        prisma.message.count({
          where: { ...baseWhere, sentAt: { gte: last24Hours } },
        }),
        prisma.message.count({
          where: { ...baseWhere, direction: 'INBOUND', sentAt: { gte: last24Hours } },
        }),
        prisma.message.count({
          where: { ...baseWhere, direction: 'OUTBOUND', sentAt: { gte: last24Hours } },
        }),
      ]);

      // Delivery rates by status
      const [sentCount, deliveredCount, readCount, failedCount] = await Promise.all([
        prisma.message.count({ where: { ...baseWhere, direction: 'OUTBOUND', status: 'SENT' } }),
        prisma.message.count({ where: { ...baseWhere, direction: 'OUTBOUND', status: 'DELIVERED' } }),
        prisma.message.count({ where: { ...baseWhere, direction: 'OUTBOUND', status: 'READ' } }),
        prisma.message.count({ where: { ...baseWhere, direction: 'OUTBOUND', status: 'FAILED' } }),
      ]);

      // Active conversations count
      const activeConversations = await prisma.conversation.count({
        where: { channel: 'WHATSAPP', status: 'ACTIVE' },
      });

      res.json({
        totalMessages,
        inbound: inboundCount,
        outbound: outboundCount,
        last24Hours: {
          total: last24Total,
          inbound: last24Inbound,
          outbound: last24Outbound,
        },
        deliveryRates: {
          sent: sentCount,
          delivered: deliveredCount,
          read: readCount,
          failed: failedCount,
        },
        activeConversations,
      });
    } catch (error) {
      logger.error('Failed to get WhatsApp stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

/**
 * @route   POST /api/v1/webhooks/whatsapp/send-template
 * @desc    Send WhatsApp template message
 * @access  Private
 */
router.post('/send-template',
  authenticateToken,
  strictRateLimiter,
  async (req, res) => {
    try {
      const { to, templateName, language, parameters } = req.body;

      if (!to || !templateName) {
        return res.status(400).json({ error: 'Phone number and template name are required' });
      }

      // Send template via Z-API
      const result = await whatsappService.sendTemplateMessage({
        phone: to,
        templateName,
        language: language || 'pt_BR',
        variables: parameters || [],
      });

      // Persist outbound message to database
      try {
        const user = await prisma.user.findFirst({
          where: { phone: to },
        });

        let conversation = user
          ? await prisma.conversation.findFirst({
              where: {
                userId: user.id,
                channel: 'WHATSAPP',
                status: 'ACTIVE',
              },
            })
          : null;

        if (!conversation && user) {
          conversation = await prisma.conversation.create({
            data: {
              userId: user.id,
              channel: 'WHATSAPP',
              status: 'ACTIVE',
              lastMessageAt: new Date(),
            },
          });
        }

        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              userId: user?.id,
              whatsappMessageId: result.messageId,
              content: `Template: ${templateName}`,
              type: 'TEXT',
              direction: 'OUTBOUND',
              status: 'SENT',
              sentAt: new Date(),
              metadata: { templateName, language, parameters },
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          });
        }
      } catch (dbError) {
        logger.error('Failed to persist template message', { error: dbError });
      }

      logger.info('WhatsApp template message sent', {
        messageId: result.messageId,
        to,
        templateName,
      });

      res.status(201).json({
        id: result.messageId,
        to,
        type: 'template',
        template: {
          name: templateName,
          language: language || 'pt_BR',
          parameters,
        },
        status: 'sent',
        timestamp: new Date(),
        zapiResponse: result,
      });
    } catch (error: any) {
      logger.error('Failed to send template message', { error: error.message });
      res.status(500).json({
        error: 'Failed to send template message',
        details: error.message,
      });
    }
  }
);

export default router;
