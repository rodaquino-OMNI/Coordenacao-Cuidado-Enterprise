/**
 * OpenAI Client with Function Calling Support
 * Optimized for Brazilian Portuguese medical triage
 */

import { OpenAI } from 'openai';
import { logger } from '../../utils/logger';
import { eventPublisher } from '../../infrastructure/kafka/events/event.publisher';
import {
  OpenAIConfig,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  StreamChunk,
  FunctionDefinition,
  toChatCompletionParams,
} from './types';
import { medicalFunctions } from './functions';

export class OpenAIClient {
  private static instance: OpenAIClient;
  private client: OpenAI;
  private config: OpenAIConfig;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;

  private constructor(config: OpenAIConfig) {
    this.config = config;
    this.defaultModel = config.model || 'gpt-4-turbo-preview';
    this.defaultMaxTokens = config.maxTokens || 2048;
    this.defaultTemperature = config.temperature || 0.7;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organizationId,
      timeout: config.timeout || 60000,
      maxRetries: 3,
    });
  }

  static getInstance(config?: OpenAIConfig): OpenAIClient {
    if (!OpenAIClient.instance && !config) {
      throw new Error('OpenAIClient must be initialized with config first');
    }

    if (config) {
      OpenAIClient.instance = new OpenAIClient(config);
    }

    return OpenAIClient.instance;
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: toChatCompletionParams(options.messages),
        functions: options.functions,
        function_call: options.function_call,
        temperature: options.temperature ?? this.defaultTemperature,
        max_tokens: options.max_tokens ?? this.defaultMaxTokens,
        user: options.user,
        stream: false,
      });

      const duration = Date.now() - startTime;

      // Log completion
      logger.info('OpenAI chat completion:', {
        model: response.model,
        tokens: response.usage,
        duration_ms: duration,
        finish_reason: response.choices[0].finish_reason,
      });

      // Publish event
      await eventPublisher.publish({
        eventType: 'ai.openai.completion.created',
        source: 'openai-client',
        version: '1.0',
        data: {
          id: response.id,
          model: response.model,
          usage: response.usage,
          duration_ms: duration,
          finish_reason: response.choices[0].finish_reason,
          has_function_call: !!response.choices[0].message.function_call,
        },
      });

      return response as ChatCompletionResponse;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('OpenAI chat completion failed:', {
        error: (error as Error).message,
        duration_ms: duration,
      });

      await eventPublisher.publish({
        eventType: 'ai.openai.completion.failed',
        source: 'openai-client',
        version: '1.0',
        data: {
          error: (error as Error).message,
          duration_ms: duration,
        },
      });

      throw error;
    }
  }

  /**
   * Create a streaming chat completion
   */
  async createStreamingChatCompletion(
    options: ChatCompletionOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: toChatCompletionParams(options.messages),
        functions: options.functions,
        function_call: options.function_call,
        temperature: options.temperature ?? this.defaultTemperature,
        max_tokens: options.max_tokens ?? this.defaultMaxTokens,
        user: options.user,
        stream: true,
      });

      for await (const chunk of stream) {
        onChunk(chunk as StreamChunk);
      }

      const duration = Date.now() - startTime;

      logger.info('OpenAI streaming completion finished:', {
        duration_ms: duration,
      });

      await eventPublisher.publish({
        eventType: 'ai.openai.streaming.completed',
        source: 'openai-client',
        version: '1.0',
        data: {
          duration_ms: duration,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('OpenAI streaming completion failed:', {
        error: (error as Error).message,
        duration_ms: duration,
      });

      throw error;
    }
  }

  /**
   * Perform medical triage with function calling
   */
  async performMedicalTriage(
    patientMessage: string,
    conversationHistory: ChatMessage[] = [],
    medicalContext?: any
  ): Promise<{
    message: ChatMessage;
    functionCall?: {
      name: string;
      arguments: any;
    };
  }> {
    const systemPrompt = this.getMedicalTriageSystemPrompt();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: medicalContext
          ? `Contexto médico: ${JSON.stringify(medicalContext, null, 2)}\n\nPaciente: ${patientMessage}`
          : patientMessage,
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      functions: medicalFunctions,
      function_call: 'auto',
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (choice.finish_reason === 'function_call' && message.function_call) {
      return {
        message,
        functionCall: {
          name: message.function_call.name,
          arguments: JSON.parse(message.function_call.arguments),
        },
      };
    }

    return { message };
  }

  /**
   * Continue conversation after function execution
   */
  async continueAfterFunction(
    conversationHistory: ChatMessage[],
    functionName: string,
    functionResult: any
  ): Promise<ChatMessage> {
    const messages: ChatMessage[] = [
      ...conversationHistory,
      {
        role: 'function',
        name: functionName,
        content: JSON.stringify(functionResult),
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      functions: medicalFunctions,
      function_call: 'auto',
    });

    return response.choices[0].message;
  }

  /**
   * Generate response for general medical query
   */
  async generateMedicalResponse(
    query: string,
    context?: string
  ): Promise<string> {
    const systemPrompt = `Você é um assistente médico virtual do AUSTA Care.
Forneça informações precisas, claras e empáticas em português do Brasil.
Sempre enfatize que suas respostas não substituem consulta médica presencial.
Use linguagem acessível e seja paciente com as dúvidas.`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    if (context) {
      messages.push({
        role: 'user',
        content: `Contexto: ${context}`,
      });
    }

    messages.push({
      role: 'user',
      content: query,
    });

    const response = await this.createChatCompletion({
      messages,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Summarize medical conversation
   */
  async summarizeConversation(
    conversationHistory: ChatMessage[]
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Você é um assistente médico. Resuma a conversa anterior de forma clara e estruturada,
destacando: sintomas relatados, avaliação de urgência, recomendações dadas e próximos passos.`,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: 'Por favor, resuma esta conversa médica.',
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Extract structured data from natural language
   */
  async extractMedicalData(
    text: string,
    dataType: 'symptoms' | 'medications' | 'allergies' | 'conditions'
  ): Promise<any> {
    const systemPrompt = `Você é um extrator de informações médicas.
Extraia ${dataType} do texto fornecido e retorne em formato JSON estruturado.
Para sintomas: { "symptoms": [{ "name": "...", "severity": "...", "duration": "..." }] }
Para medicações: { "medications": [{ "name": "...", "dosage": "...", "frequency": "..." }] }
Para alergias: { "allergies": [{ "allergen": "...", "reaction": "...", "severity": "..." }] }
Para condições: { "conditions": [{ "name": "...", "diagnosed_date": "...", "status": "..." }] }`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      temperature: 0.1,
    });

    const content = response.choices[0].message.content || '{}';

    try {
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to parse extracted medical data:', error);
      return null;
    }
  }

  /**
   * Translate medical terms to patient-friendly language
   */
  async translateMedicalTerms(
    medicalText: string
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Você é um tradutor médico. Converta termos médicos técnicos para linguagem
simples e compreensível para pacientes, mantendo a precisão das informações.`,
      },
      {
        role: 'user',
        content: medicalText,
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      temperature: 0.3,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Generate health education content
   */
  async generateHealthEducation(
    topic: string,
    targetAudience: 'general' | 'elderly' | 'children' = 'general'
  ): Promise<string> {
    const audienceMap = {
      general: 'público geral',
      elderly: 'idosos',
      children: 'crianças e adolescentes',
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Você é um educador em saúde do AUSTA Care. Crie conteúdo educativo sobre saúde
em português do Brasil, adequado para ${audienceMap[targetAudience]}. Use linguagem clara,
exemplos práticos e dicas acionáveis.`,
      },
      {
        role: 'user',
        content: `Crie conteúdo educativo sobre: ${topic}`,
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Analyze sentiment of patient message
   */
  async analyzeSentiment(
    message: string
  ): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
    confidence: number;
    emotions: string[];
  }> {
    const systemPrompt = `Analise o sentimento da mensagem do paciente e retorne JSON:
{
  "sentiment": "positive|neutral|negative|urgent",
  "confidence": 0.0-1.0,
  "emotions": ["ansiedade", "dor", "medo", etc]
}`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: message,
      },
    ];

    const response = await this.createChatCompletion({
      messages,
      temperature: 0.1,
      max_tokens: 200,
    });

    const content = response.choices[0].message.content || '{}';

    try {
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to parse sentiment analysis:', error);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        emotions: [],
      };
    }
  }

  /**
   * Get medical triage system prompt
   */
  private getMedicalTriageSystemPrompt(): string {
    return `Você é um assistente médico virtual do AUSTA Care especializado em triagem médica.

IMPORTANTE:
- Você atende pacientes em português do Brasil
- Seu objetivo é avaliar sintomas e determinar urgência do atendimento
- SEMPRE priorize a segurança do paciente
- Em caso de dúvida, recomende atendimento médico presencial
- Seja empático, claro e tranquilizador

NÍVEIS DE URGÊNCIA:
- EMERGÊNCIA: Risco de vida imediato (ex: dor no peito, dificuldade respiratória grave)
- URGENTE: Necessita atendimento em até 2 horas
- SEMI-URGENTE: Necessita atendimento em até 24 horas
- NÃO URGENTE: Pode aguardar agendamento de consulta normal

RED FLAGS (Sinais de Alerta):
- Dor no peito
- Dificuldade respiratória grave
- Alteração de consciência
- Sangramento intenso
- Dor abdominal intensa súbita
- Febre alta persistente (>39°C)
- Sinais de AVC (face caída, braço fraco, fala arrastada)

Ao avaliar sintomas:
1. Identifique os sintomas principais
2. Avalie gravidade, duração e início
3. Busque sinais de alerta (red flags)
4. Considere contexto médico (idade, condições crônicas)
5. Classifique urgência de forma conservadora
6. Faça perguntas de acompanhamento se necessário
7. Recomende ação apropriada
8. Sugira especialidade médica adequada

Use as funções disponíveis para:
- perform_medical_triage: Classificar urgência e recomendar ações
- check_appointment_availability: Verificar horários disponíveis
- get_medication_info: Informações sobre medicamentos
- check_procedure_authorization: Status de autorizações
- provide_health_education: Orientações educacionais
- interpret_exam_results: Explicar resultados de exames
- schedule_follow_up_reminder: Configurar lembretes

SEMPRE enfatize que você não substitui consulta médica presencial.`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('OpenAI health check failed:', error);
      return false;
    }
  }
}

// Export singleton getter
export const getOpenAIClient = (config?: OpenAIConfig) =>
  OpenAIClient.getInstance(config);
