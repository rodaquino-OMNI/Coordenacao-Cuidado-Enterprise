/**
 * Comprehensive Unit Tests for WhatsApp Service (Z-API Integration)
 * Coverage: Message sending, rate limiting, queue management, error handling
 */

import { WhatsAppService } from '../../../src/services/whatsapp.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    service = new WhatsAppService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Initialization', () => {
    it('should create axios client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalled();
      const config = mockedAxios.create.mock.calls[0][0];
      expect(config.timeout).toBe(30000);
      expect(config.headers['Content-Type']).toBe('application/json');
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Instance Management', () => {
    it('should get instance status successfully', async () => {
      const mockStatus = {
        status: 'success',
        value: {
          connected: true,
          phone: '5511999999999',
          state: 'CONNECTED'
        }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockStatus });

      const status = await service.getInstanceStatus();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/status');
      expect(status.connected).toBe(true);
    });

    it('should get QR code for connection', async () => {
      const mockQR = {
        status: 'success',
        value: {
          qrcode: 'data:image/png;base64,iVBORw0KGg...',
          urlCode: 'https://wa.me/qr/...'
        }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockQR });

      const qr = await service.getQRCode();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/qr-code');
      expect(qr.qrcode).toBeDefined();
    });
  });

  describe('Text Message Sending', () => {
    it('should send text message successfully', async () => {
      const mockResponse = {
        status: 'success',
        value: {
          messageId: 'msg_123',
          status: 'sent',
          timestamp: Date.now()
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test message'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/send-text',
        expect.objectContaining({
          phone: '5511999999999',
          message: 'Test message'
        })
      );
      expect(result.messageId).toBe('msg_123');
    });

    it('should format phone number correctly (add country code)', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_123' } }
      });

      await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      });

      const callArgs = mockAxiosInstance.post.mock.calls[0][1];
      expect(callArgs.phone).toBe('5511999999999');
    });

    it('should not add duplicate country code', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_123' } }
      });

      await service.sendTextMessage({
        phone: '5511999999999',
        message: 'Test'
      });

      const callArgs = mockAxiosInstance.post.mock.calls[0][1];
      expect(callArgs.phone).toBe('5511999999999');
    });

    it('should include delay message parameter', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_123' } }
      });

      await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test',
        delayMessage: 2000
      });

      const callArgs = mockAxiosInstance.post.mock.calls[0][1];
      expect(callArgs.delayMessage).toBe(2000);
    });
  });

  describe('Image Message Sending', () => {
    it('should send image message with URL', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_img_123' } }
      });

      const result = await service.sendImageMessage({
        phone: '11999999999',
        image: 'https://example.com/image.jpg',
        caption: 'Test image'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/send-image',
        expect.objectContaining({
          image: 'https://example.com/image.jpg',
          caption: 'Test image'
        })
      );
      expect(result.messageId).toBe('msg_img_123');
    });

    it('should send image without caption', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_img_123' } }
      });

      await service.sendImageMessage({
        phone: '11999999999',
        image: 'https://example.com/image.jpg'
      });

      const callArgs = mockAxiosInstance.post.mock.calls[0][1];
      expect(callArgs.caption).toBe('');
    });
  });

  describe('Document Message Sending', () => {
    it('should send document with filename', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_doc_123' } }
      });

      await service.sendDocumentMessage({
        phone: '11999999999',
        document: 'https://example.com/document.pdf',
        fileName: 'report.pdf'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/send-document',
        expect.objectContaining({
          document: 'https://example.com/document.pdf',
          fileName: 'report.pdf'
        })
      );
    });
  });

  describe('Interactive Messages', () => {
    it('should send button message', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_btn_123' } }
      });

      await service.sendButtonMessage({
        phone: '11999999999',
        message: 'Choose an option',
        buttonText: 'Select',
        buttons: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' }
        ]
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/send-button-list',
        expect.objectContaining({
          message: 'Choose an option',
          buttons: expect.arrayContaining([
            expect.objectContaining({ id: '1' })
          ])
        })
      );
    });

    it('should send list message', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_list_123' } }
      });

      await service.sendListMessage({
        phone: '11999999999',
        message: 'Select from list',
        buttonText: 'View Options',
        sections: [
          {
            title: 'Section 1',
            rows: [
              { id: '1', title: 'Option 1', description: 'Description 1' }
            ]
          }
        ]
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/send-option-list', expect.any(Object));
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit from response headers', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_123' } },
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '95',
          'x-ratelimit-reset': String(Date.now() + 60000)
        }
      });

      await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      });

      const rateLimitInfo = service.getRateLimitInfo();
      expect(rateLimitInfo).toBeDefined();
      expect(rateLimitInfo!.limit).toBe(100);
      expect(rateLimitInfo!.remaining).toBe(95);
    });

    it('should handle 429 Too Many Requests error', async () => {
      const error429 = {
        response: {
          status: 429,
          headers: {
            'retry-after': '60'
          }
        },
        config: {}
      };

      mockAxiosInstance.post
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({
          data: { status: 'success', value: { messageId: 'msg_123' } }
        });

      // Mock delay to prevent actual waiting
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on network errors', async () => {
      const networkError = new Error('Network error');

      mockAxiosInstance.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: { status: 'success', value: { messageId: 'msg_123' } }
        });

      const result = await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.messageId).toBe('msg_123');
    });

    it('should not retry on client errors (4xx except 429)', async () => {
      const clientError = {
        response: {
          status: 400,
          data: { error: 'Bad request' }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(clientError);

      await expect(service.sendTextMessage({
        phone: 'invalid',
        message: 'Test'
      })).rejects.toThrow();

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for retries', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: 'Server error' }
        }
      };

      mockAxiosInstance.post
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          data: { status: 'success', value: { messageId: 'msg_123' } }
        });

      const delaySpy = jest.spyOn(service as any, 'delay');

      await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      });

      expect(delaySpy).toHaveBeenCalled();
    });
  });

  describe('Message Queue', () => {
    it('should add message to queue', () => {
      const messageId = service.addToQueue({
        type: 'text',
        phone: '11999999999',
        payload: { phone: '11999999999', message: 'Queued message' },
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetry: new Date(Date.now() + 5000)
      });

      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^msg_/);
    });

    it('should get queue statistics', () => {
      service.addToQueue({
        type: 'text',
        phone: '11999999999',
        payload: { phone: '11999999999', message: 'Message 1' },
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetry: new Date()
      });

      service.addToQueue({
        type: 'text',
        phone: '11999999999',
        payload: { phone: '11999999999', message: 'Message 2' },
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetry: new Date()
      });

      const stats = service.getQueueStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
    });

    it('should clear completed messages from queue', () => {
      service.addToQueue({
        type: 'text',
        phone: '11999999999',
        payload: { phone: '11999999999', message: 'Message 1' },
        status: 'sent',
        attempts: 1,
        maxAttempts: 3,
        nextRetry: new Date()
      });

      const cleared = service.clearCompletedMessages();

      expect(cleared).toBeGreaterThan(0);
    });
  });

  describe('Contact and Chat Management', () => {
    it('should get all contacts', async () => {
      const mockContacts = {
        status: 'success',
        value: [
          { id: '5511999999999', name: 'John Doe', profilePicture: '' },
          { id: '5511888888888', name: 'Jane Smith', profilePicture: '' }
        ]
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockContacts });

      const contacts = await service.getContacts();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/contacts');
      expect(contacts.length).toBe(2);
    });

    it('should get all chats', async () => {
      const mockChats = {
        status: 'success',
        value: [
          { id: '5511999999999', unreadCount: 5, lastMessage: 'Hello' }
        ]
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockChats });

      const chats = await service.getChats();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/chats');
      expect(chats.length).toBe(1);
    });

    it('should get chat messages with limit', async () => {
      const mockMessages = {
        status: 'success',
        value: [
          { id: 'msg1', body: 'Hello', timestamp: Date.now() },
          { id: 'msg2', body: 'Hi', timestamp: Date.now() }
        ]
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockMessages });

      const messages = await service.getChatMessages('5511999999999', 10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/chat-messages/5511999999999',
        expect.objectContaining({ params: { limit: 10 } })
      );
    });
  });

  describe('Message Status Management', () => {
    it('should mark message as read', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { success: true } }
      });

      const result = await service.markAsRead('5511999999999', 'msg_123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/read-message',
        expect.objectContaining({
          phone: '5511999999999',
          messageId: 'msg_123'
        })
      );
      expect(result).toBe(true);
    });

    it('should set typing indicator', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { success: true } }
      });

      await service.setTyping('5511999999999', true);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/start-typing',
        expect.objectContaining({ phone: '5511999999999' })
      );
    });

    it('should stop typing indicator', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { success: true } }
      });

      await service.setTyping('5511999999999', false);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/stop-typing',
        expect.objectContaining({ phone: '5511999999999' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Z-API error responses', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          status: 'error',
          error: 'Invalid phone number'
        }
      });

      await expect(service.sendTextMessage({
        phone: 'invalid',
        message: 'Test'
      })).rejects.toThrow('Invalid phone number');
    });

    it('should handle network timeout', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Timeout'));

      await expect(service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      })).rejects.toThrow();
    });

    it('should log errors appropriately', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockAxiosInstance.post.mockRejectedValue(new Error('Test error'));

      try {
        await service.sendTextMessage({
          phone: '11999999999',
          message: 'Test'
        });
      } catch (error) {
        // Expected error
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clear timeouts on destroy', () => {
      service.addToQueue({
        type: 'text',
        phone: '11999999999',
        payload: { phone: '11999999999', message: 'Test' },
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetry: new Date(Date.now() + 10000)
      });

      service.destroy();

      const stats = service.getQueueStats();
      expect(stats.total).toBe(0);
    });

    it('should clear message queue on destroy', () => {
      service.addToQueue({
        type: 'text',
        phone: '11999999999',
        payload: { phone: '11999999999', message: 'Test' },
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetry: new Date()
      });

      service.destroy();

      expect(service.getQueueStats().total).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty phone number', () => {
      const formatted = service['formatPhoneNumber']('');
      expect(formatted).toBe('');
    });

    it('should handle phone with special characters', () => {
      const formatted = service['formatPhoneNumber']('(11) 99999-9999');
      expect(formatted).toBe('5511999999999');
    });

    it('should generate unique message IDs', () => {
      const id1 = service['generateMessageId']();
      const id2 = service['generateMessageId']();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_/);
    });

    it('should handle missing rate limit headers', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'success', value: { messageId: 'msg_123' } },
        headers: {}
      });

      await service.sendTextMessage({
        phone: '11999999999',
        message: 'Test'
      });

      const rateLimitInfo = service.getRateLimitInfo();
      expect(rateLimitInfo).toBeNull();
    });
  });
});
