/**
 * Tasy ERP API Endpoints Configuration
 */

export const TasyEndpoints = {
  // Authentication
  AUTH: {
    TOKEN: '/oauth/token',
    REFRESH: '/oauth/refresh',
    REVOKE: '/oauth/revoke',
  },

  // Patient Management
  PATIENTS: {
    BASE: '/api/v1/pacientes',
    BY_ID: (id: number) => `/api/v1/pacientes/${id}`,
    BY_CPF: (cpf: string) => `/api/v1/pacientes/cpf/${cpf}`,
    SEARCH: '/api/v1/pacientes/buscar',
    CREATE: '/api/v1/pacientes',
    UPDATE: (id: number) => `/api/v1/pacientes/${id}`,
  },

  // Insurance Plans
  INSURANCE: {
    BASE: '/api/v1/convenios',
    BY_PATIENT: (patientId: number) => `/api/v1/pacientes/${patientId}/convenios`,
    ELIGIBILITY: (patientId: number, planId: number) =>
      `/api/v1/pacientes/${patientId}/convenios/${planId}/elegibilidade`,
    VALIDATE_CARD: '/api/v1/convenios/validar-carteirinha',
  },

  // Appointments
  APPOINTMENTS: {
    BASE: '/api/v1/agendamentos',
    BY_ID: (id: number) => `/api/v1/agendamentos/${id}`,
    BY_PATIENT: (patientId: number) => `/api/v1/pacientes/${patientId}/agendamentos`,
    AVAILABILITY: '/api/v1/agendamentos/disponibilidade',
    CREATE: '/api/v1/agendamentos',
    UPDATE: (id: number) => `/api/v1/agendamentos/${id}`,
    CANCEL: (id: number) => `/api/v1/agendamentos/${id}/cancelar`,
    CONFIRM: (id: number) => `/api/v1/agendamentos/${id}/confirmar`,
  },

  // Professionals
  PROFESSIONALS: {
    BASE: '/api/v1/profissionais',
    BY_ID: (id: number) => `/api/v1/profissionais/${id}`,
    BY_SPECIALTY: (specialty: string) => `/api/v1/profissionais/especialidade/${specialty}`,
    SEARCH: '/api/v1/profissionais/buscar',
  },

  // Authorizations
  AUTHORIZATIONS: {
    BASE: '/api/v1/autorizacoes',
    BY_ID: (id: number) => `/api/v1/autorizacoes/${id}`,
    BY_PATIENT: (patientId: number) => `/api/v1/pacientes/${patientId}/autorizacoes`,
    CREATE: '/api/v1/autorizacoes',
    UPDATE_STATUS: (id: number) => `/api/v1/autorizacoes/${id}/status`,
    CANCEL: (id: number) => `/api/v1/autorizacoes/${id}/cancelar`,
  },

  // Procedures
  PROCEDURES: {
    BASE: '/api/v1/procedimentos',
    BY_CODE: (code: string) => `/api/v1/procedimentos/${code}`,
    SEARCH: '/api/v1/procedimentos/buscar',
    BY_TABLE: (table: string) => `/api/v1/procedimentos/tabela/${table}`,
  },

  // Exam Results
  EXAMS: {
    BASE: '/api/v1/exames',
    BY_ID: (id: number) => `/api/v1/exames/${id}`,
    BY_PATIENT: (patientId: number) => `/api/v1/pacientes/${patientId}/exames`,
    DOWNLOAD: (id: number) => `/api/v1/exames/${id}/download`,
  },

  // Prescriptions
  PRESCRIPTIONS: {
    BASE: '/api/v1/prescricoes',
    BY_ID: (id: number) => `/api/v1/prescricoes/${id}`,
    BY_PATIENT: (patientId: number) => `/api/v1/pacientes/${patientId}/prescricoes`,
    CREATE: '/api/v1/prescricoes',
  },

  // Vital Signs
  VITAL_SIGNS: {
    BASE: '/api/v1/sinais-vitais',
    BY_PATIENT: (patientId: number) => `/api/v1/pacientes/${patientId}/sinais-vitais`,
    CREATE: '/api/v1/sinais-vitais',
    LATEST: (patientId: number) => `/api/v1/pacientes/${patientId}/sinais-vitais/recentes`,
  },

  // Health
  HEALTH: {
    CHECK: '/health',
    STATUS: '/health/status',
  },
} as const;

/**
 * HTTP Methods
 */
export const HttpMethods = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

/**
 * Default pagination
 */
export const DefaultPagination = {
  LIMIT: 50,
  OFFSET: 0,
  MAX_LIMIT: 200,
} as const;

/**
 * Request timeouts (ms)
 */
export const Timeouts = {
  DEFAULT: 30000,
  SEARCH: 60000,
  UPLOAD: 120000,
  DOWNLOAD: 180000,
} as const;
