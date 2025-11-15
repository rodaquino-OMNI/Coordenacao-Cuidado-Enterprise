/**
 * ML Model Registry
 * Centralized registry for managing ML model metadata, versions, and deployments
 *
 * @module infrastructure/ml/config/model-registry
 * @description Production-ready model registry with:
 * - Model versioning and tracking
 * - Deployment status management
 * - Performance metrics tracking
 * - A/B test configuration
 * - Model lineage and metadata
 */

import { logger } from '../../../utils/logger';
import { mongoDBClient } from '../../mongodb/mongodb.client';
import { MODEL_REGISTRY, ModelConfig, ABTestConfig, AB_TESTS } from './ml.config';

/**
 * Model deployment status
 */
export type ModelDeploymentStatus =
  | 'development'
  | 'staging'
  | 'production'
  | 'deprecated'
  | 'archived';

/**
 * Model metadata interface
 */
export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  type: 'tensorflow' | 'openai' | 'custom';
  deploymentStatus: ModelDeploymentStatus;
  path?: string;
  s3Path?: string;
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  config: ModelConfig['config'];
  metrics?: ModelConfig['metrics'];
  trainingInfo?: {
    dataset: string;
    samplesCount: number;
    trainedAt: Date;
    trainingDuration: number; // seconds
    hyperparameters: Record<string, any>;
  };
  performanceHistory?: Array<{
    timestamp: Date;
    metrics: ModelConfig['metrics'];
    inferenceCount: number;
    averageLatency: number;
  }>;
  abTest?: ABTestConfig;
}

/**
 * Model Registry Service
 * Manages ML model lifecycle and metadata
 */
export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, ModelMetadata> = new Map();

  private constructor() {}

  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Initialize model registry from database and config
   */
  async initialize(): Promise<void> {
    try {
      // Load models from database
      await this.loadModelsFromDB();

      // Sync with config file
      await this.syncWithConfig();

      logger.info(`Model registry initialized with ${this.models.size} models`);
    } catch (error) {
      logger.error('Failed to initialize model registry:', error);
      throw error;
    }
  }

  /**
   * Load models from MongoDB
   */
  private async loadModelsFromDB(): Promise<void> {
    const modelsCollection = mongoDBClient.getCollection<ModelMetadata>('ml_models');
    const dbModels = await modelsCollection.find({}).toArray();

    for (const model of dbModels) {
      this.models.set(model.id, model);
    }

    logger.info(`Loaded ${dbModels.length} models from database`);
  }

  /**
   * Sync with configuration file
   */
  private async syncWithConfig(): Promise<void> {
    const modelsCollection = mongoDBClient.getCollection<ModelMetadata>('ml_models');

    for (const [key, config] of Object.entries(MODEL_REGISTRY)) {
      const existing = this.models.get(config.id);

      if (!existing) {
        // Create new model entry
        const metadata: ModelMetadata = {
          id: config.id,
          name: config.name,
          version: config.version,
          type: config.type,
          deploymentStatus: config.isActive ? 'production' : 'development',
          path: config.path,
          description: config.description,
          tags: config.tags,
          createdAt: new Date(),
          updatedAt: new Date(),
          config: config.config,
          metrics: config.metrics,
          abTest: AB_TESTS[key],
        };

        await modelsCollection.insertOne(metadata);
        this.models.set(config.id, metadata);

        logger.info(`Created new model entry: ${config.name}`);
      } else if (existing.version !== config.version) {
        // Update version
        await modelsCollection.updateOne(
          { id: config.id },
          {
            $set: {
              version: config.version,
              updatedAt: new Date(),
              config: config.config,
              metrics: config.metrics,
            },
          }
        );

        existing.version = config.version;
        existing.updatedAt = new Date();
        existing.config = config.config;
        existing.metrics = config.metrics;

        logger.info(`Updated model version: ${config.name} -> ${config.version}`);
      }
    }
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  /**
   * List all models
   */
  listModels(filter?: {
    status?: ModelDeploymentStatus;
    type?: ModelMetadata['type'];
    tags?: string[];
  }): ModelMetadata[] {
    let models = Array.from(this.models.values());

    if (filter?.status) {
      models = models.filter(m => m.deploymentStatus === filter.status);
    }

    if (filter?.type) {
      models = models.filter(m => m.type === filter.type);
    }

    if (filter?.tags) {
      models = models.filter(m =>
        filter.tags!.some(tag => m.tags.includes(tag))
      );
    }

    return models;
  }

  /**
   * Register new model
   */
  async registerModel(metadata: Omit<ModelMetadata, 'createdAt' | 'updatedAt'>): Promise<void> {
    const modelsCollection = mongoDBClient.getCollection<ModelMetadata>('ml_models');

    const fullMetadata: ModelMetadata = {
      ...metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await modelsCollection.insertOne(fullMetadata);
    this.models.set(metadata.id, fullMetadata);

    logger.info(`Registered new model: ${metadata.name} v${metadata.version}`);
  }

  /**
   * Update model metadata
   */
  async updateModel(modelId: string, updates: Partial<ModelMetadata>): Promise<void> {
    const modelsCollection = mongoDBClient.getCollection<ModelMetadata>('ml_models');

    await modelsCollection.updateOne(
      { id: modelId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );

    const existing = this.models.get(modelId);
    if (existing) {
      Object.assign(existing, updates, { updatedAt: new Date() });
    }

    logger.info(`Updated model: ${modelId}`);
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(modelId: string, status: ModelDeploymentStatus): Promise<void> {
    await this.updateModel(modelId, { deploymentStatus: status });
    logger.info(`Model ${modelId} deployment status: ${status}`);
  }

  /**
   * Record performance metrics
   */
  async recordPerformance(
    modelId: string,
    metrics: {
      accuracy?: number;
      f1Score?: number;
      precision?: number;
      recall?: number;
      auc?: number;
      inferenceCount: number;
      averageLatency: number;
    }
  ): Promise<void> {
    const model = this.models.get(modelId);

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const performanceEntry = {
      timestamp: new Date(),
      metrics: {
        accuracy: metrics.accuracy,
        f1Score: metrics.f1Score,
        precision: metrics.precision,
        recall: metrics.recall,
        auc: metrics.auc,
      },
      inferenceCount: metrics.inferenceCount,
      averageLatency: metrics.averageLatency,
    };

    if (!model.performanceHistory) {
      model.performanceHistory = [];
    }

    model.performanceHistory.push(performanceEntry);

    // Keep only last 100 entries
    if (model.performanceHistory.length > 100) {
      model.performanceHistory = model.performanceHistory.slice(-100);
    }

    const modelsCollection = mongoDBClient.getCollection<ModelMetadata>('ml_models');
    await modelsCollection.updateOne(
      { id: modelId },
      {
        $set: {
          performanceHistory: model.performanceHistory,
          updatedAt: new Date(),
        },
      }
    );

    logger.debug(`Recorded performance for model ${modelId}`);
  }

  /**
   * Get model for A/B testing
   * Returns model ID based on weighted random selection
   */
  getModelForABTest(testKey: string): string {
    const abTest = AB_TESTS[testKey];

    if (!abTest || !abTest.enabled) {
      // Return default model (first variant or config model)
      const defaultConfig = MODEL_REGISTRY[testKey];
      return defaultConfig?.id || '';
    }

    // Weighted random selection
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of abTest.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.modelId;
      }
    }

    // Fallback to first variant
    return abTest.variants[0].modelId;
  }

  /**
   * Get performance summary for model
   */
  getPerformanceSummary(modelId: string): {
    current: ModelConfig['metrics'];
    trend: 'improving' | 'stable' | 'degrading';
    history: ModelMetadata['performanceHistory'];
  } | null {
    const model = this.models.get(modelId);

    if (!model || !model.performanceHistory || model.performanceHistory.length === 0) {
      return null;
    }

    const history = model.performanceHistory;
    const current = model.metrics;

    // Calculate trend based on last 10 entries
    const recent = history.slice(-10);
    if (recent.length < 2) {
      return { current, trend: 'stable', history };
    }

    const firstAccuracy = recent[0].metrics?.accuracy || 0;
    const lastAccuracy = recent[recent.length - 1].metrics?.accuracy || 0;
    const delta = lastAccuracy - firstAccuracy;

    const trend = delta > 0.02 ? 'improving' : delta < -0.02 ? 'degrading' : 'stable';

    return { current, trend, history };
  }

  /**
   * Archive old model
   */
  async archiveModel(modelId: string): Promise<void> {
    await this.updateDeploymentStatus(modelId, 'archived');
    logger.info(`Archived model: ${modelId}`);
  }

  /**
   * Delete model from registry
   */
  async deleteModel(modelId: string): Promise<void> {
    const modelsCollection = mongoDBClient.getCollection<ModelMetadata>('ml_models');
    await modelsCollection.deleteOne({ id: modelId });
    this.models.delete(modelId);

    logger.info(`Deleted model: ${modelId}`);
  }
}

// Export singleton instance
export const modelRegistry = ModelRegistry.getInstance();
