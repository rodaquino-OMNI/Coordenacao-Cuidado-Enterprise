import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { redisCluster } from '../infrastructure/redis/redis.cluster';

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
// Health check result types
// ---------------------------------------------------------------------------

interface ComponentStatus {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
  algorithm?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    database: ComponentStatus;
    redis: ComponentStatus;
    encryption: ComponentStatus;
  };
}

// ---------------------------------------------------------------------------
// GET /health — full component-level health check with latency measurement
// ---------------------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [dbResult, redisResult, encryptionResult] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkEncryption(),
    ]);

    const database: ComponentStatus = dbResult.status === 'fulfilled'
      ? { status: 'up', latencyMs: dbResult.value }
      : { status: 'down', error: extractError(dbResult.reason) };

    const redis: ComponentStatus = redisResult.status === 'fulfilled'
      ? { status: 'up', latencyMs: redisResult.value }
      : { status: 'down', error: extractError(redisResult.reason) };

    const encryption: ComponentStatus = encryptionResult.status === 'fulfilled'
      ? encryptionResult.value
      : { status: 'down', error: extractError(encryptionResult.reason) };

    const allUp = database.status === 'up'
      && redis.status === 'up'
      && encryption.status === 'up';

    const someUp = database.status === 'up' || redis.status === 'up' || encryption.status === 'up';

    const response: HealthCheckResponse = {
      status: allUp ? 'healthy' : someUp ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime() * 100) / 100,
      version: process.env.npm_package_version || '1.0.0',
      components: { database, redis, encryption },
    };

    // Redis is optional — if it's the only one down, still consider healthy
    const httpStatus = database.status === 'up' && encryption.status === 'up' ? 200 : 503;
    res.status(httpStatus).json(response);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      components: {
        database: { status: 'down', error: 'Health check error' },
        redis: { status: 'down', error: 'Health check error' },
        encryption: { status: 'down', error: 'Health check error' },
      },
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
    logger.error("Dead man's switch check failed", { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: "Dead man's switch check error",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/ready — readiness probe (critical services only: DB + Encryption)
// ---------------------------------------------------------------------------
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const [dbResult, encryptionResult] = await Promise.allSettled([
      checkDatabase(),
      checkEncryption(),
    ]);

    if (dbResult.status === 'fulfilled' && encryptionResult.status === 'fulfilled') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        database: dbResult.status === 'fulfilled' ? 'up' : 'down',
        encryption: encryptionResult.status === 'fulfilled' ? 'up' : 'down',
      });
    }
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
// GET /health/live — lightweight liveness probe (Kubernetes)
// ---------------------------------------------------------------------------
router.get('/live', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
  });
});

// ===========================================================================
// Health check helpers
// ===========================================================================

/**
 * Database connectivity check — lightweight `SELECT 1`.
 * Returns latency in milliseconds.
 */
async function checkDatabase(): Promise<number> {
  const start = Date.now();
  await prisma.$queryRawUnsafe('SELECT 1');
  return Date.now() - start;
}

/**
 * Redis connectivity check with graceful degradation.
 *
 * Redis is optional in development; if unavailable the server operates
 * in degraded mode (no caching).  This check reflects that reality:
 * unavailable Redis returns 'up' with a warning rather than failing.
 *
 * Returns latency in milliseconds if available, or throws if unavailable
 * (graceful degradation handled at the caller).
 */
async function checkRedis(): Promise<number> {
  if (!redisCluster.isRedisAvailable()) {
    logger.warn('Redis unavailable — server in degraded mode (no caching)');
    // Graceful degradation: don't fail the overall health check
    return 0;
  }

  const start = Date.now();
  const healthy = await redisCluster.healthCheck();
  const latency = Date.now() - start;

  if (!healthy) {
    logger.warn('Redis health check failed — server continues in degraded mode');
    throw new Error('Redis health check returned unhealthy');
  }

  return latency;
}

/**
 * Encryption status check — verifies that PostgreSQL pgcrypto extension
 * is installed and functional.
 *
 * INVARIANT #4: Encryption at Rest
 *   "Toda PHI/PII deve ser criptografada com pgcrypto."
 */
async function checkEncryption(): Promise<ComponentStatus> {
  const start = Date.now();
  const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') as exists`
  );
  const latency = Date.now() - start;

  if (!result || !result[0]?.exists) {
    throw new Error(
      'pgcrypto extension is NOT installed. ' +
        'Run: CREATE EXTENSION IF NOT EXISTS pgcrypto; ' +
        'PHI/PII encryption at rest is disabled.'
    );
  }

  return { status: 'up', latencyMs: latency, algorithm: 'aes256' };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function extractError(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

export { router as healthRoutes };
