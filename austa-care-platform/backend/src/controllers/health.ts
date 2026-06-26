import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { prisma } from '@/config/database';
import { redisCluster } from '@/infrastructure/redis/redis.cluster';

const router = Router();

// ---------------------------------------------------------------------------
// Last system activity timestamp (updated on every authenticated request)
// Used by dead-man's-switch endpoint for external monitoring (Prometheus Blackbox).
// ---------------------------------------------------------------------------
let lastActivityTimestamp: Date = new Date();

/** Update the system activity heartbeat — call from middleware on each request */
export function touchActivity(): void {
  lastActivityTimestamp = new Date();
}

// ---------------------------------------------------------------------------
// GET /health — lightweight liveness probe
// ---------------------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
      },
      services: {
        api: 'healthy',
        database: 'checking...',
        redis: 'checking...',
        encryption: 'checking...',
      },
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/detailed — full component-level health check
// ---------------------------------------------------------------------------
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkEncryption(),
    ]);

    const services = {
      database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      encryption: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    };

    const isHealthy = Object.values(services).every((s) => s === 'healthy');

    const healthCheck = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services,
      checks: checks.map((check, index) => ({
        service: ['database', 'redis', 'encryption'][index],
        status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        error:
          check.status === 'rejected'
            ? (check.reason instanceof Error ? check.reason.message : String(check.reason))
            : undefined,
      })),
    };

    res.status(isHealthy ? 200 : 503).json(healthCheck);
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/dead-mans-switch — external monitoring endpoint
//
// Designed for Prometheus Blackbox Exporter (or similar) to periodically
// check that the system is alive and processing activity.  If the
// `lastActivityTimestamp` is too old (stale), it means the system has
// stopped processing requests — triggering an alert.
//
// Response:
//   - 200 + { status: "alive", lastActivity: ISO8601 } → system active
//   - 503 + { status: "stale", ... }                      → no activity for > threshold
// ---------------------------------------------------------------------------
router.get('/dead-mans-switch', async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const lastActivity = lastActivityTimestamp.getTime();
    const staleThresholdMs = parseInt(
      process.env.DEAD_MANS_SWITCH_THRESHOLD_MS || '300000', // default 5 min
      10
    );
    const delta = now - lastActivity;
    const isStale = delta > staleThresholdMs;

    const payload = {
      status: isStale ? 'stale' : 'alive',
      timestamp: new Date().toISOString(),
      lastActivity: lastActivityTimestamp.toISOString(),
      idleSeconds: Math.round(delta / 1000),
      thresholdSeconds: Math.round(staleThresholdMs / 1000),
    };

    res.status(isStale ? 503 : 200).json(payload);
  } catch (error) {
    logger.error('Dead man\'s switch check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Dead man\'s switch check error',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/ready — readiness probe (critical services only)
// ---------------------------------------------------------------------------
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await Promise.all([checkDatabase(), checkEncryption()]);

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Service not ready',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/live — liveness probe (Kubernetes)
// ---------------------------------------------------------------------------
router.get('/live', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ===========================================================================
// Health check helpers
// ===========================================================================

/**
 * Database connectivity check — lightweight `SELECT 1`.
 */
async function checkDatabase(): Promise<void> {
  await prisma.$queryRawUnsafe('SELECT 1');
}

/**
 * Redis connectivity check with graceful degradation.
 *
 * Redis is optional in development; if unavailable the server operates
 * in degraded mode (no caching).  This check reflects that reality:
 * unavailable Redis returns 'healthy' with a warning rather than failing.
 */
async function checkRedis(): Promise<void> {
  try {
    if (!redisCluster.isRedisAvailable()) {
      logger.warn('Redis unavailable — server in degraded mode (no caching)');
      // Graceful degradation: don't fail the overall health check
      return;
    }
    const healthy = await redisCluster.healthCheck();
    if (!healthy) {
      logger.warn('Redis health check failed — server continues in degraded mode');
    }
  } catch (error) {
    logger.warn('Redis health check failed — server continues in degraded mode', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Graceful degradation: don't throw
  }
}

/**
 * Encryption status check — verifies that PostgreSQL pgcrypto extension
 * is installed and functional.
 *
 * INVARIANT #4: Encryption at Rest
 *   "Toda PHI/PII deve ser criptografada com pgcrypto."
 */
async function checkEncryption(): Promise<void> {
  const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') as exists`
  );

  if (!result || !result[0]?.exists) {
    throw new Error(
      'pgcrypto extension is NOT installed. ' +
        'Run: CREATE EXTENSION IF NOT EXISTS pgcrypto; ' +
        'PHI/PII encryption at rest is disabled.'
    );
  }
}

export { router as healthRoutes };
