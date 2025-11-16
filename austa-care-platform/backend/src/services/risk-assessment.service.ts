/**
 * Advanced Medical Risk Assessment Service
 * Evidence-based algorithms for comprehensive health risk evaluation
 * Brazilian healthcare context with international best practices
 */

import {
  AdvancedRiskAssessment,
  CardiovascularRisk,
  DiabetesRisk,
  MentalHealthRisk,
  RespiratoryRisk,
  CompositeRisk,
  EmergencyAlert,
  ClinicalRecommendation,
  FollowupSchedule,
  EscalationProtocol,
  MedicalKnowledgeRule,
  RiskCorrelationMatrix,
  QuestionnaireResponse,
  ProcessedQuestionnaire,
  ExtractedSymptom,
  ExtractedRiskFactor,
  EmergencyFlag
} from '../types/risk.types';
import { logger } from '../utils/logger';

export class AdvancedRiskAssessmentService {
  private medicalKnowledgeRules: Map<string, MedicalKnowledgeRule> = new Map();
  private correlationMatrix!: RiskCorrelationMatrix;
  private emergencyThresholds: Map<string, number> = new Map();

  constructor() {
    this.initializeMedicalKnowledge();
    this.initializeCorrelationMatrix();
    this.initializeEmergencyThresholds();
  }

  /**
   * Main risk assessment orchestrator
   */
  async assessRisk(questionnaire: ProcessedQuestionnaire): Promise<AdvancedRiskAssessment> {
    logger.info(`Starting advanced risk assessment for user: ${questionnaire.userId}`);

    // Extract symptoms and risk factors
    const extractedData = this.extractMedicalData(questionnaire);
    
    // Individual condition assessments
    const cardiovascular = await this.assessCardiovascularRisk(extractedData);
    const diabetes = await this.assessDiabetesRisk(extractedData);
    const mentalHealth = await this.assessMentalHealthRisk(extractedData);
    const respiratory = await this.assessRespiratoryRisk(extractedData);
    
    // Composite risk analysis
    const composite = await this.assessCompositeRisk({
      cardiovascular,
      diabetes,
      mentalHealth,
      respiratory
    }, extractedData);
    
    // Emergency alerts
    const emergencyAlerts = this.generateEmergencyAlerts({
      cardiovascular,
      diabetes,
      mentalHealth,
      respiratory,
      composite
    });
    
    // Clinical recommendations
    const recommendations = this.generateClinicalRecommendations({
      cardiovascular,
      diabetes,
      mentalHealth,
      respiratory,
      composite
    });
    
    // Follow-up scheduling
    const followupSchedule = this.createFollowupSchedule({
      cardiovascular,
      diabetes,
      mentalHealth,
      respiratory,
      composite
    });
    
    // Escalation protocol
    const escalationProtocol = this.determineEscalationProtocol({
      cardiovascular,
      diabetes,
      mentalHealth,
      respiratory,
      composite
    });

    const assessment: AdvancedRiskAssessment = {
      userId: questionnaire.userId,
      assessmentId: `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      cardiovascular,
      diabetes,
      mentalHealth,
      respiratory,
      composite,
      emergencyAlerts,
      recommendations,
      followupSchedule,
      escalationProtocol
    };

    // Store assessment for temporal analysis
    await this.storeAssessment(assessment);
    
    // Trigger immediate actions if necessary
    await this.triggerImmediateActions(assessment);
    
    logger.info(`Risk assessment completed for user: ${questionnaire.userId}, composite risk: ${composite.riskLevel}`);
    
    return assessment;
  }

  /**
   * Cardiovascular Risk Assessment - Evidence-based Brazilian guidelines
   */
  private async assessCardiovascularRisk(data: ExtractedMedicalData): Promise<CardiovascularRisk> {
    const factors = this.extractCardiovascularFactors(data);
    
    // Emergency indicators check
    const emergencyIndicators: string[] = [];
    
    // Chest pain + shortness of breath at rest = immediate concern
    if (factors.chestPain && factors.shortnessOfBreath) {
      emergencyIndicators.push('ACUTE_CORONARY_SYNDROME_SUSPECTED');
    }
    
    // Syncope + chest pain = urgent evaluation needed
    if (factors.syncope && factors.chestPain) {
      emergencyIndicators.push('CARDIAC_SYNCOPE_SUSPECTED');
    }
    
    // Framingham Risk Score calculation
    const framinghamScore = this.calculateFraminghamScore(factors);
    
    // Overall risk calculation
    let overallScore = framinghamScore;
    
    // Symptom-based adjustments
    if (factors.chestPain) overallScore += 15;
    if (factors.shortnessOfBreath) overallScore += 10;
    if (factors.palpitations) overallScore += 5;
    if (factors.syncope) overallScore += 20;
    
    // Risk level determination
    let riskLevel: CardiovascularRisk['riskLevel'] = 'low';
    if (overallScore >= 20) riskLevel = 'very_high';
    else if (overallScore >= 15) riskLevel = 'high';
    else if (overallScore >= 10) riskLevel = 'intermediate';
    
    // Escalation criteria
    const escalationRequired = emergencyIndicators.length > 0 || riskLevel === 'very_high';
    const timeToEscalation = emergencyIndicators.length > 0 ? 0.5 : riskLevel === 'very_high' ? 2 : 12;
    
    return {
      overallScore,
      riskLevel,
      factors,
      framinghamScore,
      emergencyIndicators,
      recommendations: this.generateCardiovascularRecommendations(riskLevel, factors),
      escalationRequired,
      timeToEscalation
    };
  }

  /**
   * Diabetes Risk Assessment - Classic Triad + Risk Factors
   */
  private async assessDiabetesRisk(data: ExtractedMedicalData): Promise<DiabetesRisk> {
    const factors = this.extractDiabetesFactors(data);
    
    // Classic triad assessment (critical for diabetes detection)
    const classicTriad = {
      polydipsia: this.hasSymptom(data, 'sede_excessiva'),
      polyphagia: this.hasSymptom(data, 'fome_excessiva'),
      polyuria: this.hasSymptom(data, 'urina_frequente'),
      triadComplete: false,
      triadScore: 0
    };
    
    // Calculate triad score
    let triadCount = 0;
    if (classicTriad.polydipsia) triadCount++;
    if (classicTriad.polyphagia) triadCount++;
    if (classicTriad.polyuria) triadCount++;
    
    classicTriad.triadComplete = triadCount === 3;
    classicTriad.triadScore = triadCount * 20; // 60 points for complete triad
    
    // Additional factors
    const additionalFactors = this.extractAdditionalDiabetesFactors(data);
    
    // Emergency indicators
    const emergencyIndicators: string[] = [];
    
    // Complete triad + weight loss = urgent evaluation
    if (classicTriad.triadComplete && additionalFactors.weightLoss) {
      emergencyIndicators.push('DIABETIC_KETOACIDOSIS_RISK');
    }
    
    // Ketosis symptoms
    if (this.hasSymptom(data, 'cetose') || this.hasSymptom(data, 'halito_cetonico')) {
      emergencyIndicators.push('KETOSIS_DETECTED');
    }
    
    // Overall risk calculation
    let overallScore = classicTriad.triadScore;
    
    // Additional factors scoring
    if (additionalFactors.weightLoss) overallScore += 15;
    if (additionalFactors.fatigue) overallScore += 10;
    if (additionalFactors.blurredVision) overallScore += 10;
    if (additionalFactors.slowHealing) overallScore += 8;
    if (additionalFactors.frequentInfections) overallScore += 8;
    if (additionalFactors.familyHistory) overallScore += 12;
    if (additionalFactors.obesity) overallScore += 10;
    
    // Age adjustments
    if (additionalFactors.age > 45) overallScore += 5;
    if (additionalFactors.age > 65) overallScore += 10;
    
    // Risk level determination
    let riskLevel: DiabetesRisk['riskLevel'] = 'low';
    if (overallScore >= 60) riskLevel = 'critical';
    else if (overallScore >= 40) riskLevel = 'high';
    else if (overallScore >= 25) riskLevel = 'moderate';
    
    // DKA risk assessment
    const dkaRisk = this.calculateDKARisk(classicTriad, additionalFactors, data);
    const ketosisRisk = this.calculateKetosisRisk(data);
    
    const timeToEscalation = emergencyIndicators.length > 0 ? 2 : 
                           riskLevel === 'critical' ? 12 : 
                           riskLevel === 'high' ? 24 : 72;
    
    return {
      overallScore,
      riskLevel,
      classicTriad,
      additionalFactors,
      ketosisRisk,
      dkaRisk,
      emergencyIndicators,
      timeToEscalation
    };
  }

  /**
   * Mental Health Risk Assessment - PHQ-9/GAD-7 + Suicide Risk
   */
  private async assessMentalHealthRisk(data: ExtractedMedicalData): Promise<MentalHealthRisk> {
    const depressionIndicators = this.assessDepressionIndicators(data);
    const anxietyIndicators = this.assessAnxietyIndicators(data);
    const suicideRisk = this.assessSuicideRisk(data);
    
    // Calculate overall mental health score
    let overallScore = depressionIndicators.phq9Score + anxietyIndicators.gad7Score;
    
    // Suicide risk adjustment
    if (suicideRisk.riskLevel === 'imminent') overallScore += 50;
    else if (suicideRisk.riskLevel === 'high') overallScore += 30;
    else if (suicideRisk.riskLevel === 'moderate') overallScore += 15;
    
    // Risk level determination
    let riskLevel: MentalHealthRisk['riskLevel'] = 'low';
    if (overallScore >= 40 || suicideRisk.riskLevel === 'imminent') riskLevel = 'severe';
    else if (overallScore >= 25 || suicideRisk.riskLevel === 'high') riskLevel = 'high';
    else if (overallScore >= 15 || suicideRisk.riskLevel === 'moderate') riskLevel = 'moderate';
    
    const escalationRequired = suicideRisk.immediateIntervention || riskLevel === 'severe';
    const timeToEscalation = suicideRisk.immediateIntervention ? 0 : 
                           riskLevel === 'severe' ? 2 : 
                           riskLevel === 'high' ? 12 : 48;
    
    return {
      overallScore,
      riskLevel,
      depressionIndicators,
      anxietyIndicators,
      suicideRisk,
      escalationRequired,
      timeToEscalation
    };
  }

  /**
   * Respiratory Risk Assessment - Asthma, COPD, Sleep Apnea
   */
  private async assessRespiratoryRisk(data: ExtractedMedicalData): Promise<RespiratoryRisk> {
    const asthmaIndicators = this.assessAsthmaIndicators(data);
    const copdIndicators = this.assessCOPDIndicators(data);
    const sleepApneaIndicators = this.assessSleepApneaIndicators(data);
    
    // Emergency indicators
    const emergencyIndicators: string[] = [];
    
    // Severe asthma exacerbation
    if (asthmaIndicators.shortnessOfBreath && asthmaIndicators.wheezing && 
        this.hasSymptom(data, 'dificuldade_falar')) {
      emergencyIndicators.push('SEVERE_ASTHMA_EXACERBATION');
    }
    
    // COPD exacerbation
    if (copdIndicators.dyspnea && copdIndicators.sputumProduction && 
        this.hasSymptom(data, 'febre')) {
      emergencyIndicators.push('COPD_EXACERBATION');
    }
    
    // Calculate overall respiratory score
    let overallScore = 0;
    
    // Asthma scoring
    overallScore += this.calculateAsthmaScore(asthmaIndicators);
    
    // COPD scoring
    overallScore += this.calculateCOPDScore(copdIndicators);
    
    // Sleep apnea scoring
    overallScore += this.calculateSleepApneaScore(sleepApneaIndicators);
    
    // Risk level determination
    let riskLevel: RespiratoryRisk['riskLevel'] = 'low';
    if (overallScore >= 40 || emergencyIndicators.length > 0) riskLevel = 'critical';
    else if (overallScore >= 25) riskLevel = 'high';
    else if (overallScore >= 15) riskLevel = 'moderate';
    
    const timeToEscalation = emergencyIndicators.length > 0 ? 0.5 : 
                           riskLevel === 'critical' ? 2 : 12;
    
    return {
      overallScore,
      riskLevel,
      asthmaIndicators,
      copdIndicators,
      sleepApneaIndicators,
      emergencyIndicators,
      timeToEscalation
    };
  }

  /**
   * Composite Risk Analysis - Multi-dimensional assessment
   */
  private async assessCompositeRisk(
    individualRisks: {
      cardiovascular: CardiovascularRisk;
      diabetes: DiabetesRisk;
      mentalHealth: MentalHealthRisk;
      respiratory: RespiratoryRisk;
    },
    data: ExtractedMedicalData
  ): Promise<CompositeRisk> {
    const { cardiovascular, diabetes, mentalHealth, respiratory } = individualRisks;
    
    // Base composite score
    let overallScore = (
      cardiovascular.overallScore * 0.3 +
      diabetes.overallScore * 0.25 +
      mentalHealth.overallScore * 0.25 +
      respiratory.overallScore * 0.2
    );
    
    // Multiple conditions penalty (exponential risk increase)
    const highRiskConditions = [
      cardiovascular.riskLevel === 'high' || cardiovascular.riskLevel === 'very_high',
      diabetes.riskLevel === 'high' || diabetes.riskLevel === 'critical',
      mentalHealth.riskLevel === 'high' || mentalHealth.riskLevel === 'severe',
      respiratory.riskLevel === 'high' || respiratory.riskLevel === 'critical'
    ].filter(Boolean).length;
    
    const multipleConditionsPenalty = highRiskConditions > 1 ? 
      Math.pow(1.5, highRiskConditions - 1) : 1;
    
    // Synergy factor (certain combinations are particularly dangerous)
    let synergyFactor = 1;
    
    // Diabetes + Cardiovascular = very high risk
    if ((diabetes.riskLevel === 'high' || diabetes.riskLevel === 'critical') &&
        (cardiovascular.riskLevel === 'high' || cardiovascular.riskLevel === 'very_high')) {
      synergyFactor *= 1.8;
    }
    
    // Mental health + chronic conditions = poor outcomes
    if (mentalHealth.riskLevel === 'high' || mentalHealth.riskLevel === 'severe') {
      if (diabetes.riskLevel !== 'low' || cardiovascular.riskLevel !== 'low') {
        synergyFactor *= 1.4;
      }
    }
    
    // Age adjustments
    const age = this.extractAge(data);
    let ageAdjustment = 1;
    if (age > 65) ageAdjustment = 1.3;
    else if (age > 45) ageAdjustment = 1.1;
    else if (age < 18) ageAdjustment = 0.8;
    
    // Gender adjustments (evidence-based)
    const gender = this.extractGender(data);
    let genderAdjustment = 1;
    if (gender === 'M' && cardiovascular.riskLevel !== 'low') genderAdjustment = 1.2;
    if (gender === 'F' && mentalHealth.riskLevel !== 'low') genderAdjustment = 1.1;
    
    // Apply all adjustments
    overallScore = overallScore * multipleConditionsPenalty * synergyFactor * 
                   ageAdjustment * genderAdjustment;
    
    // Risk level determination
    let riskLevel: CompositeRisk['riskLevel'] = 'low';
    if (overallScore >= 70) riskLevel = 'critical';
    else if (overallScore >= 50) riskLevel = 'high';
    else if (overallScore >= 30) riskLevel = 'moderate';
    
    // Emergency escalation
    const emergencyEscalation = 
      cardiovascular.emergencyIndicators.length > 0 ||
      diabetes.emergencyIndicators.length > 0 ||
      mentalHealth.suicideRisk.immediateIntervention ||
      respiratory.emergencyIndicators.length > 0;
    
    const urgentEscalation = !emergencyEscalation && (
      riskLevel === 'critical' ||
      cardiovascular.escalationRequired ||
      diabetes.timeToEscalation <= 2 ||
      mentalHealth.escalationRequired ||
      respiratory.timeToEscalation <= 2
    );
    
    // Prioritize conditions for treatment
    const prioritizedConditions = this.prioritizeConditions(individualRisks);
    
    return {
      overallScore,
      riskLevel,
      multipleConditionsPenalty,
      synergyFactor,
      ageAdjustment,
      genderAdjustment,
      socioeconomicFactors: 1, // Would be calculated from questionnaire data
      accessToCareFactor: 1,   // Would be calculated from location/insurance data
      prioritizedConditions,
      emergencyEscalation,
      urgentEscalation,
      routineFollowup: !emergencyEscalation && !urgentEscalation && riskLevel !== 'low'
    };
  }

  /**
   * Initialize medical knowledge base with evidence-based rules
   */
  private initializeMedicalKnowledge(): void {
    // Diabetes detection rule
    const diabetesRule: MedicalKnowledgeRule = {
      id: 'diabetes_classic_triad',
      name: 'Tríade Clássica do Diabetes',
      description: 'Detecção de diabetes baseada na tríade polidipsia, polifagia, poliúria',
      condition: 'diabetes_mellitus',
      symptoms: ['sede_excessiva', 'fome_excessiva', 'urina_frequente'],
      riskFactors: ['familia_diabetes', 'obesidade', 'idade_45_plus'],
      scoring: {
        basePoints: 0,
        symptomMultipliers: {
          'sede_excessiva': 20,
          'fome_excessiva': 20,
          'urina_frequente': 20,
          'perda_peso': 15,
          'fadiga': 10
        },
        ageFactors: { '45+': 5, '65+': 10 },
        genderFactors: { 'M': 1, 'F': 1 }
      },
      thresholds: { low: 20, moderate: 35, high: 50, critical: 60 },
      escalationCriteria: ['triada_completa', 'perda_peso_rapida', 'cetose'],
      evidenceSource: 'SBD Guidelines 2023',
      lastUpdated: new Date()
    };
    
    this.medicalKnowledgeRules.set('diabetes_classic_triad', diabetesRule);
    
    logger.info('Medical knowledge base initialized with evidence-based rules');
  }

  /**
   * Initialize correlation matrix for compound risk analysis
   */
  private initializeCorrelationMatrix(): void {
    this.correlationMatrix = {
      correlations: {
        'diabetes': { 'cardiovascular': 0.8, 'depression': 0.6, 'sleep_apnea': 0.7 },
        'cardiovascular': { 'diabetes': 0.8, 'sleep_apnea': 0.6, 'anxiety': 0.5 },
        'depression': { 'diabetes': 0.6, 'anxiety': 0.9, 'chronic_pain': 0.7 },
        'sleep_apnea': { 'diabetes': 0.7, 'cardiovascular': 0.6, 'hypertension': 0.8 }
      },
      compoundingFactors: [
        {
          condition1: 'diabetes',
          condition2: 'cardiovascular',
          multiplicationFactor: 1.8,
          evidenceLevel: 'A'
        },
        {
          condition1: 'depression',
          condition2: 'diabetes',
          multiplicationFactor: 1.4,
          evidenceLevel: 'B'
        }
      ],
      exclusivePairs: [],
      dominantConditions: ['acute_coronary_syndrome', 'diabetic_ketoacidosis', 'suicide_risk']
    };
  }

  /**
   * Initialize emergency thresholds
   */
  private initializeEmergencyThresholds(): void {
    this.emergencyThresholds.set('cardiovascular_emergency', 25);
    this.emergencyThresholds.set('diabetes_emergency', 60);
    this.emergencyThresholds.set('suicide_risk', 15);
    this.emergencyThresholds.set('respiratory_emergency', 35);
  }

  // Helper methods for data extraction and scoring
  private extractMedicalData(questionnaire: ProcessedQuestionnaire): ExtractedMedicalData {
    return {
      symptoms: questionnaire.extractedSymptoms,
      riskFactors: questionnaire.riskFactors,
      emergencyFlags: questionnaire.emergencyFlags,
      responses: questionnaire.responses
    };
  }

  private hasSymptom(data: ExtractedMedicalData, symptomName: string): boolean {
    return data.symptoms.some(s => s.symptom.toLowerCase().includes(symptomName.toLowerCase()));
  }

  private extractAge(data: ExtractedMedicalData): number {
    const ageResponse = data.responses.find(r => r.question.toLowerCase().includes('idade'));
    return ageResponse ? Number(ageResponse.answer) : 0;
  }

  private extractGender(data: ExtractedMedicalData): 'M' | 'F' {
    const genderResponse = data.responses.find(r => r.question.toLowerCase().includes('sexo'));
    return genderResponse && genderResponse.answer === 'masculino' ? 'M' : 'F';
  }

  // ==================== CARDIOVASCULAR METHODS ====================

  private extractCardiovascularFactors(data: ExtractedMedicalData): CardiovascularRisk['factors'] {
    return {
      chestPain: this.hasSymptom(data, 'dor_peito') || this.hasSymptom(data, 'dor_toracica'),
      shortnessOfBreath: this.hasSymptom(data, 'falta_ar') || this.hasSymptom(data, 'dispneia'),
      palpitations: this.hasSymptom(data, 'palpitacoes') || this.hasSymptom(data, 'batedeira'),
      syncope: this.hasSymptom(data, 'desmaio') || this.hasSymptom(data, 'sincope'),
      familyHistory: data.riskFactors.some(rf => rf.factor.includes('familiar') && rf.factor.includes('cardiaco')),
      hypertension: this.hasSymptom(data, 'hipertensao') || this.hasSymptom(data, 'pressao_alta'),
      diabetes: this.hasSymptom(data, 'diabetes'),
      smoking: data.riskFactors.some(rf => rf.factor.includes('fumante') || rf.factor.includes('tabagismo')),
      cholesterol: data.riskFactors.some(rf => rf.factor.includes('colesterol')),
      age: this.extractAge(data),
      gender: this.extractGender(data)
    };
  }

  private calculateFraminghamScore(factors: CardiovascularRisk['factors']): number {
    // Simplified Framingham Risk Score adapted for Brazilian population
    let score = 0;

    // Age points
    if (factors.gender === 'M') {
      if (factors.age >= 70) score += 8;
      else if (factors.age >= 60) score += 6;
      else if (factors.age >= 50) score += 4;
      else if (factors.age >= 40) score += 2;
    } else {
      if (factors.age >= 70) score += 7;
      else if (factors.age >= 60) score += 5;
      else if (factors.age >= 50) score += 3;
      else if (factors.age >= 40) score += 1;
    }

    // Risk factor points
    if (factors.smoking) score += 4;
    if (factors.diabetes) score += 3;
    if (factors.hypertension) score += 3;
    if (factors.cholesterol) score += 2;
    if (factors.familyHistory) score += 2;

    return score;
  }

  private generateCardiovascularRecommendations(
    riskLevel: CardiovascularRisk['riskLevel'],
    factors: CardiovascularRisk['factors']
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'very_high') {
      recommendations.push('Avaliação cardiológica emergencial requerida');
      recommendations.push('Eletrocardiograma (ECG) imediato');
      recommendations.push('Exames laboratoriais: troponina, BNP, D-dímero');
    } else if (riskLevel === 'high') {
      recommendations.push('Consulta cardiológica em até 48h');
      recommendations.push('ECG e ecocardiograma dentro de 1 semana');
      recommendations.push('Perfil lipídico completo');
    }

    if (factors.hypertension) {
      recommendations.push('Monitoramento de pressão arterial (MAPA 24h)');
      recommendations.push('Ajuste de terapia anti-hipertensiva conforme Diretriz Brasileira de Hipertensão (SBC)');
    }

    if (factors.smoking) {
      recommendations.push('Encaminhamento para programa de cessação de tabagismo (SUS)');
    }

    if (factors.diabetes && riskLevel !== 'low') {
      recommendations.push('Controle glicêmico rigoroso (meta HbA1c < 7%)');
    }

    return recommendations;
  }

  // ==================== DIABETES METHODS ====================

  private extractDiabetesFactors(data: ExtractedMedicalData): DiabetesRisk['classicTriad'] {
    return {
      polydipsia: this.hasSymptom(data, 'sede_excessiva') || this.hasSymptom(data, 'polidipsia'),
      polyphagia: this.hasSymptom(data, 'fome_excessiva') || this.hasSymptom(data, 'polifagia'),
      polyuria: this.hasSymptom(data, 'urina_frequente') || this.hasSymptom(data, 'poliuria'),
      triadComplete: false,
      triadScore: 0
    };
  }

  private extractAdditionalDiabetesFactors(data: ExtractedMedicalData): DiabetesRisk['additionalFactors'] {
    const age = this.extractAge(data);

    return {
      weightLoss: this.hasSymptom(data, 'perda_peso') || this.hasSymptom(data, 'emagrecimento'),
      fatigue: this.hasSymptom(data, 'fadiga') || this.hasSymptom(data, 'cansaco'),
      blurredVision: this.hasSymptom(data, 'visao_turva') || this.hasSymptom(data, 'visao_embacada'),
      slowHealing: this.hasSymptom(data, 'cicatrizacao_lenta') || this.hasSymptom(data, 'feridas_demoradas'),
      frequentInfections: this.hasSymptom(data, 'infeccoes_frequentes'),
      familyHistory: data.riskFactors.some(rf =>
        rf.factor.toLowerCase().includes('diabetes') &&
        rf.factor.toLowerCase().includes('familiar')
      ),
      obesity: data.riskFactors.some(rf =>
        rf.factor.toLowerCase().includes('obesidade') ||
        rf.factor.toLowerCase().includes('sobrepeso')
      ),
      age,
      gestationalDiabetes: data.riskFactors.some(rf =>
        rf.factor.toLowerCase().includes('gestacional') &&
        rf.factor.toLowerCase().includes('diabetes')
      )
    };
  }

  private calculateDKARisk(
    classicTriad: DiabetesRisk['classicTriad'],
    additionalFactors: DiabetesRisk['additionalFactors'],
    data: ExtractedMedicalData
  ): number {
    // Diabetic Ketoacidosis Risk - Evidence-based Brazilian guidelines
    let dkaRisk = 0;

    // Classic triad is a strong indicator
    if (classicTriad.triadComplete) dkaRisk += 40;
    else dkaRisk += classicTriad.triadScore / 3; // Partial triad

    // Weight loss + triad = very high DKA risk
    if (additionalFactors.weightLoss && classicTriad.triadComplete) dkaRisk += 30;

    // Ketosis symptoms
    if (this.hasSymptom(data, 'cetose') || this.hasSymptom(data, 'halito_cetonico')) dkaRisk += 20;
    if (this.hasSymptom(data, 'nausea') || this.hasSymptom(data, 'vomito')) dkaRisk += 15;
    if (this.hasSymptom(data, 'dor_abdominal')) dkaRisk += 10;
    if (this.hasSymptom(data, 'confusao_mental') || this.hasSymptom(data, 'letargia')) dkaRisk += 15;

    // Respiratory signs (Kussmaul breathing)
    if (this.hasSymptom(data, 'respiracao_profunda') || this.hasSymptom(data, 'hiperventilacao')) dkaRisk += 20;

    return Math.min(dkaRisk, 100);
  }

  private calculateKetosisRisk(data: ExtractedMedicalData): number {
    let ketosisRisk = 0;

    // Direct ketosis indicators
    if (this.hasSymptom(data, 'cetose')) ketosisRisk += 50;
    if (this.hasSymptom(data, 'halito_cetonico') || this.hasSymptom(data, 'halito_frutal')) ketosisRisk += 40;

    // Metabolic indicators
    if (this.hasSymptom(data, 'nausea') || this.hasSymptom(data, 'vomito')) ketosisRisk += 15;
    if (this.hasSymptom(data, 'dor_abdominal')) ketosisRisk += 10;
    if (this.hasSymptom(data, 'desidratacao')) ketosisRisk += 20;

    // Mental status changes
    if (this.hasSymptom(data, 'confusao_mental')) ketosisRisk += 15;

    return Math.min(ketosisRisk, 100);
  }

  // ==================== MENTAL HEALTH METHODS ====================

  private assessDepressionIndicators(data: ExtractedMedicalData): MentalHealthRisk['depressionIndicators'] {
    // PHQ-9 based assessment adapted for Brazilian context
    const indicators = {
      persistentSadness: this.hasSymptom(data, 'tristeza') || this.hasSymptom(data, 'melancolia'),
      anhedonia: this.hasSymptom(data, 'anedonia') || this.hasSymptom(data, 'perda_interesse'),
      fatigue: this.hasSymptom(data, 'fadiga') || this.hasSymptom(data, 'cansaco'),
      sleepDisturbances: this.hasSymptom(data, 'insonia') || this.hasSymptom(data, 'sono_excessivo'),
      appetiteChanges: this.hasSymptom(data, 'perda_apetite') || this.hasSymptom(data, 'apetite_aumentado'),
      concentrationProblems: this.hasSymptom(data, 'dificuldade_concentracao') || this.hasSymptom(data, 'falta_foco'),
      guilt: this.hasSymptom(data, 'culpa') || this.hasSymptom(data, 'inutilidade'),
      hopelessness: this.hasSymptom(data, 'desesperanca') || this.hasSymptom(data, 'sem_futuro'),
      suicidalIdeation: this.hasSymptom(data, 'pensamento_suicida') || this.hasSymptom(data, 'ideacao_suicida'),
      phq9Score: 0
    };

    // Calculate PHQ-9 score (0-27 scale)
    let phq9Score = 0;
    if (indicators.persistentSadness) phq9Score += 3;
    if (indicators.anhedonia) phq9Score += 3;
    if (indicators.fatigue) phq9Score += 2;
    if (indicators.sleepDisturbances) phq9Score += 2;
    if (indicators.appetiteChanges) phq9Score += 2;
    if (indicators.concentrationProblems) phq9Score += 2;
    if (indicators.guilt) phq9Score += 2;
    if (indicators.hopelessness) phq9Score += 3;
    if (indicators.suicidalIdeation) phq9Score += 8; // Critical indicator

    indicators.phq9Score = phq9Score;
    return indicators;
  }

  private assessAnxietyIndicators(data: ExtractedMedicalData): MentalHealthRisk['anxietyIndicators'] {
    // GAD-7 based assessment adapted for Brazilian context
    const indicators = {
      excessiveWorry: this.hasSymptom(data, 'preocupacao_excessiva') || this.hasSymptom(data, 'ansiedade'),
      restlessness: this.hasSymptom(data, 'inquietacao') || this.hasSymptom(data, 'agitacao'),
      fatigue: this.hasSymptom(data, 'fadiga') || this.hasSymptom(data, 'cansaco'),
      concentrationDifficulty: this.hasSymptom(data, 'dificuldade_concentracao'),
      irritability: this.hasSymptom(data, 'irritabilidade') || this.hasSymptom(data, 'nervosismo'),
      muscularTension: this.hasSymptom(data, 'tensao_muscular') || this.hasSymptom(data, 'dor_muscular'),
      sleepProblems: this.hasSymptom(data, 'insonia') || this.hasSymptom(data, 'sono_ruim'),
      gad7Score: 0
    };

    // Calculate GAD-7 score (0-21 scale)
    let gad7Score = 0;
    if (indicators.excessiveWorry) gad7Score += 3;
    if (indicators.restlessness) gad7Score += 3;
    if (indicators.fatigue) gad7Score += 2;
    if (indicators.concentrationDifficulty) gad7Score += 3;
    if (indicators.irritability) gad7Score += 3;
    if (indicators.muscularTension) gad7Score += 2;
    if (indicators.sleepProblems) gad7Score += 2;

    indicators.gad7Score = gad7Score;
    return indicators;
  }

  private assessSuicideRisk(data: ExtractedMedicalData): MentalHealthRisk['suicideRisk'] {
    // Comprehensive suicide risk assessment - Brazilian Mental Health Guidelines
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];

    // Risk factors
    if (this.hasSymptom(data, 'pensamento_suicida')) riskFactors.push('Ideação suicida ativa');
    if (this.hasSymptom(data, 'plano_suicida')) riskFactors.push('Plano suicida estruturado');
    if (this.hasSymptom(data, 'tentativa_anterior')) riskFactors.push('Tentativa prévia de suicídio');
    if (this.hasSymptom(data, 'desesperanca')) riskFactors.push('Desesperança severa');
    if (this.hasSymptom(data, 'isolamento_social')) riskFactors.push('Isolamento social');
    if (this.hasSymptom(data, 'abuso_substancia')) riskFactors.push('Abuso de substâncias');
    if (this.hasSymptom(data, 'psicose')) riskFactors.push('Sintomas psicóticos');

    // Protective factors
    if (data.riskFactors.some(rf => rf.factor.includes('apoio_familiar'))) {
      protectiveFactors.push('Apoio familiar presente');
    }
    if (data.riskFactors.some(rf => rf.factor.includes('religiosidade'))) {
      protectiveFactors.push('Religiosidade/espiritualidade');
    }
    if (data.riskFactors.some(rf => rf.factor.includes('filhos'))) {
      protectiveFactors.push('Responsabilidade com filhos');
    }

    // Determine risk level
    let riskLevel: MentalHealthRisk['suicideRisk']['riskLevel'] = 'none';
    let immediateIntervention = false;

    if (this.hasSymptom(data, 'plano_suicida') && this.hasSymptom(data, 'pensamento_suicida')) {
      riskLevel = 'imminent';
      immediateIntervention = true;
    } else if (riskFactors.length >= 4 || this.hasSymptom(data, 'tentativa_anterior')) {
      riskLevel = 'high';
    } else if (riskFactors.length >= 2 || this.hasSymptom(data, 'pensamento_suicida')) {
      riskLevel = 'moderate';
    } else if (riskFactors.length === 1) {
      riskLevel = 'low';
    }

    return {
      riskLevel,
      riskFactors,
      protectiveFactors,
      immediateIntervention
    };
  }

  // ==================== RESPIRATORY METHODS ====================

  private assessAsthmaIndicators(data: ExtractedMedicalData): RespiratoryRisk['asthmaIndicators'] {
    return {
      wheezing: this.hasSymptom(data, 'chiado') || this.hasSymptom(data, 'sibilo'),
      shortnessOfBreath: this.hasSymptom(data, 'falta_ar') || this.hasSymptom(data, 'dispneia'),
      chestTightness: this.hasSymptom(data, 'aperto_peito') || this.hasSymptom(data, 'opressao_toracica'),
      coughing: this.hasSymptom(data, 'tosse'),
      nighttimeSymptoms: this.hasSymptom(data, 'sintomas_noturnos') || this.hasSymptom(data, 'tosse_noturna'),
      exerciseTriggered: this.hasSymptom(data, 'dispneia_esforco') || this.hasSymptom(data, 'sintomas_exercicio'),
      allergenTriggered: this.hasSymptom(data, 'alergia') || this.hasSymptom(data, 'gatilhos_alergicos'),
      peakFlowReduction: data.riskFactors.some(rf => rf.factor.includes('pico_fluxo_reduzido'))
    };
  }

  private assessCOPDIndicators(data: ExtractedMedicalData): RespiratoryRisk['copdIndicators'] {
    return {
      chronicCough: this.hasSymptom(data, 'tosse_cronica'),
      sputumProduction: this.hasSymptom(data, 'expectoracao') || this.hasSymptom(data, 'catarro'),
      dyspnea: this.hasSymptom(data, 'dispneia') || this.hasSymptom(data, 'falta_ar'),
      smokingHistory: data.riskFactors.some(rf =>
        rf.factor.toLowerCase().includes('fumante') ||
        rf.factor.toLowerCase().includes('ex-fumante') ||
        rf.factor.toLowerCase().includes('tabagismo')
      ),
      age: this.extractAge(data),
      occupationalExposure: data.riskFactors.some(rf =>
        rf.factor.toLowerCase().includes('exposicao_ocupacional') ||
        rf.factor.toLowerCase().includes('poeira') ||
        rf.factor.toLowerCase().includes('quimicos')
      )
    };
  }

  private assessSleepApneaIndicators(data: ExtractedMedicalData): RespiratoryRisk['sleepApneaIndicators'] {
    const bmiResponse = data.responses.find(r => r.question.toLowerCase().includes('imc') || r.question.toLowerCase().includes('peso'));
    const bmi = bmiResponse ? Number(bmiResponse.answer) : 0;

    const neckResponse = data.responses.find(r => r.question.toLowerCase().includes('pescoco') || r.question.toLowerCase().includes('circunferencia'));
    const neckCircumference = neckResponse ? Number(neckResponse.answer) : 0;

    const indicators = {
      snoring: this.hasSymptom(data, 'ronco'),
      breathingPauses: this.hasSymptom(data, 'apneia') || this.hasSymptom(data, 'pausas_respiratorias'),
      daytimeSleepiness: this.hasSymptom(data, 'sonolencia_diurna') || this.hasSymptom(data, 'cansaco_diurno'),
      morningHeadaches: this.hasSymptom(data, 'cefaleia_matinal') || this.hasSymptom(data, 'dor_cabeca_manha'),
      obesityBMI: bmi,
      neckCircumference,
      hypertension: this.hasSymptom(data, 'hipertensao') || this.hasSymptom(data, 'pressao_alta'),
      berlinScore: 0,
      stopBangScore: 0
    };

    // Berlin Questionnaire Score (simplified)
    let berlinScore = 0;
    if (indicators.snoring) berlinScore += 1;
    if (indicators.breathingPauses) berlinScore += 1;
    if (indicators.daytimeSleepiness) berlinScore += 1;
    if (indicators.obesityBMI > 30) berlinScore += 1;
    if (indicators.hypertension) berlinScore += 1;
    indicators.berlinScore = berlinScore;

    // STOP-BANG Score
    let stopBangScore = 0;
    if (indicators.snoring) stopBangScore += 1;
    if (indicators.daytimeSleepiness) stopBangScore += 1;
    if (indicators.breathingPauses) stopBangScore += 1;
    if (indicators.obesityBMI > 35) stopBangScore += 1;
    if (this.extractAge(data) > 50) stopBangScore += 1;
    if (indicators.neckCircumference > 40) stopBangScore += 1;
    if (this.extractGender(data) === 'M') stopBangScore += 1;
    if (indicators.hypertension) stopBangScore += 1;
    indicators.stopBangScore = stopBangScore;

    return indicators;
  }

  private calculateAsthmaScore(indicators: RespiratoryRisk['asthmaIndicators']): number {
    // Evidence-based asthma severity scoring
    let score = 0;

    // Core symptoms
    if (indicators.wheezing) score += 8;
    if (indicators.shortnessOfBreath) score += 10;
    if (indicators.chestTightness) score += 6;
    if (indicators.coughing) score += 4;

    // Severity indicators
    if (indicators.nighttimeSymptoms) score += 8; // Indicates poor control
    if (indicators.exerciseTriggered) score += 5;
    if (indicators.allergenTriggered) score += 3;
    if (indicators.peakFlowReduction) score += 10;

    return score;
  }

  private calculateCOPDScore(indicators: RespiratoryRisk['copdIndicators']): number {
    // mMRC + GOLD criteria adapted scoring
    let score = 0;

    // Classic COPD triad
    if (indicators.chronicCough) score += 6;
    if (indicators.sputumProduction) score += 6;
    if (indicators.dyspnea) score += 10;

    // Major risk factors
    if (indicators.smokingHistory) score += 12; // Most important risk factor
    if (indicators.age > 40) score += 5;
    if (indicators.age > 60) score += 8;
    if (indicators.occupationalExposure) score += 6;

    return score;
  }

  private calculateSleepApneaScore(indicators: RespiratoryRisk['sleepApneaIndicators']): number {
    // STOP-BANG based scoring
    let score = indicators.stopBangScore * 5; // 0-40 scale

    // Additional severity modifiers
    if (indicators.berlinScore >= 2) score += 10;
    if (indicators.obesityBMI > 35) score += 8;
    if (indicators.neckCircumference > 43) score += 5;

    return score;
  }

  // ==================== COMPOSITE METHODS ====================

  private prioritizeConditions(
    individualRisks: {
      cardiovascular: CardiovascularRisk;
      diabetes: DiabetesRisk;
      mentalHealth: MentalHealthRisk;
      respiratory: RespiratoryRisk;
    }
  ): string[] {
    const { cardiovascular, diabetes, mentalHealth, respiratory } = individualRisks;

    interface ConditionPriority {
      condition: string;
      priority: number;
      urgency: number;
    }

    const conditions: ConditionPriority[] = [];

    // Emergency conditions always first
    if (cardiovascular.emergencyIndicators.length > 0) {
      conditions.push({
        condition: 'Emergência Cardiovascular',
        priority: 100,
        urgency: cardiovascular.timeToEscalation
      });
    }

    if (mentalHealth.suicideRisk.immediateIntervention) {
      conditions.push({
        condition: 'Risco Suicida Iminente',
        priority: 100,
        urgency: 0
      });
    }

    if (diabetes.emergencyIndicators.includes('DIABETIC_KETOACIDOSIS_RISK')) {
      conditions.push({
        condition: 'Cetoacidose Diabética',
        priority: 95,
        urgency: diabetes.timeToEscalation
      });
    }

    if (respiratory.emergencyIndicators.length > 0) {
      conditions.push({
        condition: 'Emergência Respiratória',
        priority: 90,
        urgency: respiratory.timeToEscalation
      });
    }

    // High-risk chronic conditions
    if (cardiovascular.riskLevel === 'very_high' || cardiovascular.riskLevel === 'high') {
      conditions.push({
        condition: 'Risco Cardiovascular Alto',
        priority: 80,
        urgency: cardiovascular.timeToEscalation
      });
    }

    if (diabetes.riskLevel === 'critical' || diabetes.riskLevel === 'high') {
      conditions.push({
        condition: 'Diabetes de Alto Risco',
        priority: 75,
        urgency: diabetes.timeToEscalation
      });
    }

    if (mentalHealth.riskLevel === 'severe' || mentalHealth.riskLevel === 'high') {
      conditions.push({
        condition: 'Transtorno Mental Grave',
        priority: 70,
        urgency: mentalHealth.timeToEscalation
      });
    }

    if (respiratory.riskLevel === 'critical' || respiratory.riskLevel === 'high') {
      conditions.push({
        condition: 'Doença Respiratória Grave',
        priority: 65,
        urgency: respiratory.timeToEscalation
      });
    }

    // Sort by priority (descending), then by urgency (ascending - lower hours = more urgent)
    conditions.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.urgency - b.urgency;
    });

    return conditions.map(c => c.condition);
  }

  // ==================== ALERT & RECOMMENDATION METHODS ====================

  private generateEmergencyAlerts(risks: {
    cardiovascular: CardiovascularRisk;
    diabetes: DiabetesRisk;
    mentalHealth: MentalHealthRisk;
    respiratory: RespiratoryRisk;
    composite: CompositeRisk;
  }): EmergencyAlert[] {
    const alerts: EmergencyAlert[] = [];

    // Cardiovascular emergencies
    if (risks.cardiovascular.emergencyIndicators.includes('ACUTE_CORONARY_SYNDROME_SUSPECTED')) {
      alerts.push({
        id: `alert_${Date.now()}_acs`,
        severity: 'immediate',
        condition: 'Suspeita de Síndrome Coronariana Aguda',
        symptoms: ['Dor no peito', 'Falta de ar'],
        timeToAction: 15, // 15 minutes
        actions: [
          'Ligar 192 (SAMU) imediatamente',
          'Não dirigir até o hospital - aguardar ambulância',
          'Mascar 200mg de AAS se disponível',
          'Permanecer em repouso absoluto'
        ],
        contactNumbers: ['192', '193'],
        automated: true
      });
    }

    if (risks.cardiovascular.emergencyIndicators.includes('CARDIAC_SYNCOPE_SUSPECTED')) {
      alerts.push({
        id: `alert_${Date.now()}_syncope`,
        severity: 'critical',
        condition: 'Síncope de Origem Cardíaca',
        symptoms: ['Desmaio', 'Dor no peito'],
        timeToAction: 30,
        actions: [
          'Avaliação médica urgente em até 1 hora',
          'ECG e monitoramento cardíaco',
          'Não ficar sozinho até avaliação médica'
        ],
        contactNumbers: ['192'],
        automated: true
      });
    }

    // Diabetes emergencies
    if (risks.diabetes.emergencyIndicators.includes('DIABETIC_KETOACIDOSIS_RISK')) {
      alerts.push({
        id: `alert_${Date.now()}_dka`,
        severity: 'critical',
        condition: 'Risco de Cetoacidose Diabética',
        symptoms: ['Tríade clássica do diabetes', 'Perda de peso'],
        timeToAction: 120, // 2 hours
        actions: [
          'Procurar pronto-socorro imediatamente',
          'Exames urgentes: glicemia, gasometria, cetonas',
          'Hidratação venosa e insulinoterapia urgente',
          'Não aguardar agendamento - ir ao PS agora'
        ],
        contactNumbers: ['192'],
        automated: true
      });
    }

    if (risks.diabetes.emergencyIndicators.includes('KETOSIS_DETECTED')) {
      alerts.push({
        id: `alert_${Date.now()}_ketosis`,
        severity: 'high',
        condition: 'Cetose Detectada',
        symptoms: ['Hálito cetônico', 'Náuseas'],
        timeToAction: 180, // 3 hours
        actions: [
          'Medir glicemia capilar',
          'Hidratação oral abundante',
          'Procurar atendimento médico em até 3 horas',
          'Monitorar sintomas de piora'
        ],
        contactNumbers: [],
        automated: true
      });
    }

    // Mental health emergencies
    if (risks.mentalHealth.suicideRisk.immediateIntervention) {
      alerts.push({
        id: `alert_${Date.now()}_suicide`,
        severity: 'immediate',
        condition: 'Risco Suicida Iminente',
        symptoms: ['Ideação suicida', 'Plano estruturado'],
        timeToAction: 0, // Immediate
        actions: [
          'CVV - 188 (24h, gratuito e sigiloso)',
          'SAMU 192 se tentativa em andamento',
          'Não deixar a pessoa sozinha',
          'Remover meios letais do ambiente',
          'Encaminhar para CAPS ou emergência psiquiátrica'
        ],
        contactNumbers: ['188', '192'],
        automated: true
      });
    }

    // Respiratory emergencies
    if (risks.respiratory.emergencyIndicators.includes('SEVERE_ASTHMA_EXACERBATION')) {
      alerts.push({
        id: `alert_${Date.now()}_asthma`,
        severity: 'immediate',
        condition: 'Crise Asmática Grave',
        symptoms: ['Falta de ar intensa', 'Chiado', 'Dificuldade para falar'],
        timeToAction: 30,
        actions: [
          'Usar broncodilatador de resgate (até 3 doses)',
          'Ligar 192 se não houver melhora',
          'Sentar-se em posição ereta',
          'Pronto-socorro imediatamente se lábios/unhas azulados'
        ],
        contactNumbers: ['192'],
        automated: true
      });
    }

    if (risks.respiratory.emergencyIndicators.includes('COPD_EXACERBATION')) {
      alerts.push({
        id: `alert_${Date.now()}_copd`,
        severity: 'critical',
        condition: 'Exacerbação de DPOC',
        symptoms: ['Dispneia', 'Expectoração purulenta', 'Febre'],
        timeToAction: 60,
        actions: [
          'Procurar pronto-socorro em até 2 horas',
          'Levar medicações em uso',
          'Oxigenoterapia pode ser necessária',
          'Antibioticoterapia e corticoides urgentes'
        ],
        contactNumbers: ['192'],
        automated: true
      });
    }

    return alerts;
  }

  private generateClinicalRecommendations(risks: {
    cardiovascular: CardiovascularRisk;
    diabetes: DiabetesRisk;
    mentalHealth: MentalHealthRisk;
    respiratory: RespiratoryRisk;
    composite: CompositeRisk;
  }): ClinicalRecommendation[] {
    const recommendations: ClinicalRecommendation[] = [];

    // Cardiovascular recommendations
    if (risks.cardiovascular.riskLevel !== 'low') {
      recommendations.push({
        id: `rec_${Date.now()}_cv_eval`,
        category: risks.cardiovascular.riskLevel === 'very_high' ? 'immediate' : 'urgent',
        condition: 'Risco Cardiovascular',
        recommendation: 'Avaliação cardiológica completa com ECG, ecocardiograma e perfil lipídico',
        evidenceLevel: 'A',
        timeframe: risks.cardiovascular.riskLevel === 'very_high' ? '24 horas' : '1 semana',
        priority: risks.cardiovascular.riskLevel === 'very_high' ? 95 : 80,
        costEffectiveness: 'high'
      });

      if (risks.cardiovascular.factors.smoking) {
        recommendations.push({
          id: `rec_${Date.now()}_smoking`,
          category: 'preventive',
          condition: 'Tabagismo',
          recommendation: 'Programa de cessação de tabagismo (disponível no SUS)',
          evidenceLevel: 'A',
          timeframe: 'Iniciar em até 2 semanas',
          priority: 85,
          costEffectiveness: 'high'
        });
      }
    }

    // Diabetes recommendations
    if (risks.diabetes.classicTriad.triadComplete) {
      recommendations.push({
        id: `rec_${Date.now()}_dm_diagnosis`,
        category: 'urgent',
        condition: 'Suspeita de Diabetes Mellitus',
        recommendation: 'Exames diagnósticos urgentes: glicemia de jejum, HbA1c, glicemia 2h pós-prandial',
        evidenceLevel: 'A',
        timeframe: risks.diabetes.riskLevel === 'critical' ? '24 horas' : '3 dias',
        priority: 90,
        costEffectiveness: 'high'
      });
    }

    if (risks.diabetes.riskLevel === 'high' || risks.diabetes.riskLevel === 'critical') {
      recommendations.push({
        id: `rec_${Date.now()}_dm_endo`,
        category: 'urgent',
        condition: 'Diabetes de Alto Risco',
        recommendation: 'Consulta endocrinológica urgente para avaliação e início de tratamento',
        evidenceLevel: 'A',
        timeframe: '1 semana',
        priority: 85,
        costEffectiveness: 'high'
      });
    }

    // Mental health recommendations
    if (risks.mentalHealth.depressionIndicators.phq9Score >= 15) {
      recommendations.push({
        id: `rec_${Date.now()}_depression`,
        category: risks.mentalHealth.riskLevel === 'severe' ? 'urgent' : 'routine',
        condition: 'Depressão Moderada a Grave',
        recommendation: 'Avaliação psiquiátrica e início de tratamento (psicoterapia + farmacoterapia)',
        evidenceLevel: 'A',
        timeframe: risks.mentalHealth.riskLevel === 'severe' ? '48 horas' : '1 semana',
        priority: 80,
        costEffectiveness: 'high'
      });
    }

    if (risks.mentalHealth.anxietyIndicators.gad7Score >= 10) {
      recommendations.push({
        id: `rec_${Date.now()}_anxiety`,
        category: 'routine',
        condition: 'Transtorno de Ansiedade',
        recommendation: 'Terapia cognitivo-comportamental (disponível no CAPS) e avaliação para farmacoterapia',
        evidenceLevel: 'A',
        timeframe: '2 semanas',
        priority: 70,
        costEffectiveness: 'high'
      });
    }

    // Respiratory recommendations
    if (risks.respiratory.asthmaIndicators.wheezing || risks.respiratory.asthmaIndicators.shortnessOfBreath) {
      recommendations.push({
        id: `rec_${Date.now()}_asthma`,
        category: risks.respiratory.riskLevel === 'critical' ? 'immediate' : 'urgent',
        condition: 'Asma',
        recommendation: 'Avaliação pneumológica, espirometria e plano de ação para asma',
        evidenceLevel: 'A',
        timeframe: risks.respiratory.riskLevel === 'critical' ? '24 horas' : '1 semana',
        priority: 75,
        costEffectiveness: 'high'
      });
    }

    if (risks.respiratory.sleepApneaIndicators.stopBangScore >= 3) {
      recommendations.push({
        id: `rec_${Date.now()}_sleep_apnea`,
        category: 'routine',
        condition: 'Suspeita de Apneia do Sono',
        recommendation: 'Polissonografia e avaliação para CPAP se confirmado',
        evidenceLevel: 'A',
        timeframe: '1 mês',
        priority: 60,
        costEffectiveness: 'medium'
      });
    }

    // Composite recommendations
    if (risks.composite.multipleConditionsPenalty > 1.5) {
      recommendations.push({
        id: `rec_${Date.now()}_multimorbidity`,
        category: 'urgent',
        condition: 'Múltiplas Condições Crônicas',
        recommendation: 'Programa de cuidado integrado com equipe multidisciplinar (médico, enfermeiro, nutricionista)',
        evidenceLevel: 'B',
        timeframe: '2 semanas',
        priority: 85,
        costEffectiveness: 'high'
      });
    }

    // Sort by priority (descending)
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations;
  }

  private createFollowupSchedule(risks: {
    cardiovascular: CardiovascularRisk;
    diabetes: DiabetesRisk;
    mentalHealth: MentalHealthRisk;
    respiratory: RespiratoryRisk;
    composite: CompositeRisk;
  }): FollowupSchedule {
    const schedule: FollowupSchedule = {
      immediate: [],
      within24h: [],
      within1week: [],
      within1month: [],
      routine: []
    };

    // Immediate actions (emergencies)
    if (risks.cardiovascular.emergencyIndicators.length > 0) {
      schedule.immediate.push({
        action: 'Avaliação em pronto-socorro - Síndrome Coronariana Aguda',
        specialistType: 'Cardiologista',
        urgency: 'stat',
        automated: true
      });
    }

    if (risks.mentalHealth.suicideRisk.immediateIntervention) {
      schedule.immediate.push({
        action: 'Intervenção psiquiátrica de emergência - Risco suicida',
        specialistType: 'Psiquiatra',
        urgency: 'stat',
        automated: true
      });
    }

    if (risks.respiratory.emergencyIndicators.includes('SEVERE_ASTHMA_EXACERBATION')) {
      schedule.immediate.push({
        action: 'Atendimento emergencial - Crise asmática grave',
        specialistType: 'Pneumologista/Emergencista',
        urgency: 'stat',
        automated: true
      });
    }

    // Within 24 hours
    if (risks.cardiovascular.riskLevel === 'very_high' && risks.cardiovascular.emergencyIndicators.length === 0) {
      schedule.within24h.push({
        action: 'Consulta cardiológica urgente com ECG',
        specialistType: 'Cardiologista',
        urgency: 'urgent',
        automated: true
      });
    }

    if (risks.diabetes.riskLevel === 'critical') {
      schedule.within24h.push({
        action: 'Exames laboratoriais: glicemia, HbA1c, função renal',
        urgency: 'urgent',
        automated: true
      });
    }

    // Within 1 week
    if (risks.cardiovascular.riskLevel === 'high') {
      schedule.within1week.push({
        action: 'Consulta cardiológica + ecocardiograma',
        specialistType: 'Cardiologista',
        urgency: 'urgent',
        automated: false
      });
    }

    if (risks.diabetes.classicTriad.triadComplete) {
      schedule.within1week.push({
        action: 'Consulta endocrinológica para diagnóstico e tratamento',
        specialistType: 'Endocrinologista',
        urgency: 'urgent',
        automated: false
      });
    }

    if (risks.mentalHealth.riskLevel === 'severe' || risks.mentalHealth.riskLevel === 'high') {
      schedule.within1week.push({
        action: 'Avaliação psiquiátrica e início de tratamento',
        specialistType: 'Psiquiatra',
        urgency: 'urgent',
        automated: false
      });
    }

    if (risks.respiratory.riskLevel === 'high' || risks.respiratory.riskLevel === 'critical') {
      schedule.within1week.push({
        action: 'Consulta pneumológica + espirometria',
        specialistType: 'Pneumologista',
        urgency: 'urgent',
        automated: false
      });
    }

    // Within 1 month
    if (risks.diabetes.riskLevel === 'moderate' || risks.diabetes.riskLevel === 'high') {
      schedule.within1month.push({
        action: 'Avaliação oftalmológica (fundo de olho)',
        specialistType: 'Oftalmologista',
        urgency: 'routine',
        automated: false
      });

      schedule.within1month.push({
        action: 'Consulta com nutricionista',
        specialistType: 'Nutricionista',
        urgency: 'routine',
        automated: false
      });
    }

    if (risks.respiratory.sleepApneaIndicators.stopBangScore >= 3) {
      schedule.within1month.push({
        action: 'Polissonografia',
        specialistType: 'Médico do Sono',
        urgency: 'routine',
        automated: false
      });
    }

    // Routine follow-up
    if (risks.composite.routineFollowup) {
      schedule.routine.push({
        action: 'Consulta de acompanhamento em medicina de família',
        specialistType: 'Clínico Geral',
        urgency: 'routine',
        automated: false,
        estimatedCost: 0 // SUS gratuito
      });
    }

    if (risks.cardiovascular.riskLevel !== 'low' || risks.diabetes.riskLevel !== 'low') {
      schedule.routine.push({
        action: 'Exames de rotina trimestrais (glicemia, lipidograma, função renal)',
        urgency: 'routine',
        automated: false,
        estimatedCost: 0
      });
    }

    return schedule;
  }

  private determineEscalationProtocol(risks: {
    cardiovascular: CardiovascularRisk;
    diabetes: DiabetesRisk;
    mentalHealth: MentalHealthRisk;
    respiratory: RespiratoryRisk;
    composite: CompositeRisk;
  }): EscalationProtocol {
    // Determine if immediate emergency services needed
    const immediate =
      risks.cardiovascular.emergencyIndicators.length > 0 ||
      risks.mentalHealth.suicideRisk.immediateIntervention ||
      risks.respiratory.emergencyIndicators.includes('SEVERE_ASTHMA_EXACERBATION');

    // Determine if urgent physician review needed
    const urgent = !immediate && (
      risks.composite.urgentEscalation ||
      risks.cardiovascular.riskLevel === 'very_high' ||
      risks.diabetes.riskLevel === 'critical' ||
      risks.mentalHealth.riskLevel === 'severe' ||
      risks.respiratory.riskLevel === 'critical'
    );

    // Calculate time to escalation (in hours)
    let timeToEscalation = 72; // Default: 3 days for routine

    if (immediate) {
      timeToEscalation = 0; // Immediate
    } else if (urgent) {
      // Use the shortest time from all conditions
      const times = [
        risks.cardiovascular.timeToEscalation,
        risks.diabetes.timeToEscalation,
        risks.mentalHealth.timeToEscalation,
        risks.respiratory.timeToEscalation
      ].filter(t => t > 0);

      timeToEscalation = times.length > 0 ? Math.min(...times) : 24;
    }

    // Determine escalation level
    let escalationLevel: EscalationProtocol['escalationLevel'] = 'ai_only';

    if (immediate) {
      escalationLevel = 'emergency_services';
    } else if (urgent) {
      escalationLevel = 'physician_review';
    } else if (risks.composite.riskLevel === 'moderate' || risks.composite.riskLevel === 'high') {
      escalationLevel = 'nurse_review';
    }

    // Determine notification channels
    const notificationChannels: EscalationProtocol['notificationChannels'] = ['email'];

    if (immediate) {
      notificationChannels.push('call', 'sms', 'whatsapp'); // All channels for emergency
    } else if (urgent) {
      notificationChannels.push('sms', 'whatsapp');
    } else if (escalationLevel === 'nurse_review') {
      notificationChannels.push('whatsapp');
    }

    // Automatic scheduling
    const automaticScheduling = urgent || immediate;

    return {
      immediate,
      urgent,
      timeToEscalation,
      escalationLevel,
      notificationChannels,
      automaticScheduling
    };
  }
  
  private async storeAssessment(assessment: AdvancedRiskAssessment): Promise<void> {
    // Store in database for temporal analysis
    logger.info(`Storing assessment: ${assessment.assessmentId}`);
  }

  private async triggerImmediateActions(assessment: AdvancedRiskAssessment): Promise<void> {
    if (assessment.emergencyAlerts.length > 0) {
      logger.warn(`Emergency alerts triggered for user: ${assessment.userId}`);
      // Trigger immediate notifications, appointments, etc.
    }
  }
}

interface ExtractedMedicalData {
  symptoms: ExtractedSymptom[];
  riskFactors: ExtractedRiskFactor[];
  emergencyFlags: EmergencyFlag[];
  responses: QuestionnaireResponse[];
}