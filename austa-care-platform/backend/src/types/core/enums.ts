/**
 * Shared Enum Constants
 * Re-exports Prisma enums for consistent usage across validation, events, and business logic
 *
 * @module types/core/enums
 * @description Centralized enum definitions from Prisma schema for type-safe usage
 * across the application including event schemas, validation, and business logic.
 */

import {
  CommunicationChannel,
  MessageContentType,
  MessageDirection,
  MessageStatus,
  ConversationStatus,
  UserRole,
  UserStatus,
  HealthDataType,
  MissionType,
  MissionCategory,
  MissionDifficulty,
  MissionStatus,
  PointTransactionType
} from '@prisma/client';

/**
 * Communication Channel Enum
 * Supported communication channels in the platform
 * @enum {string}
 */
export { CommunicationChannel };

/**
 * Message Content Type Enum
 * Types of content that can be sent in messages
 * @enum {string}
 */
export { MessageContentType };

/**
 * Message Direction Enum
 * Direction of message flow (inbound/outbound)
 * @enum {string}
 */
export { MessageDirection };

/**
 * Message Status Enum
 * Current status of a message in its lifecycle
 * @enum {string}
 */
export { MessageStatus };

/**
 * Conversation Status Enum
 * Current status of a conversation
 * @enum {string}
 */
export { ConversationStatus };

/**
 * User Role Enum
 * Available user roles in the system
 * @enum {string}
 */
export { UserRole };

/**
 * User Status Enum
 * Current status of a user account
 * @enum {string}
 */
export { UserStatus };

/**
 * Health Data Type Enum
 * Types of health data that can be collected
 * @enum {string}
 */
export { HealthDataType };

/**
 * Mission Type Enum
 * Types of missions available in gamification
 * @enum {string}
 */
export { MissionType };

/**
 * Mission Category Enum
 * Categories for organizing missions
 * @enum {string}
 */
export { MissionCategory };

/**
 * Mission Difficulty Enum
 * Difficulty levels for missions
 * @enum {string}
 */
export { MissionDifficulty };

/**
 * Mission Status Enum
 * Current status of a mission
 * @enum {string}
 */
export { MissionStatus };

/**
 * Point Transaction Type Enum
 * Types of point transactions in gamification
 * @enum {string}
 */
export { PointTransactionType };

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
 * import { MessageContentType, prismaEnumToZod } from './enums';
 *
 * const messageSchema = z.object({
 *   contentType: z.enum(prismaEnumToZod(MessageContentType))
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
