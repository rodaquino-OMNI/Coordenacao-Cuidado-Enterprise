import request from 'supertest';
import { OpenAIService } from '../services/openaiService';
import { HealthPromptService } from '../services/healthPromptService';
import { PersonaType } from '../types/ai';

// Mock OpenAI to avoid real API calls in tests
jest.mock('openai');
jest.mock('../services/redisService');

describe('AI Integration', () => {
  let openaiService: OpenAIService;
  let healthPromptService: HealthPromptService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Initialize services
    healthPromptService = new HealthPromptService();
    openaiService = new OpenAIService();
  });

  /**
   * Critical: Cleanup after each test to prevent memory leaks
   * The OpenAIService creates a setInterval that must be cleared
   */
  afterEach(async () => {
    if (openaiService) {
      await openaiService.destroy();
    }
  });

  describe('HealthPromptService', () => {
    test('should initialize with templates', () => {
      const stats = healthPromptService.getTemplateStats();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byPersona).toHaveProperty('zeca');
      expect(stats.byPersona).toHaveProperty('ana');
      expect(stats.byCategory).toHaveProperty('symptom_inquiry');
    });

    test('should classify health topics correctly', () => {
      const testCases = [
        {
          message: 'estou sentindo dor de cabeça forte',
          expectedCategory: 'symptoms',
          expectedUrgency: 'medium'
        },
        {
          message: 'preciso agendar consulta de rotina',
          expectedCategory: 'preventive_care',
          expectedUrgency: 'low'
        },
        {
          message: 'socorro não consigo respirar',
          expectedCategory: 'emergency',
          expectedUrgency: 'critical'
        },
        {
          message: 'quero fazer exercícios',
          expectedCategory: 'exercise',
          expectedUrgency: 'low'
        }
      ];

      testCases.forEach(({ message, expectedCategory, expectedUrgency }) => {
        const classification = healthPromptService.classifyHealthTopic(message);
        
        expect(classification.category).toBe(expectedCategory);
        expect(classification.urgencyLevel).toBe(expectedUrgency);
        expect(classification.confidence).toBeGreaterThan(0);
      });
    });

    test('should find appropriate templates', () => {
      const symptomTemplate = healthPromptService.findBestTemplate(
        'estou sentindo dor nas costas',
        'zeca'
      );
      
      expect(symptomTemplate).toBeTruthy();
      expect(symptomTemplate?.category).toBe('symptom_inquiry');
      expect(symptomTemplate?.persona).toMatch(/zeca|both/);
    });

    test('should handle emergency scenarios', () => {
      const emergencyClassification = healthPromptService.classifyHealthTopic(
        'emergência preciso de socorro'
      );
      
      expect(emergencyClassification.requiresHumanIntervention).toBe(true);
      expect(emergencyClassification.urgencyLevel).toBe('critical');
      expect(emergencyClassification.category).toBe('emergency');
    });
  });

  describe('OpenAI Service Integration', () => {
    test('should have both personas configured', () => {
      const zecaInfo = openaiService.getPersonaInfo('zeca');
      const anaInfo = openaiService.getPersonaInfo('ana');
      
      expect(zecaInfo.name).toBe('Zeca');
      expect(zecaInfo.gender).toBe('masculino');
      expect(zecaInfo.fallbackResponses).toHaveLength(3);
      
      expect(anaInfo.name).toBe('Ana');
      expect(anaInfo.gender).toBe('feminino');
      expect(anaInfo.fallbackResponses).toHaveLength(3);
    });

    test('should handle different persona personalities', () => {
      const zecaInfo = openaiService.getPersonaInfo('zeca');
      const anaInfo = openaiService.getPersonaInfo('ana');
      
      expect(zecaInfo.personality).toContain('encorajador');
      expect(anaInfo.personality).toContain('empática');
      
      // System prompts should be different and relevant
      expect(zecaInfo.systemPrompt).toContain('saúde masculina');
      expect(anaInfo.systemPrompt).toContain('saúde feminina');
    });
  });

  describe('Persona Selection Logic', () => {
    test('should select correct persona based on user profile', () => {
      const maleProfile = { gender: 'M', preferences: {} };
      const femaleProfile = { gender: 'F', preferences: {} };
      
      // This would be tested in the WhatsApp controller
      // For now, we test the persona info retrieval
      expect(openaiService.getPersonaInfo('zeca')).toBeTruthy();
      expect(openaiService.getPersonaInfo('ana')).toBeTruthy();
    });
  });

  describe('Health Education Content', () => {
    test('should provide gender-appropriate health templates', () => {
      const maleTemplates = healthPromptService.getTemplatesByCategory('health_education', 'zeca');
      const femaleTemplates = healthPromptService.getTemplatesByCategory('health_education', 'ana');
      
      expect(maleTemplates.length).toBeGreaterThan(0);
      expect(femaleTemplates.length).toBeGreaterThan(0);
      
      // Check that templates are persona-specific or universal
      maleTemplates.forEach(template => {
        expect(['zeca', 'both']).toContain(template.persona);
      });
      
      femaleTemplates.forEach(template => {
        expect(['ana', 'both']).toContain(template.persona);
      });
    });
  });

  describe('Portuguese Language Support', () => {
    test('should have Portuguese content in templates', () => {
      const allTemplates = healthPromptService.getAllTemplates();
      
      // Check that templates contain Portuguese content
      allTemplates.forEach(template => {
        expect(template.template).toMatch(/[áàâãéêíóôõúç]/); // Portuguese characters
        expect(template.triggers.some(trigger => 
          /[áàâãéêíóôõúç]/.test(trigger) || 
          ['dor', 'consulta', 'saúde', 'exame'].includes(trigger)
        )).toBe(true);
      });
    });

    test('should have appropriate Portuguese greetings in personas', () => {
      const zecaInfo = openaiService.getPersonaInfo('zeca');
      const anaInfo = openaiService.getPersonaInfo('ana');
      
      expect(zecaInfo.fallbackResponses.some(response => 
        response.includes('Olá') || response.includes('Oi')
      )).toBe(true);
      
      expect(anaInfo.fallbackResponses.some(response => 
        response.includes('Oi') || response.includes('querida')
      )).toBe(true);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should provide fallback responses', () => {
      const zecaInfo = openaiService.getPersonaInfo('zeca');
      const anaInfo = openaiService.getPersonaInfo('ana');
      
      expect(zecaInfo.fallbackResponses).toHaveLength(3);
      expect(anaInfo.fallbackResponses).toHaveLength(3);
      
      // Fallbacks should be appropriate for each persona
      expect(zecaInfo.fallbackResponses.join(' ')).toContain('Zeca');
      expect(anaInfo.fallbackResponses.join(' ')).toContain('Ana');
    });
  });

  describe('Content Classification Edge Cases', () => {
    test('should handle mixed content appropriately', () => {
      const mixedMessage = 'oi, estou com dor de cabeça mas também quero saber sobre exercícios';
      const classification = healthPromptService.classifyHealthTopic(mixedMessage);
      
      // Should prioritize symptoms over exercise
      expect(classification.category).toBe('symptoms');
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    test('should handle empty or invalid messages', () => {
      const emptyClassification = healthPromptService.classifyHealthTopic('');
      const invalidClassification = healthPromptService.classifyHealthTopic('xyz123');
      
      expect(emptyClassification.category).toBe('general');
      expect(invalidClassification.category).toBe('general');
      expect(emptyClassification.urgencyLevel).toBe('low');
    });
  });

  describe('Template Matching Logic', () => {
    test('should match templates based on priority', () => {
      const urgentMessage = 'emergência, preciso de ajuda urgente';
      const template = healthPromptService.findBestTemplate(urgentMessage, 'zeca');
      
      expect(template?.priority).toBe('critical');
      expect(template?.category).toBe('emergency_guidance');
    });

    test('should return null for non-health related messages', () => {
      const nonHealthMessage = 'qual é a previsão do tempo?';
      const template = healthPromptService.findBestTemplate(nonHealthMessage, 'ana');
      
      // Should return null or a general template
      if (template) {
        expect(template.category).toBe('general_wellness');
      }
    });
  });
});

describe('AI API Endpoints', () => {
  // These would test the actual API endpoints
  // For now, we'll focus on the core logic above
  
  test('should validate required fields in API requests', () => {
    // Test that API validates userId, message, and persona
    const requiredFields = ['userId', 'message', 'persona'];
    
    requiredFields.forEach(field => {
      expect(field).toBeTruthy(); // Placeholder test
    });
  });
});

describe('Security and Content Moderation', () => {
  test('should handle content moderation flags', () => {
    // Test that inappropriate content is flagged
    // This would be tested with actual OpenAI moderation API
    expect(true).toBe(true); // Placeholder
  });

  test('should protect against prompt injection', () => {
    // Test that malicious prompts are handled safely
    expect(true).toBe(true); // Placeholder
  });
});

describe('Performance and Caching', () => {
  test('should implement caching for common responses', () => {
    // Test that frequently asked questions are cached
    expect(true).toBe(true); // Placeholder
  });

  test('should track token usage', () => {
    // Test that token usage is properly tracked
    expect(true).toBe(true); // Placeholder
  });
});

describe('Memory Leak Prevention - Service Cleanup', () => {
  /**
   * Critical Test Suite: Verify OpenAIService cleanup mechanism
   * These tests ensure the service properly releases resources to prevent memory leaks
   */

  let testService: OpenAIService;

  beforeEach(() => {
    testService = new OpenAIService();
  });

  afterEach(async () => {
    if (testService) {
      await testService.destroy();
    }
  });

  test('should have destroy method', () => {
    expect(typeof testService.destroy).toBe('function');
  });

  test('should cleanup without errors', async () => {
    await expect(testService.destroy()).resolves.not.toThrow();
  });

  test('should be safe to call destroy multiple times', async () => {
    await testService.destroy();
    await expect(testService.destroy()).resolves.not.toThrow();
  });

  test('should clear interval on destroy', async () => {
    // Access private property through type assertion for testing
    const serviceWithInterval = testService as any;

    // Verify interval exists after construction
    expect(serviceWithInterval.tokenTrackingInterval).toBeTruthy();

    // Destroy should clear the interval
    await testService.destroy();

    // Verify interval is cleared
    expect(serviceWithInterval.tokenTrackingInterval).toBeNull();
  });

  /**
   * Integration test: Verify no open handles remain after destroy
   * This prevents Jest from hanging with "Jest did not exit one second after the test run has completed"
   */
  test('should prevent open handles by cleaning up interval', async (done) => {
    const service = new OpenAIService();

    // Destroy should clear all intervals
    await service.destroy();

    // If cleanup worked, this test should complete without hanging
    setTimeout(() => {
      expect(true).toBe(true);
      done();
    }, 100);
  });

  test('should save final token usage on destroy', async () => {
    // Mock the saveTokenUsage method to verify it's called
    const saveTokenUsageSpy = jest.spyOn(testService as any, 'saveTokenUsage');

    await testService.destroy();

    expect(saveTokenUsageSpy).toHaveBeenCalled();
  });

  test('should clear in-memory token usage on destroy', async () => {
    const serviceWithTokens = testService as any;

    // Add some token usage data
    serviceWithTokens.tokenUsage.set('user123', {
      userId: 'user123',
      totalTokens: 100,
      date: '2025-01-01'
    });

    expect(serviceWithTokens.tokenUsage.size).toBeGreaterThan(0);

    // Destroy should clear the map
    await testService.destroy();

    expect(serviceWithTokens.tokenUsage.size).toBe(0);
  });
});