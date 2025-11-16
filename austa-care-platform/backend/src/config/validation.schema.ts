/**
 * Configuration Validation Schemas
 * Joi schemas for validating environment variables and configuration
 */

import * as Joi from 'joi';

/**
 * Base environment schema
 */
const baseEnvSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development')
    .description('Application environment'),

  PORT: Joi.number()
    .port()
    .default(3000)
    .description('Server port number'),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Logging level'),

  // Database - PostgreSQL (Prisma)
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required()
    .description('PostgreSQL connection URL'),

  // MongoDB
  MONGODB_URI: Joi.string()
    .uri({ scheme: 'mongodb' })
    .default('mongodb://localhost:27017')
    .description('MongoDB connection URI'),

  MONGODB_DATABASE: Joi.string()
    .default('austa_care')
    .description('MongoDB database name'),

  // Redis Cluster
  REDIS_CLUSTER_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable Redis cluster mode'),

  REDIS_CLUSTER_NODES: Joi.string()
    .when('REDIS_CLUSTER_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .pattern(/^([a-zA-Z0-9.-]+:\d+)(,[a-zA-Z0-9.-]+:\d+)*$/)
    .description('Redis cluster nodes (comma-separated host:port)'),

  REDIS_URL: Joi.string()
    .uri({ scheme: 'redis' })
    .when('REDIS_CLUSTER_ENABLED', {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .description('Redis standalone connection URL'),

  // Kafka
  KAFKA_BROKERS: Joi.string()
    .required()
    .pattern(/^([a-zA-Z0-9.-]+:\d+)(,[a-zA-Z0-9.-]+:\d+)*$/)
    .description('Kafka broker addresses (comma-separated)'),

  KAFKA_CLIENT_ID: Joi.string()
    .default('austa-care-platform')
    .description('Kafka client identifier'),

  KAFKA_SSL_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable Kafka SSL/TLS'),

  KAFKA_SASL_USERNAME: Joi.string()
    .when('KAFKA_SSL_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .description('Kafka SASL username'),

  KAFKA_SASL_PASSWORD: Joi.string()
    .when('KAFKA_SSL_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .description('Kafka SASL password'),

  // WhatsApp Z-API
  ZAPI_BASE_URL: Joi.string()
    .uri()
    .default('https://api.z-api.io')
    .description('Z-API base URL'),

  ZAPI_INSTANCE_ID: Joi.string()
    .required()
    .min(10)
    .description('Z-API instance ID'),

  ZAPI_TOKEN: Joi.string()
    .required()
    .min(20)
    .description('Z-API authentication token'),

  ZAPI_WEBHOOK_SECRET: Joi.string()
    .required()
    .min(32)
    .description('Z-API webhook secret for validation'),

  ZAPI_WEBHOOK_VERIFY_TOKEN: Joi.string()
    .required()
    .min(20)
    .description('Z-API webhook verification token'),

  ZAPI_RATE_LIMIT_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .description('Z-API rate limit requests per window'),

  ZAPI_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(60000)
    .description('Z-API rate limit window in milliseconds'),

  ZAPI_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3)
    .description('Z-API retry attempts'),

  ZAPI_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(100)
    .default(1000)
    .description('Z-API retry delay in milliseconds'),

  // OpenAI
  OPENAI_API_KEY: Joi.string()
    .required()
    .pattern(/^sk-[a-zA-Z0-9]{32,}$/)
    .description('OpenAI API key'),

  OPENAI_MODEL: Joi.string()
    .default('gpt-4-turbo')
    .valid('gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo')
    .description('OpenAI model to use'),

  OPENAI_MAX_TOKENS: Joi.number()
    .integer()
    .min(100)
    .max(8192)
    .default(2048)
    .description('OpenAI max tokens per request'),

  // JWT
  JWT_SECRET: Joi.string()
    .required()
    .min(32)
    .description('JWT signing secret (min 32 characters)'),

  JWT_EXPIRY: Joi.string()
    .default('24h')
    .pattern(/^\d+[smhd]$/)
    .description('JWT access token expiration'),

  JWT_REFRESH_SECRET: Joi.string()
    .required()
    .min(32)
    .description('JWT refresh token secret (min 32 characters)'),

  JWT_REFRESH_EXPIRY: Joi.string()
    .default('7d')
    .pattern(/^\d+[smhd]$/)
    .description('JWT refresh token expiration'),

  // Security
  ENCRYPTION_KEY: Joi.string()
    .required()
    .min(32)
    .description('Data encryption key (min 32 characters)'),

  ENCRYPTION_ALGORITHM: Joi.string()
    .default('aes-256-gcm')
    .valid('aes-256-gcm', 'aes-256-cbc')
    .description('Encryption algorithm'),

  // File Upload
  MAX_FILE_SIZE: Joi.number()
    .integer()
    .min(1048576) // 1MB minimum
    .default(10485760) // 10MB default
    .description('Maximum file upload size in bytes'),

  UPLOAD_PATH: Joi.string()
    .default('./uploads')
    .description('File upload directory path'),

  // Tasy Integration
  TASY_API_URL: Joi.string()
    .uri()
    .required()
    .description('Tasy EHR API base URL'),

  TASY_API_KEY: Joi.string()
    .required()
    .min(20)
    .description('Tasy API key'),

  TASY_API_SECRET: Joi.string()
    .required()
    .min(32)
    .description('Tasy API secret'),

  TASY_CLIENT_ID: Joi.string()
    .required()
    .description('Tasy OAuth client ID'),

  TASY_CLIENT_SECRET: Joi.string()
    .required()
    .min(32)
    .description('Tasy OAuth client secret'),

  // FHIR
  FHIR_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:8080/fhir')
    .description('FHIR server base URL'),

  FHIR_VERSION: Joi.string()
    .default('R4')
    .valid('R4', 'R5')
    .description('FHIR specification version'),

  // AWS
  AWS_ACCESS_KEY_ID: Joi.string()
    .pattern(/^[A-Z0-9]{20}$/)
    .required()
    .description('AWS access key ID'),

  AWS_SECRET_ACCESS_KEY: Joi.string()
    .required()
    .min(40)
    .description('AWS secret access key'),

  AWS_REGION: Joi.string()
    .default('us-east-1')
    .description('AWS region'),

  AWS_S3_BUCKET: Joi.string()
    .required()
    .description('AWS S3 bucket for document storage'),

  AWS_SECRETS_MANAGER_REGION: Joi.string()
    .default('us-east-1')
    .description('AWS Secrets Manager region'),

  // CORS
  CORS_ORIGIN: Joi.string()
    .default('http://localhost:5173')
    .description('CORS allowed origin'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(900000) // 15 minutes
    .description('Rate limit window in milliseconds'),

  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .default(100)
    .description('Maximum requests per rate limit window'),

  // Health Check
  HEALTH_CHECK_INTERVAL: Joi.number()
    .integer()
    .min(1000)
    .default(30000) // 30 seconds
    .description('Health check interval in milliseconds'),

  // Feature Flags
  ENABLE_GAMIFICATION: Joi.boolean()
    .default(true)
    .description('Enable gamification features'),

  ENABLE_ML_MODELS: Joi.boolean()
    .default(true)
    .description('Enable ML model predictions'),

  ENABLE_FHIR_GATEWAY: Joi.boolean()
    .default(false)
    .description('Enable FHIR gateway integration'),

  // WebSocket
  WEBSOCKET_PATH: Joi.string()
    .default('/socket.io')
    .description('WebSocket connection path'),

  WEBSOCKET_PING_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(60000)
    .description('WebSocket ping timeout in milliseconds'),

  WEBSOCKET_PING_INTERVAL: Joi.number()
    .integer()
    .min(1000)
    .default(25000)
    .description('WebSocket ping interval in milliseconds'),
}).unknown(true); // Allow additional environment variables

/**
 * Development environment schema
 */
export const developmentSchema = baseEnvSchema.fork(
  [
    'KAFKA_SSL_ENABLED',
    'REDIS_CLUSTER_ENABLED',
    'ENABLE_FHIR_GATEWAY',
  ],
  (schema) => schema.default(false)
);

/**
 * Staging environment schema
 */
export const stagingSchema = baseEnvSchema.fork(
  [
    'KAFKA_SSL_ENABLED',
    'REDIS_CLUSTER_ENABLED',
  ],
  (schema) => schema.default(true)
).fork(['LOG_LEVEL'], (schema) => schema.default('info'));

/**
 * Production environment schema
 */
export const productionSchema = baseEnvSchema
  .fork(
    [
      'KAFKA_SSL_ENABLED',
      'REDIS_CLUSTER_ENABLED',
    ],
    (schema) => schema.default(true).required()
  )
  .fork(['LOG_LEVEL'], (schema) => schema.default('warn'))
  .fork(
    [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ],
    (schema: any) => (schema as Joi.StringSchema).min(64) // Stronger secrets in production
  );

/**
 * Validate environment variables against schema
 */
export function validateEnv(env: NodeJS.ProcessEnv, environment?: string): {
  value: any;
  error?: Joi.ValidationError;
} {
  const nodeEnv = environment || env.NODE_ENV || 'development';

  let schema: Joi.ObjectSchema;
  switch (nodeEnv) {
    case 'production':
      schema = productionSchema;
      break;
    case 'staging':
      schema = stagingSchema;
      break;
    case 'development':
    default:
      schema = developmentSchema;
      break;
  }

  return schema.validate(env, {
    abortEarly: false,
    stripUnknown: false,
    convert: true,
  });
}

/**
 * Get required environment variables for a specific service
 */
export function getRequiredEnvForService(service: string): string[] {
  const serviceEnvMap: Record<string, string[]> = {
    kafka: ['KAFKA_BROKERS', 'KAFKA_CLIENT_ID'],
    redis: ['REDIS_URL', 'REDIS_CLUSTER_ENABLED'],
    mongodb: ['MONGODB_URI', 'MONGODB_DATABASE'],
    whatsapp: ['ZAPI_BASE_URL', 'ZAPI_INSTANCE_ID', 'ZAPI_TOKEN'],
    openai: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
    tasy: ['TASY_API_URL', 'TASY_API_KEY', 'TASY_API_SECRET'],
    aws: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
  };

  return serviceEnvMap[service] || [];
}

export default {
  baseEnvSchema,
  developmentSchema,
  stagingSchema,
  productionSchema,
  validateEnv,
  getRequiredEnvForService,
};
