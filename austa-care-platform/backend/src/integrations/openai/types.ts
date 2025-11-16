/**
 * OpenAI Integration Types
 * Support for chat completions with function calling
 */

export interface OpenAIConfig {
  apiKey: string;
  organizationId?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface FunctionParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: {
    type: string;
    properties?: Record<string, FunctionParameter>;
  };
  properties?: Record<string, FunctionParameter>;
  required?: string[];
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  functions?: FunctionDefinition[];
  function_call?: 'auto' | 'none' | { name: string };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  user?: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      function_call?: {
        name?: string;
        arguments?: string;
      };
    };
    finish_reason: string | null;
  }>;
}

// Medical Triage Function Definitions

export interface TriageSymptom {
  symptom: string;
  severity: 'mild' | 'moderate' | 'severe';
  duration: string;
  onset: 'sudden' | 'gradual';
}

export interface TriageAssessment {
  urgency: 'emergency' | 'urgent' | 'semi_urgent' | 'non_urgent';
  recommended_action: string;
  reasoning: string;
  red_flags: string[];
  follow_up_questions: string[];
  specialty_recommendation?: string;
}

export interface MedicalContext {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  chronic_conditions?: string[];
  current_medications?: string[];
  allergies?: string[];
  vital_signs?: {
    temperature?: number;
    heart_rate?: number;
    blood_pressure?: {
      systolic: number;
      diastolic: number;
    };
    respiratory_rate?: number;
    oxygen_saturation?: number;
  };
}

export interface TriageRequest {
  symptoms: TriageSymptom[];
  medical_context?: MedicalContext;
  patient_description: string;
}

export interface SchedulingRequest {
  specialty: string;
  urgency: 'emergency' | 'urgent' | 'semi_urgent' | 'non_urgent';
  preferred_date?: string;
  preferred_time?: 'morning' | 'afternoon' | 'evening';
  reason: string;
}

export interface SchedulingResponse {
  available_slots: Array<{
    date: string;
    time: string;
    doctor_name: string;
    specialty: string;
  }>;
  recommended_slot?: {
    date: string;
    time: string;
    doctor_name: string;
    reason: string;
  };
}

export interface MedicationQuery {
  medication_name?: string;
  symptom?: string;
  interaction_check?: {
    medication1: string;
    medication2: string;
  };
}

export interface MedicationInfo {
  name: string;
  generic_name?: string;
  purpose: string;
  dosage_info: string;
  side_effects: string[];
  contraindications: string[];
  interactions?: string[];
  warnings: string[];
}

export interface AuthorizationRequest {
  procedure_name: string;
  diagnosis_code?: string;
  patient_plan: string;
  urgency: 'emergency' | 'urgent' | 'routine';
  additional_info?: string;
}

export interface AuthorizationStatus {
  status: 'approved' | 'pending' | 'denied' | 'more_info_needed';
  authorization_code?: string;
  valid_until?: string;
  coverage_percentage?: number;
  estimated_cost?: number;
  requirements?: string[];
  next_steps: string[];
}
