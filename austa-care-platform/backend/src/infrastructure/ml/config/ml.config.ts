/**
 * ML Pipeline Configuration
 * Centralized configuration for ML models and inference settings
 *
 * @module infrastructure/ml/config
 * @description Production-ready ML configuration with:
 * - Model paths and metadata
 * - Feature configurations
 * - Inference settings
 * - A/B testing framework
 * - Performance thresholds
 */

import { config } from '../../../config/config';

/**
 * Model configuration interface
 */
export interface ModelConfig {
  id: string;
  name: string;
  version: string;
  type: 'tensorflow' | 'openai' | 'custom';
  path?: string;
  isActive: boolean;
  description: string;
  tags: string[];
  config: {
    modelName?: string; // For OpenAI models
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    preprocessor?: {
      type: 'normalize' | 'tokenize' | 'embedding';
      mean?: number;
      std?: number;
      vocabSize?: number;
      maxLength?: number;
    };
    postprocessor?: {
      type: 'classification' | 'regression' | 'generation';
      classes?: string[];
      threshold?: number;
    };
    testInput?: any;
  };
  metrics?: {
    accuracy?: number;
    f1Score?: number;
    precision?: number;
    recall?: number;
    auc?: number;
  };
}

/**
 * A/B Testing configuration
 */
export interface ABTestConfig {
  enabled: boolean;
  variants: Array<{
    modelId: string;
    weight: number; // 0-100 percentage
  }>;
}

/**
 * Feature engineering configuration
 */
export interface FeatureConfig {
  name: string;
  type: 'categorical' | 'numerical' | 'text' | 'temporal';
  required: boolean;
  transformations?: string[];
  defaultValue?: any;
}

/**
 * Inference configuration
 */
export interface InferenceConfig {
  batchSize: number;
  timeout: number; // milliseconds
  maxConcurrentRequests: number;
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
}

/**
 * Get ML pipeline configuration
 */
export const getMLConfig = () => {
  return {
    modelsPath: process.env.ML_MODELS_PATH || './models',
    s3Bucket: process.env.ML_MODELS_S3_BUCKET,
    cacheEnabled: process.env.ML_CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.ML_CACHE_TTL || '3600', 10),
    maxConcurrentInferences: parseInt(process.env.ML_MAX_CONCURRENT || '10', 10),
    inferenceTimeout: parseInt(process.env.ML_INFERENCE_TIMEOUT || '30000', 10),
    batchInferenceEnabled: process.env.ML_BATCH_ENABLED !== 'false',
    batchSize: parseInt(process.env.ML_BATCH_SIZE || '32', 10),
  };
};

/**
 * Model registry
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  SYMPTOM_CLASSIFIER: {
    id: 'symptom-classifier-v1',
    name: 'Symptom Urgency Classifier',
    version: '1.0.0',
    type: 'tensorflow',
    path: 'file://./models/symptom-classifier/model.json',
    isActive: true,
    description: 'Classifies symptom urgency: low, medium, high, critical',
    tags: ['symptom', 'classification', 'urgency'],
    config: {
      preprocessor: {
        type: 'embedding',
        vocabSize: 10000,
        maxLength: 100,
      },
      postprocessor: {
        type: 'classification',
        classes: ['low', 'medium', 'high', 'critical'],
        threshold: 0.7,
      },
      testInput: ['headache', 'fever', 'cough'],
    },
    metrics: {
      accuracy: 0.89,
      f1Score: 0.87,
      precision: 0.88,
      recall: 0.86,
    },
  },

  RISK_SCORER: {
    id: 'risk-scorer-v1',
    name: '30-Day Hospitalization Risk Scorer',
    version: '1.0.0',
    type: 'tensorflow',
    path: 'file://./models/risk-scorer/model.json',
    isActive: true,
    description: 'Predicts 30-day hospitalization risk score (0-100)',
    tags: ['risk', 'regression', 'hospitalization'],
    config: {
      preprocessor: {
        type: 'normalize',
        mean: 0,
        std: 1,
      },
      postprocessor: {
        type: 'regression',
        threshold: 0.5,
      },
      testInput: [45, 1, 120, 80, 98.6, 0, 2, 1],
    },
    metrics: {
      auc: 0.85,
      precision: 0.82,
      recall: 0.79,
    },
  },

  INTENT_RECOGNIZER: {
    id: 'intent-recognizer-v1',
    name: 'Conversation Intent Recognizer',
    version: '1.0.0',
    type: 'openai',
    isActive: true,
    description: 'Recognizes user intent in conversations',
    tags: ['intent', 'nlp', 'conversation'],
    config: {
      modelName: 'gpt-4-turbo',
      temperature: 0.3,
      maxTokens: 500,
      systemPrompt: `You are an intent recognition system for healthcare conversations.
Analyze the user message and return JSON with:
{
  "primary_intent": "symptom_report|appointment_request|medication_question|general_inquiry",
  "confidence": 0.0-1.0,
  "entities": ["extracted", "entities"],
  "urgency": "low|medium|high|critical"
}`,
      postprocessor: {
        type: 'classification',
        classes: ['symptom_report', 'appointment_request', 'medication_question', 'general_inquiry'],
      },
    },
  },

  FRAUD_DETECTOR: {
    id: 'fraud-detector-v1',
    name: 'Authorization Fraud Detector',
    version: '1.0.0',
    type: 'tensorflow',
    path: 'file://./models/fraud-detector/model.json',
    isActive: true,
    description: 'Detects potentially fraudulent authorization requests',
    tags: ['fraud', 'classification', 'security'],
    config: {
      preprocessor: {
        type: 'normalize',
        mean: 0,
        std: 1,
      },
      postprocessor: {
        type: 'classification',
        classes: ['legitimate', 'suspicious', 'fraudulent'],
        threshold: 0.8,
      },
      testInput: [100, 1, 0, 0, 1, 50000, 3],
    },
    metrics: {
      accuracy: 0.93,
      f1Score: 0.91,
      precision: 0.94,
      recall: 0.88,
    },
  },
};

/**
 * A/B Testing configurations
 */
export const AB_TESTS: Record<string, ABTestConfig> = {
  SYMPTOM_CLASSIFIER: {
    enabled: false,
    variants: [
      { modelId: 'symptom-classifier-v1', weight: 80 },
      { modelId: 'symptom-classifier-v2', weight: 20 },
    ],
  },
  RISK_SCORER: {
    enabled: false,
    variants: [
      { modelId: 'risk-scorer-v1', weight: 100 },
    ],
  },
};

/**
 * Feature configurations for each model
 */
export const FEATURE_CONFIGS: Record<string, FeatureConfig[]> = {
  SYMPTOM_CLASSIFIER: [
    { name: 'symptom_text', type: 'text', required: true, transformations: ['lowercase', 'tokenize'] },
    { name: 'duration_hours', type: 'numerical', required: false, transformations: ['normalize'] },
    { name: 'severity', type: 'categorical', required: false, transformations: ['one_hot_encode'] },
  ],
  RISK_SCORER: [
    { name: 'age', type: 'numerical', required: true, transformations: ['normalize'] },
    { name: 'gender', type: 'categorical', required: true, transformations: ['one_hot_encode'] },
    { name: 'systolic_bp', type: 'numerical', required: true, transformations: ['normalize'] },
    { name: 'diastolic_bp', type: 'numerical', required: true, transformations: ['normalize'] },
    { name: 'temperature', type: 'numerical', required: true, transformations: ['normalize'] },
    { name: 'diabetes', type: 'categorical', required: false, transformations: ['binary_encode'], defaultValue: 0 },
    { name: 'previous_admissions', type: 'numerical', required: false, transformations: ['normalize'], defaultValue: 0 },
    { name: 'chronic_conditions', type: 'numerical', required: false, transformations: ['normalize'], defaultValue: 0 },
  ],
  FRAUD_DETECTOR: [
    { name: 'authorization_amount', type: 'numerical', required: true, transformations: ['normalize'] },
    { name: 'provider_new', type: 'categorical', required: true, transformations: ['binary_encode'] },
    { name: 'after_hours', type: 'categorical', required: true, transformations: ['binary_encode'] },
    { name: 'high_cost_procedure', type: 'categorical', required: true, transformations: ['binary_encode'] },
    { name: 'duplicate_request', type: 'categorical', required: true, transformations: ['binary_encode'] },
    { name: 'patient_age', type: 'numerical', required: true, transformations: ['normalize'] },
    { name: 'previous_claims', type: 'numerical', required: false, transformations: ['normalize'], defaultValue: 0 },
  ],
};

/**
 * Inference configuration
 */
export const INFERENCE_CONFIG: InferenceConfig = {
  batchSize: 32,
  timeout: 30000, // 30 seconds
  maxConcurrentRequests: 10,
  cacheEnabled: true,
  cacheTTL: 3600, // 1 hour
};

/**
 * Performance thresholds for model monitoring
 */
export const PERFORMANCE_THRESHOLDS = {
  minAccuracy: 0.75,
  minF1Score: 0.70,
  maxInferenceTime: 5000, // 5 seconds
  maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
};

export default {
  config: getMLConfig(),
  modelRegistry: MODEL_REGISTRY,
  abTests: AB_TESTS,
  featureConfigs: FEATURE_CONFIGS,
  inferenceConfig: INFERENCE_CONFIG,
  performanceThresholds: PERFORMANCE_THRESHOLDS,
};
