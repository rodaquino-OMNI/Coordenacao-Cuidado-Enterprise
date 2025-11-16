/**
 * Audit Logging Middleware
 * Logs all important operations for compliance and security
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Audit logging middleware
 * Logs important operations with user context
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Capture original send function
  const originalSend = res.send;

  // Override send to log after response
  res.send = function (body: any): Response {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log audit entry for important operations
    if (shouldAudit(req, statusCode)) {
      logger.info('Audit log entry', {
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        method: req.method,
        path: req.path,
        statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: sanitizeBody(req.body),
        query: req.query,
        params: req.params
      });
    }

    // Call original send
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Determine if request should be audited
 */
function shouldAudit(req: Request, statusCode: number): boolean {
  // Audit all write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return true;
  }

  // Audit failed requests
  if (statusCode >= 400) {
    return true;
  }

  // Audit sensitive read operations
  const sensitivePaths = [
    '/api/v1/users',
    '/api/v1/health-data',
    '/api/v1/documents',
    '/api/v1/admin'
  ];

  return sensitivePaths.some(path => req.path.startsWith(path));
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Audit middleware specifically for admin actions
 */
export const auditAdminAction = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.warn('Admin action executed', {
      action,
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      details: {
        method: req.method,
        path: req.path,
        body: sanitizeBody(req.body),
        query: req.query,
        params: req.params
      }
    });

    next();
  };
};
