/**
 * Comprehensive Unit Tests for Emergency Detection Service
 * Coverage: Emergency detection, alerting, escalation
 */

import { EmergencyDetectionService, EmergencyConfig } from '../../../src/services/emergency-detection.service';
import { AdvancedRiskAssessment } from '../../../src/types/risk.types';

describe('EmergencyDetectionService', () => {
  let service: EmergencyDetectionService;
  let mockConfig: EmergencyConfig;

  beforeEach(() => {
    mockConfig = {
      autoEscalation: true,
      emergencyContacts: [
        {
          id: 'samu-192',
          type: 'samu',
          name: 'SAMU',
          phone: '192',
          priority: 1,
          available24h: true
        },
        {
          id: 'cvv-188',
          type: 'medical_team',
          name: 'CVV',
          phone: '188',
          priority: 2,
          available24h: true,
          specialties: ['mental_health']
        }
      ],
      escalationTimeouts: {
        immediate: 0,
        critical: 30,
        high: 120
      },
      notificationChannels: [
        {
          type: 'sms',
          enabled: true,
          priority: 1,
          template: '{condition} - {severity} - Action required in {timeToAction} minutes'
        },
        {
          type: 'whatsapp',
          enabled: true,
          priority: 2,
          template: 'Emergency: {condition}'
        }
      ]
    };

    service = new EmergencyDetectionService(mockConfig);
  });

  describe('Cardiac Emergency Detection', () => {
    it('should detect Acute Coronary Syndrome', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: {
            chestPain: true,
            shortnessOfBreath: true
          },
          riskLevel: 'very_high',
          emergencyIndicators: []
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].condition).toContain('Síndrome Coronariana Aguda');
      expect(alerts[0].severity).toBe('immediate');
      expect(alerts[0].timeToAction).toBeLessThanOrEqual(15);
      expect(alerts[0].contactNumbers).toContain('192');
    });

    it('should detect cardiac syncope emergency', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: {
            syncope: true,
            chestPain: true
          },
          riskLevel: 'high',
          emergencyIndicators: []
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Síncope'))).toBe(true);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect hypertensive crisis', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: {
            hypertension: true
          },
          riskLevel: 'high',
          emergencyIndicators: ['HYPERTENSIVE_CRISIS']
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Crise Hipertensiva'))).toBe(true);
    });

    it('should provide correct emergency actions for cardiac arrest risk', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: {
            chestPain: true,
            shortnessOfBreath: true
          },
          riskLevel: 'very_high',
          emergencyIndicators: ['ACUTE_CORONARY_SYNDROME_SUSPECTED']
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts[0].actions).toContain('Chamar SAMU imediatamente (192)');
      expect(alerts[0].actions.some(a => a.includes('repouso'))).toBe(true);
    });
  });

  describe('Diabetic Emergency Detection', () => {
    it('should detect Diabetic Ketoacidosis (DKA)', async () => {
      const assessment = createMockAssessment({
        diabetes: {
          dkaRisk: 75,
          riskLevel: 'critical',
          emergencyIndicators: ['DIABETIC_KETOACIDOSIS_RISK'],
          classicTriad: { triadComplete: true, triadScore: 60 }
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Cetoacidose'))).toBe(true);
      expect(alerts[0].severity).toBe('immediate');
      expect(alerts[0].timeToAction).toBeLessThanOrEqual(30);
    });

    it('should detect severe hyperglycemia with complete triad', async () => {
      const assessment = createMockAssessment({
        diabetes: {
          dkaRisk: 40,
          riskLevel: 'critical',
          emergencyIndicators: [],
          classicTriad: { triadComplete: true, triadScore: 60 }
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Hiperglicemia'))).toBe(true);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect ketosis risk', async () => {
      const assessment = createMockAssessment({
        diabetes: {
          dkaRisk: 30,
          riskLevel: 'moderate',
          emergencyIndicators: ['KETOSIS_DETECTED'],
          ketosisRisk: 60
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Cetose'))).toBe(true);
    });

    it('should detect hypoglycemia risk', async () => {
      const assessment = createMockAssessment({
        diabetes: {
          dkaRisk: 10,
          riskLevel: 'low',
          emergencyIndicators: ['HYPOGLYCEMIA_RISK']
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Hipoglicemia'))).toBe(true);
      expect(alerts[0].timeToAction).toBeLessThanOrEqual(10);
    });
  });

  describe('Mental Health Emergency Detection', () => {
    it('should detect imminent suicide risk', async () => {
      const assessment = createMockAssessment({
        mentalHealth: {
          suicideRisk: {
            riskLevel: 'imminent',
            immediateIntervention: true,
            riskFactors: ['ideação suicida ativa', 'plano estruturado'],
            protectiveFactors: []
          },
          riskLevel: 'severe'
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Risco Iminente de Suicídio'))).toBe(true);
      expect(alerts[0].severity).toBe('immediate');
      expect(alerts[0].timeToAction).toBe(0);
      expect(alerts[0].contactNumbers).toContain('188'); // CVV
    });

    it('should detect high suicide risk', async () => {
      const assessment = createMockAssessment({
        mentalHealth: {
          suicideRisk: {
            riskLevel: 'high',
            immediateIntervention: false,
            riskFactors: ['pensamentos suicidas frequentes'],
            protectiveFactors: ['apoio familiar']
          },
          riskLevel: 'high'
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Alto Risco de Suicídio'))).toBe(true);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect severe depression with psychotic features', async () => {
      const assessment = createMockAssessment({
        mentalHealth: {
          depressionIndicators: {
            phq9Score: 22
          },
          suicideRisk: {
            riskLevel: 'moderate',
            immediateIntervention: false
          },
          riskLevel: 'severe'
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Depressão Severa'))).toBe(true);
    });

    it('should detect severe anxiety/panic', async () => {
      const assessment = createMockAssessment({
        mentalHealth: {
          anxietyIndicators: {
            gad7Score: 18
          },
          suicideRisk: {
            riskLevel: 'none',
            immediateIntervention: false
          },
          riskLevel: 'high'
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Ansiedade'))).toBe(true);
    });

    it('should provide CVV contact for all mental health emergencies', async () => {
      const assessment = createMockAssessment({
        mentalHealth: {
          suicideRisk: {
            riskLevel: 'high',
            immediateIntervention: false
          },
          riskLevel: 'high'
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts[0].contactNumbers).toContain('188');
    });
  });

  describe('Respiratory Emergency Detection', () => {
    it('should detect severe asthma exacerbation', async () => {
      const assessment = createMockAssessment({
        respiratory: {
          emergencyIndicators: ['SEVERE_ASTHMA_EXACERBATION'],
          riskLevel: 'critical',
          asthmaIndicators: {
            wheezing: true,
            shortnessOfBreath: true
          }
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Crise Asmática'))).toBe(true);
      expect(alerts[0].severity).toBe('immediate');
      expect(alerts[0].actions).toContain('Usar broncodilatador de resgate AGORA');
    });

    it('should detect COPD exacerbation', async () => {
      const assessment = createMockAssessment({
        respiratory: {
          emergencyIndicators: ['COPD_EXACERBATION'],
          riskLevel: 'critical',
          copdIndicators: {
            dyspnea: true,
            sputumProduction: true
          }
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('DPOC'))).toBe(true);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect sleep apnea with cardiovascular risk', async () => {
      const assessment = createMockAssessment({
        respiratory: {
          emergencyIndicators: [],
          riskLevel: 'moderate',
          sleepApneaIndicators: {
            stopBangScore: 6,
            hypertension: true
          }
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Apneia do Sono'))).toBe(true);
    });
  });

  describe('Composite Emergency Detection', () => {
    it('should detect multiple critical conditions', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          riskLevel: 'very_high',
          factors: { chestPain: true }
        },
        diabetes: {
          riskLevel: 'critical',
          dkaRisk: 70
        },
        mentalHealth: {
          riskLevel: 'severe',
          suicideRisk: { riskLevel: 'high', immediateIntervention: false }
        },
        respiratory: {
          riskLevel: 'critical',
          emergencyIndicators: []
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Múltiplas Condições'))).toBe(true);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect diabetic + cardiac emergency combination', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          riskLevel: 'very_high',
          factors: { chestPain: true, shortnessOfBreath: true }
        },
        diabetes: {
          riskLevel: 'critical',
          dkaRisk: 60,
          emergencyIndicators: ['DIABETIC_KETOACIDOSIS_RISK']
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.some(a => a.condition.includes('Emergência Diabética + Cardíaca'))).toBe(true);
      expect(alerts[0].severity).toBe('immediate');
    });
  });

  describe('Alert Processing and Prioritization', () => {
    it('should remove duplicate alerts', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: { chestPain: true, shortnessOfBreath: true },
          riskLevel: 'very_high',
          emergencyIndicators: ['ACUTE_CORONARY_SYNDROME_SUSPECTED']
        }
      });

      const alerts = await service.detectEmergencies(assessment);
      const conditions = alerts.map(a => a.condition);
      const uniqueConditions = [...new Set(conditions)];

      expect(conditions.length).toBe(uniqueConditions.length);
    });

    it('should sort alerts by severity and time to action', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: { chestPain: true },
          riskLevel: 'high',
          emergencyIndicators: []
        },
        mentalHealth: {
          suicideRisk: { riskLevel: 'imminent', immediateIntervention: true },
          riskLevel: 'severe'
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      // First alert should be most urgent (imminent suicide)
      expect(alerts[0].severity).toBe('immediate');
      expect(alerts[0].timeToAction).toBe(0);
    });

    it('should prioritize immediate emergencies over critical ones', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: { chestPain: true, shortnessOfBreath: true },
          riskLevel: 'very_high',
          emergencyIndicators: []
        },
        diabetes: {
          riskLevel: 'critical',
          dkaRisk: 50,
          emergencyIndicators: []
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      const immediateAlerts = alerts.filter(a => a.severity === 'immediate');
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');

      if (immediateAlerts.length > 0 && criticalAlerts.length > 0) {
        const immediateIndex = alerts.indexOf(immediateAlerts[0]);
        const criticalIndex = alerts.indexOf(criticalAlerts[0]);
        expect(immediateIndex).toBeLessThan(criticalIndex);
      }
    });
  });

  describe('Emergency Actions and Notifications', () => {
    it('should trigger notifications for automated alerts', async () => {
      const assessment = createMockAssessment({
        cardiovascular: {
          factors: { chestPain: true, shortnessOfBreath: true },
          riskLevel: 'very_high',
          emergencyIndicators: []
        }
      });

      const alerts = await service.detectEmergencies(assessment);
      const automatedAlert = alerts.find(a => a.automated);

      expect(automatedAlert).toBeDefined();
      expect(automatedAlert!.automated).toBe(true);
    });

    it('should not trigger automatic actions for low urgency alerts', async () => {
      const assessment = createMockAssessment({
        respiratory: {
          riskLevel: 'moderate',
          emergencyIndicators: [],
          sleepApneaIndicators: { stopBangScore: 3 }
        }
      });

      const alerts = await service.detectEmergencies(assessment);

      if (alerts.length > 0) {
        const highUrgencyAlerts = alerts.filter(a => a.timeToAction <= 30);
        expect(highUrgencyAlerts.length).toBe(0);
      }
    });
  });

  describe('Fail-safe Mechanisms', () => {
    it('should create fail-safe alert on error', async () => {
      // Simulate error by passing invalid data
      const invalidAssessment = {} as any;

      const alerts = await service.detectEmergencies(invalidAssessment);

      expect(alerts.length).toBe(1);
      expect(alerts[0].condition).toContain('Erro no Sistema');
      expect(alerts[0].severity).toBe('high');
    });

    it('should ensure fail-safe alert has manual review action', async () => {
      const invalidAssessment = {} as any;

      const alerts = await service.detectEmergencies(invalidAssessment);

      expect(alerts[0].automated).toBe(false);
      expect(alerts[0].actions.some(a => a.includes('manual'))).toBe(true);
    });
  });

  describe('Emergency Configuration', () => {
    it('should respect auto-escalation configuration', () => {
      expect(service['config'].autoEscalation).toBe(true);
    });

    it('should have configured notification channels', () => {
      expect(service['config'].notificationChannels.length).toBeGreaterThan(0);
    });

    it('should have emergency contact list', () => {
      expect(service['config'].emergencyContacts.length).toBeGreaterThan(0);
      expect(service['config'].emergencyContacts[0].available24h).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle assessment with no emergency indicators', async () => {
      const assessment = createMockAssessment({
        cardiovascular: { riskLevel: 'low', factors: {} },
        diabetes: { riskLevel: 'low', dkaRisk: 0 },
        mentalHealth: {
          riskLevel: 'low',
          suicideRisk: { riskLevel: 'none', immediateIntervention: false }
        },
        respiratory: { riskLevel: 'low', emergencyIndicators: [] }
      });

      const alerts = await service.detectEmergencies(assessment);

      expect(alerts.length).toBe(0);
    });

    it('should handle missing cardiovascular data', async () => {
      const assessment = createMockAssessment({
        cardiovascular: undefined as any
      });

      const alerts = await service.detectEmergencies(assessment);

      // Should still return valid response (fail-safe)
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });
});

// ==================== TEST HELPERS ====================

function createMockAssessment(overrides: any = {}): AdvancedRiskAssessment {
  const defaults = {
    userId: 'test-user-123',
    assessmentId: 'test-assessment-123',
    timestamp: new Date(),
    cardiovascular: {
      overallScore: 0,
      riskLevel: 'low' as const,
      factors: {},
      framinghamScore: 0,
      emergencyIndicators: [],
      recommendations: [],
      escalationRequired: false,
      timeToEscalation: 72
    },
    diabetes: {
      overallScore: 0,
      riskLevel: 'low' as const,
      classicTriad: {
        polydipsia: false,
        polyphagia: false,
        polyuria: false,
        triadComplete: false,
        triadScore: 0
      },
      additionalFactors: {},
      ketosisRisk: 0,
      dkaRisk: 0,
      emergencyIndicators: [],
      timeToEscalation: 72
    },
    mentalHealth: {
      overallScore: 0,
      riskLevel: 'low' as const,
      depressionIndicators: {
        phq9Score: 0
      },
      anxietyIndicators: {
        gad7Score: 0
      },
      suicideRisk: {
        riskLevel: 'none' as const,
        riskFactors: [],
        protectiveFactors: [],
        immediateIntervention: false
      },
      escalationRequired: false,
      timeToEscalation: 72
    },
    respiratory: {
      overallScore: 0,
      riskLevel: 'low' as const,
      asthmaIndicators: {},
      copdIndicators: {},
      sleepApneaIndicators: {},
      emergencyIndicators: [],
      timeToEscalation: 72
    },
    composite: {
      overallScore: 0,
      riskLevel: 'low' as const,
      multipleConditionsPenalty: 1,
      synergyFactor: 1,
      ageAdjustment: 1,
      genderAdjustment: 1,
      socioeconomicFactors: 1,
      accessToCareFactor: 1,
      prioritizedConditions: [],
      emergencyEscalation: false,
      urgentEscalation: false,
      routineFollowup: false
    },
    emergencyAlerts: [],
    recommendations: [],
    followupSchedule: {
      immediate: [],
      within24h: [],
      within1week: [],
      within1month: [],
      routine: []
    },
    escalationProtocol: {
      immediate: false,
      urgent: false,
      timeToEscalation: 72,
      escalationLevel: 'ai_only' as const,
      notificationChannels: [],
      automaticScheduling: false
    }
  };

  return {
    ...defaults,
    ...overrides,
    cardiovascular: { ...defaults.cardiovascular, ...overrides.cardiovascular },
    diabetes: { ...defaults.diabetes, ...overrides.diabetes },
    mentalHealth: { ...defaults.mentalHealth, ...overrides.mentalHealth },
    respiratory: { ...defaults.respiratory, ...overrides.respiratory },
    composite: { ...defaults.composite, ...overrides.composite }
  };
}
