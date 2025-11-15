/**
 * Risk Scorer Model
 * TensorFlow-based 30-day hospitalization risk prediction
 *
 * @module infrastructure/ml/models/risk-scorer
 * @description Predicts patient hospitalization risk using:
 * - Demographics (age, gender)
 * - Vital signs (BP, temperature, heart rate)
 * - Medical history (chronic conditions, previous admissions)
 * - Current symptoms and lab results
 */

import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../../utils/logger';
import { MODEL_REGISTRY } from '../config/ml.config';
import { metrics } from '../../monitoring/prometheus.metrics';

/**
 * Risk scoring input
 */
export interface RiskScoringInput {
  // Demographics
  age: number;
  gender: 'male' | 'female' | 'other';

  // Vital signs
  systolicBP: number;
  diastolicBP: number;
  temperature: number; // Fahrenheit
  heartRate?: number;
  respiratoryRate?: number;

  // Medical history
  chronicConditions?: string[];
  previousAdmissions?: number;
  diabetes?: boolean;
  hypertension?: boolean;
  heartDisease?: boolean;
  kidneyDisease?: boolean;

  // Current status
  currentMedications?: number;
  recentLabAbnormalities?: number;
  functionalStatus?: 'independent' | 'assisted' | 'dependent';
}

/**
 * Risk scoring result
 */
export interface RiskScoringResult {
  riskScore: number; // 0-100 scale
  riskLevel: 'low' | 'moderate' | 'high' | 'very-high';
  confidence: number;
  contributingFactors: Array<{
    factor: string;
    impact: 'positive' | 'negative';
    weight: number;
  }>;
  recommendations: string[];
}

/**
 * Risk Scorer Model Service
 */
export class RiskScorerModel {
  private model: tf.LayersModel | null = null;
  private readonly modelConfig = MODEL_REGISTRY.RISK_SCORER;
  private featureMeans: number[] = [];
  private featureStds: number[] = [];

  /**
   * Initialize and load the model
   */
  async initialize(): Promise<void> {
    try {
      if (this.modelConfig.path) {
        this.model = await tf.loadLayersModel(this.modelConfig.path);
        await this.loadNormalizationParams();
        logger.info('Risk Scorer model loaded successfully');
      } else {
        logger.warn('Risk Scorer model path not configured, using statistical fallback');
      }
    } catch (error) {
      logger.error('Failed to load Risk Scorer model:', error);
      logger.warn('Falling back to statistical risk scoring');
    }
  }

  /**
   * Load feature normalization parameters
   */
  private async loadNormalizationParams(): Promise<void> {
    // In production, load from model metadata or separate config
    // These are example values for feature normalization
    this.featureMeans = [55, 0.5, 130, 80, 98.6, 0.3, 1.5, 3];
    this.featureStds = [15, 0.5, 20, 15, 1.5, 0.5, 2, 4];
  }

  /**
   * Calculate hospitalization risk score
   */
  async scoreRisk(input: RiskScoringInput): Promise<RiskScoringResult> {
    const startTime = Date.now();

    try {
      if (this.model) {
        return await this.scoreWithModel(input);
      } else {
        return this.scoreWithStatisticalModel(input);
      }
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      metrics.mlInferenceLatency.observe({ model: 'risk-scorer' }, duration);
      metrics.mlInferenceRequests.inc({ model: 'risk-scorer', status: 'success' });
    }
  }

  /**
   * Score using TensorFlow model
   */
  private async scoreWithModel(input: RiskScoringInput): Promise<RiskScoringResult> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Extract and normalize features
    const features = this.extractFeatures(input);
    const normalized = this.normalizeFeatures(features);
    const inputTensor = tf.tensor2d([normalized], [1, normalized.length]);

    // Perform inference
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const riskScores = await prediction.data();

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    // Convert to 0-100 scale
    const riskScore = Math.round(riskScores[0] * 100);
    const riskLevel = this.getRiskLevel(riskScore);
    const contributingFactors = this.analyzeContributingFactors(input, riskScore);
    const recommendations = this.generateRecommendations(riskLevel, contributingFactors);

    return {
      riskScore,
      riskLevel,
      confidence: 0.85,
      contributingFactors,
      recommendations,
    };
  }

  /**
   * Score using statistical model (fallback)
   */
  private scoreWithStatisticalModel(input: RiskScoringInput): Promise<RiskScoringResult> {
    let riskScore = 0;
    const contributingFactors: RiskScoringResult['contributingFactors'] = [];

    // Age factor (0-30 points)
    const ageFactor = Math.min((input.age / 100) * 30, 30);
    riskScore += ageFactor;
    if (ageFactor > 20) {
      contributingFactors.push({
        factor: 'Advanced age',
        impact: 'negative',
        weight: ageFactor / 100,
      });
    }

    // Vital signs factors (0-25 points)
    const systolicAbnormal = Math.abs(input.systolicBP - 120) / 40;
    const diastolicAbnormal = Math.abs(input.diastolicBP - 80) / 30;
    const tempAbnormal = Math.abs(input.temperature - 98.6) / 5;

    const vitalsScore = Math.min((systolicAbnormal + diastolicAbnormal + tempAbnormal) * 8, 25);
    riskScore += vitalsScore;

    if (vitalsScore > 15) {
      contributingFactors.push({
        factor: 'Abnormal vital signs',
        impact: 'negative',
        weight: vitalsScore / 100,
      });
    }

    // Chronic conditions (0-20 points)
    const chronicScore = (input.chronicConditions?.length || 0) * 5;
    riskScore += Math.min(chronicScore, 20);

    if ((input.chronicConditions?.length || 0) > 0) {
      contributingFactors.push({
        factor: `${input.chronicConditions!.length} chronic condition(s)`,
        impact: 'negative',
        weight: Math.min(chronicScore, 20) / 100,
      });
    }

    // Previous admissions (0-15 points)
    const admissionsScore = Math.min((input.previousAdmissions || 0) * 3, 15);
    riskScore += admissionsScore;

    if ((input.previousAdmissions || 0) > 2) {
      contributingFactors.push({
        factor: `${input.previousAdmissions} previous admission(s)`,
        impact: 'negative',
        weight: admissionsScore / 100,
      });
    }

    // Specific conditions (0-10 points)
    let conditionsScore = 0;
    if (input.diabetes) conditionsScore += 3;
    if (input.hypertension) conditionsScore += 2;
    if (input.heartDisease) conditionsScore += 4;
    if (input.kidneyDisease) conditionsScore += 5;

    riskScore += Math.min(conditionsScore, 10);

    if (conditionsScore > 5) {
      contributingFactors.push({
        factor: 'Multiple comorbidities',
        impact: 'negative',
        weight: Math.min(conditionsScore, 10) / 100,
      });
    }

    // Cap at 100
    riskScore = Math.min(Math.round(riskScore), 100);

    const riskLevel = this.getRiskLevel(riskScore);
    const recommendations = this.generateRecommendations(riskLevel, contributingFactors);

    return Promise.resolve({
      riskScore,
      riskLevel,
      confidence: 0.75,
      contributingFactors,
      recommendations,
    });
  }

  /**
   * Extract features from input
   */
  private extractFeatures(input: RiskScoringInput): number[] {
    return [
      input.age,
      input.gender === 'male' ? 1 : 0,
      input.systolicBP,
      input.diastolicBP,
      input.temperature,
      input.diabetes ? 1 : 0,
      input.previousAdmissions || 0,
      input.chronicConditions?.length || 0,
    ];
  }

  /**
   * Normalize features using mean and std
   */
  private normalizeFeatures(features: number[]): number[] {
    return features.map((value, index) => {
      const mean = this.featureMeans[index] || 0;
      const std = this.featureStds[index] || 1;
      return (value - mean) / std;
    });
  }

  /**
   * Determine risk level from score
   */
  private getRiskLevel(score: number): RiskScoringResult['riskLevel'] {
    if (score < 25) return 'low';
    if (score < 50) return 'moderate';
    if (score < 75) return 'high';
    return 'very-high';
  }

  /**
   * Analyze contributing factors to risk
   */
  private analyzeContributingFactors(
    input: RiskScoringInput,
    riskScore: number
  ): RiskScoringResult['contributingFactors'] {
    const factors: RiskScoringResult['contributingFactors'] = [];

    // Age analysis
    if (input.age > 65) {
      factors.push({
        factor: `Age ${input.age}`,
        impact: 'negative',
        weight: Math.min((input.age - 65) / 35, 1),
      });
    } else if (input.age < 50) {
      factors.push({
        factor: 'Younger age',
        impact: 'positive',
        weight: 0.3,
      });
    }

    // Vital signs analysis
    if (input.systolicBP > 140 || input.systolicBP < 90) {
      factors.push({
        factor: `Abnormal blood pressure (${input.systolicBP}/${input.diastolicBP})`,
        impact: 'negative',
        weight: 0.5,
      });
    }

    if (input.temperature > 101) {
      factors.push({
        factor: `Elevated temperature (${input.temperature}°F)`,
        impact: 'negative',
        weight: 0.4,
      });
    }

    // Medical history
    if (input.previousAdmissions && input.previousAdmissions > 1) {
      factors.push({
        factor: 'History of multiple hospitalizations',
        impact: 'negative',
        weight: 0.6,
      });
    }

    return factors;
  }

  /**
   * Generate care recommendations based on risk level
   */
  private generateRecommendations(
    riskLevel: RiskScoringResult['riskLevel'],
    factors: RiskScoringResult['contributingFactors']
  ): string[] {
    const recommendations: string[] = [];

    switch (riskLevel) {
      case 'very-high':
        recommendations.push('Consider immediate medical evaluation');
        recommendations.push('Monitor vital signs closely');
        recommendations.push('Prepare for potential hospitalization');
        break;

      case 'high':
        recommendations.push('Schedule urgent provider consultation');
        recommendations.push('Daily monitoring of symptoms and vital signs');
        recommendations.push('Review and optimize medication management');
        break;

      case 'moderate':
        recommendations.push('Schedule follow-up within 1-2 weeks');
        recommendations.push('Monitor symptoms and report changes');
        recommendations.push('Ensure medication compliance');
        break;

      case 'low':
        recommendations.push('Routine follow-up as scheduled');
        recommendations.push('Continue preventive care measures');
        recommendations.push('Maintain healthy lifestyle practices');
        break;
    }

    // Add factor-specific recommendations
    factors.forEach(factor => {
      if (factor.factor.includes('blood pressure')) {
        recommendations.push('Monitor blood pressure daily');
      }
      if (factor.factor.includes('temperature')) {
        recommendations.push('Take temperature regularly and stay hydrated');
      }
    });

    return recommendations;
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      ...this.modelConfig,
      isLoaded: this.model !== null,
      featureCount: this.featureMeans.length,
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
    logger.info('Risk Scorer model disposed');
  }
}

// Export singleton instance
export const riskScorer = new RiskScorerModel();
