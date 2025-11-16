/**
 * Conversation Model
 * Defines the conversation data structure for MongoDB
 */

import { ObjectId } from 'mongodb';

/**
 * Conversation status
 */
export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

/**
 * Conversation metadata
 */
export interface ConversationMetadata {
  messageCount: number;
  lastMessageAt?: Date;
  participantCount: number;
  tags?: string[];
  category?: string;
}

/**
 * Conversation document structure
 */
export interface ConversationDocument {
  _id?: ObjectId;
  userId: string;
  title: string;
  status: ConversationStatus;
  metadata: ConversationMetadata;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  deletedAt?: Date;
}

/**
 * Create conversation input
 */
export interface CreateConversationInput {
  userId: string;
  title: string;
  tags?: string[];
  category?: string;
}

/**
 * Update conversation input
 */
export interface UpdateConversationInput {
  title?: string;
  status?: ConversationStatus;
  tags?: string[];
  category?: string;
}

/**
 * Conversation helper functions
 */
export class ConversationModel {
  /**
   * Create a new conversation document
   */
  static create(input: CreateConversationInput): ConversationDocument {
    return {
      userId: input.userId,
      title: input.title,
      status: ConversationStatus.ACTIVE,
      metadata: {
        messageCount: 0,
        participantCount: 1,
        tags: input.tags,
        category: input.category,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update conversation document
   */
  static update(existing: ConversationDocument, input: UpdateConversationInput): Partial<ConversationDocument> {
    const updates: Partial<ConversationDocument> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updates.title = input.title;
    }

    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === ConversationStatus.ARCHIVED) {
        updates.archivedAt = new Date();
      }
      if (input.status === ConversationStatus.DELETED) {
        updates.deletedAt = new Date();
      }
    }

    if (input.tags !== undefined || input.category !== undefined) {
      updates.metadata = {
        ...existing.metadata,
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.category !== undefined && { category: input.category }),
      };
    }

    return updates;
  }
}
