import helmet from 'helmet';
import { Express } from 'express';

/**
 * Security configuration for production deployment
 * Implements OWASP best practices for web application security
 */
export const configureSecurityHeaders = (app: Express): void => {
  // Apply Helmet security middleware with strict settings
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production with nonce
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: []
        }
      },

      // Strict Transport Security (HSTS)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      // X-Frame-Options
      frameguard: {
        action: 'deny'
      },

      // X-Content-Type-Options
      noSniff: true,

      // X-XSS-Protection
      xssFilter: true,

      // Referrer-Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },

      // X-Permitted-Cross-Domain-Policies
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none'
      },

      // DNS Prefetch Control
      dnsPrefetchControl: {
        allow: false
      },

      // Hide X-Powered-By
      hidePoweredBy: true
    })
  );
};

/**
 * Input validation and sanitization configuration
 */
export const inputValidationRules = {
  // Phone number validation (E.164 format)
  phoneNumber: /^\+[1-9]\d{1,14}$/,

  // Email validation (RFC 5322)
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

  // UUID validation
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  // Alphanumeric with basic punctuation
  safeText: /^[a-zA-Z0-9\s.,!?-]+$/,

  // Max lengths
  maxLengths: {
    message: 10000,
    name: 255,
    description: 2000,
    phoneNumber: 15
  }
};

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  // General API rate limit
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later'
  },

  // Authentication rate limit (stricter)
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later',
    skipSuccessfulRequests: true
  },

  // WhatsApp messaging rate limit
  whatsapp: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 messages per minute
    message: 'Message rate limit exceeded'
  },

  // AI analysis rate limit
  ai: {
    windowMs: 60 * 1000,
    max: 20, // 20 requests per minute
    message: 'AI analysis rate limit exceeded'
  }
};

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'https://austa-care.com',
      'https://www.austa-care.com',
      'https://staging.austa-care.com'
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
  maxAge: 86400 // 24 hours
};

/**
 * Sensitive data patterns to redact in logs
 */
export const sensitiveDataPatterns = [
  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Social security numbers
  /\b\d{3}-\d{2}-\d{4}\b/g,

  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // API keys and tokens
  /\b[A-Za-z0-9]{32,}\b/g,

  // Phone numbers
  /\b\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g
];

/**
 * Security headers for API responses
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};
