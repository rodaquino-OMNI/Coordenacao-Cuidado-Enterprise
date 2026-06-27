import { Worker } from 'bullmq';
import { connection } from '../lib/queue';
import { logger } from '../utils/logger';
import { withRetry } from '../lib/retry';

interface OCRJob {
  documentId: string;
  fileUrl: string;
  userId: string;
  organizationId: string;
}

const ocrWorker = new Worker(
  'ocr',
  async (job) => {
    const { documentId, fileUrl, userId, organizationId } = job.data as OCRJob;

    logger.info(`Processing OCR for document ${documentId}`, {
      jobId: job.id,
      userId,
      organizationId,
    });

    await withRetry(
      async () => {
        // TODO: integrate with actual OCR service
        // const result = await ocrOrchestrator.processDocument(fileUrl);
        // await prisma.document.update({
        //   where: { id: documentId },
        //   data: { ocrText: result.text, ocrConfidence: result.confidence, hasOcr: true, processedAt: new Date() }
        // });

        // Placeholder: simulate OCR processing
        logger.info(`OCR stub processing for document ${documentId}`, { fileUrl });
      },
      {
        maxAttempts: 3,
        initialDelayMs: 2000,
        operationName: `OCR-${documentId}`,
        onRetry: (error: Error, attempt: number, delayMs: number) => {
          logger.warn(
            `OCR retry ${attempt}/3 for document ${documentId}: ${error.message}`,
            { delayMs }
          );
        },
      }
    );
  },
  {
    connection,
    concurrency: 2, // OCR is CPU-intensive, limit concurrency
  }
);

ocrWorker.on('completed', (job) => {
  const { documentId } = job.data as OCRJob;
  logger.info(`OCR job ${job.id} completed for document ${documentId}`);
});

ocrWorker.on('failed', (job, err) => {
  const data = job?.data as OCRJob | undefined;
  logger.error(
    `OCR job ${job?.id} failed permanently for document ${data?.documentId}: ${err.message}`
  );
  // After all retries exhausted, this goes to DLQ automatically
});

export { ocrWorker };
