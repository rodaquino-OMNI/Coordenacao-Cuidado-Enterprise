/**
 * Test Database Helper
 * Provides utilities for database setup/teardown in tests
 */

import { PrismaClient } from '@prisma/client';

export class TestDatabase {
  private static instance: TestDatabase;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
        }
      }
    });
  }

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async cleanup() {
    // Delete all data in reverse order of dependencies
    const tableNames = [
      'messages',
      'conversations',
      'appointments',
      'health_documents',
      'risk_assessments',
      'questionnaire_responses',
      'users'
    ];

    for (const tableName of tableNames) {
      try {
        await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
      } catch (error) {
        console.error(`Failed to clean table ${tableName}:`, error);
      }
    }
  }

  async reset() {
    await this.cleanup();
  }

  getPrismaClient() {
    return this.prisma;
  }

  async seedTestData() {
    // Add test users
    const testUser = await this.prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        phone: '5511999999999',
        role: 'patient'
      }
    });

    return { testUser };
  }
}
