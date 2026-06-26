/**
 * Shared Enum Constants
 * Re-exports Prisma enums for consistent usage across validation, events, and business logic
 *
 * @module types/core/enums
 * @description Centralized enum definitions from Prisma schema for type-safe usage
 * across the application including event schemas, validation, and business logic.
 */

import {
  MessageDirection,
  MessageStatus,
  ConversationStatus,
  UserRole,
  UserStatus,
  HealthDataType,
  MissionCategory,
  DifficultyLevel,
  ProgressStatus,
  TransactionType,
  MessageType
} from '@prisma/client';

// Re-exports for convenience
export { MessageType, MessageDirection, MessageStatus };
export { ConversationStatus, UserRole, UserStatus };
export { HealthDataType, MissionCategory, DifficultyLevel, ProgressStatus, TransactionType };

/**
 * Mission Difficulty Enum (alias for DifficultyLevel)
 */
export { DifficultyLevel as MissionDifficulty };

/**
 * Mission Status Enum (alias for ProgressStatus)
 */
export { ProgressStatus as MissionStatus };

/**
 * Point Transaction Type Enum (alias for TransactionType)
 */
export { TransactionType as PointTransactionType };

/**
 * Message Content Type Enum (alias for MessageType)
 */
export { MessageType as MessageContentType };

/**
 * Helper to convert Prisma enum to Zod enum format
 *
 * Prisma enums are objects with string keys and values, but Zod enums
 * require a tuple format: [first, ...rest]. This helper performs the conversion.
 *
 * @template T - The Prisma enum type
 * @param {T} prismaEnum - The Prisma enum object to convert
 * @returns {[string, ...string[]]} A tuple suitable for z.enum()
 *
 * @example
 * import { z } from 'zod';
 * import { MessageType, prismaEnumToZod } from './enums';
 *
 * const messageSchema = z.object({
 *   contentType: z.enum(prismaEnumToZod(MessageType))
 * });
 */
export const prismaEnumToZod = <T extends Record<string, string>>(
  prismaEnum: T
): [string, ...string[]] => {
  const values = Object.values(prismaEnum);
  if (values.length === 0) {
    throw new Error('Prisma enum must have at least one value');
  }
  return [values[0], ...values.slice(1)] as [string, ...string[]];
};

// Aliases for backward compatibility with code that expects these names
// (these are NOT in the Prisma schema — use the schema's native enums instead)
export const CommunicationChannel = {
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
  VOICE: 'VOICE',
  WEB: 'WEB',
  MOBILE: 'MOBILE',
  TELEGRAM: 'TELEGRAM',
} as const;
export type CommunicationChannel = (typeof CommunicationChannel)[keyof typeof CommunicationChannel];
