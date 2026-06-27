/**
 * BullMQ Queue Infrastructure
 * Shared Redis connection + queue definitions for async processing.
 *
 * Queues:
 *  - whatsapp         Outbound WhatsApp message delivery
 *  - clinical-score   Risk-assessment & emergency-detection pipelines
 *  - ocr              Document OCR / medical entity extraction
 *  - notification     Push / email / in-app notifications
 *
 * Uses BullMQ's ConnectionOptions (plain object) rather than a raw ioredis
 * instance to avoid type conflicts with BullMQ's bundled ioredis dependency.
 */

import { Queue } from 'bullmq';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Parse Redis URL for connection options
const redisUrl = new URL(config.redis.url);

export const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  db: Number(redisUrl.pathname?.replace(/^\//, '') || '0'),
};

logger.info(
  `BullMQ connection configured: redis://${connection.host}:${connection.port}/${connection.db}`
);

// ---------------------------------------------------------------------------
// Queue definitions
// ---------------------------------------------------------------------------
export const whatsappQueue = new Queue('whatsapp', { connection });
export const clinicalScoreQueue = new Queue('clinical-score', { connection });
export const ocrQueue = new Queue('ocr', { connection });
export const notificationQueue = new Queue('notification', { connection });

// ---------------------------------------------------------------------------
// Graceful shutdown helper
// ---------------------------------------------------------------------------
export async function shutdownQueues(): Promise<void> {
  logger.info('Shutting down BullMQ queues…');
  await Promise.allSettled([
    whatsappQueue.close(),
    clinicalScoreQueue.close(),
    ocrQueue.close(),
    notificationQueue.close(),
  ]);
  logger.info('BullMQ queues closed');
}

export default connection;
