import { z } from 'zod';

/**
 * Conversation type enum
 */
export const ConversationTypeSchema = z.enum([
  'HEALTH_QUERY',
  'APPOINTMENT_SCHEDULING',
  'MEDICATION_REMINDER',
  'SYMPTOM_TRACKING',
  'MENTAL_HEALTH_SUPPORT',
  'GENERAL_SUPPORT'
]);

/**
 * Message sender type
 */
export const MessageSenderSchema = z.enum(['USER', 'AI_AGENT', 'SYSTEM']);

/**
 * AI agent mood enum
 */
export const AgentMoodSchema = z.enum([
  'EMPATHETIC',
  'PROFESSIONAL',
  'ENCOURAGING',
  'INFORMATIVE',
  'SUPPORTIVE'
]);

/**
 * Create conversation schema
 */
export const createConversationSchema = z.object({
  body: z.object({
    type: ConversationTypeSchema,

    title: z.string()
      .min(1, { message: 'Título é obrigatório' })
      .max(200, { message: 'Título deve ter no máximo 200 caracteres' })
      .optional(),

    initialMessage: z.string()
      .min(1, { message: 'Mensagem inicial é obrigatória' })
      .max(5000, { message: 'Mensagem deve ter no máximo 5000 caracteres' })
      .optional(),

    metadata: z.object({
      urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      relatedCondition: z.string().optional(),
      preferredLanguage: z.enum(['pt-BR', 'en-US']).default('pt-BR'),
    }).optional(),
  }),
});

/**
 * Send message schema
 */
export const sendMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),

  body: z.object({
    content: z.string()
      .min(1, { message: 'Conteúdo da mensagem é obrigatório' })
      .max(5000, { message: 'Mensagem deve ter no máximo 5000 caracteres' }),

    attachments: z.array(z.object({
      type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOCATION']),
      url: z.string().url({ message: 'URL do anexo inválida' }),
      filename: z.string(),
      size: z.number().positive({ message: 'Tamanho deve ser positivo' }),
    })).optional(),

    metadata: z.object({
      location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }).optional(),
      timestamp: z.string().datetime().optional(),
    }).optional(),
  }),
});

/**
 * Get conversation schema
 */
export const getConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),
});

/**
 * List conversations schema
 */
export const listConversationsSchema = z.object({
  query: z.object({
    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('20')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),

    type: ConversationTypeSchema.optional(),

    active: z.enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),

    search: z.string().optional(),

    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).optional(),
});

/**
 * Update conversation schema
 */
export const updateConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),

  body: z.object({
    title: z.string()
      .min(1, { message: 'Título deve ter no mínimo 1 caractere' })
      .max(200, { message: 'Título deve ter no máximo 200 caracteres' })
      .optional(),

    isActive: z.boolean().optional(),

    metadata: z.object({
      urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      relatedCondition: z.string().optional(),
      notes: z.string().max(1000).optional(),
    }).optional(),
  }),
});

/**
 * Delete conversation schema
 */
export const deleteConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),
});

/**
 * Get conversation messages schema
 */
export const getConversationMessagesSchema = z.object({
  params: z.object({
    conversationId: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),

  query: z.object({
    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('50')
      .refine((val) => val <= 200, { message: 'Limite máximo é 200' }),

    before: z.string().datetime().optional(),
    after: z.string().datetime().optional(),
  }).optional(),
});

/**
 * Rate message schema
 */
export const rateMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().uuid({ message: 'ID da conversa inválido' }),
    messageId: z.string().uuid({ message: 'ID da mensagem inválido' }),
  }),

  body: z.object({
    rating: z.number()
      .int({ message: 'Avaliação deve ser um número inteiro' })
      .min(1, { message: 'Avaliação mínima é 1' })
      .max(5, { message: 'Avaliação máxima é 5' }),

    feedback: z.string()
      .max(500, { message: 'Feedback deve ter no máximo 500 caracteres' })
      .optional(),
  }),
});

/**
 * Conversation analytics schema
 */
export const getConversationAnalyticsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),
});

/**
 * Archive conversation schema
 */
export const archiveConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),
});

/**
 * Unarchive conversation schema
 */
export const unarchiveConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID da conversa inválido' }),
  }),
});

// Export types
export type ConversationType = z.infer<typeof ConversationTypeSchema>;
export type MessageSender = z.infer<typeof MessageSenderSchema>;
export type AgentMood = z.infer<typeof AgentMoodSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetConversationInput = z.infer<typeof getConversationSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type DeleteConversationInput = z.infer<typeof deleteConversationSchema>;
export type GetConversationMessagesInput = z.infer<typeof getConversationMessagesSchema>;
export type RateMessageInput = z.infer<typeof rateMessageSchema>;
export type GetConversationAnalyticsInput = z.infer<typeof getConversationAnalyticsSchema>;
