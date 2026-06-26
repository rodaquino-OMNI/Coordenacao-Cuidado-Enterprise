import request from 'supertest';
import express from 'express';
import { whatsappRoutes } from '@/controllers/whatsapp';
import { logger } from '@/utils/logger';

const app = express();
app.use(express.json());
app.use('/whatsapp', whatsappRoutes);

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('WhatsApp Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /whatsapp/webhook', () => {
    it('should verify webhook with correct parameters', async () => {
      const verifyToken = 'test_verify_token';
      const challenge = 'test_challenge';
      
      const response = await request(app)
        .get('/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge,
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe(challenge);
      expect(logger.info).toHaveBeenCalledWith(
        'WhatsApp webhook verification',
        { mode: 'subscribe', token: verifyToken }
      );
    });

    it('should reject webhook verification for non-subscribe mode', async () => {
      const response = await request(app)
        .get('/whatsapp/webhook')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test_token',
          'hub.challenge': 'test_challenge',
        });

      expect(response.status).toBe(403);
      expect(response.text).toBe('Forbidden');
    });

    it('should handle webhook verification errors', async () => {
      // Mock an error in the verification process
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_token',
          'hub.challenge': 'test_challenge',
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Webhook verification failed'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('POST /whatsapp/webhook', () => {
    it('should process incoming webhook messages successfully', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'entry_id',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '1234567890',
                phone_number_id: 'phone_id'
              },
              messages: [{
                from: '5511999999999',
                id: 'message_id',
                timestamp: '1234567890',
                text: {
                  body: 'Hello, I need help with my appointment'
                },
                type: 'text'
              }]
            },
            field: 'messages'
          }]
        }]
      };

      const response = await request(app)
        .post('/whatsapp/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Message received'
      });
      expect(logger.info).toHaveBeenCalledWith(
        'WhatsApp webhook received',
        { body: webhookPayload }
      );
    });

    it('should handle webhook processing errors', async () => {
      // Mock an error in the processing
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Processing error');
      });

      const response = await request(app)
        .post('/whatsapp/webhook')
        .send({ test: 'data' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Message processing failed'
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty webhook payload', async () => {
      const response = await request(app)
        .post('/whatsapp/webhook')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Message received'
      });
    });
  });

  describe('POST /whatsapp/send', () => {
    it('should send text message successfully', async () => {
      const messageData = {
        to: '5511999999999',
        message: 'Hello from AUSTA Care!',
        type: 'text'
      };

      const response = await request(app)
        .post('/whatsapp/send')
        .send(messageData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Message sending endpoint ready',
        data: {
          messageId: 'placeholder-message-id',
          to: messageData.to,
          status: 'sent'
        }
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Sending WhatsApp message',
        { to: messageData.to, type: messageData.type }
      );
    });

    it('should default to text type when not specified', async () => {
      const messageData = {
        to: '5511999999999',
        message: 'Hello without type!'
      };

      const response = await request(app)
        .post('/whatsapp/send')
        .send(messageData);

      expect(response.status).toBe(200);
      expect(logger.info).toHaveBeenCalledWith(
        'Sending WhatsApp message',
        { to: messageData.to, type: 'text' }
      );
    });

    it('should handle message sending errors', async () => {
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Sending error');
      });

      const response = await request(app)
        .post('/whatsapp/send')
        .send({ to: '5511999999999', message: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Message sending failed'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('POST /whatsapp/send-template', () => {
    it('should send template message successfully', async () => {
      const templateData = {
        to: '5511999999999',
        template: 'appointment_reminder',
        language: 'pt_BR',
        parameters: ['João', '2024-01-15', '14:00']
      };

      const response = await request(app)
        .post('/whatsapp/send-template')
        .send(templateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Template message sending endpoint ready',
        data: {
          messageId: 'placeholder-template-message-id',
          to: templateData.to,
          template: templateData.template,
          status: 'sent'
        }
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Sending WhatsApp template message',
        {
          to: templateData.to,
          template: templateData.template,
          language: templateData.language
        }
      );
    });

    it('should use default language and parameters', async () => {
      const templateData = {
        to: '5511999999999',
        template: 'welcome_message'
      };

      const response = await request(app)
        .post('/whatsapp/send-template')
        .send(templateData);

      expect(response.status).toBe(200);
      expect(logger.info).toHaveBeenCalledWith(
        'Sending WhatsApp template message',
        {
          to: templateData.to,
          template: templateData.template,
          language: 'pt_BR'
        }
      );
    });

    it('should handle template sending errors', async () => {
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Template sending error');
      });

      const response = await request(app)
        .post('/whatsapp/send-template')
        .send({ to: '5511999999999', template: 'test_template' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Template message sending failed'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});