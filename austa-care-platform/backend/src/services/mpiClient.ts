import axios from 'axios';
import { logger } from '../utils/logger';

export interface MPIResolveRequest {
  cpfHash?: string;
  name?: string;
  birthDate?: string;
  phone?: string;
}

export interface MPIResolveResponse {
  mpi_id: string;
  match_method: 'DETERMINISTIC' | 'PROBABILISTIC' | 'NEW';
  match_confidence: number;
  golden_record?: Record<string, unknown>;
}

export class MPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.MPI_API_URL || 'https://mpi.amh.internal';
    this.apiKey = process.env.MPI_API_KEY || '';
  }

  async resolvePatient(request: MPIResolveRequest): Promise<MPIResolveResponse> {
    const response = await axios.post(`${this.baseUrl}/api/v1/mpi/lookup`, request, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      timeout: 5000,
    });
    return response.data;
  }

  async getGoldenRecord(mpiId: string): Promise<Record<string, unknown>> {
    const response = await axios.get(`${this.baseUrl}/api/v1/mpi/golden-record/${mpiId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      timeout: 3000,
    });
    return response.data;
  }
}

export const mpiClient = new MPIClient();
