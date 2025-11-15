/**
 * Symptom Classifier Model
 * TensorFlow-based symptom urgency classification model
 *
 * @module infrastructure/ml/models/symptom-classifier
 * @description Classifies patient symptoms into urgency levels:
 * - low: General health concerns, routine checkup
 * - medium: Concerning symptoms requiring attention
 * - high: Urgent symptoms requiring prompt care
 * - critical: Emergency symptoms requiring immediate action
 */

import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../../utils/logger';
import { MODEL_REGISTRY } from '../config/ml.config';
import { metrics } from '../../monitoring/prometheus.metrics';

/**
 * Symptom input interface
 */
export interface SymptomInput {
  symptoms: string[]; // Array of symptom descriptions
  duration?: number; // Duration in hours
  severity?: 'mild' | 'moderate' | 'severe';
  vitalSigns?: {
    temperature?: number;
    heartRate?: number;
    bloodPressure?: { systolic: number; diastolic: number };
    oxygenSaturation?: number;
  };
}

/**
 * Classification result
 */
export interface ClassificationResult {
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  probabilities: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  reasoning?: string[];
}

/**
 * Symptom Classifier Model Service
 */
export class SymptomClassifierModel {
  private model: tf.LayersModel | null = null;
  private vocabulary: Map<string, number> = new Map();
  private readonly modelConfig = MODEL_REGISTRY.SYMPTOM_CLASSIFIER;

  /**
   * Initialize and load the model
   */
  async initialize(): Promise<void> {
    try {
      if (this.modelConfig.path) {
        this.model = await tf.loadLayersModel(this.modelConfig.path);
        await this.loadVocabulary();
        logger.info('Symptom Classifier model loaded successfully');
      } else {
        logger.warn('Symptom Classifier model path not configured, using rule-based fallback');
      }
    } catch (error) {
      logger.error('Failed to load Symptom Classifier model:', error);
      logger.warn('Falling back to rule-based classification');
    }
  }

  /**
   * Load vocabulary for text encoding
   */
  private async loadVocabulary(): Promise<void> {
    // In production, load from file or database
    // For now, create a basic medical vocabulary
    const medicalTerms = [
      'fever', 'cough', 'headache', 'pain', 'chest', 'abdominal', 'breathing',
      'difficulty', 'severe', 'mild', 'moderate', 'nausea', 'vomiting',
      'dizziness', 'fatigue', 'weakness', 'bleeding', 'unconscious', 'seizure',
      'stroke', 'heart', 'attack', 'shortness', 'breath', 'confusion',
    ];

    medicalTerms.forEach((term, index) => {
      this.vocabulary.set(term.toLowerCase(), index + 1);
    });
  }

  /**
   * Classify symptom urgency
   */
  async classify(input: SymptomInput): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      if (this.model) {
        return await this.classifyWithModel(input);
      } else {
        return this.classifyWithRules(input);
      }
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      metrics.mlInferenceLatency.observe({ model: 'symptom-classifier' }, duration);
      metrics.mlInferenceRequests.inc({ model: 'symptom-classifier', status: 'success' });
    }
  }

  /**
   * Classify using TensorFlow model
   */
  private async classifyWithModel(input: SymptomInput): Promise<ClassificationResult> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Encode symptoms to tensor
    const encoded = this.encodeSymptoms(input.symptoms);
    const inputTensor = tf.tensor2d([encoded], [1, encoded.length]);

    // Perform inference
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    // Map probabilities to classes
    const [low, medium, high, critical] = Array.from(probabilities);
    const maxProb = Math.max(low, medium, high, critical);

    let urgency: ClassificationResult['urgency'];
    if (maxProb === critical) urgency = 'critical';
    else if (maxProb === high) urgency = 'high';
    else if (maxProb === medium) urgency = 'medium';
    else urgency = 'low';

    return {
      urgency,
      confidence: maxProb,
      probabilities: { low, medium, high, critical },
    };
  }

  /**
   * Classify using rule-based system (fallback)
   */
  private classifyWithRules(input: SymptomInput): ClassificationResult {
    const symptomsText = input.symptoms.join(' ').toLowerCase();
    const reasoning: string[] = [];

    // Critical symptoms (immediate emergency)
    const criticalKeywords = [
      'unconscious', 'seizure', 'stroke', 'heart attack', 'chest pain',
      'difficulty breathing', 'severe bleeding', 'suicide', 'overdose',
    ];

    for (const keyword of criticalKeywords) {
      if (symptomsText.includes(keyword)) {
        reasoning.push(`Critical keyword detected: ${keyword}`);
        return {
          urgency: 'critical',
          confidence: 0.95,
          probabilities: { low: 0.01, medium: 0.02, high: 0.02, critical: 0.95 },
          reasoning,
        };
      }
    }

    // Check vital signs for critical values
    if (input.vitalSigns) {
      const { temperature, heartRate, bloodPressure, oxygenSaturation } = input.vitalSigns;

      if (temperature && (temperature >= 104 || temperature <= 95)) {
        reasoning.push(`Critical temperature: ${temperature}°F`);
        return {
          urgency: 'critical',
          confidence: 0.92,
          probabilities: { low: 0.01, medium: 0.02, high: 0.05, critical: 0.92 },
          reasoning,
        };
      }

      if (oxygenSaturation && oxygenSaturation < 90) {
        reasoning.push(`Low oxygen saturation: ${oxygenSaturation}%`);
        return {
          urgency: 'critical',
          confidence: 0.93,
          probabilities: { low: 0.01, medium: 0.02, high: 0.04, critical: 0.93 },
          reasoning,
        };
      }

      if (heartRate && (heartRate > 130 || heartRate < 50)) {
        reasoning.push(`Abnormal heart rate: ${heartRate} bpm`);
        return {
          urgency: 'high',
          confidence: 0.85,
          probabilities: { low: 0.02, medium: 0.05, high: 0.85, critical: 0.08 },
          reasoning,
        };
      }
    }

    // High urgency symptoms
    const highUrgencyKeywords = [
      'severe pain', 'high fever', 'persistent vomiting', 'blood',
      'confusion', 'severe headache', 'vision loss', 'difficulty swallowing',
    ];

    for (const keyword of highUrgencyKeywords) {
      if (symptomsText.includes(keyword)) {
        reasoning.push(`High urgency keyword: ${keyword}`);
        return {
          urgency: 'high',
          confidence: 0.82,
          probabilities: { low: 0.03, medium: 0.10, high: 0.82, critical: 0.05 },
          reasoning,
        };
      }
    }

    // Medium urgency symptoms
    const mediumUrgencyKeywords = [
      'fever', 'persistent cough', 'moderate pain', 'nausea',
      'diarrhea', 'rash', 'swelling', 'dizziness',
    ];

    for (const keyword of mediumUrgencyKeywords) {
      if (symptomsText.includes(keyword)) {
        reasoning.push(`Medium urgency keyword: ${keyword}`);
        return {
          urgency: 'medium',
          confidence: 0.75,
          probabilities: { low: 0.10, medium: 0.75, high: 0.12, critical: 0.03 },
          reasoning,
        };
      }
    }

    // Default to low urgency
    reasoning.push('No critical or high urgency indicators found');
    return {
      urgency: 'low',
      confidence: 0.70,
      probabilities: { low: 0.70, medium: 0.20, high: 0.08, critical: 0.02 },
      reasoning,
    };
  }

  /**
   * Encode symptoms to numerical array
   */
  private encodeSymptoms(symptoms: string[], maxLength: number = 100): number[] {
    const encoded: number[] = new Array(maxLength).fill(0);

    const words = symptoms
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .slice(0, maxLength);

    words.forEach((word, index) => {
      const vocabIndex = this.vocabulary.get(word) || 0;
      encoded[index] = vocabIndex;
    });

    return encoded;
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      ...this.modelConfig,
      isLoaded: this.model !== null,
      vocabularySize: this.vocabulary.size,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.vocabulary.clear();
    logger.info('Symptom Classifier model disposed');
  }
}

// Export singleton instance
export const symptomClassifier = new SymptomClassifierModel();
