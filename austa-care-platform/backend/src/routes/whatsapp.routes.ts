/**
 * WhatsApp Routes
 * RESTful API endpoints for WhatsApp integration
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateRequest, validateQuery } from '../middleware/validation';
import { defaultRateLimiter, strictRateLimiter, lenientRateLimiter } from '../middleware/rateLimiter';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

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

                // Process message asynchronously
                // This would trigger conversation handling, AI response, etc.
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

      // Mock implementation
      const message = {
        id: `wamid.${Date.now()}`,
        to,
        type,
        status: 'sent',
        timestamp: new Date(),
        sentBy: req.user!.id
      };

      logger.info('WhatsApp message sent', { messageId: message.id, to, type });
      res.status(201).json(message);
    } catch (error) {
      logger.error('Failed to send WhatsApp message', { error });
      res.status(500).json({ error: 'Failed to send message' });
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

      // Mock implementation
      const messages = [
        {
          id: 'wamid.123',
          from: '+5511987654321',
          to: '+5511912345678',
          type: 'text',
          text: { body: 'Olá, preciso de ajuda' },
          timestamp: new Date(),
          status: 'read',
          direction: 'inbound'
        },
        {
          id: 'wamid.124',
          from: '+5511912345678',
          to: '+5511987654321',
          type: 'text',
          text: { body: 'Olá! Como posso ajudá-lo?' },
          timestamp: new Date(),
          status: 'delivered',
          direction: 'outbound'
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
      // Mock implementation
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
        }
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
      const { messageId } = req.body;

      if (!messageId) {
        return res.status(400).json({ error: 'Message ID is required' });
      }

      // Mock implementation
      logger.info('WhatsApp message marked as read', { messageId });

      res.json({
        success: true,
        messageId,
        status: 'read'
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
      // Mock implementation
      const stats = {
        totalMessages: 12450,
        inbound: 6500,
        outbound: 5950,
        last24Hours: {
          total: 340,
          inbound: 180,
          outbound: 160
        },
        deliveryRates: {
          sent: 5950,
          delivered: 5800,
          read: 4200,
          failed: 150
        },
        responseTime: {
          average: '2m 30s',
          median: '1m 45s'
        },
        activeConversations: 89,
        templateUsage: {
          welcome_message: 450,
          appointment_reminder: 320
        }
      };

      res.json(stats);
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

      // Mock implementation
      const message = {
        id: `wamid.${Date.now()}`,
        to,
        type: 'template',
        template: {
          name: templateName,
          language: language || 'pt_BR',
          parameters
        },
        status: 'sent',
        timestamp: new Date()
      };

      logger.info('WhatsApp template message sent', { messageId: message.id, to, templateName });
      res.status(201).json(message);
    } catch (error) {
      logger.error('Failed to send template message', { error });
      res.status(500).json({ error: 'Failed to send template message' });
    }
  }
);

export default router;
