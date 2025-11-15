/**
 * Staging Environment Configuration
 * Production-like environment for testing before release
 */

export const stagingConfig = {
  nodeEnv: 'staging',

  // Logging
  logging: {
    level: 'info',
    prettyPrint: false,
    includeStackTrace: true,
  },

  // Database
  database: {
    pool: {
      min: 5,
      max: 20,
    },
    debug: false,
  },

  // Redis
  redis: {
    cluster: {
      enabled: true,
    },
    maxRetries: 5,
    retryDelay: 2000,
  },

  // MongoDB
  mongodb: {
    pool: {
      minSize: 5,
      maxSize: 20,
    },
    debug: false,
  },

  // Kafka
  kafka: {
    ssl: true,
    connectionTimeout: 15000,
    requestTimeout: 45000,
    retry: {
      maxRetryTime: 60000,
      initialRetryTime: 500,
      retries: 8,
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 900000, // 15 minutes
    maxRequests: 200,
    skipSuccessfulRequests: false,
  },

  // CORS
  cors: {
    origin: [
      'https://staging.austacare.com',
      'https://staging-admin.austacare.com',
    ],
    credentials: true,
  },

  // File Upload
  upload: {
    maxFileSize: 10485760, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },

  // Feature Flags
  features: {
    gamification: true,
    mlModels: true,
    fhirGateway: true,
    documentOCR: true,
    advancedAnalytics: true,
  },

  // External APIs
  externalApis: {
    timeout: 45000,
    retryAttempts: 3,
    retryDelay: 2000,
  },

  // WebSocket
  websocket: {
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: ['https://staging.austacare.com'],
      credentials: true,
    },
  },

  // Health Check
  healthCheck: {
    interval: 30000,
    timeout: 10000,
    enableDetailedChecks: true,
  },

  // Security
  security: {
    bcryptRounds: 12,
    jwtAlgorithm: 'HS256',
    enableCSRF: true,
    rateLimitByIP: true,
  },

  // Cache
  cache: {
    defaultTTL: 600, // 10 minutes
    checkPeriod: 1200, // 20 minutes
    maxKeys: 5000,
  },

  // AI/ML
  ai: {
    timeout: 90000,
    maxRetries: 3,
    temperature: 0.7,
    enableCaching: true,
    cacheTTL: 7200,
  },

  // Monitoring
  monitoring: {
    enableMetrics: true,
    enableTracing: true,
    metricsInterval: 15000,
  },
} as const;

export type StagingConfig = typeof stagingConfig;
