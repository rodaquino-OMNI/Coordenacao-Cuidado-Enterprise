/**
 * Development Environment Configuration
 * Optimized for local development with minimal external dependencies
 */

export const developmentConfig = {
  nodeEnv: 'development',

  // Logging
  logging: {
    level: 'debug',
    prettyPrint: true,
    includeStackTrace: true,
  },

  // Database
  database: {
    pool: {
      min: 2,
      max: 10,
    },
    debug: true,
  },

  // Redis
  redis: {
    cluster: {
      enabled: false,
    },
    maxRetries: 3,
    retryDelay: 1000,
  },

  // MongoDB
  mongodb: {
    pool: {
      minSize: 2,
      maxSize: 10,
    },
    debug: true,
  },

  // Kafka
  kafka: {
    ssl: false,
    connectionTimeout: 10000,
    requestTimeout: 30000,
    retry: {
      maxRetryTime: 30000,
      initialRetryTime: 300,
      retries: 5,
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 900000, // 15 minutes
    maxRequests: 1000, // More lenient for development
    skipSuccessfulRequests: false,
  },

  // CORS
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
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
    fhirGateway: false, // Disabled by default in dev
    documentOCR: true,
    advancedAnalytics: true,
  },

  // External APIs
  externalApis: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  // WebSocket
  websocket: {
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: '*',
      credentials: true,
    },
  },

  // Health Check
  healthCheck: {
    interval: 30000,
    timeout: 5000,
    enableDetailedChecks: true,
  },

  // Security
  security: {
    bcryptRounds: 10, // Lower rounds for faster development
    jwtAlgorithm: 'HS256',
    enableCSRF: false, // Disabled in development
    rateLimitByIP: false,
  },

  // Cache
  cache: {
    defaultTTL: 300, // 5 minutes
    checkPeriod: 600, // 10 minutes
    maxKeys: 1000,
  },

  // AI/ML
  ai: {
    timeout: 60000,
    maxRetries: 2,
    temperature: 0.7,
    enableCaching: true,
    cacheTTL: 3600,
  },

  // Monitoring
  monitoring: {
    enableMetrics: true,
    enableTracing: false,
    metricsInterval: 10000,
  },
} as const;

export type DevelopmentConfig = typeof developmentConfig;
