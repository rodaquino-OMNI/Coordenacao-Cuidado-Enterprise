/**
 * Webhook Processor Service
 * Handles incoming Z-API webhook events and processes them accordingly
 */

import { logger } from '@/utils/logger';
import { whatsappService } from './whatsapp.service';
import {
  ZAPIWebhookPayload,
  WebhookEventType,
  WebhookEvent,
  MessageStatus,
} from '@/types/whatsapp';
import { EventEmitter } from 'events';
import { prisma } from '../config/database';
import { CommunicationChannel } from '@prisma/client';
import { ConversationFlowEngine } from './conversationFlowEngine';
import { PersonaType } from '../types/ai';

/**
 * Webhook Processor Service
 */
export class WebhookProcessorService extends EventEmitter {
  private messageHandlers: Map<string, (payload: ZAPIWebhookPayload) => Promise<void>> = new Map();
  private statusHandlers: Map<string, (payload: ZAPIWebhookPayload) => Promise<void>> = new Map();
  private conversationFlow: ConversationFlowEngine;

  constructor() {
    super();
    this.conversationFlow = new ConversationFlowEngine();
    this.setupDefaultHandlers();
  }

  /**
   * Setup default message and status handlers
   */
  private setupDefaultHandlers(): void {
    // Text message handler
    this.messageHandlers.set('text', this.handleTextMessage.bind(this));
    
    // Image message handler
    this.messageHandlers.set('image', this.handleImageMessage.bind(this));
    
    // Document message handler
    this.messageHandlers.set('document', this.handleDocumentMessage.bind(this));
    
    // Audio message handler
    this.messageHandlers.set('audio', this.handleAudioMessage.bind(this));
    
    // Video message handler
    this.messageHandlers.set('video', this.handleVideoMessage.bind(this));
    
    // Location message handler
    this.messageHandlers.set('location', this.handleLocationMessage.bind(this));
    
    // Contact message handler
    this.messageHandlers.set('contact', this.handleContactMessage.bind(this));
    
    // Button response handler
    this.messageHandlers.set('buttonsResponseMessage', this.handleButtonResponse.bind(this));
    
    // List response handler
    this.messageHandlers.set('listResponseMessage', this.handleListResponse.bind(this));

    // Status handlers
    this.statusHandlers.set('DeliveryCallback', this.handleDeliveryStatus.bind(this));
    this.statusHandlers.set('ReadCallback', this.handleReadStatus.bind(this));
  }

  /**
   * Process incoming webhook payload
   */
  async processWebhook(payload: ZAPIWebhookPayload): Promise<void> {
    try {
      logger.info('Processing webhook payload', {
        type: payload.type,
        instanceId: payload.instanceId,
        phone: payload.phone,
        fromMe: payload.fromMe,
        messageId: payload.messageId,
      });

      // Create webhook event
      const event: WebhookEvent = {
        type: this.mapToEventType(payload),
        instanceId: payload.instanceId,
        timestamp: payload.momment || Date.now(),
        data: payload,
      };

      // Emit the event for external listeners
      this.emit('webhook.received', event);

      // Process based on callback type
      if (payload.type === 'ReceivedCallback' && !payload.fromMe) {
        await this.processIncomingMessage(payload);
      } else if (payload.type === 'DeliveryCallback' || payload.type === 'ReadCallback') {
        await this.processStatusUpdate(payload);
      }

      // Emit processed event
      this.emit('webhook.processed', event);

      logger.debug('Webhook processed successfully', {
        type: payload.type,
        messageId: payload.messageId,
      });
    } catch (error) {
      logger.error('Webhook processing error', {
        error: (error as Error).message,
        payload: this.sanitizePayload(payload),
      });
      
      // Emit error event
      this.emit('webhook.error', {
        error: error as Error,
        payload,
      });
      
      throw error;
    }
  }

  /**
   * Process incoming messages
   */
  private async processIncomingMessage(payload: ZAPIWebhookPayload): Promise<void> {
    // Determine message type
    const messageType = this.getMessageType(payload);
    
    // Get appropriate handler
    const handler = this.messageHandlers.get(messageType);
    
    if (handler) {
      await handler(payload);
    } else {
      logger.warn('No handler found for message type', { messageType });
      await this.handleUnknownMessage(payload);
    }

    // Mark message as read (optional)
    if (payload.phone && payload.messageId) {
      try {
        await whatsappService.markAsRead(payload.phone, payload.messageId);
      } catch (error) {
        logger.warn('Failed to mark message as read', {
          phone: payload.phone,
          messageId: payload.messageId,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Process status updates
   */
  private async processStatusUpdate(payload: ZAPIWebhookPayload): Promise<void> {
    const handler = this.statusHandlers.get(payload.type);
    
    if (handler) {
      await handler(payload);
    } else {
      logger.warn('No handler found for status type', { type: payload.type });
    }
  }

  /**
   * Handle text messages
   */
  private async handleTextMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const message = payload.text?.message;
    
    if (!message) {
      logger.warn('Text message without content', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received text message', {
      phone: payload.phone.substring(0, 5) + '***',
      senderName: payload.senderName,
      messageLength: message.length,
      messagePreview: message.substring(0, 100),
    });

    // Emit text message event (for external listeners)
    this.emit('message.text', {
      phone: payload.phone,
      senderName: payload.senderName,
      message,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });

    // Persist conversation + message, then auto-reply
    try {
      const { userId, organizationId } = await this.findOrCreateUserByPhone(payload.phone, payload.senderName);
      const conversationId = await this.findOrCreateConversation(payload.phone, userId, organizationId);
      await this.persistInboundMessage(payload, conversationId, userId);
      await this.processAIReply(payload, message, conversationId, userId);
    } catch (error) {
      logger.error('Failed to persist message or send auto-reply', {
        phone: payload.phone.substring(0, 5) + '***',
        error: (error as Error).message,
      });
      // Fallback to simple greeting auto-reply
      await this.processAutoReply(payload, message);
    }
  }

  /**
   * Handle image messages
   */
  private async handleImageMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const image = payload.image;
    
    if (!image) {
      logger.warn('Image message without image data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received image message', {
      phone: payload.phone.substring(0, 5) + '***',
      senderName: payload.senderName,
      imageUrl: image.imageUrl,
      caption: image.caption,
      mimeType: image.mimeType,
    });

    // Emit image message event
    this.emit('message.image', {
      phone: payload.phone,
      senderName: payload.senderName,
      imageUrl: image.imageUrl,
      caption: image.caption,
      mimeType: image.mimeType,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });

    // Persist message
    try {
      const { userId, organizationId } = await this.findOrCreateUserByPhone(payload.phone, payload.senderName);
      const conversationId = await this.findOrCreateConversation(payload.phone, userId, organizationId);
      await this.persistInboundMessage(payload, conversationId, userId);
    } catch (error) {
      logger.error('Failed to persist image message', {
        phone: payload.phone.substring(0, 5) + '***',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle document messages
   */
  private async handleDocumentMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const document = payload.document;
    
    if (!document) {
      logger.warn('Document message without document data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received document message', {
      phone: payload.phone.substring(0, 5) + '***',
      senderName: payload.senderName,
      fileName: document.fileName,
      documentUrl: document.documentUrl,
      mimeType: document.mimeType,
    });

    // Emit document message event
    this.emit('message.document', {
      phone: payload.phone,
      senderName: payload.senderName,
      fileName: document.fileName,
      documentUrl: document.documentUrl,
      mimeType: document.mimeType,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });

    // Persist message
    try {
      const { userId, organizationId } = await this.findOrCreateUserByPhone(payload.phone, payload.senderName);
      const conversationId = await this.findOrCreateConversation(payload.phone, userId, organizationId);
      await this.persistInboundMessage(payload, conversationId, userId);
    } catch (error) {
      logger.error('Failed to persist document message', {
        phone: payload.phone.substring(0, 5) + '***',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle audio messages
   */
  private async handleAudioMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const audio = payload.audio;
    
    if (!audio) {
      logger.warn('Audio message without audio data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received audio message', {
      phone: payload.phone,
      senderName: payload.senderName,
      audioUrl: audio.audioUrl,
      mimeType: audio.mimeType,
    });

    // Emit audio message event
    this.emit('message.audio', {
      phone: payload.phone,
      senderName: payload.senderName,
      audioUrl: audio.audioUrl,
      mimeType: audio.mimeType,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle video messages
   */
  private async handleVideoMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const video = payload.video;
    
    if (!video) {
      logger.warn('Video message without video data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received video message', {
      phone: payload.phone,
      senderName: payload.senderName,
      videoUrl: video.videoUrl,
      caption: video.caption,
      mimeType: video.mimeType,
    });

    // Emit video message event
    this.emit('message.video', {
      phone: payload.phone,
      senderName: payload.senderName,
      videoUrl: video.videoUrl,
      caption: video.caption,
      mimeType: video.mimeType,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle location messages
   */
  private async handleLocationMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const location = payload.location;
    
    if (!location) {
      logger.warn('Location message without location data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received location message', {
      phone: payload.phone,
      senderName: payload.senderName,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
    });

    // Emit location message event
    this.emit('message.location', {
      phone: payload.phone,
      senderName: payload.senderName,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle contact messages
   */
  private async handleContactMessage(payload: ZAPIWebhookPayload): Promise<void> {
    const contact = payload.contact;
    
    if (!contact) {
      logger.warn('Contact message without contact data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received contact message', {
      phone: payload.phone,
      senderName: payload.senderName,
      contactName: contact.displayName,
    });

    // Emit contact message event
    this.emit('message.contact', {
      phone: payload.phone,
      senderName: payload.senderName,
      contactName: contact.displayName,
      vcard: contact.vcard,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle button responses
   */
  private async handleButtonResponse(payload: ZAPIWebhookPayload): Promise<void> {
    const buttonResponse = payload.buttonsResponseMessage;
    
    if (!buttonResponse) {
      logger.warn('Button response without data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received button response', {
      phone: payload.phone,
      senderName: payload.senderName,
      buttonId: buttonResponse.selectedButtonId,
      buttonText: buttonResponse.selectedButtonText,
    });

    // Emit button response event
    this.emit('message.button_response', {
      phone: payload.phone,
      senderName: payload.senderName,
      buttonId: buttonResponse.selectedButtonId,
      buttonText: buttonResponse.selectedButtonText,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle list responses
   */
  private async handleListResponse(payload: ZAPIWebhookPayload): Promise<void> {
    const listResponse = payload.listResponseMessage;
    
    if (!listResponse) {
      logger.warn('List response without data', { payload: this.sanitizePayload(payload) });
      return;
    }

    logger.info('Received list response', {
      phone: payload.phone,
      senderName: payload.senderName,
      selectedRowId: listResponse.singleSelectReply.selectedRowId,
      title: listResponse.singleSelectReply.title,
    });

    // Emit list response event
    this.emit('message.list_response', {
      phone: payload.phone,
      senderName: payload.senderName,
      selectedRowId: listResponse.singleSelectReply.selectedRowId,
      title: listResponse.singleSelectReply.title,
      description: listResponse.singleSelectReply.description,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle unknown message types
   */
  private async handleUnknownMessage(payload: ZAPIWebhookPayload): Promise<void> {
    logger.info('Received unknown message type', {
      phone: payload.phone,
      senderName: payload.senderName,
      payload: this.sanitizePayload(payload),
    });

    // Emit unknown message event
    this.emit('message.unknown', {
      phone: payload.phone,
      senderName: payload.senderName,
      payload,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });
  }

  /**
   * Handle delivery status updates
   */
  private async handleDeliveryStatus(payload: ZAPIWebhookPayload): Promise<void> {
    logger.info('Message delivered', {
      phone: payload.phone,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });

    const status: MessageStatus = {
      messageId: payload.messageId,
      phone: payload.phone,
      status: 'delivered',
      timestamp: payload.momment || Date.now(),
    };

    // Emit delivery status event
    this.emit('message.status.delivered', status);
  }

  /**
   * Handle read status updates
   */
  private async handleReadStatus(payload: ZAPIWebhookPayload): Promise<void> {
    logger.info('Message read', {
      phone: payload.phone,
      messageId: payload.messageId,
      timestamp: payload.momment,
    });

    const status: MessageStatus = {
      messageId: payload.messageId,
      phone: payload.phone,
      status: 'read',
      timestamp: payload.momment || Date.now(),
    };

    // Emit read status event
    this.emit('message.status.read', status);
  }

  /**
   * Find or create a user by phone number (WhatsApp primary identifier).
   * If user does not exist, creates a minimal user assigned to the first active organization.
   */
  private async findOrCreateUserByPhone(
    phone: string,
    senderName?: string,
  ): Promise<{ userId: string; organizationId: string }> {
    // Find existing user by phone
    let user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, organizationId: true },
    });

    if (user) {
      return { userId: user.id, organizationId: user.organizationId };
    }

    // Find or create a default organization for WhatsApp users
    let organization = await prisma.organization.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!organization) {
      // Create a default organization if none exists
      organization = await prisma.organization.create({
        data: {
          name: 'AUSTA Care - WhatsApp Users',
          type: 'HEALTH_CENTER',
          isActive: true,
          lgpdCompliant: true,
          dataRetentionYears: 7,
        },
        select: { id: true },
      });
      logger.info('Created default organization for WhatsApp users', { orgId: organization.id });
    }

    // Parse sender name into first/last name
    const nameParts = (senderName || 'WhatsApp User').split(' ');
    const firstName = nameParts[0] || 'WhatsApp';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        phone,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        organizationId: organization.id,
        preferredLanguage: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        isActive: true,
        isVerified: false,
        onboardingComplete: false,
      },
      select: { id: true, organizationId: true },
    });

    logger.info('Created new user from WhatsApp message', {
      userId: newUser.id,
      phone: phone.substring(0, 5) + '***',
      orgId: newUser.organizationId,
    });

    return { userId: newUser.id, organizationId: newUser.organizationId };
  }

  /**
   * Find or create a Conversation for a WhatsApp chat.
   * Uses whatsappChatId (phone number) as the unique identifier.
   */
  private async findOrCreateConversation(
    phone: string,
    userId: string,
    organizationId: string,
  ): Promise<string> {
    // Try to find existing active conversation
    const existing = await prisma.conversation.findUnique({
      where: { whatsappChatId: phone },
      select: { id: true, status: true },
    });

    if (existing) {
      // If conversation exists but is not active, reactivate it
      if (existing.status !== 'ACTIVE') {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', lastMessageAt: new Date() },
        });
      }
      return existing.id;
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        whatsappChatId: phone,
        userId,
        organizationId,
        channel: CommunicationChannel.WHATSAPP,
        status: 'ACTIVE',
        type: 'SUPPORT',
        priority: 'NORMAL',
        botEnabled: true,
        startedAt: new Date(),
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });

    logger.info('Created new WhatsApp conversation', {
      conversationId: conversation.id,
      phone: phone.substring(0, 5) + '***',
      userId,
    });

    return conversation.id;
  }

  /**
   * Persist an inbound WhatsApp message to the database.
   * Uses upsert to ensure idempotency based on whatsappMessageId.
   */
  private async persistInboundMessage(
    payload: ZAPIWebhookPayload,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const content = payload.text?.message
      || payload.image?.caption
      || payload.document?.fileName
      || JSON.stringify(payload);

    const contentType = this.getMessageType(payload).toUpperCase();

    await prisma.message.upsert({
      where: { whatsappMessageId: payload.messageId },
      create: {
        whatsappMessageId: payload.messageId,
        conversationId,
        userId,
        direction: 'INBOUND',
        type: contentType as any,
        content,
        metadata: { raw: payload } as any,
        status: 'DELIVERED',
        sentAt: new Date(payload.momment || Date.now()),
      },
      update: {
        // If already exists, update status (e.g., delivered confirmation)
        status: 'DELIVERED',
      },
    });

    // Update conversation's lastMessageAt and messageCount
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    logger.info('Persisted inbound WhatsApp message', {
      conversationId,
      messageId: payload.messageId,
      contentType,
    });
  }

  /**
   * Process message through AI conversation flow and send reply.
   * Falls back to a simple auto-reply if AI processing fails.
   */
  private async processAIReply(
    payload: ZAPIWebhookPayload,
    message: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    let responseText: string;

    try {
      // Determine persona based on sender name (simplistic — can be improved)
      const persona: PersonaType = 'ana';

      // Process through conversation flow engine
      const flowResult = await this.conversationFlow.processMessage(
        userId,
        message,
        persona,
        conversationId,
      );

      responseText = flowResult.response;

      logger.info('AI response generated', {
        conversationId,
        nextNode: flowResult.nextNode.id,
        depth: flowResult.nextNode.depth,
        riskLevel: flowResult.state.riskAssessment.urgencyLevel,
      });
    } catch (aiError) {
      logger.warn('AI processing failed, using fallback', {
        conversationId,
        error: (aiError as Error).message,
      });
      // Fallback: simple greeting detection
      responseText = this.getFallbackResponse(message, payload.senderName);
    }

    // Send reply via WhatsApp
    try {
      await whatsappService.sendTextMessage({
        phone: payload.phone,
        message: responseText,
      });

      // Persist outbound message
      await prisma.message.create({
        data: {
          conversationId,
          userId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: responseText,
          isBot: true,
          botResponseTime: 0,
          status: 'DELIVERED',
          sentAt: new Date(),
        },
      });

      // Update conversation lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
          lastBotResponse: new Date(),
        },
      });

      logger.info('Auto-reply sent and persisted', {
        conversationId,
        responseLength: responseText.length,
      });
    } catch (sendError) {
      logger.error('Failed to send auto-reply via WhatsApp', {
        conversationId,
        phone: payload.phone.substring(0, 5) + '***',
        error: (sendError as Error).message,
      });
    }
  }

  /**
   * Simple fallback response when AI is unavailable.
   */
  private getFallbackResponse(message: string, senderName?: string): string {
    const lowerMessage = message.toLowerCase().trim();

    if (lowerMessage.includes('oi') || lowerMessage.includes('olá') || lowerMessage.includes('ola')) {
      return `Olá ${senderName || ''}! 👋\n\nSou a assistente virtual da AUSTA Care. Como posso ajudá-lo hoje?\n\n🩺 Consultas\n📅 Agendamentos\n💊 Medicamentos\n🏥 Emergência\n\nEnvie uma das opções acima ou descreva sua necessidade.`;
    }

    if (lowerMessage.includes('emergência') || lowerMessage.includes('socorro') || lowerMessage.includes('urgente')) {
      return '🚨 Se esta é uma emergência médica, ligue imediatamente para 192 (SAMU) ou dirija-se ao pronto-socorro mais próximo.\n\nSe precisar de ajuda não urgente, estou aqui para ajudar.';
    }

    return `Olá ${senderName || ''}! Recebi sua mensagem. Um de nossos atendentes analisará seu caso em breve. Enquanto isso, você pode me dizer mais sobre o que precisa?`;
  }

  /**
   * Process auto-reply logic (legacy fallback)
   */
  private async processAutoReply(payload: ZAPIWebhookPayload, message: string): Promise<void> {
    // Simple auto-reply logic - can be expanded
    const lowerMessage = message.toLowerCase().trim();
    
    // Welcome message for new conversations
    if (lowerMessage.includes('oi') || lowerMessage.includes('olá') || lowerMessage.includes('ola')) {
      try {
        await whatsappService.sendTextMessage({
          phone: payload.phone,
          message: `Olá ${payload.senderName}! 👋\n\nSou a assistente virtual da AUSTA Care. Como posso ajudá-lo hoje?\n\n🩺 Consultas\n📅 Agendamentos\n💊 Medicamentos\n🏥 Emergência\n\nEnvie uma das opções acima ou descreva sua necessidade.`,
        });
      } catch (error) {
        logger.error('Failed to send auto-reply', {
          phone: payload.phone,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get message type from payload
   */
  private getMessageType(payload: ZAPIWebhookPayload): string {
    if (payload.text) return 'text';
    if (payload.image) return 'image';
    if (payload.document) return 'document';
    if (payload.audio) return 'audio';
    if (payload.video) return 'video';
    if (payload.location) return 'location';
    if (payload.contact) return 'contact';
    if (payload.buttonsResponseMessage) return 'buttonsResponseMessage';
    if (payload.listResponseMessage) return 'listResponseMessage';
    
    return 'unknown';
  }

  /**
   * Map payload type to event type
   */
  private mapToEventType(payload: ZAPIWebhookPayload): WebhookEventType {
    switch (payload.type) {
      case 'ReceivedCallback':
        return 'message.received';
      case 'DeliveryCallback':
        return 'message.delivered';
      case 'ReadCallback':
        return 'message.read';
      default:
        return 'message.received';
    }
  }

  /**
   * Sanitize payload for logging (remove sensitive data)
   */
  private sanitizePayload(payload: ZAPIWebhookPayload): Partial<ZAPIWebhookPayload> {
    const { senderPhoto, photo, ...sanitized } = payload;
    return sanitized;
  }

  /**
   * Register custom message handler
   */
  registerMessageHandler(messageType: string, handler: (payload: ZAPIWebhookPayload) => Promise<void>): void {
    this.messageHandlers.set(messageType, handler);
    logger.info('Registered custom message handler', { messageType });
  }

  /**
   * Register custom status handler
   */
  registerStatusHandler(statusType: string, handler: (payload: ZAPIWebhookPayload) => Promise<void>): void {
    this.statusHandlers.set(statusType, handler);
    logger.info('Registered custom status handler', { statusType });
  }

  /**
   * Remove message handler
   */
  removeMessageHandler(messageType: string): boolean {
    const removed = this.messageHandlers.delete(messageType);
    if (removed) {
      logger.info('Removed message handler', { messageType });
    }
    return removed;
  }

  /**
   * Remove status handler
   */
  removeStatusHandler(statusType: string): boolean {
    const removed = this.statusHandlers.delete(statusType);
    if (removed) {
      logger.info('Removed status handler', { statusType });
    }
    return removed;
  }

  /**
   * Get registered handlers info
   */
  getHandlersInfo(): { messageHandlers: string[]; statusHandlers: string[] } {
    return {
      messageHandlers: Array.from(this.messageHandlers.keys()),
      statusHandlers: Array.from(this.statusHandlers.keys()),
    };
  }
}

// Create singleton instance
export const webhookProcessor = new WebhookProcessorService();