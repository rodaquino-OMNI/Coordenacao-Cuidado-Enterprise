/**
 * AWS Textract Service
 * Core implementation for medical document OCR processing
 */

import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  StartDocumentAnalysisCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentAnalysisCommand,
  GetDocumentTextDetectionCommand,
  FeatureType
} from '@aws-sdk/client-textract';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import {
  TextractConfiguration,
  TextractResponse,
  TextractBlock,
  TextractFormField,
  TextractTable,
  ProcessedDocument,
  TextractProcessingOptions,
  ProcessingStatus
} from '../types/medical-document.types';
import { TEXTRACT_CONFIG, DEFAULT_PROCESSING_OPTIONS } from '../config/textract.config';
import { TextractError } from '../errors/textract.errors';
import { logger } from '../../../utils/logger';

export class TextractService {
  private textract: TextractClient;
  private s3: S3Client;
  private config: TextractConfiguration;

  constructor(config?: Partial<TextractConfiguration>) {
    this.config = { ...TEXTRACT_CONFIG, ...config };

    // AWS SDK v3 uses client configuration instead of global config
    const clientConfig = {
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      },
      maxAttempts: 3
    };

    this.textract = new TextractClient(clientConfig);
    this.s3 = new S3Client(clientConfig);
  }

  /**
   * Process a document using AWS Textract with comprehensive medical document analysis
   */
  async processDocument(
    s3Key: string,
    options: Partial<TextractProcessingOptions> = {}
  ): Promise<ProcessedDocument> {
    const processingOptions = { ...DEFAULT_PROCESSING_OPTIONS, ...options };
    const documentId = uuidv4();
    const startTime = new Date();

    logger.info(`Starting Textract processing for document: ${s3Key}`, {
      documentId,
      s3Key,
      options: processingOptions
    });

    try {
      // Initialize processing document
      const processedDoc: Partial<ProcessedDocument> = {
        id: documentId,
        originalFileName: s3Key.split('/').pop() || s3Key,
        s3Key,
        status: ProcessingStatus.PROCESSING,
        processingStartTime: startTime,
        blocks: [],
        forms: [],
        tables: [],
        medicalEntities: [],
        validationErrors: [],
        requiresHumanReview: false,
        processingHistory: [
          {
            timestamp: startTime,
            event: 'PROCESSING_STARTED',
            details: { s3Key, options: processingOptions }
          }
        ]
      };

      // Determine processing method based on document size and complexity
      const documentMetadata = await this.getDocumentMetadata(s3Key);
      const useAsyncProcessing = documentMetadata.pages > 1 || documentMetadata.sizeBytes > 5 * 1024 * 1024; // 5MB

      let textractResponse: TextractResponse;

      if (useAsyncProcessing) {
        textractResponse = await this.processDocumentAsync(s3Key, processingOptions);
      } else {
        textractResponse = await this.processDocumentSync(s3Key, processingOptions);
      }

      // Process Textract results
      const blocks = this.parseTextractBlocks(textractResponse.blocks);
      const forms = processingOptions.enableForms ? this.extractForms(blocks) : [];
      const tables = processingOptions.enableTables ? this.extractTables(blocks) : [];

      // Calculate confidence and quality metrics
      const overallConfidence = this.calculateOverallConfidence(blocks);
      const qualityScore = this.calculateQualityScore(blocks, documentMetadata);

      // Determine if human review is required
      const requiresHumanReview = this.shouldRequireHumanReview(
        overallConfidence,
        qualityScore,
        processingOptions
      );

      // Complete processed document
      const completedDoc: ProcessedDocument = {
        ...processedDoc as ProcessedDocument,
        pages: documentMetadata.pages,
        blocks,
        forms,
        tables,
        processingEndTime: new Date(),
        overallConfidence,
        qualityScore,
        requiresHumanReview,
        status: requiresHumanReview ? ProcessingStatus.HUMAN_REVIEW : ProcessingStatus.EXTRACTED,
        processingHistory: [
          ...processedDoc.processingHistory!,
          {
            timestamp: new Date(),
            event: 'TEXTRACT_COMPLETED',
            details: {
              confidence: overallConfidence,
              qualityScore,
              requiresHumanReview,
              blocksExtracted: blocks.length,
              formsExtracted: forms.length,
              tablesExtracted: tables.length
            }
          }
        ]
      };

      logger.info(`Textract processing completed for document: ${s3Key}`, {
        documentId,
        processingTime: Date.now() - startTime.getTime(),
        confidence: overallConfidence,
        qualityScore,
        requiresHumanReview
      });

      return completedDoc;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Textract processing failed for document: ${s3Key}`, {
        documentId,
        error: errorMessage,
        stack: errorStack
      });

      throw new TextractError(
        `Failed to process document ${s3Key}: ${errorMessage}`,
        'PROCESSING_FAILED',
        { documentId, s3Key, originalError: error }
      );
    }
  }

  /**
   * Process document synchronously (for smaller documents)
   */
  private async processDocumentSync(
    s3Key: string,
    options: TextractProcessingOptions
  ): Promise<TextractResponse> {
    const documentInput = {
      S3Object: {
        Bucket: this.config.bucketName,
        Name: s3Key
      }
    };

    try {
      if (options.enableForms || options.enableTables) {
        // Use AnalyzeDocument for forms and tables
        const featureTypes: FeatureType[] = [];

        if (options.enableForms) {
          featureTypes.push('FORMS' as FeatureType);
        }
        if (options.enableTables) {
          featureTypes.push('TABLES' as FeatureType);
        }
        if (options.enableQueries && options.customQueries?.length) {
          featureTypes.push('QUERIES' as FeatureType);
        }

        const analyzeCommand = new AnalyzeDocumentCommand({
          Document: documentInput,
          FeatureTypes: featureTypes,
          QueriesConfig: (options.enableQueries && options.customQueries?.length)
            ? { Queries: options.customQueries.map(query => ({ Text: query })) }
            : undefined
        });

        const result = await this.textract.send(analyzeCommand);
        const rawBlocks = result.Blocks || [];

        return {
          status: 'SUCCEEDED',
          blocks: this.parseTextractBlocks(rawBlocks),
          metadata: {
            pages: this.countPages(rawBlocks),
            processingTime: 0,
            documentMetadata: result.DocumentMetadata
          }
        };
      } else {
        // Use DetectDocumentText for simple text extraction
        const detectCommand = new DetectDocumentTextCommand({
          Document: documentInput
        });

        const result = await this.textract.send(detectCommand);
        const rawBlocks = result.Blocks || [];

        return {
          status: 'SUCCEEDED',
          blocks: this.parseTextractBlocks(rawBlocks),
          metadata: {
            pages: this.countPages(rawBlocks),
            processingTime: 0,
            documentMetadata: result.DocumentMetadata
          }
        };
      }

    } catch (error: any) {
      logger.error('Synchronous Textract processing failed', {
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process document asynchronously (for larger documents)
   */
  private async processDocumentAsync(
    s3Key: string,
    options: TextractProcessingOptions
  ): Promise<TextractResponse> {
    const startTime = Date.now();

    try {
      const documentLocation = {
        S3Object: {
          Bucket: this.config.bucketName,
          Name: s3Key
        }
      };

      const outputConfig = {
        S3Bucket: this.config.bucketName,
        S3Prefix: `textract-output/${s3Key.replace(/\//g, '_')}`
      };

      let jobId: string;

      if (options.enableForms || options.enableTables) {
        const featureTypes: FeatureType[] = [];
        if (options.enableForms) featureTypes.push('FORMS' as FeatureType);
        if (options.enableTables) featureTypes.push('TABLES' as FeatureType);
        if (options.enableQueries) featureTypes.push('QUERIES' as FeatureType);

        const startCommand = new StartDocumentAnalysisCommand({
          DocumentLocation: documentLocation,
          FeatureTypes: featureTypes,
          OutputConfig: outputConfig,
          QueriesConfig: (options.enableQueries && options.customQueries?.length)
            ? { Queries: options.customQueries.map(query => ({ Text: query })) }
            : undefined
        });

        const startResult = await this.textract.send(startCommand);
        jobId = startResult.JobId!;
      } else {
        const startCommand = new StartDocumentTextDetectionCommand({
          DocumentLocation: documentLocation,
          OutputConfig: outputConfig
        });

        const startResult = await this.textract.send(startCommand);
        jobId = startResult.JobId!;
      }

      logger.info(`Started async Textract job: ${jobId}`, { s3Key });

      // Poll for job completion
      const result = await this.pollJobCompletion(jobId, options.enableForms || options.enableTables);
      const rawBlocks = result.Blocks || [];

      return {
        jobId,
        status: result.JobStatus === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
        blocks: this.parseTextractBlocks(rawBlocks),
        warnings: result.Warnings?.map((w: any) => w.ErrorCode + ': ' + w.Pages?.join(',')) || [],
        metadata: {
          pages: this.countPages(rawBlocks),
          processingTime: Date.now() - startTime,
          documentMetadata: result.DocumentMetadata
        }
      };

    } catch (error: any) {
      logger.error('Asynchronous Textract processing failed', {
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Poll job completion status
   */
  private async pollJobCompletion(
    jobId: string,
    isAnalyzeJob: boolean,
    maxPollingTime: number = this.config.timeoutMs
  ): Promise<any> {
    const startTime = Date.now();
    const pollingInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxPollingTime) {
      try {
        const getCommand = isAnalyzeJob
          ? new GetDocumentAnalysisCommand({ JobId: jobId })
          : new GetDocumentTextDetectionCommand({ JobId: jobId });

        const result = await this.textract.send(getCommand);

        if (result.JobStatus === 'SUCCEEDED') {
          // Get all pages if multi-page
          const allBlocks = [...(result.Blocks || [])];
          let nextToken = result.NextToken;

          while (nextToken) {
            const nextCommand = isAnalyzeJob
              ? new GetDocumentAnalysisCommand({ JobId: jobId, NextToken: nextToken })
              : new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken });

            const nextResult = await this.textract.send(nextCommand);
            allBlocks.push(...(nextResult.Blocks || []));
            nextToken = nextResult.NextToken;
          }

          return {
            ...result,
            Blocks: allBlocks
          };
        }

        if (result.JobStatus === 'FAILED') {
          throw new TextractError(
            `Textract job failed: ${result.StatusMessage}`,
            'JOB_FAILED',
            { jobId, statusMessage: result.StatusMessage }
          );
        }

        // Continue polling
        await new Promise(resolve => setTimeout(resolve, pollingInterval));

      } catch (error: any) {
        if (error instanceof TextractError) {
          throw error;
        }
        logger.warn(`Error polling job ${jobId}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }

    throw new TextractError(
      `Textract job ${jobId} timed out after ${maxPollingTime}ms`,
      'JOB_TIMEOUT',
      { jobId, maxPollingTime }
    );
  }

  /**
   * Parse Textract blocks into our internal format
   */
  private parseTextractBlocks(blocks: any[]): TextractBlock[] {
    return blocks.map(block => ({
      id: block.Id,
      blockType: block.BlockType,
      confidence: block.Confidence || 0,
      text: block.Text,
      geometry: block.Geometry ? {
        boundingBox: block.Geometry.BoundingBox,
        polygon: block.Geometry.Polygon
      } : undefined,
      relationships: block.Relationships,
      entityTypes: block.EntityTypes,
      page: block.Page
    }));
  }

  /**
   * Extract form fields from Textract blocks
   */
  private extractForms(blocks: TextractBlock[]): TextractFormField[] {
    const keyValuePairs: TextractFormField[] = [];
    const keyBlocks = blocks.filter(block => block.blockType === 'KEY_VALUE_SET' && 
                                            block.entityTypes?.includes('KEY'));

    for (const keyBlock of keyBlocks) {
      const valueBlockId = keyBlock.relationships?.find(rel => rel.type === 'VALUE')?.ids[0];
      if (!valueBlockId) continue;

      const valueBlock = blocks.find(block => block.id === valueBlockId);
      if (!valueBlock) continue;

      // Get child text blocks
      const keyText = this.getChildText(keyBlock, blocks);
      const valueText = this.getChildText(valueBlock, blocks);

      keyValuePairs.push({
        key: {
          text: keyText,
          confidence: keyBlock.confidence,
          boundingBox: keyBlock.geometry?.boundingBox
        },
        value: {
          text: valueText,
          confidence: valueBlock.confidence,
          boundingBox: valueBlock.geometry?.boundingBox
        }
      });
    }

    return keyValuePairs;
  }

  /**
   * Extract tables from Textract blocks
   */
  private extractTables(blocks: TextractBlock[]): TextractTable[] {
    const tables: TextractTable[] = [];
    const tableBlocks = blocks.filter(block => block.blockType === 'TABLE');

    for (const tableBlock of tableBlocks) {
      const cellBlocks = this.getRelatedBlocks(tableBlock, blocks, 'CHILD')
                            .filter(block => block.blockType === 'CELL');

      // Build table structure
      const tableData: { [key: string]: string } = {};
      let maxRow = 0;
      let maxCol = 0;

      for (const cell of cellBlocks) {
        const cellText = this.getChildText(cell, blocks);
        const rowIndex = (cell as any).RowIndex || 1;
        const colIndex = (cell as any).ColumnIndex || 1;
        
        tableData[`${rowIndex}-${colIndex}`] = cellText;
        maxRow = Math.max(maxRow, rowIndex);
        maxCol = Math.max(maxCol, colIndex);
      }

      // Convert to array format
      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers (first row)
      for (let col = 1; col <= maxCol; col++) {
        headers.push(tableData[`1-${col}`] || '');
      }

      // Extract data rows
      for (let row = 2; row <= maxRow; row++) {
        const rowData: string[] = [];
        for (let col = 1; col <= maxCol; col++) {
          rowData.push(tableData[`${row}-${col}`] || '');
        }
        rows.push(rowData);
      }

      tables.push({
        id: tableBlock.id,
        headers,
        rows,
        confidence: tableBlock.confidence,
        page: tableBlock.page || 1,
        boundingBox: tableBlock.geometry?.boundingBox
      });
    }

    return tables;
  }

  /**
   * Get child text from a block
   */
  private getChildText(block: TextractBlock, allBlocks: TextractBlock[]): string {
    const childIds = block.relationships?.find(rel => rel.type === 'CHILD')?.ids || [];
    const words = childIds
      .map(id => allBlocks.find(b => b.id === id))
      .filter((b): b is TextractBlock => b !== undefined && b.blockType === 'WORD')
      .map(b => b.text)
      .filter(Boolean);

    return words.join(' ');
  }

  /**
   * Get related blocks by relationship type
   */
  private getRelatedBlocks(
    block: TextractBlock,
    allBlocks: TextractBlock[],
    relationshipType: string
  ): TextractBlock[] {
    const relationshipIds = block.relationships?.find(rel => rel.type === relationshipType)?.ids || [];
    return relationshipIds
      .map(id => allBlocks.find(b => b.id === id))
      .filter(Boolean) as TextractBlock[];
  }

  /**
   * Count pages in blocks
   */
  private countPages(blocks: any[]): number {
    const pages = new Set(blocks.map(block => block.Page || 1));
    return pages.size;
  }

  /**
   * Get document metadata from S3
   */
  private async getDocumentMetadata(s3Key: string): Promise<any> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key
      });

      const headResult = await this.s3.send(headCommand);

      return {
        sizeBytes: headResult.ContentLength || 0,
        lastModified: headResult.LastModified,
        contentType: headResult.ContentType,
        pages: 1 // Default, will be updated after processing
      };
    } catch (error: any) {
      logger.warn(`Could not get metadata for ${s3Key}:`, error.message);
      return { sizeBytes: 0, pages: 1 };
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(blocks: TextractBlock[]): number {
    const confidenceScores = blocks
      .filter(block => block.confidence > 0)
      .map(block => block.confidence);

    if (confidenceScores.length === 0) return 0;

    return confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
  }

  /**
   * Calculate quality score based on various metrics
   */
  private calculateQualityScore(blocks: TextractBlock[], metadata: any): number {
    // Basic quality assessment based on confidence and text coverage
    const textBlocks = blocks.filter(block => block.blockType === 'WORD' && block.text);
    
    if (textBlocks.length === 0) return 0;

    const avgConfidence = textBlocks.reduce((sum, block) => sum + block.confidence, 0) / textBlocks.length;
    const textCoverage = textBlocks.length / blocks.length;
    
    // Weight different factors
    const qualityScore = (avgConfidence * 0.7) + (textCoverage * 0.3);

    return Math.min(Math.max(qualityScore, 0), 1);
  }

  /**
   * Determine if human review is required
   */
  private shouldRequireHumanReview(
    confidence: number,
    qualityScore: number,
    options: TextractProcessingOptions
  ): boolean {
    if (options.requireHumanReview) return true;
    
    return confidence < options.confidenceThreshold || 
           qualityScore < 0.7;
  }

  /**
   * Get processing status for a job
   */
  async getJobStatus(jobId: string): Promise<{ status: string; progress?: number }> {
    try {
      const command = new GetDocumentAnalysisCommand({ JobId: jobId });
      const result = await this.textract.send(command);
      return {
        status: result.JobStatus || 'UNKNOWN',
        progress: this.calculateJobProgress(result)
      };
    } catch (error: any) {
      logger.error(`Failed to get job status for ${jobId}:`, error.message);
      throw new TextractError(
        `Failed to get job status: ${error.message}`,
        'STATUS_CHECK_FAILED',
        { jobId }
      );
    }
  }

  /**
   * Calculate job progress percentage
   */
  private calculateJobProgress(result: any): number {
    // AWS Textract doesn't provide explicit progress, so we estimate
    if (result.JobStatus === 'SUCCEEDED') return 100;
    if (result.JobStatus === 'FAILED') return 0;
    if (result.JobStatus === 'IN_PROGRESS') return 50; // Estimate
    return 0;
  }
}