import { Worker } from 'bullmq';
import { connection } from '../lib/queue';
import { logger } from '../utils/logger';

// Monitor DLQ for failed jobs across all queues
const QUEUES_TO_MONITOR = ['whatsapp', 'clinical-score', 'ocr', 'notification'];

const dlqWorkers: Worker[] = [];

/**
 * Initialize Dead Letter Queue handlers for all monitored queues.
 * Each DLQ worker listens on `{queueName}:dlq` and logs failures
 * for monitoring, alerting, and manual review.
 */
function startDLQHandlers(): void {
  QUEUES_TO_MONITOR.forEach((queueName) => {
    const dlqWorker = new Worker(
      `{${queueName}}:dlq`,
      async (job) => {
        logger.error(`DLQ: Failed job in ${queueName}`, {
          jobId: job.id,
          data: job.data,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          queueName,
        });

        // TODO: Integrate with monitoring (send to PagerDuty / Slack)
        // TODO: Store in database for manual review
      },
      { connection }
    );

    dlqWorker.on('error', (err) => {
      logger.error(`DLQ worker error for queue ${queueName}: ${err.message}`);
    });

    dlqWorkers.push(dlqWorker);
    logger.info(`DLQ handler started for queue: ${queueName}`);
  });
}

startDLQHandlers();

export { dlqWorkers, QUEUES_TO_MONITOR };
