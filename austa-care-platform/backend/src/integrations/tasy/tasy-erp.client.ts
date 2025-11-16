/**
 * Tasy ERP REST API Client
 * Philips Healthcare ERP System Integration with OAuth2 authentication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { eventPublisher } from '../../infrastructure/kafka/events/event.publisher';
import {
  TasyConfig,
  TasyAuthToken,
  TasyPatient,
  TasyInsurancePlan,
  TasyAppointment,
  TasyProfessional,
  TasyAuthorization,
  TasyProcedure,
  TasyExamResult,
  TasyPrescription,
  TasyVitalSigns,
  TasyAppointmentAvailability,
  TasyEligibilityCheck,
  TasySearchParams,
  TasyPaginatedResponse,
  TasyError,
} from './types';
import { TasyEndpoints, DefaultPagination, Timeouts } from './endpoints';

export class TasyERPClient {
  private static instance: TasyERPClient;
  private client: AxiosInstance;
  private config: TasyConfig;
  private tokenData: TasyAuthToken | null = null;
  private tokenExpiry: Date | null = null;

  private constructor(config: TasyConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || Timeouts.DEFAULT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  static getInstance(config?: TasyConfig): TasyERPClient {
    if (!TasyERPClient.instance && !config) {
      throw new Error('TasyERPClient must be initialized with config first');
    }

    if (config) {
      TasyERPClient.instance = new TasyERPClient(config);
    }

    return TasyERPClient.instance;
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      async (config) => {
        // Ensure we have a valid token
        await this.ensureValidToken();

        if (this.tokenData) {
          config.headers.Authorization = `Bearer ${this.tokenData.access_token}`;
        }

        logger.debug('Tasy API request:', {
          method: config.method,
          url: config.url,
        });

        return config;
      },
      (error) => {
        logger.error('Tasy request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Tasy API response:', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      async (error: AxiosError<TasyError>) => {
        const errorData = error.response?.data;

        logger.error('Tasy API error:', {
          status: error.response?.status,
          code: errorData?.codigo,
          message: errorData?.mensagem,
          details: errorData?.detalhes,
        });

        // Handle 401 - Refresh token
        if (error.response?.status === 401) {
          try {
            await this.refreshToken();
            // Retry original request
            return this.client.request(error.config!);
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError);
            this.tokenData = null;
            this.tokenExpiry = null;
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * Ensure we have a valid authentication token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.tokenData || this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;

    // Refresh 5 minutes before expiry
    const expiryBuffer = 5 * 60 * 1000;
    return Date.now() >= this.tokenExpiry.getTime() - expiryBuffer;
  }

  /**
   * Authenticate with Tasy API using OAuth2
   */
  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<TasyAuthToken>(
        `${this.config.apiUrl}${TasyEndpoints.AUTH.TOKEN}`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          auth: {
            username: this.config.clientId,
            password: this.config.clientSecret,
          },
        }
      );

      this.tokenData = response.data;
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

      logger.info('Tasy authentication successful', {
        expires_in: response.data.expires_in,
      });

      await eventPublisher.publish({
        eventType: 'tasy.auth.success',
        source: 'tasy-erp-client',
        version: '1.0',
        data: {
          timestamp: new Date().toISOString(),
          expires_in: response.data.expires_in,
        },
      });
    } catch (error) {
      logger.error('Tasy authentication failed:', error);

      await eventPublisher.publish({
        eventType: 'tasy.auth.failed',
        source: 'tasy-erp-client',
        version: '1.0',
        data: {
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<void> {
    if (!this.tokenData?.refresh_token) {
      return this.authenticate();
    }

    try {
      const response = await axios.post<TasyAuthToken>(
        `${this.config.apiUrl}${TasyEndpoints.AUTH.REFRESH}`,
        {
          grant_type: 'refresh_token',
          refresh_token: this.tokenData.refresh_token,
        }
      );

      this.tokenData = response.data;
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

      logger.info('Tasy token refreshed successfully');
    } catch (error) {
      logger.error('Tasy token refresh failed:', error);
      throw error;
    }
  }

  // ========================================
  // Patient Methods
  // ========================================

  /**
   * Get patient by ID
   */
  async getPatient(patientId: number): Promise<TasyPatient> {
    const response = await this.client.get<TasyPatient>(
      TasyEndpoints.PATIENTS.BY_ID(patientId)
    );
    return response.data;
  }

  /**
   * Get patient by CPF
   */
  async getPatientByCPF(cpf: string): Promise<TasyPatient | null> {
    try {
      const response = await this.client.get<TasyPatient>(
        TasyEndpoints.PATIENTS.BY_CPF(cpf)
      );
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search patients
   */
  async searchPatients(
    params: TasySearchParams
  ): Promise<TasyPaginatedResponse<TasyPatient>> {
    const response = await this.client.get<TasyPaginatedResponse<TasyPatient>>(
      TasyEndpoints.PATIENTS.SEARCH,
      {
        params: {
          ...params,
          limit: params.limit || DefaultPagination.LIMIT,
          offset: params.offset || DefaultPagination.OFFSET,
        },
        timeout: Timeouts.SEARCH,
      }
    );
    return response.data;
  }

  // ========================================
  // Insurance Plan Methods
  // ========================================

  /**
   * Get patient insurance plans
   */
  async getPatientInsurancePlans(patientId: number): Promise<TasyInsurancePlan[]> {
    const response = await this.client.get<TasyInsurancePlan[]>(
      TasyEndpoints.INSURANCE.BY_PATIENT(patientId)
    );
    return response.data;
  }

  /**
   * Check patient eligibility for plan
   */
  async checkEligibility(
    patientId: number,
    planId: number
  ): Promise<TasyEligibilityCheck> {
    const response = await this.client.get<TasyEligibilityCheck>(
      TasyEndpoints.INSURANCE.ELIGIBILITY(patientId, planId)
    );
    return response.data;
  }

  /**
   * Validate insurance card
   */
  async validateInsuranceCard(
    cardNumber: string,
    planId: number
  ): Promise<{ valid: boolean; message?: string }> {
    const response = await this.client.post(
      TasyEndpoints.INSURANCE.VALIDATE_CARD,
      {
        nr_carteirinha: cardNumber,
        nr_seq_convenio: planId,
      }
    );
    return response.data;
  }

  // ========================================
  // Appointment Methods
  // ========================================

  /**
   * Get patient appointments
   */
  async getPatientAppointments(
    patientId: number,
    params?: { dt_inicio?: string; dt_fim?: string }
  ): Promise<TasyAppointment[]> {
    const response = await this.client.get<TasyAppointment[]>(
      TasyEndpoints.APPOINTMENTS.BY_PATIENT(patientId),
      { params }
    );
    return response.data;
  }

  /**
   * Check appointment availability
   */
  async checkAppointmentAvailability(params: {
    cd_especialidade?: number;
    nr_seq_profissional?: number;
    dt_inicio: string;
    dt_fim: string;
  }): Promise<TasyAppointmentAvailability[]> {
    const response = await this.client.get<TasyAppointmentAvailability[]>(
      TasyEndpoints.APPOINTMENTS.AVAILABILITY,
      { params }
    );
    return response.data;
  }

  /**
   * Create appointment
   */
  async createAppointment(data: {
    nr_seq_pessoa: number;
    nr_seq_profissional: number;
    nr_seq_convenio?: number;
    dt_agendamento: string;
    hr_agendamento: string;
    ds_observacao?: string;
  }): Promise<TasyAppointment> {
    const response = await this.client.post<TasyAppointment>(
      TasyEndpoints.APPOINTMENTS.CREATE,
      data
    );

    await eventPublisher.publish({
      eventType: 'tasy.appointment.created',
      source: 'tasy-erp-client',
      version: '1.0',
      data: {
        appointmentId: response.data.nr_seq_agendamento,
        patientId: data.nr_seq_pessoa,
        timestamp: new Date().toISOString(),
      },
    });

    return response.data;
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(
    appointmentId: number,
    reason: string
  ): Promise<void> {
    await this.client.post(TasyEndpoints.APPOINTMENTS.CANCEL(appointmentId), {
      ds_motivo_cancelamento: reason,
    });

    await eventPublisher.publish({
      eventType: 'tasy.appointment.cancelled',
      source: 'tasy-erp-client',
      version: '1.0',
      data: {
        appointmentId,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Confirm appointment
   */
  async confirmAppointment(appointmentId: number): Promise<void> {
    await this.client.post(TasyEndpoints.APPOINTMENTS.CONFIRM(appointmentId));

    await eventPublisher.publish({
      eventType: 'tasy.appointment.confirmed',
      source: 'tasy-erp-client',
      version: '1.0',
      data: {
        appointmentId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // ========================================
  // Professional Methods
  // ========================================

  /**
   * Get professional by ID
   */
  async getProfessional(professionalId: number): Promise<TasyProfessional> {
    const response = await this.client.get<TasyProfessional>(
      TasyEndpoints.PROFESSIONALS.BY_ID(professionalId)
    );
    return response.data;
  }

  /**
   * Get professionals by specialty
   */
  async getProfessionalsBySpecialty(
    specialty: string
  ): Promise<TasyProfessional[]> {
    const response = await this.client.get<TasyProfessional[]>(
      TasyEndpoints.PROFESSIONALS.BY_SPECIALTY(specialty)
    );
    return response.data;
  }

  // ========================================
  // Authorization Methods
  // ========================================

  /**
   * Get authorization by ID
   */
  async getAuthorization(authorizationId: number): Promise<TasyAuthorization> {
    const response = await this.client.get<TasyAuthorization>(
      TasyEndpoints.AUTHORIZATIONS.BY_ID(authorizationId)
    );
    return response.data;
  }

  /**
   * Get patient authorizations
   */
  async getPatientAuthorizations(
    patientId: number
  ): Promise<TasyAuthorization[]> {
    const response = await this.client.get<TasyAuthorization[]>(
      TasyEndpoints.AUTHORIZATIONS.BY_PATIENT(patientId)
    );
    return response.data;
  }

  /**
   * Create authorization request
   */
  async createAuthorization(data: {
    nr_seq_pessoa: number;
    nr_seq_convenio: number;
    cd_procedimento: string;
    ds_procedimento: string;
    qt_solicitada: number;
    ds_justificativa?: string;
    nr_seq_profissional_solicitante: number;
  }): Promise<TasyAuthorization> {
    const response = await this.client.post<TasyAuthorization>(
      TasyEndpoints.AUTHORIZATIONS.CREATE,
      data
    );

    await eventPublisher.publish({
      eventType: 'tasy.authorization.created',
      source: 'tasy-erp-client',
      version: '1.0',
      data: {
        authorizationId: response.data.nr_seq_autorizacao,
        patientId: data.nr_seq_pessoa,
        procedureCode: data.cd_procedimento,
        timestamp: new Date().toISOString(),
      },
    });

    return response.data;
  }

  // ========================================
  // Procedure Methods
  // ========================================

  /**
   * Get procedure by code
   */
  async getProcedure(procedureCode: string): Promise<TasyProcedure> {
    const response = await this.client.get<TasyProcedure>(
      TasyEndpoints.PROCEDURES.BY_CODE(procedureCode)
    );
    return response.data;
  }

  /**
   * Search procedures
   */
  async searchProcedures(
    searchTerm: string,
    table?: string
  ): Promise<TasyProcedure[]> {
    const response = await this.client.get<TasyProcedure[]>(
      TasyEndpoints.PROCEDURES.SEARCH,
      {
        params: {
          q: searchTerm,
          tp_tabela: table,
        },
        timeout: Timeouts.SEARCH,
      }
    );
    return response.data;
  }

  // ========================================
  // Exam Results Methods
  // ========================================

  /**
   * Get patient exam results
   */
  async getPatientExamResults(patientId: number): Promise<TasyExamResult[]> {
    const response = await this.client.get<TasyExamResult[]>(
      TasyEndpoints.EXAMS.BY_PATIENT(patientId)
    );
    return response.data;
  }

  /**
   * Download exam result file
   */
  async downloadExamResult(examId: number): Promise<Buffer> {
    const response = await this.client.get(
      TasyEndpoints.EXAMS.DOWNLOAD(examId),
      {
        responseType: 'arraybuffer',
        timeout: Timeouts.DOWNLOAD,
      }
    );
    return Buffer.from(response.data);
  }

  // ========================================
  // Prescription Methods
  // ========================================

  /**
   * Get patient prescriptions
   */
  async getPatientPrescriptions(
    patientId: number
  ): Promise<TasyPrescription[]> {
    const response = await this.client.get<TasyPrescription[]>(
      TasyEndpoints.PRESCRIPTIONS.BY_PATIENT(patientId)
    );
    return response.data;
  }

  // ========================================
  // Vital Signs Methods
  // ========================================

  /**
   * Get patient vital signs
   */
  async getPatientVitalSigns(
    patientId: number,
    params?: { dt_inicio?: string; dt_fim?: string }
  ): Promise<TasyVitalSigns[]> {
    const response = await this.client.get<TasyVitalSigns[]>(
      TasyEndpoints.VITAL_SIGNS.BY_PATIENT(patientId),
      { params }
    );
    return response.data;
  }

  /**
   * Get latest vital signs
   */
  async getLatestVitalSigns(patientId: number): Promise<TasyVitalSigns | null> {
    try {
      const response = await this.client.get<TasyVitalSigns>(
        TasyEndpoints.VITAL_SIGNS.LATEST(patientId)
      );
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create vital signs record
   */
  async createVitalSigns(data: TasyVitalSigns): Promise<TasyVitalSigns> {
    const response = await this.client.post<TasyVitalSigns>(
      TasyEndpoints.VITAL_SIGNS.CREATE,
      data
    );
    return response.data;
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Format error for consistent handling
   */
  private formatError(error: AxiosError<TasyError>): Error {
    const errorData = error.response?.data;

    if (errorData) {
      const message = `Tasy API Error (${errorData.codigo}): ${errorData.mensagem}`;
      const formattedError = new Error(message);
      (formattedError as any).code = errorData.codigo;
      (formattedError as any).details = errorData.detalhes;
      return formattedError;
    }

    return error;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get(TasyEndpoints.HEALTH.CHECK);
      return true;
    } catch (error) {
      logger.error('Tasy health check failed:', error);
      return false;
    }
  }
}

// Export singleton getter
export const getTasyClient = (config?: TasyConfig) =>
  TasyERPClient.getInstance(config);
