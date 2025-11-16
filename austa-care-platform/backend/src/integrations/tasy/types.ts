/**
 * Tasy ERP REST API Types
 * Philips Healthcare ERP System Integration
 */

export interface TasyConfig {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  clientSecret: string;
  timeout?: number;
}

export interface TasyAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface TasyPatient {
  nr_seq_pessoa: number;
  nm_pessoa: string;
  nr_cpf?: string;
  dt_nascimento: string;
  ie_sexo: 'M' | 'F';
  nr_cns?: string;
  nr_rg?: string;
  nm_mae?: string;
  nm_pai?: string;
  ds_endereco?: string;
  nr_endereco?: string;
  ds_complemento?: string;
  ds_bairro?: string;
  cd_cidade?: number;
  nm_cidade?: string;
  cd_uf?: string;
  nr_cep?: string;
  nr_telefone?: string;
  nr_celular?: string;
  ds_email?: string;
}

export interface TasyInsurancePlan {
  nr_seq_convenio: number;
  nm_convenio: string;
  nr_carteirinha: string;
  dt_validade_carteirinha?: string;
  ie_situacao: 'A' | 'I' | 'B'; // A=Ativo, I=Inativo, B=Bloqueado
  tp_plano?: string;
  nm_plano?: string;
  nr_contrato?: string;
}

export interface TasyAppointment {
  nr_seq_agendamento: number;
  nr_seq_pessoa: number;
  nm_pessoa: string;
  nr_seq_convenio?: number;
  nm_convenio?: string;
  dt_agendamento: string;
  hr_agendamento: string;
  nr_seq_profissional: number;
  nm_profissional: string;
  ds_especialidade?: string;
  nr_seq_unidade: number;
  nm_unidade: string;
  nr_seq_sala?: number;
  ds_sala?: string;
  ie_status: 'A' | 'C' | 'R' | 'F'; // A=Agendado, C=Cancelado, R=Realizado, F=Faltou
  ds_observacao?: string;
  dt_confirmacao?: string;
  ie_confirmado: 'S' | 'N';
}

export interface TasyProfessional {
  nr_seq_profissional: number;
  nm_profissional: string;
  nr_conselho?: string;
  cd_uf_conselho?: string;
  ds_especialidade?: string;
  cd_especialidade?: number;
  ie_situacao: 'A' | 'I';
  nr_cbo?: string;
}

export interface TasyAuthorization {
  nr_seq_autorizacao: number;
  nr_seq_pessoa: number;
  nr_seq_convenio: number;
  nm_convenio: string;
  dt_solicitacao: string;
  dt_validade?: string;
  ie_status: 'P' | 'A' | 'N' | 'C'; // P=Pendente, A=Autorizado, N=Negado, C=Cancelado
  nr_guia?: string;
  ds_procedimento: string;
  cd_procedimento?: string;
  qt_autorizada?: number;
  vl_autorizado?: number;
  ds_justificativa?: string;
  nm_profissional_solicitante?: string;
  ds_observacao?: string;
}

export interface TasyProcedure {
  cd_procedimento: string;
  ds_procedimento: string;
  tp_tabela: string; // TUSS, AMB, etc
  ie_tipo: 'C' | 'E' | 'I'; // C=Consulta, E=Exame, I=Internação
  vl_referencia?: number;
  ie_situacao: 'A' | 'I';
}

export interface TasyExamResult {
  nr_seq_resultado: number;
  nr_seq_pessoa: number;
  nr_seq_convenio?: number;
  dt_realizacao: string;
  ds_exame: string;
  cd_exame?: string;
  ds_resultado?: string;
  ds_interpretacao?: string;
  ie_status: 'P' | 'F'; // P=Parcial, F=Finalizado
  nm_profissional_executante?: string;
  ds_observacao?: string;
  ds_arquivo?: string; // URL or file path
}

export interface TasyPrescription {
  nr_seq_prescricao: number;
  nr_seq_pessoa: number;
  nr_seq_profissional: number;
  nm_profissional: string;
  dt_prescricao: string;
  ie_situacao: 'A' | 'C' | 'E'; // A=Ativo, C=Cancelado, E=Executado
  itens: TasyPrescriptionItem[];
}

export interface TasyPrescriptionItem {
  nr_seq_item: number;
  ds_medicamento: string;
  cd_medicamento?: string;
  ds_posologia: string;
  qt_dias?: number;
  ds_via_administracao?: string;
  ds_frequencia?: string;
  ds_observacao?: string;
}

export interface TasyVitalSigns {
  nr_seq_pessoa: number;
  dt_aferacao: string;
  hr_aferacao: string;
  vl_pressao_sistolica?: number;
  vl_pressao_diastolica?: number;
  vl_frequencia_cardiaca?: number;
  vl_temperatura?: number;
  vl_frequencia_respiratoria?: number;
  vl_saturacao_oxigenio?: number;
  vl_peso?: number;
  vl_altura?: number;
  vl_glicemia?: number;
  ds_observacao?: string;
}

export interface TasyAppointmentAvailability {
  nr_seq_profissional: number;
  nm_profissional: string;
  ds_especialidade: string;
  dt_disponivel: string;
  horarios: Array<{
    hr_inicio: string;
    hr_fim: string;
    ie_disponivel: boolean;
  }>;
}

export interface TasyEligibilityCheck {
  nr_seq_pessoa: number;
  nr_seq_convenio: number;
  nm_convenio: string;
  ie_elegivel: boolean;
  ds_motivo_inelegibilidade?: string;
  dt_validade_plano?: string;
  ie_carencia: boolean;
  ds_carencias?: string[];
  vl_coparticipacao?: number;
  nr_vidas_plano?: number;
}

export interface TasySearchParams {
  nr_seq_pessoa?: number;
  nr_cpf?: string;
  nm_pessoa?: string;
  dt_inicio?: string;
  dt_fim?: string;
  nr_seq_convenio?: number;
  ie_situacao?: string;
  limit?: number;
  offset?: number;
}

export interface TasyPaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface TasyError {
  codigo: string;
  mensagem: string;
  detalhes?: any;
  timestamp: string;
}
