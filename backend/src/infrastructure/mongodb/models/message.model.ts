/**
 * Message Model
 * Defines the message data structure for MongoDB
 */

import { ObjectId } from 'mongodb';

/**
 * Message role
 */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  tokens?: number;
  model?: string;
  processingTime?: number;
  confidence?: number;
  sources?: string[];
}

/**
 * Message document structure
 */
export interface MessageDocument {
  _id?: ObjectId;
  conversationId: ObjectId;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

/**
 * Create message input
 */
export interface CreateMessageInput {
  conversationId: string | ObjectId;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
}

/**
 * Update message input
 */
export interface UpdateMessageInput {
  content?: string;
  metadata?: MessageMetadata;
}

/**
 * Message helper functions
 */
export class MessageModel {
  /**
   * Create a new message document
   */
  static create(input: CreateMessageInput): MessageDocument {
    return {
      conversationId: typeof input.conversationId === 'string'
        ? new ObjectId(input.conversationId)
        : input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata,
      timestamp: new Date(),
    };
  }

  /**
   * Update message document
   */
  static update(input: UpdateMessageInput): Partial<MessageDocument> {
    const updates: Partial<MessageDocument> = {
      editedAt: new Date(),
    };

    if (input.content !== undefined) {
      updates.content = input.content;
    }

    if (input.metadata !== undefined) {
      updates.metadata = input.metadata;
    }

    return updates;
  }
}
