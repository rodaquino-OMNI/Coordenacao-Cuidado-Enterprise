import { z } from 'zod';

/**
 * Health data type enum
 */
export const HealthDataTypeSchema = z.enum([
  'BLOOD_PRESSURE',
  'BLOOD_GLUCOSE',
  'HEART_RATE',
  'WEIGHT',
  'TEMPERATURE',
  'OXYGEN_SATURATION',
  'SLEEP',
  'STEPS',
  'MEDICATION_ADHERENCE',
  'PAIN_LEVEL',
  'MOOD',
  'SYMPTOM'
]);

/**
 * Measurement unit enum
 */
export const MeasurementUnitSchema = z.enum([
  'mmHg',
  'mg/dL',
  'bpm',
  'kg',
  'celsius',
  'fahrenheit',
  'percent',
  'hours',
  'steps',
  'level_1_10'
]);

/**
 * Create health data schema
 */
export const createHealthDataSchema = z.object({
  body: z.object({
    type: HealthDataTypeSchema,

    value: z.union([
      z.number().positive({ message: 'Valor deve ser positivo' }),
      z.string().min(1, { message: 'Valor é obrigatório' }),
    ]),

    unit: MeasurementUnitSchema,

    timestamp: z.string()
      .datetime({ message: 'Timestamp inválido' })
      .default(() => new Date().toISOString()),

    notes: z.string()
      .max(500, { message: 'Notas devem ter no máximo 500 caracteres' })
      .optional(),

    metadata: z.object({
      deviceId: z.string().optional(),
      deviceType: z.enum(['MANUAL', 'WEARABLE', 'MEDICAL_DEVICE', 'APP']).optional(),
      location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }).optional(),
      accuracy: z.number().min(0).max(100).optional(),
    }).optional(),

    // Type-specific validations
    bloodPressure: z.object({
      systolic: z.number().int().min(50).max(300),
      diastolic: z.number().int().min(30).max(200),
    }).optional(),

    bloodGlucose: z.object({
      value: z.number().positive(),
      mealContext: z.enum(['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM']),
    }).optional(),

    sleep: z.object({
      duration: z.number().positive(), // in hours
      quality: z.enum(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']),
      deepSleep: z.number().min(0).optional(), // in hours
      remSleep: z.number().min(0).optional(), // in hours
    }).optional(),

    mood: z.object({
      level: z.number().int().min(1).max(10),
      description: z.string().max(200).optional(),
      triggers: z.array(z.string()).optional(),
    }).optional(),

    symptom: z.object({
      name: z.string().min(1).max(100),
      severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL']),
      duration: z.string().optional(), // e.g., "2 hours", "3 days"
      bodyPart: z.string().optional(),
    }).optional(),
  }).refine((data) => {
    // Validate type-specific data matches type
    if (data.type === 'BLOOD_PRESSURE' && !data.bloodPressure) {
      return false;
    }
    if (data.type === 'BLOOD_GLUCOSE' && !data.bloodGlucose) {
      return false;
    }
    if (data.type === 'SLEEP' && !data.sleep) {
      return false;
    }
    if (data.type === 'MOOD' && !data.mood) {
      return false;
    }
    if (data.type === 'SYMPTOM' && !data.symptom) {
      return false;
    }
    return true;
  }, {
    message: 'Dados específicos do tipo de medição são obrigatórios',
  }),
});

/**
 * Get health data schema
 */
export const getHealthDataSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
  }),
});

/**
 * List health data schema
 */
export const listHealthDataSchema = z.object({
  query: z.object({
    type: HealthDataTypeSchema.optional(),

    startDate: z.string()
      .datetime({ message: 'Data inicial inválida' })
      .optional(),

    endDate: z.string()
      .datetime({ message: 'Data final inválida' })
      .optional(),

    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('50')
      .refine((val) => val <= 500, { message: 'Limite máximo é 500' }),

    sortBy: z.enum(['timestamp', 'type', 'value']).default('timestamp'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).optional().refine((data) => {
    if (data?.startDate && data?.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'Data inicial deve ser anterior à data final',
  }),
});

/**
 * Update health data schema
 */
export const updateHealthDataSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
  }),

  body: z.object({
    value: z.union([
      z.number().positive(),
      z.string().min(1),
    ]).optional(),

    notes: z.string().max(500).optional(),

    metadata: z.object({
      accuracy: z.number().min(0).max(100).optional(),
    }).optional(),
  }),
});

/**
 * Delete health data schema
 */
export const deleteHealthDataSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
  }),
});

/**
 * Health data analytics schema
 */
export const getHealthDataAnalyticsSchema = z.object({
  query: z.object({
    type: HealthDataTypeSchema,

    startDate: z.string()
      .datetime({ message: 'Data inicial inválida' }),

    endDate: z.string()
      .datetime({ message: 'Data final inválida' }),

    aggregation: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  }).refine((data) => {
    return new Date(data.startDate) <= new Date(data.endDate);
  }, {
    message: 'Data inicial deve ser anterior à data final',
  }),
});

/**
 * Batch create health data schema
 */
export const batchCreateHealthDataSchema = z.object({
  body: z.object({
    records: z.array(
      z.object({
        type: HealthDataTypeSchema,
        value: z.union([z.number().positive(), z.string().min(1)]),
        unit: MeasurementUnitSchema,
        timestamp: z.string().datetime(),
        notes: z.string().max(500).optional(),
      })
    ).min(1, { message: 'Pelo menos um registro é obrigatório' })
      .max(100, { message: 'Máximo de 100 registros por lote' }),
  }),
});

/**
 * Export health data schema
 */
export const exportHealthDataSchema = z.object({
  query: z.object({
    format: z.enum(['JSON', 'CSV', 'PDF']).default('JSON'),

    startDate: z.string()
      .datetime({ message: 'Data inicial inválida' })
      .optional(),

    endDate: z.string()
      .datetime({ message: 'Data final inválida' })
      .optional(),

    types: z.string()
      .transform((val) => val.split(','))
      .pipe(z.array(HealthDataTypeSchema))
      .optional(),
  }),
});

/**
 * Health data trend schema
 */
export const getHealthDataTrendSchema = z.object({
  params: z.object({
    type: HealthDataTypeSchema,
  }),

  query: z.object({
    period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  }),
});

// Export types
export type HealthDataType = z.infer<typeof HealthDataTypeSchema>;
export type MeasurementUnit = z.infer<typeof MeasurementUnitSchema>;
export type CreateHealthDataInput = z.infer<typeof createHealthDataSchema>;
export type GetHealthDataInput = z.infer<typeof getHealthDataSchema>;
export type ListHealthDataInput = z.infer<typeof listHealthDataSchema>;
export type UpdateHealthDataInput = z.infer<typeof updateHealthDataSchema>;
export type DeleteHealthDataInput = z.infer<typeof deleteHealthDataSchema>;
export type GetHealthDataAnalyticsInput = z.infer<typeof getHealthDataAnalyticsSchema>;
export type BatchCreateHealthDataInput = z.infer<typeof batchCreateHealthDataSchema>;
export type ExportHealthDataInput = z.infer<typeof exportHealthDataSchema>;
