/**
 * Prisma Client Singleton
 * Global database client for the AUSTA Care Platform
 */

import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// PrismaClient is attached to the global object in development to prevent
// exhausting database connection limit during hot reloading.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.nodeEnv === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
  } catch (error) {
    logger.error('Failed to disconnect Prisma client', { error });
  }
}
