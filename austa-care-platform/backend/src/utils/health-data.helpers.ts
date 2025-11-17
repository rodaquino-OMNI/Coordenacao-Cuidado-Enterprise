import { PrismaClient, HealthDataType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get vital signs for a user filtered by type
 * @param userId - User ID to query
 * @param types - Array of health data types to filter (optional)
 * @param limit - Maximum number of records to return
 * @returns Array of health data records
 */
export async function getVitalSigns(
  userId: string,
  types?: HealthDataType[],
  limit: number = 100
) {
  const where: Prisma.HealthDataWhereInput = { userId };

  if (types && types.length > 0) {
    where.type = { in: types };
  }

  return prisma.healthData.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: limit
  });
}

/**
 * Record a vital sign measurement
 * @param userId - User ID
 * @param data - Health data to record
 * @returns Created health data record
 */
export async function recordVitalSign(
  userId: string,
  data: {
    type: HealthDataType;
    value: number;
    unit: string;
    recordedAt?: Date;
    notes?: string;
    source?: string;
  }
) {
  return prisma.healthData.create({
    data: {
      userId,
      type: data.type,
      value: data.value, // Will be coerced to Json
      unit: data.unit,
      recordedAt: data.recordedAt || new Date(),
      metadata: data.notes ? { notes: data.notes } : undefined,
      source: data.source || 'manual'
    }
  });
}

/**
 * Get the latest vital signs for a user (one of each type)
 * @param userId - User ID to query
 * @returns Object with latest vital signs by type
 */
export async function getLatestVitals(userId: string) {
  const types = Object.values(HealthDataType);

  const latestVitals = await Promise.all(
    types.map(async (type) => {
      const record = await prisma.healthData.findFirst({
        where: { userId, type },
        orderBy: { recordedAt: 'desc' }
      });
      return { type, record };
    })
  );

  return latestVitals.reduce((acc, { type, record }) => {
    if (record) {
      acc[type] = record;
    }
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Get vital signs within a date range
 * @param userId - User ID to query
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @param type - Optional health data type filter
 * @returns Array of health data records
 */
export async function getVitalSignsInRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  type?: HealthDataType
) {
  const where: Prisma.HealthDataWhereInput = {
    userId,
    recordedAt: {
      gte: startDate,
      lte: endDate
    }
  };

  if (type) {
    where.type = type;
  }

  return prisma.healthData.findMany({
    where,
    orderBy: { recordedAt: 'asc' }
  });
}

/**
 * Get blood pressure readings
 * @param userId - User ID to query
 * @param limit - Maximum number of records
 * @returns Array of blood pressure records
 */
export async function getBloodPressureReadings(userId: string, limit: number = 50) {
  return getVitalSigns(
    userId,
    [HealthDataType.BLOOD_PRESSURE_SYSTOLIC, HealthDataType.BLOOD_PRESSURE_DIASTOLIC],
    limit
  );
}

/**
 * Get blood glucose readings
 * @param userId - User ID to query
 * @param limit - Maximum number of records
 * @returns Array of blood glucose records
 */
export async function getBloodGlucoseReadings(userId: string, limit: number = 50) {
  return getVitalSigns(userId, [HealthDataType.BLOOD_GLUCOSE], limit);
}

/**
 * Get heart rate readings
 * @param userId - User ID to query
 * @param limit - Maximum number of records
 * @returns Array of heart rate records
 */
export async function getHeartRateReadings(userId: string, limit: number = 50) {
  return getVitalSigns(userId, [HealthDataType.HEART_RATE], limit);
}

/**
 * Get weight readings
 * @param userId - User ID to query
 * @param limit - Maximum number of records
 * @returns Array of weight records
 */
export async function getWeightReadings(userId: string, limit: number = 50) {
  return getVitalSigns(userId, [HealthDataType.WEIGHT], limit);
}

/**
 * Calculate average value for a vital sign type
 * @param userId - User ID to query
 * @param type - Health data type
 * @param days - Number of days to look back
 * @returns Average value or null
 */
export async function getAverageVitalSign(
  userId: string,
  type: HealthDataType,
  days: number = 30
): Promise<number | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.healthData.findMany({
    where: {
      userId,
      type,
      recordedAt: { gte: startDate }
    },
    select: { value: true }
  });

  if (records.length === 0) {
    return null;
  }

  const sum = records.reduce((acc, record) => acc + record.value, 0);
  return sum / records.length;
}

/**
 * Get vital signs statistics for a user
 * @param userId - User ID to query
 * @param type - Health data type
 * @param days - Number of days to analyze
 * @returns Statistics object with min, max, average, count
 */
export async function getVitalSignStats(
  userId: string,
  type: HealthDataType,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.healthData.findMany({
    where: {
      userId,
      type,
      recordedAt: { gte: startDate }
    },
    select: { value: true }
  });

  if (records.length === 0) {
    return null;
  }

  const values = records.map(r => r.value);
  const sum = values.reduce((acc, val) => acc + val, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: sum / values.length,
    count: values.length,
    period: `${days} days`
  };
}

/**
 * Delete health data records
 * @param userId - User ID
 * @param recordIds - Array of record IDs to delete
 * @returns Number of deleted records
 */
export async function deleteHealthRecords(userId: string, recordIds: string[]) {
  const result = await prisma.healthData.deleteMany({
    where: {
      id: { in: recordIds },
      userId // Ensure user owns the records
    }
  });
  return result.count;
}

/**
 * Update health data record
 * @param recordId - Record ID to update
 * @param userId - User ID (for authorization)
 * @param updates - Fields to update
 * @returns Updated record
 */
export async function updateHealthRecord(
  recordId: string,
  userId: string,
  updates: {
    value?: number;
    unit?: string;
    notes?: string;
    recordedAt?: Date;
  }
) {
  return prisma.healthData.updateMany({
    where: {
      id: recordId,
      userId // Ensure user owns the record
    },
    data: updates
  });
}

/**
 * Get health data count by type
 * @param userId - User ID to query
 * @returns Object with counts by type
 */
export async function getHealthDataCounts(userId: string) {
  const counts = await prisma.healthData.groupBy({
    by: ['type'],
    where: { userId },
    _count: true
  });

  return counts.reduce((acc, item) => {
    acc[item.type] = item._count;
    return acc;
  }, {} as Record<string, number>);
}
