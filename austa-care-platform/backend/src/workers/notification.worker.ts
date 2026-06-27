/**
 * Notification Worker
 * Processes push / email / in-app notification jobs from the
 * 'notification' queue.
 * Stub worker — integrate with NotificationService when ready.
 *
 * Job data shape:
 *   { channel: 'push' | 'email' | 'in-app'; userId: string; title: string; body: string }
 */

import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import { logger } from '../utils/logger';

export interface NotificationJobData {
  channel: 'push' | 'email' | 'in-app';
  userId: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job: Job<NotificationJobData>) => {
    const { channel, userId, title, body } = job.data;

    logger.info('Processing notification job', {
      jobId: job.id,
      channel,
      userId,
      title,
    });

    // TODO: Integrate with NotificationService
    // await notificationService.send({ channel, userId, title, body });

    logger.warn('Notification worker is a stub — no processing performed', {
      jobId: job.id,
      channel,
      userId,
    });
  },
  {
    connection,
    concurrency: 5,
    autorun: true,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  }
);

// ---------------------------------------------------------------------------
// Lifecycle events
// ---------------------------------------------------------------------------
notificationWorker.on('completed', (job: Job) => {
  logger.info('Notification job completed', { jobId: job.id });
});

notificationWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error('Notification job failed', {
    jobId: job?.id,
    error: err.message,
  });
});

notificationWorker.on('error', (err: Error) => {
  logger.error('Notification worker error', { error: err.message });
});

export { notificationWorker };
