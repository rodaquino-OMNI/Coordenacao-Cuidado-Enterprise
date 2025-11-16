import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AUSTA Care Platform API',
      version,
      description: 'Enterprise healthcare coordination platform with AI-powered WhatsApp integration',
      contact: {
        name: 'AUSTA Care Platform Team',
        email: 'support@austa-care.com',
        url: 'https://austa-care.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://austa-care.com/license'
      }
    },
    servers: [
      {
        url: 'https://api.austa-care.com',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.austa-care.com',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization token'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['message', 'status'],
          properties: {
            message: {
              type: 'string',
              description: 'Error message'
            },
            status: {
              type: 'integer',
              description: 'HTTP status code'
            },
            code: {
              type: 'string',
              description: 'Application-specific error code'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy']
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    latency: { type: 'number' }
                  }
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    latency: { type: 'number' }
                  }
                },
                mongodb: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    latency: { type: 'number' }
                  }
                },
                kafka: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    latency: { type: 'number' }
                  }
                }
              }
            },
            version: { type: 'string' },
            uptime: { type: 'number' }
          }
        },
        WhatsAppMessage: {
          type: 'object',
          required: ['to', 'type', 'content'],
          properties: {
            to: {
              type: 'string',
              pattern: '^\\+[1-9]\\d{1,14}$',
              description: 'Recipient phone number in E.164 format'
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'document', 'audio', 'video', 'template'],
              description: 'Message type'
            },
            content: {
              type: 'object',
              description: 'Message content (structure varies by type)'
            }
          }
        },
        AIAnalysisRequest: {
          type: 'object',
          required: ['text', 'analysisType'],
          properties: {
            text: {
              type: 'string',
              minLength: 1,
              maxLength: 10000,
              description: 'Text to analyze'
            },
            analysisType: {
              type: 'string',
              enum: ['symptom', 'risk', 'emergency', 'sentiment'],
              description: 'Type of analysis to perform'
            },
            metadata: {
              type: 'object',
              description: 'Additional context for analysis'
            }
          }
        },
        OCRRequest: {
          type: 'object',
          required: ['documentType'],
          properties: {
            documentType: {
              type: 'string',
              enum: ['prescription', 'lab_result', 'medical_record', 'insurance_card'],
              description: 'Type of medical document'
            },
            file: {
              type: 'string',
              format: 'binary',
              description: 'Document image file'
            }
          }
        },
        RiskAssessment: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
              format: 'uuid'
            },
            riskScore: {
              type: 'number',
              minimum: 0,
              maximum: 100
            },
            riskLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical']
            },
            factors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  factor: { type: 'string' },
                  weight: { type: 'number' },
                  value: { type: 'number' }
                }
              }
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints'
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'WhatsApp',
        description: 'WhatsApp messaging integration'
      },
      {
        name: 'AI',
        description: 'AI-powered analysis and processing'
      },
      {
        name: 'OCR',
        description: 'Document OCR and medical record processing'
      },
      {
        name: 'Risk Assessment',
        description: 'Patient risk assessment and monitoring'
      },
      {
        name: 'Authorization',
        description: 'Role-based access control and permissions'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/whatsapp/send:
 *   post:
 *     summary: Send WhatsApp message
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WhatsAppMessage'
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/ai/analyze:
 *   post:
 *     summary: Analyze text with AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIAnalysisRequest'
 *     responses:
 *       200:
 *         description: Analysis complete
 *       400:
 *         description: Invalid input
 */

/**
 * @swagger
 * /api/ocr/process:
 *   post:
 *     summary: Process medical document with OCR
 *     tags: [OCR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/OCRRequest'
 *     responses:
 *       200:
 *         description: Document processed
 *       400:
 *         description: Invalid document
 */

/**
 * @swagger
 * /api/risk/assess:
 *   post:
 *     summary: Perform patient risk assessment
 *     tags: [Risk Assessment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId]
 *             properties:
 *               patientId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Risk assessment complete
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RiskAssessment'
 */
