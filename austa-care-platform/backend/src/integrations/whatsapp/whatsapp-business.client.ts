/**
 * WhatsApp Business Cloud API Client
 * Official Meta Cloud API implementation with comprehensive error handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { eventPublisher } from '../../infrastructure/kafka/events/event.publisher';
import {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppTextMessage,
  WhatsAppTemplateMessage,
  WhatsAppMediaMessage,
  WhatsAppInteractiveMessage,
  WhatsAppMessageResponse,
  WhatsAppError,
  SendMessageOptions,
  WhatsAppWebhookMessage,
} from './types';

export class WhatsAppBusinessClient {
  private static instance: WhatsAppBusinessClient;
  private client: AxiosInstance;
  private config: WhatsAppConfig;
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly apiVersion: string;

  private constructor(config: WhatsAppConfig) {
    this.config = config;
    this.apiVersion = config.apiVersion || 'v18.0';

    this.client = axios.create({
      baseURL: `${this.baseUrl}/${this.apiVersion}`,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  static getInstance(config?: WhatsAppConfig): WhatsAppBusinessClient {
    if (!WhatsAppBusinessClient.instance && !config) {
      throw new Error('WhatsAppBusinessClient must be initialized with config first');
    }

    if (config) {
      WhatsAppBusinessClient.instance = new WhatsAppBusinessClient(config);
    }

    return WhatsAppBusinessClient.instance;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('WhatsApp API request:', {
          method: config.method,
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error('WhatsApp request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('WhatsApp API response:', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      async (error: AxiosError<WhatsAppError>) => {
        const errorData = error.response?.data?.error;

        logger.error('WhatsApp API error:', {
          status: error.response?.status,
          code: errorData?.code,
          type: errorData?.type,
          message: errorData?.message,
          details: errorData?.error_data?.details,
          fbtrace_id: errorData?.fbtrace_id,
        });

        // Handle specific error codes
        if (error.response?.status === 429) {
          // Rate limit exceeded
          const retryAfter = error.response.headers['retry-after'];
          logger.warn(`WhatsApp rate limit exceeded. Retry after: ${retryAfter}s`);
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * Send a text message
   */
  async sendText(
    to: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppTextMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    return this.sendMessage(message, options);
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    components?: WhatsAppTemplateMessage['template']['components'],
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppTemplateMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    return this.sendMessage(message, options);
  }

  /**
   * Send an image
   */
  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppMediaMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    };

    return this.sendMessage(message, options);
  }

  /**
   * Send a document
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppMediaMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        link: documentUrl,
        filename,
        caption,
      },
    };

    return this.sendMessage(message, options);
  }

  /**
   * Send an audio file
   */
  async sendAudio(
    to: string,
    audioUrl: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppMediaMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: {
        link: audioUrl,
      },
    };

    return this.sendMessage(message, options);
  }

  /**
   * Send a video
   */
  async sendVideo(
    to: string,
    videoUrl: string,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppMediaMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'video',
      video: {
        link: videoUrl,
        caption,
      },
    };

    return this.sendMessage(message, options);
  }

  /**
   * Send an interactive button message
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppInteractiveMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title.substring(0, 20), // Max 20 chars
            },
          })),
        },
      },
    };

    if (headerText) {
      message.interactive.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      message.interactive.footer = {
        text: footerText,
      };
    }

    return this.sendMessage(message, options);
  }

  /**
   * Send an interactive list message
   */
  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>,
    headerText?: string,
    footerText?: string,
    options?: SendMessageOptions
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppInteractiveMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText,
        },
        action: {
          button: buttonText,
          sections,
        },
      },
    };

    if (headerText) {
      message.interactive.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      message.interactive.footer = {
        text: footerText,
      };
    }

    return this.sendMessage(message, options);
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post(`/${this.config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });

      return { success: response.data.success };
    } catch (error) {
      logger.error('Failed to mark message as read:', error);
      throw error;
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      // Get media URL
      const mediaInfo = await this.client.get(`/${mediaId}`);
      const mediaUrl = mediaInfo.data.url;

      // Download media
      const response = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download media:', error);
      throw error;
    }
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(file: Buffer, mimeType: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', new Blob([file], { type: mimeType }));

      const response = await this.client.post(
        `/${this.config.phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data.id;
    } catch (error) {
      logger.error('Failed to upload media:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  /**
   * Handle webhook verification
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      logger.info('Webhook verified successfully');
      return challenge;
    }

    logger.warn('Webhook verification failed');
    return null;
  }

  /**
   * Process webhook message
   */
  async processWebhook(webhook: WhatsAppWebhookMessage): Promise<void> {
    try {
      for (const entry of webhook.entry) {
        for (const change of entry.changes) {
          // Process incoming messages
          if (change.value.messages) {
            for (const message of change.value.messages) {
              await this.handleIncomingMessage(message, change.value.metadata.phone_number_id);
            }
          }

          // Process message status updates
          if (change.value.statuses) {
            for (const status of change.value.statuses) {
              await this.handleMessageStatus(status);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process webhook:', error);
      throw error;
    }
  }

  /**
   * Core message sending method with retry logic
   */
  private async sendMessage(
    message: WhatsAppMessage,
    options: SendMessageOptions = {}
  ): Promise<WhatsAppMessageResponse> {
    const {
      retryAttempts = 3,
      retryDelay = 1000,
      timeout = 30000,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const response = await this.client.post<WhatsAppMessageResponse>(
          `/${this.config.phoneNumberId}/messages`,
          message,
          { timeout }
        );

        // Publish success event
        await eventPublisher.publish({
          eventType: 'whatsapp.message.sent',
          source: 'whatsapp-business-client',
          version: '1.0',
          data: {
            messageId: response.data.messages[0].id,
            recipient: message.to,
            type: message.type,
            timestamp: new Date().toISOString(),
          },
        });

        return response.data;
      } catch (error) {
        lastError = error as Error;

        logger.warn(`WhatsApp send attempt ${attempt}/${retryAttempts} failed:`, {
          error: (error as Error).message,
          recipient: message.to,
        });

        if (attempt < retryAttempts) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    await eventPublisher.publish({
      eventType: 'whatsapp.message.failed',
      source: 'whatsapp-business-client',
      version: '1.0',
      data: {
        recipient: message.to,
        type: message.type,
        error: lastError?.message,
        timestamp: new Date().toISOString(),
      },
    });

    throw lastError;
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: any, phoneNumberId: string): Promise<void> {
    await eventPublisher.publish({
      eventType: 'whatsapp.message.received',
      source: 'whatsapp-business-client',
      version: '1.0',
      data: {
        messageId: message.id,
        from: message.from,
        type: message.type,
        phoneNumberId,
        message,
        timestamp: message.timestamp,
      },
    });

    // Auto-mark as read
    await this.markAsRead(message.id).catch(err =>
      logger.error('Failed to mark message as read:', err)
    );
  }

  /**
   * Handle message status update
   */
  private async handleMessageStatus(status: any): Promise<void> {
    await eventPublisher.publish({
      eventType: 'whatsapp.message.status',
      source: 'whatsapp-business-client',
      version: '1.0',
      data: {
        messageId: status.id,
        status: status.status,
        recipient: status.recipient_id,
        timestamp: status.timestamp,
        errors: status.errors,
      },
    });
  }

  /**
   * Format error for consistent handling
   */
  private formatError(error: AxiosError<WhatsAppError>): Error {
    const errorData = error.response?.data?.error;

    if (errorData) {
      const message = `WhatsApp API Error (${errorData.code}): ${errorData.message}`;
      const formattedError = new Error(message);
      (formattedError as any).code = errorData.code;
      (formattedError as any).type = errorData.type;
      (formattedError as any).fbtrace_id = errorData.fbtrace_id;
      return formattedError;
    }

    return error;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get(`/${this.config.phoneNumberId}`);
      return true;
    } catch (error) {
      logger.error('WhatsApp health check failed:', error);
      return false;
    }
  }
}

// Export singleton getter
export const getWhatsAppClient = (config?: WhatsAppConfig) =>
  WhatsAppBusinessClient.getInstance(config);
