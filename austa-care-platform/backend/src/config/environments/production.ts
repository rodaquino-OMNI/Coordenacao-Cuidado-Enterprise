/**
 * Production Environment Configuration
 * Optimized for performance, security, and reliability
 */

export const productionConfig = {
  nodeEnv: 'production',

  // Logging
  logging: {
    level: 'warn',
    prettyPrint: false,
    includeStackTrace: false,
  },

  // Database
  database: {
    pool: {
      min: 10,
      max: 50,
    },
    debug: false,
  },

  // Redis
  redis: {
    cluster: {
      enabled: true,
    },
    maxRetries: 10,
    retryDelay: 3000,
  },

  // MongoDB
  mongodb: {
    pool: {
      minSize: 10,
      maxSize: 50,
    },
    debug: false,
  },

  // Kafka
  kafka: {
    ssl: true,
    connectionTimeout: 20000,
    requestTimeout: 60000,
    retry: {
      maxRetryTime: 120000,
      initialRetryTime: 1000,
      retries: 10,
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 900000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
  },

  // CORS
  cors: {
    origin: [
      'https://austacare.com',
      'https://www.austacare.com',
      'https://admin.austacare.com',
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
    timeout: 60000,
    retryAttempts: 5,
    retryDelay: 3000,
  },

  // WebSocket
  websocket: {
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: [
        'https://austacare.com',
        'https://www.austacare.com',
      ],
      credentials: true,
    },
  },

  // Health Check
  healthCheck: {
    interval: 60000,
    timeout: 15000,
    enableDetailedChecks: false, // Reduced overhead in production
  },

  // Security
  security: {
    bcryptRounds: 14, // Stronger hashing in production
    jwtAlgorithm: 'HS256',
    enableCSRF: true,
    rateLimitByIP: true,
  },

  // Cache
  cache: {
    defaultTTL: 1800, // 30 minutes
    checkPeriod: 3600, // 60 minutes
    maxKeys: 10000,
  },

  // AI/ML
  ai: {
    timeout: 120000,
    maxRetries: 3,
    temperature: 0.7,
    enableCaching: true,
    cacheTTL: 14400, // 4 hours
  },

  // Monitoring
  monitoring: {
    enableMetrics: true,
    enableTracing: true,
    metricsInterval: 30000,
  },
} as const;

export type ProductionConfig = typeof productionConfig;
