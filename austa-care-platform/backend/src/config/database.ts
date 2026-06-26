/**
 * Prisma Client Singleton
 *
 * AUSTA Care Platform — database access layer.
 * Single PrismaClient instance reused across the entire backend.
 *
 * LGPD compliance: all queries go through this client;
 * connection pooling and query logging configured per environment.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
