/**
 * WhatsApp Test Helpers
 * Utilities for creating WhatsApp webhook payloads in tests
 */

import { faker } from '@faker-js/faker';

export class WhatsAppTestHelpers {
  static createWebhookPayload(messageData: {
    from: string;
    messageId?: string;
    content: string;
    type?: 'text' | 'image' | 'document' | 'audio';
    metadata?: any;
  }) {
    const { from, messageId = faker.string.alphanumeric(15), content, type = 'text', metadata = {} } = messageData;
    
    const message: any = {
      from,
      id: messageId,
      timestamp: Date.now().toString(),
      type
    };

    switch (type) {
      case 'text':
        message.text = { body: content };
        break;
      case 'image':
        message.image = {
          id: faker.string.alphanumeric(15),
          mime_type: 'image/jpeg',
          sha256: faker.string.alphanumeric(64),
          caption: content
        };
        break;
      case 'document':
        message.document = {
          id: faker.string.alphanumeric(15),
          mime_type: 'application/pdf',
          sha256: faker.string.alphanumeric(64),
          filename: content,
          caption: content
        };
        break;
      case 'audio':
        message.audio = {
          id: faker.string.alphanumeric(15),
          mime_type: 'audio/ogg',
          sha256: faker.string.alphanumeric(64)
        };
        break;
    }

    return {
      object: 'whatsapp_business_account',
      entry: [{
        id: faker.string.alphanumeric(10),
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: faker.phone.number('##########'),
              phone_number_id: faker.string.alphanumeric(10),
              ...metadata
            },
            messages: [message]
          },
          field: 'messages'
        }]
      }]
    };
  }

  static extractMessageData(webhookPayload: any) {
    const entry = webhookPayload.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    
    return {
      from: message?.from,
      messageId: message?.id,
      timestamp: message?.timestamp,
      type: message?.type,
      content: message?.text?.body || message?.image?.caption || message?.document?.filename || 'media',
      metadata: change?.value?.metadata
    };
  }
}
