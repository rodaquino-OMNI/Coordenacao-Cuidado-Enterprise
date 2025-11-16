import { z } from 'zod';

/**
 * Achievement type enum
 */
export const AchievementTypeSchema = z.enum([
  'HEALTH_TRACKING',
  'MEDICATION_ADHERENCE',
  'EXERCISE',
  'NUTRITION',
  'MENTAL_HEALTH',
  'SOCIAL_ENGAGEMENT',
  'LEARNING',
  'MILESTONE'
]);

/**
 * Achievement rarity enum
 */
export const AchievementRaritySchema = z.enum([
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY'
]);

/**
 * Quest status enum
 */
export const QuestStatusSchema = z.enum([
  'AVAILABLE',
  'IN_PROGRESS',
  'COMPLETED',
  'EXPIRED',
  'ABANDONED'
]);

/**
 * Quest difficulty enum
 */
export const QuestDifficultySchema = z.enum([
  'EASY',
  'MEDIUM',
  'HARD',
  'EXPERT'
]);

/**
 * Reward type enum
 */
export const RewardTypeSchema = z.enum([
  'POINTS',
  'BADGE',
  'TITLE',
  'AVATAR_ITEM',
  'UNLOCK_FEATURE',
  'DISCOUNT_COUPON'
]);

/**
 * Record action schema
 */
export const recordActionSchema = z.object({
  body: z.object({
    actionType: z.string()
      .min(1, { message: 'Tipo de ação é obrigatório' })
      .max(50, { message: 'Tipo de ação deve ter no máximo 50 caracteres' }),

    actionValue: z.number()
      .positive({ message: 'Valor da ação deve ser positivo' })
      .default(1),

    metadata: z.object({
      category: z.string().max(50).optional(),
      subcategory: z.string().max(50).optional(),
      duration: z.number().positive().optional(), // in seconds
      intensity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    }).optional(),
  }),
});

/**
 * Get user profile schema
 */
export const getGamificationProfileSchema = z.object({
  params: z.object({
    userId: z.string().uuid({ message: 'ID do usuário inválido' }).optional(),
  }).optional(),
});

/**
 * Get leaderboard schema
 */
export const getLeaderboardSchema = z.object({
  query: z.object({
    period: z.enum(['daily', 'weekly', 'monthly', 'all-time']).default('weekly'),

    category: AchievementTypeSchema.optional(),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('50')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),

    includeUser: z.enum(['true', 'false'])
      .transform((val) => val === 'true')
      .default('true'),
  }).optional(),
});

/**
 * Get achievements schema
 */
export const getAchievementsSchema = z.object({
  query: z.object({
    type: AchievementTypeSchema.optional(),

    rarity: AchievementRaritySchema.optional(),

    unlocked: z.enum(['true', 'false', 'all'])
      .default('all'),

    page: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .default('20')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),
  }).optional(),
});

/**
 * Unlock achievement schema
 */
export const unlockAchievementSchema = z.object({
  params: z.object({
    achievementId: z.string().uuid({ message: 'ID da conquista inválido' }),
  }),
});

/**
 * Get quests schema
 */
export const getQuestsSchema = z.object({
  query: z.object({
    status: QuestStatusSchema.optional(),

    difficulty: QuestDifficultySchema.optional(),

    type: AchievementTypeSchema.optional(),

    page: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .default('20')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),
  }).optional(),
});

/**
 * Start quest schema
 */
export const startQuestSchema = z.object({
  params: z.object({
    questId: z.string().uuid({ message: 'ID da missão inválido' }),
  }),
});

/**
 * Complete quest schema
 */
export const completeQuestSchema = z.object({
  params: z.object({
    questId: z.string().uuid({ message: 'ID da missão inválido' }),
  }),

  body: z.object({
    completionProof: z.object({
      timestamp: z.string().datetime(),
      data: z.record(z.any()).optional(),
    }).optional(),
  }).optional(),
});

/**
 * Abandon quest schema
 */
export const abandonQuestSchema = z.object({
  params: z.object({
    questId: z.string().uuid({ message: 'ID da missão inválido' }),
  }),
});

/**
 * Claim reward schema
 */
export const claimRewardSchema = z.object({
  params: z.object({
    rewardId: z.string().uuid({ message: 'ID da recompensa inválido' }),
  }),
});

/**
 * Get rewards schema
 */
export const getRewardsSchema = z.object({
  query: z.object({
    type: RewardTypeSchema.optional(),

    claimed: z.enum(['true', 'false', 'all']).default('all'),

    available: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),

    page: z.string().regex(/^\d+$/).transform(Number).default('1'),

    limit: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .default('20')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),
  }).optional(),
});

/**
 * Update streak schema
 */
export const updateStreakSchema = z.object({
  body: z.object({
    activityType: z.string()
      .min(1, { message: 'Tipo de atividade é obrigatório' })
      .max(50),

    completed: z.boolean().default(true),
  }),
});

/**
 * Get statistics schema
 */
export const getGamificationStatsSchema = z.object({
  query: z.object({
    period: z.enum(['week', 'month', 'quarter', 'year', 'all-time']).default('month'),
  }).optional(),
});

/**
 * Set daily goal schema
 */
export const setDailyGoalSchema = z.object({
  body: z.object({
    goalType: z.string().min(1).max(50),

    targetValue: z.number()
      .positive({ message: 'Meta deve ser positiva' }),

    unit: z.string().max(20).optional(),
  }),
});

/**
 * Update daily goal progress schema
 */
export const updateDailyGoalProgressSchema = z.object({
  params: z.object({
    goalId: z.string().uuid({ message: 'ID da meta inválido' }),
  }),

  body: z.object({
    currentValue: z.number()
      .min(0, { message: 'Progresso não pode ser negativo' }),
  }),
});

/**
 * Share achievement schema
 */
export const shareAchievementSchema = z.object({
  params: z.object({
    achievementId: z.string().uuid({ message: 'ID da conquista inválido' }),
  }),

  body: z.object({
    platform: z.enum(['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'WHATSAPP']),

    message: z.string()
      .max(280, { message: 'Mensagem deve ter no máximo 280 caracteres' })
      .optional(),
  }),
});

/**
 * Challenge friend schema
 */
export const challengeFriendSchema = z.object({
  body: z.object({
    friendUserId: z.string().uuid({ message: 'ID do amigo inválido' }),

    challengeType: z.string().min(1).max(50),

    duration: z.number()
      .int()
      .positive({ message: 'Duração deve ser positiva' }), // in days

    goal: z.number()
      .positive({ message: 'Meta deve ser positiva' }),

    message: z.string().max(200).optional(),
  }),
});

/**
 * Accept challenge schema
 */
export const acceptChallengeSchema = z.object({
  params: z.object({
    challengeId: z.string().uuid({ message: 'ID do desafio inválido' }),
  }),
});

/**
 * Decline challenge schema
 */
export const declineChallengeSchema = z.object({
  params: z.object({
    challengeId: z.string().uuid({ message: 'ID do desafio inválido' }),
  }),
});

// Export types
export type AchievementType = z.infer<typeof AchievementTypeSchema>;
export type AchievementRarity = z.infer<typeof AchievementRaritySchema>;
export type QuestStatus = z.infer<typeof QuestStatusSchema>;
export type QuestDifficulty = z.infer<typeof QuestDifficultySchema>;
export type RewardType = z.infer<typeof RewardTypeSchema>;
export type RecordActionInput = z.infer<typeof recordActionSchema>;
export type GetLeaderboardInput = z.infer<typeof getLeaderboardSchema>;
export type GetAchievementsInput = z.infer<typeof getAchievementsSchema>;
export type GetQuestsInput = z.infer<typeof getQuestsSchema>;
export type CompleteQuestInput = z.infer<typeof completeQuestSchema>;
export type ClaimRewardInput = z.infer<typeof claimRewardSchema>;
