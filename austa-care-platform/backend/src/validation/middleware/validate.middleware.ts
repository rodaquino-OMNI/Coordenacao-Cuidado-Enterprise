import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodIssue } from 'zod';

/**
 * Error response format
 */
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationErrorResponse {
  success: false;
  error: {
    type: 'VALIDATION_ERROR';
    message: string;
    details: ValidationError[];
    timestamp: string;
  };
}

/**
 * Format Zod validation errors into user-friendly Portuguese messages
 */
const formatZodError = (error: ZodError): ValidationError[] => {
  return error.issues.map((issue: ZodIssue) => {
    const field = issue.path.join('.');

    return {
      field,
      message: issue.message,
      code: issue.code,
    };
  });
};

/**
 * Generic validation middleware factory
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post('/users', validate(createUserSchema), userController.create);
 * ```
 */
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request against schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // If validation passes, continue to next middleware
      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        const validationErrors = formatZodError(error);

        const response: ValidationErrorResponse = {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Erro de validação nos dados enviados',
            details: validationErrors,
            timestamp: new Date().toISOString(),
          },
        };

        res.status(400).json(response);
        return;
      }

      // Handle unexpected errors
      console.error('Unexpected validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Erro interno ao validar requisição',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Validate only request body
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateBody = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodError(error);

        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Erro de validação no corpo da requisição',
            details: validationErrors,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      console.error('Unexpected validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Erro interno ao validar requisição',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Validate only query parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateQuery = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodError(error);

        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Erro de validação nos parâmetros da requisição',
            details: validationErrors,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      console.error('Unexpected validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Erro interno ao validar requisição',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Validate only path parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateParams = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodError(error);

        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Erro de validação nos parâmetros da URL',
            details: validationErrors,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      console.error('Unexpected validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Erro interno ao validar requisição',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Validate file uploads
 *
 * @param options - Validation options
 * @returns Express middleware function
 */
export const validateFile = (options: {
  required?: boolean;
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = req.file;

    // Check if file is required
    if (options.required && !file) {
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Arquivo é obrigatório',
          details: [{
            field: 'file',
            message: 'Nenhum arquivo foi enviado',
            code: 'required',
          }],
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // If file not required and not provided, skip validation
    if (!file) {
      next();
      return;
    }

    const errors: ValidationError[] = [];

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      errors.push({
        field: 'file',
        message: `Arquivo muito grande. Tamanho máximo: ${options.maxSize / 1024 / 1024}MB`,
        code: 'file_too_large',
      });
    }

    // Check MIME type
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
      errors.push({
        field: 'file',
        message: `Tipo de arquivo não permitido. Tipos aceitos: ${options.allowedMimeTypes.join(', ')}`,
        code: 'invalid_mime_type',
      });
    }

    // If there are errors, return error response
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Erro de validação no arquivo enviado',
          details: errors,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validation passed
    next();
  };
};

/**
 * Middleware to sanitize input data (remove potentially harmful content)
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Basic XSS protection - remove script tags and HTML
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;

    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? sanitizeString(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  };

  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

export default validate;
