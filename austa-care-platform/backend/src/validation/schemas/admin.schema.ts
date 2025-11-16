import { z } from 'zod';

/**
 * System metric type enum
 */
export const MetricTypeSchema = z.enum([
  'USER_ACTIVITY',
  'API_PERFORMANCE',
  'DATABASE_PERFORMANCE',
  'ERROR_RATE',
  'RESOURCE_USAGE',
  'BUSINESS_METRICS'
]);

/**
 * User action type enum
 */
export const UserActionTypeSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'PASSWORD_RESET',
  'ROLE_CHANGE',
  'PERMISSION_CHANGE'
]);

/**
 * Get system metrics schema
 */
export const getSystemMetricsSchema = z.object({
  query: z.object({
    type: MetricTypeSchema.optional(),

    startDate: z.string()
      .datetime({ message: 'Data inicial inválida' }),

    endDate: z.string()
      .datetime({ message: 'Data final inválida' }),

    granularity: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('hour'),

    aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  }).refine((data) => {
    return new Date(data.startDate) <= new Date(data.endDate);
  }, {
    message: 'Data inicial deve ser anterior à data final',
  }),
});

/**
 * Get audit logs schema
 */
export const getAuditLogsSchema = z.object({
  query: z.object({
    userId: z.string().uuid({ message: 'ID do usuário inválido' }).optional(),

    action: UserActionTypeSchema.optional(),

    entityType: z.string().max(50).optional(),

    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),

    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('50')
      .refine((val) => val <= 500, { message: 'Limite máximo é 500' }),

    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
});

/**
 * Manage user role schema
 */
export const manageUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().uuid({ message: 'ID do usuário inválido' }),
  }),

  body: z.object({
    role: z.enum([
      'PATIENT',
      'CAREGIVER',
      'FAMILY_MEMBER',
      'HEALTHCARE_PROFESSIONAL',
      'ADMIN'
    ]),

    reason: z.string()
      .min(10, { message: 'Justificativa deve ter no mínimo 10 caracteres' })
      .max(500, { message: 'Justificativa deve ter no máximo 500 caracteres' }),
  }),
});

/**
 * Suspend user schema
 */
export const suspendUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid({ message: 'ID do usuário inválido' }),
  }),

  body: z.object({
    reason: z.string()
      .min(10, { message: 'Motivo deve ter no mínimo 10 caracteres' })
      .max(500, { message: 'Motivo deve ter no máximo 500 caracteres' }),

    duration: z.number()
      .int()
      .positive({ message: 'Duração deve ser positiva' })
      .optional(), // in days, if not provided = permanent

    notifyUser: z.boolean().default(true),
  }),
});

/**
 * Reactivate user schema
 */
export const reactivateUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid({ message: 'ID do usuário inválido' }),
  }),

  body: z.object({
    reason: z.string()
      .min(10, { message: 'Motivo deve ter no mínimo 10 caracteres' })
      .max(500, { message: 'Motivo deve ter no máximo 500 caracteres' }),
  }),
});

/**
 * Get system health schema
 */
export const getSystemHealthSchema = z.object({
  query: z.object({
    detailed: z.enum(['true', 'false'])
      .transform((val) => val === 'true')
      .default('false'),
  }).optional(),
});

/**
 * Configure system settings schema
 */
export const configureSystemSettingsSchema = z.object({
  body: z.object({
    category: z.enum([
      'GENERAL',
      'SECURITY',
      'NOTIFICATIONS',
      'FEATURES',
      'INTEGRATIONS',
      'PERFORMANCE'
    ]),

    settings: z.record(z.any()),

    applyImmediately: z.boolean().default(false),
  }),
});

/**
 * Get feature flags schema
 */
export const getFeatureFlagsSchema = z.object({
  query: z.object({
    environment: z.enum(['development', 'staging', 'production']).optional(),
  }).optional(),
});

/**
 * Update feature flag schema
 */
export const updateFeatureFlagSchema = z.object({
  params: z.object({
    flagKey: z.string()
      .min(1, { message: 'Chave da feature flag é obrigatória' })
      .max(100),
  }),

  body: z.object({
    enabled: z.boolean(),

    description: z.string().max(500).optional(),

    rolloutPercentage: z.number()
      .min(0, { message: 'Porcentagem deve ser entre 0 e 100' })
      .max(100, { message: 'Porcentagem deve ser entre 0 e 100' })
      .optional(),

    targetUserIds: z.array(z.string().uuid()).optional(),
  }),
});

/**
 * Export data schema
 */
export const exportDataSchema = z.object({
  body: z.object({
    entityType: z.enum([
      'USERS',
      'CONVERSATIONS',
      'HEALTH_DATA',
      'DOCUMENTS',
      'AUTHORIZATIONS',
      'AUDIT_LOGS'
    ]),

    format: z.enum(['JSON', 'CSV', 'EXCEL']).default('JSON'),

    filters: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      userIds: z.array(z.string().uuid()).optional(),
      includeDeleted: z.boolean().default(false),
    }).optional(),

    includeRelations: z.boolean().default(false),
  }),
});

/**
 * Get user analytics schema
 */
export const getUserAnalyticsSchema = z.object({
  query: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),

    groupBy: z.enum(['day', 'week', 'month']).default('day'),

    metrics: z.string()
      .transform((val) => val.split(','))
      .pipe(z.array(z.enum([
        'active_users',
        'new_users',
        'conversations',
        'health_records',
        'documents_uploaded',
        'authorizations'
      ])))
      .optional(),
  }).refine((data) => {
    return new Date(data.startDate) <= new Date(data.endDate);
  }, {
    message: 'Data inicial deve ser anterior à data final',
  }),
});

/**
 * Send system notification schema
 */
export const sendSystemNotificationSchema = z.object({
  body: z.object({
    recipients: z.enum(['ALL', 'ADMINS', 'PATIENTS', 'PROFESSIONALS', 'SPECIFIC_USERS']),

    userIds: z.array(z.string().uuid())
      .optional()
      .refine((val, ctx) => {
        if (ctx.parent?.recipients === 'SPECIFIC_USERS' && (!val || val.length === 0)) {
          return false;
        }
        return true;
      }, { message: 'IDs de usuários são obrigatórios quando recipients é SPECIFIC_USERS' }),

    title: z.string()
      .min(1, { message: 'Título é obrigatório' })
      .max(100, { message: 'Título deve ter no máximo 100 caracteres' }),

    message: z.string()
      .min(1, { message: 'Mensagem é obrigatória' })
      .max(500, { message: 'Mensagem deve ter no máximo 500 caracteres' }),

    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),

    actionUrl: z.string().url().optional(),

    expiresAt: z.string()
      .datetime()
      .optional()
      .refine((date) => {
        if (!date) return true;
        return new Date(date) > new Date();
      }, { message: 'Data de expiração deve ser futura' }),
  }),
});

/**
 * Manage API keys schema
 */
export const manageApiKeySchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, { message: 'Nome é obrigatório' })
      .max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),

    scopes: z.array(z.string()).min(1, { message: 'Ao menos um escopo é obrigatório' }),

    expiresAt: z.string()
      .datetime()
      .optional()
      .refine((date) => {
        if (!date) return true;
        return new Date(date) > new Date();
      }, { message: 'Data de expiração deve ser futura' }),

    rateLimit: z.number()
      .int()
      .positive()
      .optional(), // requests per minute
  }),
});

/**
 * Revoke API key schema
 */
export const revokeApiKeySchema = z.object({
  params: z.object({
    keyId: z.string().uuid({ message: 'ID da chave inválido' }),
  }),
});

/**
 * Get error logs schema
 */
export const getErrorLogsSchema = z.object({
  query: z.object({
    severity: z.enum(['ERROR', 'WARNING', 'CRITICAL']).optional(),

    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),

    search: z.string().max(200).optional(),

    page: z.string().regex(/^\d+$/).transform(Number).default('1'),

    limit: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .default('100')
      .refine((val) => val <= 1000, { message: 'Limite máximo é 1000' }),
  }).optional(),
});

// Export types
export type MetricType = z.infer<typeof MetricTypeSchema>;
export type UserActionType = z.infer<typeof UserActionTypeSchema>;
export type GetSystemMetricsInput = z.infer<typeof getSystemMetricsSchema>;
export type GetAuditLogsInput = z.infer<typeof getAuditLogsSchema>;
export type ManageUserRoleInput = z.infer<typeof manageUserRoleSchema>;
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type ConfigureSystemSettingsInput = z.infer<typeof configureSystemSettingsSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type SendSystemNotificationInput = z.infer<typeof sendSystemNotificationSchema>;
