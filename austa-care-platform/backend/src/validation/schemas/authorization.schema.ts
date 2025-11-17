import { z } from 'zod';

/**
 * Authorization request type enum
 */
export const AuthorizationTypeSchema = z.enum([
  'CONSULTATION',
  'EXAM',
  'PROCEDURE',
  'MEDICATION',
  'HOSPITALIZATION',
  'SURGERY',
  'THERAPY',
  'HOME_CARE',
  'EMERGENCY'
]);

/**
 * Authorization status enum
 */
export const AuthorizationStatusSchema = z.enum([
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'DENIED',
  'CANCELLED',
  'EXPIRED'
]);

/**
 * Urgency level enum
 */
export const UrgencyLevelSchema = z.enum([
  'ROUTINE',
  'URGENT',
  'EMERGENCY'
]);

/**
 * Health insurance provider regex (Brazilian format)
 */
const insuranceCardRegex = /^\d{15,20}$/;

/**
 * Create authorization request schema
 */
export const createAuthorizationSchema = z.object({
  body: z.object({
    type: AuthorizationTypeSchema,

    urgencyLevel: UrgencyLevelSchema.default('ROUTINE'),

    requestedService: z.object({
      code: z.string()
        .min(1, { message: 'Código do serviço é obrigatório' })
        .max(20, { message: 'Código deve ter no máximo 20 caracteres' }),
      description: z.string()
        .min(1, { message: 'Descrição é obrigatória' })
        .max(500, { message: 'Descrição deve ter no máximo 500 caracteres' }),
      quantity: z.number()
        .int({ message: 'Quantidade deve ser um número inteiro' })
        .positive({ message: 'Quantidade deve ser positiva' })
        .default(1),
    }),

    clinicalJustification: z.string()
      .min(10, { message: 'Justificativa clínica deve ter no mínimo 10 caracteres' })
      .max(2000, { message: 'Justificativa deve ter no máximo 2000 caracteres' }),

    requestingPhysician: z.object({
      name: z.string().min(1, { message: 'Nome do médico é obrigatório' }),
      crm: z.string()
        .regex(/^CRM\/[A-Z]{2}\s\d{4,6}$/, {
          message: 'CRM inválido. Use o formato: CRM/SP 123456'
        }),
      specialty: z.string().optional(),
      phone: z.string()
        .regex(/^\+55\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, {
          message: 'Telefone inválido. Use o formato: +55 (00) 00000-0000'
        }),
    }),

    healthInsurance: z.object({
      provider: z.string()
        .min(1, { message: 'Operadora é obrigatória' }),
      cardNumber: z.string()
        .regex(insuranceCardRegex, {
          message: 'Número da carteirinha inválido (15-20 dígitos)'
        }),
      plan: z.string().optional(),
      validity: z.string().datetime().optional(),
    }),

    diagnosisCodes: z.array(
      z.string()
        .regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, {
          message: 'Código CID inválido. Use o formato: A00 ou A00.0'
        })
    ).min(1, { message: 'Ao menos um código CID é obrigatório' }),

    supportingDocuments: z.array(
      z.string().uuid({ message: 'ID do documento inválido' })
    ).optional(),

    preferredDate: z.string()
      .datetime({ message: 'Data preferencial inválida' })
      .optional()
      .refine((date) => {
        if (!date) return true;
        return new Date(date) >= new Date();
      }, { message: 'Data preferencial deve ser futura' }),

    facility: z.object({
      name: z.string().min(1, { message: 'Nome da unidade é obrigatório' }),
      cnes: z.string()
        .regex(/^\d{7}$/, { message: 'CNES inválido (7 dígitos)' })
        .optional(),
      address: z.string().optional(),
    }).optional(),

    estimatedCost: z.number()
      .positive({ message: 'Custo estimado deve ser positivo' })
      .optional(),

    observations: z.string()
      .max(1000, { message: 'Observações devem ter no máximo 1000 caracteres' })
      .optional(),
  }),
});

/**
 * Get authorization schema
 */
export const getAuthorizationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da autorização inválido' }),
  }),
});

/**
 * List authorizations schema
 */
export const listAuthorizationsSchema = z.object({
  query: z.object({
    type: AuthorizationTypeSchema.optional(),

    status: AuthorizationStatusSchema.optional(),

    urgencyLevel: UrgencyLevelSchema.optional(),

    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),

    search: z.string().max(100).optional(),

    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('20')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),

    sortBy: z.enum(['createdAt', 'preferredDate', 'urgencyLevel']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
});

/**
 * Update authorization schema
 */
export const updateAuthorizationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da autorização inválido' }),
  }),

  body: z.object({
    status: AuthorizationStatusSchema.optional(),

    clinicalJustification: z.string()
      .min(10)
      .max(2000)
      .optional(),

    preferredDate: z.string()
      .datetime()
      .refine((date) => new Date(date) >= new Date(), {
        message: 'Data preferencial deve ser futura'
      })
      .optional(),

    observations: z.string().max(1000).optional(),

    supportingDocuments: z.array(z.string().uuid()).optional(),
  }),
});

/**
 * Update authorization status schema
 */
export const updateAuthorizationStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da autorização inválido' }),
  }),

  body: z.object({
    status: AuthorizationStatusSchema,

    reviewerNotes: z.string()
      .max(1000, { message: 'Notas devem ter no máximo 1000 caracteres' })
      .optional(),

    approvedQuantity: z.number()
      .int()
      .positive()
      .optional(),

    denialReason: z.string()
      .max(500)
      .optional(),

    validUntil: z.string()
      .datetime()
      .optional()
      .refine((date) => {
        if (!date) return true;
        return new Date(date) > new Date();
      }, { message: 'Validade deve ser futura' }),

    authorizationNumber: z.string()
      .max(50)
      .optional(),
  }).superRefine((data, ctx) => {
    // Validate denialReason is required when status is DENIED
    if (data.status === 'DENIED' && !data.denialReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Motivo da negativa é obrigatório quando status é DENIED',
        path: ['denialReason']
      });
    }
  }),
});

/**
 * Cancel authorization schema
 */
export const cancelAuthorizationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da autorização inválido' }),
  }),

  body: z.object({
    cancellationReason: z.string()
      .min(10, { message: 'Motivo deve ter no mínimo 10 caracteres' })
      .max(500, { message: 'Motivo deve ter no máximo 500 caracteres' }),
  }),
});

/**
 * Get authorization timeline schema
 */
export const getAuthorizationTimelineSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da autorização inválido' }),
  }),
});

/**
 * Export authorization schema
 */
export const exportAuthorizationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da autorização inválido' }),
  }),

  query: z.object({
    format: z.enum(['PDF', 'JSON']).default('PDF'),
  }).optional(),
});

/**
 * Batch create authorizations schema
 */
export const batchCreateAuthorizationsSchema = z.object({
  body: z.object({
    authorizations: z.array(
      z.object({
        type: AuthorizationTypeSchema,
        requestedService: z.object({
          code: z.string(),
          description: z.string(),
          quantity: z.number().positive().default(1),
        }),
        clinicalJustification: z.string().min(10),
      })
    ).min(1).max(10, { message: 'Máximo de 10 autorizações por lote' }),
  }),
});

/**
 * Authorization statistics schema
 */
export const getAuthorizationStatsSchema = z.object({
  query: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    groupBy: z.enum(['type', 'status', 'urgency']).default('status'),
  }).refine((data) => {
    return new Date(data.startDate) <= new Date(data.endDate);
  }, {
    message: 'Data inicial deve ser anterior à data final',
  }),
});

// Export types
export type AuthorizationType = z.infer<typeof AuthorizationTypeSchema>;
export type AuthorizationStatus = z.infer<typeof AuthorizationStatusSchema>;
export type UrgencyLevel = z.infer<typeof UrgencyLevelSchema>;
export type CreateAuthorizationInput = z.infer<typeof createAuthorizationSchema>;
export type GetAuthorizationInput = z.infer<typeof getAuthorizationSchema>;
export type ListAuthorizationsInput = z.infer<typeof listAuthorizationsSchema>;
export type UpdateAuthorizationInput = z.infer<typeof updateAuthorizationSchema>;
export type UpdateAuthorizationStatusInput = z.infer<typeof updateAuthorizationStatusSchema>;
export type CancelAuthorizationInput = z.infer<typeof cancelAuthorizationSchema>;
