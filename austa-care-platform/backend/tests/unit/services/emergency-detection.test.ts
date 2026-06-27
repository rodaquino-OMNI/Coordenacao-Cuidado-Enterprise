/**
 * Basic smoke test for the Emergency Detection Service.
 * Verifies the service instantiates and detects emergencies
 * from a completed risk assessment.
 */

import {
  EmergencyDetectionService,
  EmergencyConfig,
} from '../../../src/services/emergency-detection.service';
import { AdvancedRiskAssessment } from '../../../src/types/risk.types';

const DEFAULT_CONFIG: EmergencyConfig = {
  autoEscalation: true,
  emergencyContacts: [
    {
      id: 'samu-192',
      type: 'samu',
      name: 'SAMU',
      phone: '192',
      priority: 1,
      available24h: true,
    },
  ],
  escalationTimeouts: { immediate: 0, critical: 30, high: 120 },
  notificationChannels: [],
};

function mockAssessment(
  overrides: Partial<AdvancedRiskAssessment> = {},
): AdvancedRiskAssessment {
  const base: AdvancedRiskAssessment = {
    userId: 'test-user-ec',
    assessmentId: 'asmt-001',
    timestamp: new Date(),
    algorithmVersion: 'risk-v1.0.0',
    cardiovascular: {
      overallScore: 0,
      riskLevel: 'low',
      factors: {
        chestPain: false,
        shortnessOfBreath: false,
        palpitations: false,
        syncope: false,
        familyHistory: false,
        hypertension: false,
        diabetes: false,
        smoking: false,
        cholesterol: false,
        age: 35,
        gender: 'F',
      },
      framinghamScore: 0,
      emergencyIndicators: [],
      recommendations: [],
      escalationRequired: false,
      timeToEscalation: 72,
    },
    diabetes: {
      overallScore: 0,
      riskLevel: 'low',
      classicTriad: {
        polydipsia: false,
        polyphagia: false,
        polyuria: false,
        triadComplete: false,
        triadScore: 0,
      },
      additionalFactors: {
        weightLoss: false,
        fatigue: false,
        blurredVision: false,
        slowHealing: false,
        frequentInfections: false,
        familyHistory: false,
        obesity: false,
        age: 35,
        gestationalDiabetes: false,
      },
      ketosisRisk: 0,
      dkaRisk: 0,
      emergencyIndicators: [],
      timeToEscalation: 72,
    },
    mentalHealth: {
      overallScore: 0,
      riskLevel: 'low',
      depressionIndicators: {
        persistentSadness: false,
        anhedonia: false,
        fatigue: false,
        sleepDisturbances: false,
        appetiteChanges: false,
        concentrationProblems: false,
        guilt: false,
        hopelessness: false,
        suicidalIdeation: false,
        phq9Score: 0,
      },
      anxietyIndicators: {
        excessiveWorry: false,
        restlessness: false,
        fatigue: false,
        concentrationDifficulty: false,
        irritability: false,
        muscularTension: false,
        sleepProblems: false,
        gad7Score: 0,
      },
      suicideRisk: {
        riskLevel: 'none',
        protectiveFactors: [],
        riskFactors: [],
        immediateIntervention: false,
      },
      escalationRequired: false,
      timeToEscalation: 72,
    },
    respiratory: {
      overallScore: 0,
      riskLevel: 'low',
      asthmaIndicators: {
        wheezing: false,
        shortnessOfBreath: false,
        chestTightness: false,
        coughing: false,
        nighttimeSymptoms: false,
        exerciseTriggered: false,
        allergenTriggered: false,
        peakFlowReduction: false,
      },
      copdIndicators: {
        chronicCough: false,
        sputumProduction: false,
        dyspnea: false,
        smokingHistory: false,
        age: 35,
        occupationalExposure: false,
      },
      sleepApneaIndicators: {
        snoring: false,
        breathingPauses: false,
        daytimeSleepiness: false,
        morningHeadaches: false,
        obesityBMI: 25,
        neckCircumference: 38,
        hypertension: false,
        berlinScore: 0,
        stopBangScore: 0,
      },
      emergencyIndicators: [],
      timeToEscalation: 72,
    },
    composite: {
      overallScore: 0,
      riskLevel: 'low',
      multipleConditionsPenalty: 1,
      synergyFactor: 1,
      ageAdjustment: 1,
      genderAdjustment: 1,
      socioeconomicFactors: 1,
      accessToCareFactor: 1,
      prioritizedConditions: [],
      emergencyEscalation: false,
      urgentEscalation: false,
      routineFollowup: false,
    },
    emergencyAlerts: [],
    recommendations: [],
    followupSchedule: {
      immediate: [],
      within24h: [],
      within1week: [],
      within1month: [],
      routine: [],
    },
    escalationProtocol: {
      immediate: false,
      urgent: false,
      timeToEscalation: 72,
      escalationLevel: 'ai_only',
      notificationChannels: [],
      automaticScheduling: false,
    },
    ...overrides,
  };
  return base;
}

describe('EmergencyDetectionService (basic smoke)', () => {
  let service: EmergencyDetectionService;

  beforeEach(() => {
    service = new EmergencyDetectionService(DEFAULT_CONFIG);
  });

  it('can be instantiated', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EmergencyDetectionService);
  });

  it('returns empty alerts for a low-risk assessment', async () => {
    const assessment = mockAssessment();
    const alerts = await service.detectEmergencies(assessment);

    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBe(0);
  });

  it('detects Acute Coronary Syndrome from cardiovascular indicators', async () => {
    const assessment = mockAssessment({
      cardiovascular: {
        ...mockAssessment().cardiovascular,
        factors: {
          ...mockAssessment().cardiovascular.factors,
          chestPain: true,
          shortnessOfBreath: true,
        },
        riskLevel: 'very_high',
      },
    });

    const alerts = await service.detectEmergencies(assessment);

    expect(alerts.length).toBeGreaterThan(0);
    const acsAlert = alerts.find((a) =>
      a.condition.includes('Síndrome Coronariana Aguda'),
    );
    expect(acsAlert).toBeDefined();
    expect(acsAlert!.severity).toBe('immediate');
  });

  it('sets algorithmVersion on each returned alert', async () => {
    const assessment = mockAssessment({
      mentalHealth: {
        ...mockAssessment().mentalHealth,
        suicideRisk: {
          riskLevel: 'imminent',
          protectiveFactors: [],
          riskFactors: ['ideação suicida ativa'],
          immediateIntervention: true,
        },
        riskLevel: 'severe',
      },
    });

    const alerts = await service.detectEmergencies(assessment);

    for (const alert of alerts) {
      expect(alert.algorithmVersion).toBeTruthy();
    }
  });
});
