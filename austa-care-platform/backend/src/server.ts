import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { metricsMiddleware, errorMetricsMiddleware } from './middleware/metrics.middleware';
// Controller-based routes (legacy)
import { authRoutes as legacyAuthRoutes } from './controllers/auth';
import { healthRoutes } from './controllers/health';
import { whatsappRoutes as legacyWhatsappRoutes } from './controllers/whatsapp';
import { userRoutes as legacyUserRoutes } from './controllers/user';

// New route modules
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import conversationRoutes from './routes/conversation.routes';
import healthDataRoutes from './routes/health-data.routes';
import documentRoutes from './routes/document.routes';
import gamificationRoutes from './routes/gamification.routes';
import adminRoutes from './routes/admin.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import ocrRoutes from './routes/ocr.routes';
import aiRoutes from './routes/ai';
import authorizationRoutes from './routes/authorization';
import advancedRiskRoutes from './routes/advanced-risk';

// Infrastructure imports
import { kafkaClient } from './infrastructure/kafka/kafka.client';
import { redisCluster } from './infrastructure/redis/redis.cluster';
import { mongoDBClient } from './infrastructure/mongodb/mongodb.client';
import { websocketServer } from './infrastructure/websocket/websocket.server';
import { mlPipeline } from './infrastructure/ml/ml-pipeline.service';
import { metrics } from './infrastructure/monitoring/prometheus.metrics';

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Compression
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Metrics middleware - track all HTTP requests
app.use(metricsMiddleware);
app.use(errorMetricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.getContentType());
    res.end(await metrics.getMetrics());
  } catch (error) {
    res.status(500).end();
  }
});

// Health check routes (non-versioned)
app.use('/health', healthRoutes);

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/health-data', healthDataRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/authorizations', authorizationRoutes);
app.use('/api/v1/risk-assessment', advancedRiskRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ocr', ocrRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/webhooks/whatsapp', whatsappRoutes);

// Legacy routes (for backward compatibility - to be deprecated)
app.use('/api/auth', legacyAuthRoutes);
app.use('/api/whatsapp', legacyWhatsappRoutes);
app.use('/api/users', legacyUserRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/authorization', authorizationRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Initialize infrastructure services
async function initializeServices() {
  try {
    logger.info('Initializing infrastructure services...');

    // Initialize Kafka (non-fatal — server operates without event streaming if unavailable)
    try {
      logger.info('Connecting to Kafka...');
      await kafkaClient.connectProducer();
      await kafkaClient.connectAdmin();
      
      // Create Kafka topics
      await kafkaClient.createTopics([
        { topic: 'austa.care.user.registered' },
        { topic: 'austa.care.conversation.started' },
        { topic: 'austa.care.message.received' },
        { topic: 'austa.care.ai.symptom.analyzed' },
        { topic: 'austa.care.risk.calculated' },
        { topic: 'austa.care.authorization.requested' },
        { topic: 'austa.care.authorization.approved' },
        { topic: 'austa.care.health.data.updated' },
        { topic: 'austa.care.document.uploaded' },
        { topic: 'austa.care.document.processed' },
        { topic: 'austa.care.integration.tasy.sync.completed' },
        { topic: 'austa.care.notification.scheduled' },
        { topic: 'austa.care.dead-letter' },
      ]);
      logger.info('✅ Kafka connected and topics created');
    } catch (error) {
      logger.warn('⚠️  Kafka unavailable — server operating without event streaming', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize Redis (non-blocking - optional for development)
    logger.info('Connecting to Redis...');
    await redisCluster.connect();
    if (redisCluster.isRedisAvailable()) {
      logger.info('✅ Redis connected');
    } else {
      logger.warn('⚠️  Redis unavailable - server operating in degraded mode (caching disabled)');
    }

    // Initialize MongoDB (non-fatal — ML pipeline uses it; server operates without if unavailable)
    try {
      logger.info('Connecting to MongoDB...');
      await mongoDBClient.connect();
      logger.info('✅ MongoDB connected');
    } catch (error) {
      logger.warn('⚠️  MongoDB unavailable — ML features disabled', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize WebSocket server
    logger.info('Initializing WebSocket server...');
    await websocketServer.initialize(httpServer);
    logger.info('✅ WebSocket server initialized');

    // Initialize ML Pipeline (non-fatal — clinical risk scoring still works via direct service calls)
    try {
      logger.info('Initializing ML Pipeline...');
      await mlPipeline.initialize();
      logger.info('✅ ML Pipeline initialized');
    } catch (error) {
      logger.warn('⚠️  ML Pipeline unavailable — risk scoring limited to rule-based algorithms', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('✅ All infrastructure services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize infrastructure services:', error);
    throw error;
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Shutdown services in reverse order (each independently — one failure doesn't block others)
    try { await websocketServer.shutdown(); } catch (e) { logger.warn('WebSocket shutdown error:', e); }
    try { await mlPipeline.shutdown(); } catch (e) { logger.warn('ML Pipeline shutdown error:', e); }
    try { await kafkaClient.disconnect(); } catch (e) { logger.warn('Kafka shutdown error:', e); }
    try { await redisCluster.disconnect(); } catch (e) { logger.warn('Redis shutdown error:', e); }
    try { await mongoDBClient.disconnect(); } catch (e) { logger.warn('MongoDB shutdown error:', e); }
    
    logger.info('All services shut down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  metrics.unhandledExceptions.inc({ type: error.name });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  metrics.unhandledExceptions.inc({ type: 'unhandledRejection' });
});

// Start server
const PORT = config.port || 3000;

initializeServices()
  .then(() => {
    httpServer.listen(PORT, () => {
      logger.info(`🚀 AUSTA Care Platform API Server running on port ${PORT}`);
      logger.info(`📱 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 API Documentation: http://localhost:${PORT}/docs`);
      logger.info(`📊 Metrics available at: http://localhost:${PORT}/metrics`);
      logger.info(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

export default app;
export { app };