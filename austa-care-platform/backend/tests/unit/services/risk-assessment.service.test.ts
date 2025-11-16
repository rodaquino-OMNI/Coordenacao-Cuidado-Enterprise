/**
 * Comprehensive Unit Tests for Advanced Risk Assessment Service
 * Coverage: Cardiovascular, Diabetes, Mental Health, Respiratory, Composite Risk
 */

import { AdvancedRiskAssessmentService } from '../../../src/services/risk-assessment.service';
import {
  ProcessedQuestionnaire,
  CardiovascularRisk,
  DiabetesRisk,
  MentalHealthRisk,
  RespiratoryRisk,
  CompositeRisk
} from '../../../src/types/risk.types';

describe('AdvancedRiskAssessmentService', () => {
  let service: AdvancedRiskAssessmentService;

  beforeEach(() => {
    service = new AdvancedRiskAssessmentService();
  });

  describe('Initialization', () => {
    it('should initialize with medical knowledge rules', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AdvancedRiskAssessmentService);
    });

    it('should have emergency thresholds configured', () => {
      const assessment = service['emergencyThresholds'];
      expect(assessment).toBeDefined();
      expect(assessment.size).toBeGreaterThan(0);
    });
  });

  describe('Cardiovascular Risk Assessment', () => {
    it('should detect Acute Coronary Syndrome with chest pain and shortness of breath', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'high', duration: '30min' },
          { symptom: 'falta_ar', severity: 'high', duration: '30min' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.cardiovascular.emergencyIndicators).toContain('ACUTE_CORONARY_SYNDROME_SUSPECTED');
      expect(assessment.cardiovascular.riskLevel).toBe('very_high');
      expect(assessment.cardiovascular.escalationRequired).toBe(true);
      expect(assessment.cardiovascular.timeToEscalation).toBeLessThanOrEqual(2);
    });

    it('should detect cardiac syncope with syncope and chest pain', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'desmaio', severity: 'high', duration: '5min' },
          { symptom: 'dor_peito', severity: 'medium', duration: '15min' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.cardiovascular.emergencyIndicators).toContain('CARDIAC_SYNCOPE_SUSPECTED');
      expect(assessment.cardiovascular.riskLevel).toMatch(/high|very_high/);
    });

    it('should calculate Framingham score correctly for high-risk patient', async () => {
      const questionnaire = createMockQuestionnaire({
        responses: [
          { question: 'idade', answer: '65' },
          { question: 'sexo', answer: 'masculino' }
        ],
        riskFactors: [
          { factor: 'fumante', severity: 'high' },
          { factor: 'diabetes', severity: 'medium' },
          { factor: 'hipertensao', severity: 'medium' },
          { factor: 'colesterol_alto', severity: 'medium' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.cardiovascular.framinghamScore).toBeGreaterThan(10);
      expect(assessment.cardiovascular.riskLevel).not.toBe('low');
    });

    it('should assign low risk for young patient with no symptoms', async () => {
      const questionnaire = createMockQuestionnaire({
        responses: [
          { question: 'idade', answer: '25' },
          { question: 'sexo', answer: 'feminino' }
        ],
        symptoms: [],
        riskFactors: []
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.cardiovascular.riskLevel).toBe('low');
      expect(assessment.cardiovascular.escalationRequired).toBe(false);
    });

    it('should generate appropriate cardiovascular recommendations', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [{ symptom: 'dor_peito', severity: 'medium', duration: '1h' }],
        riskFactors: [{ factor: 'hipertensao', severity: 'medium' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.recommendations).toBeDefined();
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.some(r => r.category === 'urgent')).toBe(true);
    });
  });

  describe('Diabetes Risk Assessment', () => {
    it('should detect complete classic triad (polydipsia, polyphagia, polyuria)', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'fome_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'urina_frequente', severity: 'high', duration: '2weeks' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.diabetes.classicTriad.triadComplete).toBe(true);
      expect(assessment.diabetes.classicTriad.triadScore).toBe(60);
      expect(assessment.diabetes.riskLevel).toMatch(/high|critical/);
    });

    it('should detect DKA risk with complete triad and weight loss', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'fome_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'urina_frequente', severity: 'high', duration: '2weeks' },
          { symptom: 'perda_peso', severity: 'high', duration: '2weeks' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.diabetes.emergencyIndicators).toContain('DIABETIC_KETOACIDOSIS_RISK');
      expect(assessment.diabetes.dkaRisk).toBeGreaterThan(50);
      expect(assessment.diabetes.timeToEscalation).toBeLessThanOrEqual(2);
    });

    it('should calculate ketosis risk with ketone symptoms', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'halito_cetonico', severity: 'high', duration: '1day' },
          { symptom: 'nausea', severity: 'medium', duration: '1day' },
          { symptom: 'vomito', severity: 'medium', duration: '1day' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.diabetes.ketosisRisk).toBeGreaterThan(50);
      expect(assessment.diabetes.emergencyIndicators).toContain('KETOSIS_DETECTED');
    });

    it('should assess moderate risk with partial triad and risk factors', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'medium', duration: '1week' },
          { symptom: 'fadiga', severity: 'medium', duration: '1week' }
        ],
        riskFactors: [
          { factor: 'familia_diabetes', severity: 'medium' },
          { factor: 'obesidade', severity: 'high' }
        ],
        responses: [{ question: 'idade', answer: '50' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.diabetes.riskLevel).toBe('moderate');
      expect(assessment.diabetes.additionalFactors.familyHistory).toBe(true);
      expect(assessment.diabetes.additionalFactors.obesity).toBe(true);
    });

    it('should assign low risk with no diabetes symptoms or risk factors', async () => {
      const questionnaire = createMockQuestionnaire({
        responses: [{ question: 'idade', answer: '30' }],
        symptoms: [],
        riskFactors: []
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.diabetes.riskLevel).toBe('low');
      expect(assessment.diabetes.classicTriad.triadComplete).toBe(false);
    });
  });

  describe('Mental Health Risk Assessment', () => {
    it('should detect imminent suicide risk with plan and ideation', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'pensamento_suicida', severity: 'critical', duration: 'current' },
          { symptom: 'plano_suicida', severity: 'critical', duration: 'current' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.mentalHealth.suicideRisk.riskLevel).toBe('imminent');
      expect(assessment.mentalHealth.suicideRisk.immediateIntervention).toBe(true);
      expect(assessment.mentalHealth.escalationRequired).toBe(true);
      expect(assessment.mentalHealth.timeToEscalation).toBe(0);
    });

    it('should calculate high PHQ-9 score for severe depression', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'tristeza', severity: 'high', duration: '2weeks' },
          { symptom: 'anedonia', severity: 'high', duration: '2weeks' },
          { symptom: 'desesperanca', severity: 'high', duration: '2weeks' },
          { symptom: 'fadiga', severity: 'medium', duration: '2weeks' },
          { symptom: 'insonia', severity: 'medium', duration: '2weeks' },
          { symptom: 'culpa', severity: 'medium', duration: '2weeks' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.mentalHealth.depressionIndicators.phq9Score).toBeGreaterThan(15);
      expect(assessment.mentalHealth.riskLevel).toMatch(/high|severe/);
    });

    it('should calculate high GAD-7 score for severe anxiety', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'preocupacao_excessiva', severity: 'high', duration: '1month' },
          { symptom: 'inquietacao', severity: 'high', duration: '1month' },
          { symptom: 'dificuldade_concentracao', severity: 'high', duration: '1month' },
          { symptom: 'irritabilidade', severity: 'medium', duration: '1month' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.mentalHealth.anxietyIndicators.gad7Score).toBeGreaterThan(10);
      expect(assessment.mentalHealth.riskLevel).not.toBe('low');
    });

    it('should identify protective factors for suicide risk', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [{ symptom: 'tristeza', severity: 'medium', duration: '1week' }],
        riskFactors: [
          { factor: 'apoio_familiar', severity: 'protective' },
          { factor: 'religiosidade', severity: 'protective' },
          { factor: 'filhos', severity: 'protective' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.mentalHealth.suicideRisk.protectiveFactors.length).toBeGreaterThan(0);
      expect(assessment.mentalHealth.suicideRisk.riskLevel).not.toBe('imminent');
    });

    it('should detect high risk with previous suicide attempt', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'pensamento_suicida', severity: 'high', duration: 'current' },
          { symptom: 'tentativa_anterior', severity: 'critical', duration: 'past' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.mentalHealth.suicideRisk.riskLevel).toMatch(/high|imminent/);
      expect(assessment.mentalHealth.suicideRisk.riskFactors).toContain('Tentativa prévia de suicídio');
    });
  });

  describe('Respiratory Risk Assessment', () => {
    it('should detect severe asthma exacerbation', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'chiado', severity: 'high', duration: '2h' },
          { symptom: 'falta_ar', severity: 'critical', duration: '2h' },
          { symptom: 'dificuldade_falar', severity: 'high', duration: '1h' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.respiratory.emergencyIndicators).toContain('SEVERE_ASTHMA_EXACERBATION');
      expect(assessment.respiratory.riskLevel).toBe('critical');
      expect(assessment.respiratory.timeToEscalation).toBeLessThanOrEqual(1);
    });

    it('should detect COPD exacerbation', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dispneia', severity: 'high', duration: '1day' },
          { symptom: 'expectoracao', severity: 'high', duration: '1day' },
          { symptom: 'febre', severity: 'medium', duration: '1day' }
        ],
        riskFactors: [{ factor: 'fumante', severity: 'high' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.respiratory.emergencyIndicators).toContain('COPD_EXACERBATION');
      expect(assessment.respiratory.riskLevel).toMatch(/high|critical/);
    });

    it('should calculate STOP-BANG score for sleep apnea', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'ronco', severity: 'high', duration: 'chronic' },
          { symptom: 'apneia', severity: 'high', duration: 'chronic' },
          { symptom: 'sonolencia_diurna', severity: 'medium', duration: 'chronic' },
          { symptom: 'hipertensao', severity: 'medium', duration: 'chronic' }
        ],
        responses: [
          { question: 'idade', answer: '55' },
          { question: 'sexo', answer: 'masculino' },
          { question: 'imc', answer: '32' },
          { question: 'circunferencia_pescoco', answer: '42' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.respiratory.sleepApneaIndicators.stopBangScore).toBeGreaterThanOrEqual(5);
      expect(assessment.respiratory.sleepApneaIndicators.berlinScore).toBeGreaterThan(0);
    });

    it('should assess asthma severity based on symptoms', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'chiado', severity: 'medium', duration: '1week' },
          { symptom: 'tosse_noturna', severity: 'medium', duration: '1week' },
          { symptom: 'dispneia_esforco', severity: 'medium', duration: '1week' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.respiratory.asthmaIndicators.wheezing).toBe(true);
      expect(assessment.respiratory.asthmaIndicators.nighttimeSymptoms).toBe(true);
      expect(assessment.respiratory.riskLevel).not.toBe('low');
    });
  });

  describe('Composite Risk Analysis', () => {
    it('should calculate high composite risk for multiple critical conditions', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'high', duration: '1h' },
          { symptom: 'sede_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'fome_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'pensamento_suicida', severity: 'high', duration: 'current' }
        ],
        riskFactors: [
          { factor: 'diabetes', severity: 'high' },
          { factor: 'hipertensao', severity: 'high' }
        ],
        responses: [{ question: 'idade', answer: '65' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.composite.riskLevel).toMatch(/high|critical/);
      expect(assessment.composite.multipleConditionsPenalty).toBeGreaterThan(1);
      expect(assessment.composite.emergencyEscalation).toBe(true);
    });

    it('should apply synergy factor for diabetes + cardiovascular disease', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'high', duration: '1month' },
          { symptom: 'dor_peito', severity: 'medium', duration: '3days' }
        ],
        riskFactors: [
          { factor: 'diabetes', severity: 'high' },
          { factor: 'hipertensao', severity: 'medium' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.composite.synergyFactor).toBeGreaterThan(1);
      expect(assessment.composite.overallScore).toBeGreaterThan(30);
    });

    it('should apply age adjustments for elderly patients', async () => {
      const questionnaire = createMockQuestionnaire({
        responses: [{ question: 'idade', answer: '70' }],
        symptoms: [{ symptom: 'fadiga', severity: 'medium', duration: '1week' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.composite.ageAdjustment).toBeGreaterThan(1);
    });

    it('should prioritize emergency conditions correctly', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'critical', duration: '30min' },
          { symptom: 'falta_ar', severity: 'critical', duration: '30min' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.composite.prioritizedConditions[0]).toContain('Emergência');
      expect(assessment.composite.emergencyEscalation).toBe(true);
    });

    it('should recommend routine followup for moderate risk without emergencies', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'fadiga', severity: 'medium', duration: '2weeks' },
          { symptom: 'cefaleia', severity: 'medium', duration: '1week' }
        ],
        responses: [{ question: 'idade', answer: '45' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.composite.routineFollowup).toBe(true);
      expect(assessment.composite.emergencyEscalation).toBe(false);
    });
  });

  describe('Emergency Alerts Generation', () => {
    it('should generate immediate alerts for ACS', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'critical', duration: '20min' },
          { symptom: 'falta_ar', severity: 'high', duration: '20min' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.emergencyAlerts.length).toBeGreaterThan(0);
      expect(assessment.emergencyAlerts[0].severity).toBe('immediate');
      expect(assessment.emergencyAlerts[0].timeToAction).toBeLessThanOrEqual(15);
    });

    it('should generate alerts with correct contact numbers', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [{ symptom: 'pensamento_suicida', severity: 'critical', duration: 'current' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.emergencyAlerts.some(a => a.contactNumbers.includes('188'))).toBe(true);
    });
  });

  describe('Clinical Recommendations', () => {
    it('should generate evidence-based recommendations', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'fome_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'urina_frequente', severity: 'high', duration: '2weeks' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.every(r => r.evidenceLevel)).toBe(true);
      expect(assessment.recommendations.every(r => r.timeframe)).toBe(true);
    });

    it('should prioritize recommendations by urgency', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'high', duration: '2h' },
          { symptom: 'fadiga', severity: 'low', duration: '1week' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.recommendations[0].priority).toBeGreaterThan(assessment.recommendations[assessment.recommendations.length - 1].priority);
    });
  });

  describe('Follow-up Scheduling', () => {
    it('should schedule immediate follow-up for emergencies', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'critical', duration: '30min' },
          { symptom: 'falta_ar', severity: 'critical', duration: '30min' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.followupSchedule.immediate.length).toBeGreaterThan(0);
      expect(assessment.followupSchedule.immediate[0].urgency).toBe('stat');
    });

    it('should schedule appropriate specialist consultations', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'fome_excessiva', severity: 'high', duration: '2weeks' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      const hasEndoConsult = assessment.followupSchedule.within1week.some(
        f => f.specialistType === 'Endocrinologista'
      );
      expect(hasEndoConsult).toBe(true);
    });
  });

  describe('Escalation Protocol', () => {
    it('should trigger immediate escalation for critical conditions', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'dor_peito', severity: 'critical', duration: '15min' },
          { symptom: 'falta_ar', severity: 'critical', duration: '15min' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.escalationProtocol.immediate).toBe(true);
      expect(assessment.escalationProtocol.escalationLevel).toBe('emergency_services');
      expect(assessment.escalationProtocol.timeToEscalation).toBe(0);
    });

    it('should use multiple notification channels for emergencies', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [{ symptom: 'pensamento_suicida', severity: 'critical', duration: 'current' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.escalationProtocol.notificationChannels.length).toBeGreaterThan(2);
      expect(assessment.escalationProtocol.notificationChannels).toContain('call');
    });

    it('should enable automatic scheduling for urgent cases', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [
          { symptom: 'sede_excessiva', severity: 'high', duration: '2weeks' },
          { symptom: 'perda_peso', severity: 'high', duration: '2weeks' }
        ]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.escalationProtocol.automaticScheduling).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle questionnaire with no symptoms', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [],
        riskFactors: [],
        responses: [{ question: 'idade', answer: '30' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment).toBeDefined();
      expect(assessment.composite.riskLevel).toBe('low');
    });

    it('should handle missing age gracefully', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [{ symptom: 'fadiga', severity: 'low', duration: '1day' }],
        responses: []
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment).toBeDefined();
      expect(assessment.composite.ageAdjustment).toBeDefined();
    });

    it('should store assessment for temporal analysis', async () => {
      const questionnaire = createMockQuestionnaire({
        symptoms: [{ symptom: 'fadiga', severity: 'medium', duration: '1week' }]
      });

      const assessment = await service.assessRisk(questionnaire);

      expect(assessment.assessmentId).toBeDefined();
      expect(assessment.timestamp).toBeInstanceOf(Date);
    });
  });
});

// ==================== TEST HELPERS ====================

function createMockQuestionnaire(options: {
  symptoms?: Array<{ symptom: string; severity: string; duration: string }>;
  riskFactors?: Array<{ factor: string; severity: string }>;
  responses?: Array<{ question: string; answer: string }>;
  userId?: string;
}): ProcessedQuestionnaire {
  return {
    userId: options.userId || 'test-user-123',
    questionnaireId: 'test-questionnaire-123',
    timestamp: new Date(),
    extractedSymptoms: (options.symptoms || []).map(s => ({
      symptom: s.symptom,
      severity: s.severity,
      duration: s.duration,
      confidence: 0.9
    })),
    riskFactors: (options.riskFactors || []).map(rf => ({
      factor: rf.factor,
      severity: rf.severity,
      confidence: 0.85
    })),
    emergencyFlags: [],
    responses: (options.responses || []).map(r => ({
      question: r.question,
      answer: r.answer,
      timestamp: new Date()
    }))
  };
}
