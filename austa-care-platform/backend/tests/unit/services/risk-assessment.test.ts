/**
 * Basic smoke test for the Advanced Risk Assessment Service.
 * Verifies the service instantiates and processes a simple input.
 */

import { AdvancedRiskAssessmentService } from '../../../src/services/risk-assessment.service';
import { ProcessedQuestionnaire } from '../../../src/types/risk.types';

function createSimpleQuestionnaire(
  overrides: Partial<ProcessedQuestionnaire> = {},
): ProcessedQuestionnaire {
  return {
    userId: 'test-user-basic',
    questionnaireId: 'q-basic-001',
    completedAt: new Date(),
    extractedSymptoms: [],
    riskFactors: [],
    emergencyFlags: [],
    responses: [],
    ...overrides,
  };
}

describe('RiskAssessmentService (basic smoke)', () => {
  let service: AdvancedRiskAssessmentService;

  beforeEach(() => {
    service = new AdvancedRiskAssessmentService();
  });

  it('can be instantiated', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AdvancedRiskAssessmentService);
  });

  it('processes a minimal questionnaire and returns an assessment', async () => {
    const questionnaire = createSimpleQuestionnaire({
      responses: [
        {
          question: 'idade',
          answer: '35',
          timestamp: new Date(),
          questionId: 'q1',
          type: 'numeric' as const,
          medicalRelevance: { conditions: [], weight: 0, category: 'demographic' },
        },
      ],
    });

    const result = await service.assessRisk(questionnaire);

    expect(result).toBeDefined();
    expect(result.userId).toBe('test-user-basic');
    expect(result.assessmentId).toBeDefined();
    expect(result.algorithmVersion).toBeDefined();
    expect(result.cardiovascular).toBeDefined();
    expect(result.diabetes).toBeDefined();
    expect(result.mentalHealth).toBeDefined();
    expect(result.respiratory).toBeDefined();
    expect(result.composite).toBeDefined();
  });

  it('sets algorithmVersion on the returned assessment', async () => {
    const questionnaire = createSimpleQuestionnaire();

    const result = await service.assessRisk(questionnaire);

    expect(result.algorithmVersion).toBeTruthy();
    expect(typeof result.algorithmVersion).toBe('string');
  });
});
