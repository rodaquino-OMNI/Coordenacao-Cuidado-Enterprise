// CRITICAL: Load .env.test BEFORE any other imports to ensure environment variables are available
import { config } from 'dotenv';
import * as path from 'path';

// Load test environment variables with absolute path
const result = config({ path: path.resolve(__dirname, '../.env.test') });

if (result.error) {
  console.error('❌ Failed to load .env.test:', result.error);
  throw new Error('Required .env.test file not found');
}

// Verify critical environment variables are loaded
const requiredVars = [
  'ZAPI_INSTANCE_ID',
  'ZAPI_TOKEN',
  'ZAPI_WEBHOOK_SECRET',
  'ZAPI_WEBHOOK_VERIFY_TOKEN',
  'JWT_REFRESH_SECRET',
  'TASY_API_SECRET'
];

const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
}

// NOW import logger which imports config
import { logger } from '@/utils/logger';

// Mock external services during tests
jest.mock('axios');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  })),
}));

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

// Mock WhatsApp Web.js
jest.mock('whatsapp-web.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    destroy: jest.fn(),
    sendMessage: jest.fn(),
    getChats: jest.fn(),
    getContactById: jest.fn(),
    on: jest.fn(),
  })),
  LocalAuth: jest.fn(),
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    appointment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  })),
}));

// Silence logger during tests
beforeAll(() => {
  logger.silent = true;
});

afterAll(() => {
  logger.silent = false;
});

// Global test timeout
jest.setTimeout(30000);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test helpers
global.testHelpers = {
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  }),
  
  createMockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },
  
  createMockNext: () => jest.fn(),
  
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

declare global {
  var testHelpers: {
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
    createMockNext: () => jest.Mock;
    delay: (ms: number) => Promise<void>;
  };
}