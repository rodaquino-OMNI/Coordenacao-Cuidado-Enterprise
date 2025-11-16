/**
 * OpenAI Function Definitions for Medical Triage
 * Brazilian Portuguese optimized functions
 */

import { FunctionDefinition } from './types';

/**
 * Triage patient symptoms and determine urgency
 */
export const performTriageFunction: FunctionDefinition = {
  name: 'perform_medical_triage',
  description: 'Analisa os sintomas do paciente e determina o nível de urgência do atendimento. Identifica sinais de alerta e recomenda ações apropriadas.',
  parameters: {
    type: 'object',
    properties: {
      symptoms: {
        type: 'array',
        description: 'Lista de sintomas relatados pelo paciente',
        items: {
          type: 'object',
          properties: {
            symptom: {
              type: 'string',
              description: 'Descrição do sintoma (ex: dor no peito, febre, tontura)',
            },
            severity: {
              type: 'string',
              enum: ['mild', 'moderate', 'severe'],
              description: 'Gravidade do sintoma: mild (leve), moderate (moderado), severe (grave)',
            },
            duration: {
              type: 'string',
              description: 'Duração do sintoma (ex: 2 horas, 3 dias, 1 semana)',
            },
            onset: {
              type: 'string',
              enum: ['sudden', 'gradual'],
              description: 'Início do sintoma: sudden (súbito) ou gradual',
            },
          },
        },
      },
      urgency: {
        type: 'string',
        enum: ['emergency', 'urgent', 'semi_urgent', 'non_urgent'],
        description: 'Nível de urgência: emergency (emergência - SAMU), urgent (urgente - até 2h), semi_urgent (semi-urgente - até 24h), non_urgent (não urgente - agendamento normal)',
      },
      recommended_action: {
        type: 'string',
        description: 'Ação recomendada em português (ex: "Procurar emergência imediatamente", "Agendar consulta em até 24h")',
      },
      reasoning: {
        type: 'string',
        description: 'Justificativa médica para a classificação de urgência em português',
      },
      red_flags: {
        type: 'array',
        description: 'Sinais de alerta identificados (red flags) em português',
        items: {
          type: 'string',
        },
      },
      follow_up_questions: {
        type: 'array',
        description: 'Perguntas de acompanhamento para melhor avaliação em português',
        items: {
          type: 'string',
        },
      },
      specialty_recommendation: {
        type: 'string',
        description: 'Especialidade médica recomendada em português (ex: Cardiologia, Clínico Geral)',
      },
    },
    required: ['symptoms', 'urgency', 'recommended_action', 'reasoning'],
  },
};

/**
 * Check appointment availability
 */
export const checkAppointmentAvailabilityFunction: FunctionDefinition = {
  name: 'check_appointment_availability',
  description: 'Verifica a disponibilidade de horários para consultas médicas com base na especialidade e urgência.',
  parameters: {
    type: 'object',
    properties: {
      specialty: {
        type: 'string',
        description: 'Especialidade médica em português (ex: Cardiologia, Clínico Geral, Pediatria)',
      },
      urgency: {
        type: 'string',
        enum: ['emergency', 'urgent', 'semi_urgent', 'non_urgent'],
        description: 'Nível de urgência do atendimento',
      },
      preferred_date: {
        type: 'string',
        description: 'Data preferencial no formato YYYY-MM-DD (opcional)',
      },
      preferred_time: {
        type: 'string',
        enum: ['morning', 'afternoon', 'evening'],
        description: 'Período preferencial: morning (manhã), afternoon (tarde), evening (noite)',
      },
    },
    required: ['specialty', 'urgency'],
  },
};

/**
 * Get medication information
 */
export const getMedicationInfoFunction: FunctionDefinition = {
  name: 'get_medication_info',
  description: 'Obtém informações sobre medicamentos, incluindo indicações, contraindicações, efeitos colaterais e interações medicamentosas.',
  parameters: {
    type: 'object',
    properties: {
      medication_name: {
        type: 'string',
        description: 'Nome do medicamento (comercial ou genérico)',
      },
      info_type: {
        type: 'string',
        enum: ['general', 'side_effects', 'interactions', 'dosage', 'contraindications'],
        description: 'Tipo de informação: general (geral), side_effects (efeitos colaterais), interactions (interações), dosage (dosagem), contraindications (contraindicações)',
      },
      check_interaction_with: {
        type: 'array',
        description: 'Lista de medicamentos para verificar interações',
        items: {
          type: 'string',
        },
      },
    },
    required: ['medication_name', 'info_type'],
  },
};

/**
 * Check authorization status
 */
export const checkAuthorizationFunction: FunctionDefinition = {
  name: 'check_procedure_authorization',
  description: 'Verifica o status de autorização para procedimentos médicos junto ao plano de saúde.',
  parameters: {
    type: 'object',
    properties: {
      procedure_name: {
        type: 'string',
        description: 'Nome do procedimento médico em português',
      },
      procedure_code: {
        type: 'string',
        description: 'Código TUSS do procedimento (se disponível)',
      },
      urgency: {
        type: 'string',
        enum: ['emergency', 'urgent', 'routine'],
        description: 'Urgência do procedimento: emergency (emergência), urgent (urgente), routine (rotina)',
      },
      additional_info: {
        type: 'string',
        description: 'Informações adicionais relevantes para a autorização',
      },
    },
    required: ['procedure_name', 'urgency'],
  },
};

/**
 * Provide health education
 */
export const provideHealthEducationFunction: FunctionDefinition = {
  name: 'provide_health_education',
  description: 'Fornece orientações educacionais sobre saúde, prevenção de doenças e cuidados específicos.',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Tópico de saúde em português (ex: diabetes, hipertensão, vacinação)',
      },
      education_type: {
        type: 'string',
        enum: ['prevention', 'management', 'lifestyle', 'medication_adherence', 'symptoms'],
        description: 'Tipo de educação: prevention (prevenção), management (manejo), lifestyle (estilo de vida), medication_adherence (adesão medicamentosa), symptoms (sintomas)',
      },
      patient_context: {
        type: 'object',
        description: 'Contexto do paciente para personalizar a orientação',
        properties: {
          age_group: {
            type: 'string',
            enum: ['child', 'adolescent', 'adult', 'elderly'],
          },
          has_chronic_condition: {
            type: 'boolean',
          },
        },
      },
    },
    required: ['topic', 'education_type'],
  },
};

/**
 * Get exam results interpretation
 */
export const interpretExamResultsFunction: FunctionDefinition = {
  name: 'interpret_exam_results',
  description: 'Fornece interpretação simplificada de resultados de exames médicos em linguagem acessível.',
  parameters: {
    type: 'object',
    properties: {
      exam_type: {
        type: 'string',
        description: 'Tipo de exame em português (ex: hemograma, glicemia, colesterol)',
      },
      results: {
        type: 'array',
        description: 'Resultados do exame',
        items: {
          type: 'object',
          properties: {
            parameter: {
              type: 'string',
              description: 'Parâmetro avaliado',
            },
            value: {
              type: 'string',
              description: 'Valor obtido',
            },
            reference_range: {
              type: 'string',
              description: 'Faixa de referência',
            },
          },
        },
      },
      interpretation_level: {
        type: 'string',
        enum: ['simple', 'detailed'],
        description: 'Nível de interpretação: simple (linguagem simples), detailed (detalhada)',
      },
    },
    required: ['exam_type', 'results', 'interpretation_level'],
  },
};

/**
 * Schedule follow-up reminder
 */
export const scheduleFollowUpFunction: FunctionDefinition = {
  name: 'schedule_follow_up_reminder',
  description: 'Agenda lembretes de acompanhamento para o paciente (medicação, consultas, exames).',
  parameters: {
    type: 'object',
    properties: {
      reminder_type: {
        type: 'string',
        enum: ['medication', 'appointment', 'exam', 'vital_signs'],
        description: 'Tipo de lembrete: medication (medicação), appointment (consulta), exam (exame), vital_signs (sinais vitais)',
      },
      frequency: {
        type: 'string',
        enum: ['daily', 'weekly', 'monthly', 'custom'],
        description: 'Frequência do lembrete',
      },
      time: {
        type: 'string',
        description: 'Horário do lembrete (HH:MM)',
      },
      duration_days: {
        type: 'number',
        description: 'Duração dos lembretes em dias',
      },
      message: {
        type: 'string',
        description: 'Mensagem personalizada do lembrete em português',
      },
    },
    required: ['reminder_type', 'frequency', 'time', 'message'],
  },
};

/**
 * All medical functions for easy import
 */
export const medicalFunctions: FunctionDefinition[] = [
  performTriageFunction,
  checkAppointmentAvailabilityFunction,
  getMedicationInfoFunction,
  checkAuthorizationFunction,
  provideHealthEducationFunction,
  interpretExamResultsFunction,
  scheduleFollowUpFunction,
];

/**
 * Function map for executing function calls
 */
export const functionMap = {
  perform_medical_triage: 'performMedicalTriage',
  check_appointment_availability: 'checkAppointmentAvailability',
  get_medication_info: 'getMedicationInfo',
  check_procedure_authorization: 'checkProcedureAuthorization',
  provide_health_education: 'provideHealthEducation',
  interpret_exam_results: 'interpretExamResults',
  schedule_follow_up_reminder: 'scheduleFollowUpReminder',
} as const;
