/**
 * Prometheus Metrics Middleware
 * Automatically tracks HTTP request metrics
 */

import { Request, Response, NextFunction } from 'express';
import { metrics } from '../infrastructure/monitoring/prometheus.metrics';
import { logger } from '../utils/logger';

/**
 * Middleware to track HTTP request metrics
 * Records request duration, count, size, and status codes
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  // Track in-progress requests
  const route = getRoutePattern(req);
  metrics.httpRequestsInProgress.inc({ method: req.method, route });

  // Get request size
  const requestSize = req.headers['content-length']
    ? parseInt(req.headers['content-length'], 10)
    : 0;

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to capture metrics when response finishes
  res.end = function(this: Response, chunk?: any, encodingOrCallback?: BufferEncoding | (() => void), callback?: () => void): Response {
    // Calculate duration
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9; // Convert to seconds

    // Get response size
    const responseSize = parseInt(res.getHeader('content-length') as string) || 0;

    // Record metrics
    try {
      metrics.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration,
        requestSize,
        responseSize
      );

      // Decrement in-progress counter
      metrics.httpRequestsInProgress.dec({ method: req.method, route });

      // Log slow requests
      if (duration > 2) {
        logger.warn('Slow HTTP request detected', {
          method: req.method,
          route,
          statusCode: res.statusCode,
          duration: `${duration.toFixed(3)}s`,
        });
      }

      // Log errors
      if (res.statusCode >= 500) {
        logger.error('HTTP 5xx error', {
          method: req.method,
          route,
          statusCode: res.statusCode,
          duration: `${duration.toFixed(3)}s`,
        });
      }
    } catch (error) {
      logger.error('Error recording HTTP metrics:', error);
    }

    // Call original end function with proper signature
    if (callback) {
      return originalEnd.call(this, chunk, encodingOrCallback as BufferEncoding, callback);
    } else if (typeof encodingOrCallback === 'function') {
      return originalEnd.call(this, chunk, encodingOrCallback as any);
    } else if (encodingOrCallback) {
      return originalEnd.call(this, chunk, encodingOrCallback as BufferEncoding, undefined as any);
    } else if (chunk !== undefined) {
      return originalEnd.call(this, chunk, undefined as any, undefined as any);
    } else {
      return originalEnd.call(this, undefined as any, undefined as any, undefined as any);
    }
  };

  next();
}

/**
 * Get route pattern from request
 * Normalizes dynamic route segments for better metric grouping
 */
function getRoutePattern(req: Request): string {
  // Use Express route if available
  if (req.route && req.route.path) {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${req.route.path}`;
  }

  // Fallback to pathname normalization
  const path = req.path || req.url;

  // Normalize common patterns
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')  // UUIDs
    .replace(/\/\d+/g, '/:id')  // Numeric IDs
    .replace(/\?.*/, '')  // Remove query strings
    .replace(/\/+$/, '') || '/';  // Remove trailing slashes
}

/**
 * Middleware to track specific business metrics
 */
export function businessMetricsMiddleware(
  metricType: string,
  getLabelsFn?: (req: Request, res: Response) => Record<string, string | number>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Capture the original json function
    const originalJson = res.json;

    // Override res.json to capture business metrics
    res.json = function(this: Response, body: any): Response {
      try {
        const labels = getLabelsFn ? getLabelsFn(req, res) : {};

        // Record business metric
        if (body && typeof body === 'object') {
          metrics.recordBusinessMetric(metricType, labels, body.value);
        }
      } catch (error) {
        logger.error('Error recording business metrics:', error);
      }

      // Call original json function
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Middleware to track AI/ML prediction metrics
 */
export function aiMetricsMiddleware(
  model: string,
  type: string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();

    // Capture the original json function
    const originalJson = res.json;

    // Override res.json to capture AI metrics
    res.json = function(this: Response, body: any): Response {
      try {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1e9;

        const success = res.statusCode >= 200 && res.statusCode < 300;
        const tokensUsed = body?.usage?.total_tokens || body?.tokens_used;

        metrics.recordAIPrediction(model, type, duration, success, tokensUsed);
      } catch (error) {
        logger.error('Error recording AI metrics:', error);
      }

      // Call original json function
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Middleware to track error metrics
 */
export function errorMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;

  res.json = function(this: Response, body: any): Response {
    try {
      if (res.statusCode >= 400) {
        const errorType = body?.error?.type || 'unknown';
        const severity = res.statusCode >= 500 ? 'error' : 'warning';
        const component = getRoutePattern(req).split('/')[1] || 'unknown';

        metrics.recordError(errorType, severity, component);
      }
    } catch (error) {
      logger.error('Error recording error metrics:', error);
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Create a timer for custom metric tracking
 * Returns an end function to stop the timer and record the metric
 */
export function createMetricTimer(
  metricName: 'kafka' | 'redis' | 'mongo' | 'whatsapp' | 'tasy' | 'fhir',
  operation: string,
  labels: Record<string, string> = {}
) {
  const startTime = process.hrtime.bigint();

  return {
    end: (success: boolean = true) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      const status = success ? 'success' : 'failure';

      try {
        switch (metricName) {
          case 'kafka':
            if (operation.includes('produce')) {
              metrics.kafkaProducedMessages.inc({ ...labels, status });
            } else if (operation.includes('consume')) {
              metrics.kafkaConsumedMessages.inc({ ...labels, status });
            }
            break;

          case 'redis':
            metrics.redisOperations.inc({ operation, status });
            metrics.redisLatency.observe({ operation }, duration);
            break;

          case 'mongo':
            metrics.mongoOperations.inc({ ...labels, operation, status });
            metrics.mongoLatency.observe({ ...labels, operation }, duration);
            break;

          case 'whatsapp':
            metrics.whatsappMessagesTotal.inc({ ...labels, status });
            metrics.whatsappMessageLatency.observe(labels, duration);
            break;

          case 'tasy':
            metrics.tasyAPICallsTotal.inc({ operation, status });
            metrics.tasyAPILatency.observe({ operation }, duration);
            break;

          case 'fhir':
            metrics.fhirOperationsTotal.inc({ ...labels, operation, status });
            metrics.fhirOperationDuration.observe({ ...labels, operation }, duration);
            break;
        }
      } catch (error) {
        logger.error(`Error recording ${metricName} metrics:`, error);
      }
    },
  };
}

export default {
  metricsMiddleware,
  businessMetricsMiddleware,
  aiMetricsMiddleware,
  errorMetricsMiddleware,
  createMetricTimer,
};
