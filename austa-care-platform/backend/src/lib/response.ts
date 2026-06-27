import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: meta || { timestamp: new Date().toISOString() }
  };
  res.status(statusCode).json(body);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number
): void {
  const body: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      timestamp: new Date().toISOString()
    }
  };
  res.status(200).json(body);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: unknown
): void {
  const body: ApiResponse = {
    success: false,
    error: { code, message, details }
  };
  res.status(statusCode).json(body);
}

/**
 * Send a 201 Created response
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * Send a 204 No Content response
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
