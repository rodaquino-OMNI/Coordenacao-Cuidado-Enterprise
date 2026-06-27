/**
 * WhatsApp Worker
 * Processes outbound WhatsApp messages from the 'whatsapp' queue.
 *
 * Job data shape:
 *   { to: string; message: string; type?: string; userId?: string }
 */

import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import { logger } from '../utils/logger';
import { whatsappService } from '../services/whatsapp.service';

export interface WhatsAppJobData {
  to: string;
  message: string;
  type?: 'text' | 'template' | 'interactive';
  templateName?: string;
  language?: string;
  variables?: string[];
  userId?: string;
}

const whatsappWorker = new Worker<WhatsAppJobData>(
  'whatsapp',
  async (job: Job<WhatsAppJobData>) => {
    const { to, message, type, templateName, language, variables } = job.data;

    logger.info('Processing WhatsApp job', {
      jobId: job.id,
      to,
      type: type ?? 'text',
    });

    if (type === 'template' && templateName) {
      await whatsappService.sendTemplateMessage({
        phone: to,
        templateName,
        language: language ?? 'pt_BR',
        variables: variables ?? [],
      });
    } else {
      await whatsappService.sendTextMessage({
        phone: to,
        message,
      });
    }
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
whatsappWorker.on('completed', (job: Job) => {
  logger.info('WhatsApp job completed', { jobId: job.id, to: (job.data as WhatsAppJobData).to });
});

whatsappWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error('WhatsApp job failed', {
    jobId: job?.id,
    to: job ? (job.data as WhatsAppJobData).to : undefined,
    error: err.message,
  });
});

whatsappWorker.on('error', (err: Error) => {
  logger.error('WhatsApp worker error', { error: err.message });
});

export { whatsappWorker };
