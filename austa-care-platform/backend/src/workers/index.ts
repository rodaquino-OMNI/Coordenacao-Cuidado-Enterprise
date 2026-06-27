/**
 * Worker Entry Point
 * Starts all BullMQ workers for async processing.
 *
 * Workers:
 *   - WhatsApp:      Outbound WhatsApp message delivery
 *   - Clinical Score: Risk-assessment & emergency-detection pipelines
 *   - OCR:           Document OCR processing (Tesseract + AWS Textract)
 *   - Notification:  Push / email / in-app notification delivery
 *   - DLQ:           Dead Letter Queue handler for all failed jobs
 *
 * Usage:
 *   npm run workers          (from package.json)
 *   tsx src/workers/index.ts (direct)
 */

import { logger } from '../utils/logger';
import { whatsappWorker } from './whatsapp.worker';
import { clinicalScoreWorker } from './clinical-score.worker';
import { ocrWorker } from './ocr.worker';
import { notificationWorker } from './notification.worker';
import { shutdownQueues } from '../lib/queue';

// DLQ workers are self-starting on import
import './dlq.worker';

const workers = [
  { name: 'WhatsApp', instance: whatsappWorker },
  { name: 'Clinical Score', instance: clinicalScoreWorker },
  { name: 'OCR', instance: ocrWorker },
  { name: 'Notification', instance: notificationWorker },
];

logger.info('Starting BullMQ workers…');

workers.forEach(({ name }) => {
  logger.info(`  ✓ ${name} worker ready`);
});

logger.info(`All ${workers.length} workers started + DLQ handler. Waiting for jobs…`);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Shutting down workers…`);

  await Promise.allSettled(workers.map(({ instance }) => instance.close()));
  await shutdownQueues();

  logger.info('All workers shut down');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});
