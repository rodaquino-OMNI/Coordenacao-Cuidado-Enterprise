/**
 * Document Model
 * Defines the document data structure for MongoDB
 */

import { ObjectId } from 'mongodb';

/**
 * Document processing status
 */
export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  size: number;
  mimeType: string;
  checksum?: string;
  extractedText?: string;
  pageCount?: number;
  processingTime?: number;
}

/**
 * Document structure
 */
export interface DocumentDocument {
  _id?: ObjectId;
  conversationId: ObjectId;
  filename: string;
  storageKey: string;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  uploadedBy: string;
  uploadedAt: Date;
  processedAt?: Date;
  error?: string;
}

/**
 * Create document input
 */
export interface CreateDocumentInput {
  conversationId: string | ObjectId;
  filename: string;
  storageKey: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
}

/**
 * Update document input
 */
export interface UpdateDocumentInput {
  status?: DocumentStatus;
  metadata?: Partial<DocumentMetadata>;
  error?: string;
}

/**
 * Document helper functions
 */
export class DocumentModel {
  /**
   * Create a new document
   */
  static create(input: CreateDocumentInput): DocumentDocument {
    return {
      conversationId: typeof input.conversationId === 'string'
        ? new ObjectId(input.conversationId)
        : input.conversationId,
      filename: input.filename,
      storageKey: input.storageKey,
      status: DocumentStatus.PENDING,
      metadata: {
        size: input.size,
        mimeType: input.mimeType,
      },
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date(),
    };
  }

  /**
   * Update document
   */
  static update(existing: DocumentDocument, input: UpdateDocumentInput): Partial<DocumentDocument> {
    const updates: Partial<DocumentDocument> = {};

    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === DocumentStatus.COMPLETED || input.status === DocumentStatus.FAILED) {
        updates.processedAt = new Date();
      }
    }

    if (input.metadata !== undefined) {
      updates.metadata = {
        ...existing.metadata,
        ...input.metadata,
      };
    }

    if (input.error !== undefined) {
      updates.error = input.error;
    }

    return updates;
  }
}
