/**
 * Request Sanitization Middleware
 * Sanitizes and validates incoming requests for security
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Sanitize request inputs to prevent injection attacks
 */
export const sanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize params
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Sanitization middleware error', { error });
    res.status(500).json({ error: 'Request processing failed' });
  }
};

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const cleanKey = sanitizeString(key);

      // Sanitize value
      if (typeof value === 'string') {
        sanitized[cleanKey] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[cleanKey] = sanitizeObject(value);
      } else {
        sanitized[cleanKey] = value;
      }
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

/**
 * Sanitize string to prevent XSS and injection attacks
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove null bytes
  let sanitized = str.replace(/\0/g, '');

  // HTML entity encoding for special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Remove potential SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|;|\/\*|\*\/)/g
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(sanitized)) {
      logger.warn('Potential SQL injection attempt detected', { original: str });
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // Remove potential NoSQL injection patterns
  if (sanitized.includes('$where') || sanitized.includes('$regex')) {
    logger.warn('Potential NoSQL injection attempt detected', { original: str });
    sanitized = sanitized.replace(/\$where/g, '').replace(/\$regex/g, '');
  }

  return sanitized;
}

/**
 * Validate Content-Type header
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('Content-Type');

    if (!contentType) {
      return res.status(400).json({ error: 'Content-Type header is required' });
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));

    if (!isAllowed) {
      logger.warn('Invalid Content-Type', { contentType, allowedTypes });
      return res.status(415).json({
        error: 'Unsupported Media Type',
        allowedTypes
      });
    }

    next();
  };
};

/**
 * Prevent parameter pollution
 */
export const preventParameterPollution = (req: Request, res: Response, next: NextFunction) => {
  // Check for duplicate parameters
  const duplicates: string[] = [];

  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value) && value.length > 1) {
      duplicates.push(key);
    }
  }

  if (duplicates.length > 0) {
    logger.warn('Parameter pollution detected', { duplicates });
    return res.status(400).json({
      error: 'Parameter pollution detected',
      duplicateParameters: duplicates
    });
  }

  next();
};
