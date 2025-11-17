import { PrismaClient, MissionDifficulty, PointTransactionType, MissionType, MissionCategory } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get user's achievements (completed missions with point transactions)
 * @param userId - User ID to query
 * @param limit - Maximum number of achievements to return
 * @returns Array of achievements with mission details
 */
export async function getUserAchievements(userId: string, limit: number = 100) {
  const transactions = await prisma.pointTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return transactions.map(transaction => ({
    id: transaction.id,
    points: transaction.points,
    earnedAt: transaction.createdAt,
    type: transaction.type,
    reason: transaction.reason,
    metadata: transaction.metadata
  }));
}

/**
 * Award an achievement to a user
 * @param userId - User ID
 * @param points - Points to award
 * @param reason - Reason for the award
 * @param transactionType - Type of transaction (EARNED, BONUS, ACHIEVEMENT, etc.)
 * @returns Created point transaction
 */
export async function awardAchievement(
  userId: string,
  points: number,
  reason: string,
  transactionType: PointTransactionType = PointTransactionType.EARNED
) {
  // Create transaction and update health points in a transaction
  return prisma.$transaction(async (tx) => {
    // Get or create health points
    const healthPoints = await tx.healthPoints.upsert({
      where: { userId },
      create: {
        userId,
        currentPoints: points,
        lifetimePoints: points,
        level: calculateUserLevel(points)
      },
      update: {
        currentPoints: { increment: points },
        lifetimePoints: { increment: points }
      }
    });

    // Calculate new level based on updated lifetime points
    const newLevel = calculateUserLevel(healthPoints.lifetimePoints + points);
    if (newLevel !== healthPoints.level) {
      await tx.healthPoints.update({
        where: { userId },
        data: { level: newLevel }
      });
    }

    // Create point transaction
    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        healthPointsId: healthPoints.id,
        points,
        type: transactionType,
        reason
      }
    });

    return transaction;
  });
}

/**
 * Get user's missions with optional active status filter
 * @param userId - User ID to query
 * @param isActive - Optional filter for active missions only
 * @param limit - Maximum number of missions to return
 * @returns Array of missions with completion status
 */
export async function getUserMissions(
  userId: string,
  isActive?: boolean,
  limit: number = 100
) {
  const where: any = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const missions = await prisma.mission.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  // Track completion via point transactions with missionId
  const userTransactions = await prisma.pointTransaction.findMany({
    where: {
      userId,
      missionId: { not: null }
    },
    select: { missionId: true }
  });

  // Extract mission IDs from transactions
  const completedMissionIds = new Set(
    userTransactions
      .map(t => t.missionId)
      .filter((id): id is string => id !== null)
  );

  return missions.map(mission => ({
    ...mission,
    isCompleted: completedMissionIds.has(mission.id)
  }));
}

/**
 * Calculate user level from total points
 * @param points - Total points earned
 * @returns User level
 */
export function calculateUserLevel(points: number): number {
  // Level formula: Every 100 points = 1 level
  // Can be customized based on game design
  return Math.floor(points / 100) + 1;
}

/**
 * Get points required for next level
 * @param currentLevel - Current user level
 * @returns Points needed for next level
 */
export function getPointsForNextLevel(currentLevel: number): number {
  return currentLevel * 100;
}

/**
 * Get user's gamification stats
 * @param userId - User ID to query
 * @returns Comprehensive gamification statistics
 */
export async function getUserGamificationStats(userId: string) {
  const [healthPoints, achievements, activeMissions] = await Promise.all([
    prisma.healthPoints.findUnique({
      where: { userId }
    }),
    prisma.pointTransaction.count({
      where: { userId }
    }),
    prisma.mission.count({
      where: { isActive: true }
    })
  ]);

  if (!healthPoints) {
    return {
      currentPoints: 0,
      lifetimePoints: 0,
      level: 1,
      achievementsCount: 0,
      activeMissionsCount: activeMissions,
      pointsToNextLevel: 100,
      progress: 0
    };
  }

  const pointsToNextLevel = getPointsForNextLevel(healthPoints.level);
  const currentLevelPoints = (healthPoints.level - 1) * 100;
  const progress = Math.round(
    ((healthPoints.lifetimePoints - currentLevelPoints) / 100) * 100
  );

  return {
    currentPoints: healthPoints.currentPoints,
    lifetimePoints: healthPoints.lifetimePoints,
    level: healthPoints.level,
    achievementsCount: achievements,
    activeMissionsCount: activeMissions,
    pointsToNextLevel,
    progress
  };
}

/**
 * Get available missions for user (not yet completed)
 * @param userId - User ID to query
 * @param difficulty - Optional difficulty filter
 * @returns Array of available missions
 */
export async function getAvailableMissions(
  userId: string,
  difficulty?: MissionDifficulty
) {
  // Get completed mission IDs from transactions
  const userTransactions = await prisma.pointTransaction.findMany({
    where: {
      userId,
      missionId: { not: null }
    },
    select: { missionId: true }
  });

  const completedMissionIds = userTransactions
    .map(t => t.missionId)
    .filter((id): id is string => id !== null);

  const where: any = {
    isActive: true,
    id: { notIn: completedMissionIds }
  };

  if (difficulty) {
    where.difficulty = difficulty;
  }

  return prisma.mission.findMany({
    where,
    orderBy: [
      { difficulty: 'asc' },
      { points: 'asc' }
    ]
  });
}

/**
 * Complete a mission for a user
 * @param userId - User ID
 * @param missionId - Mission ID to complete
 * @returns Created point transaction
 */
export async function completeMission(userId: string, missionId: string) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId }
  });

  if (!mission) {
    throw new Error('Mission not found');
  }

  if (!mission.isActive) {
    throw new Error('Mission is not active');
  }

  // Check if already completed
  const existingTransaction = await prisma.pointTransaction.findFirst({
    where: {
      userId,
      missionId: missionId
    }
  });

  const alreadyCompleted = existingTransaction !== null;

  if (alreadyCompleted) {
    throw new Error('Mission already completed by user');
  }

  // Award points with mission metadata
  return prisma.$transaction(async (tx) => {
    // Get or create health points
    const healthPoints = await tx.healthPoints.upsert({
      where: { userId },
      create: {
        userId,
        currentPoints: mission.points,
        lifetimePoints: mission.points,
        level: calculateUserLevel(mission.points)
      },
      update: {
        currentPoints: { increment: mission.points },
        lifetimePoints: { increment: mission.points }
      }
    });

    // Calculate new level based on updated lifetime points
    const newLevel = calculateUserLevel(healthPoints.lifetimePoints + mission.points);
    if (newLevel !== healthPoints.level) {
      await tx.healthPoints.update({
        where: { userId },
        data: { level: newLevel }
      });
    }

    // Create point transaction with missionId
    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        healthPointsId: healthPoints.id,
        missionId: missionId,
        points: mission.points,
        type: PointTransactionType.ACHIEVEMENT,
        reason: `Completed mission: ${mission.title}`
      }
    });

    return transaction;
  });
}

/**
 * Get leaderboard (top users by points)
 * @param limit - Number of top users to return
 * @returns Array of users with their points
 */
export async function getLeaderboard(limit: number = 10) {
  const topUsers = await prisma.healthPoints.findMany({
    take: limit,
    orderBy: { lifetimePoints: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  return topUsers.map((hp, index) => ({
    rank: index + 1,
    userId: hp.userId,
    userName: `${hp.user.firstName} ${hp.user.lastName}`,
    level: hp.level,
    lifetimePoints: hp.lifetimePoints,
    currentPoints: hp.currentPoints
  }));
}

/**
 * Get user's rank on leaderboard
 * @param userId - User ID to check
 * @returns User's rank or null if not on leaderboard
 */
export async function getUserRank(userId: string): Promise<number | null> {
  const userPoints = await prisma.healthPoints.findUnique({
    where: { userId }
  });

  if (!userPoints) {
    return null;
  }

  const higherRanked = await prisma.healthPoints.count({
    where: {
      lifetimePoints: { gt: userPoints.lifetimePoints }
    }
  });

  return higherRanked + 1;
}

/**
 * Create a new mission
 * @param data - Mission data
 * @returns Created mission
 */
export async function createMission(data: {
  title: string;
  description: string;
  points: number;
  difficulty: MissionDifficulty;
  type: string;
  category: string;
  requirements: any;
  isActive?: boolean;
}) {
  return prisma.mission.create({
    data: {
      title: data.title,
      description: data.description,
      points: data.points,
      difficulty: data.difficulty,
      type: data.type as any,
      category: data.category as any,
      requirements: data.requirements,
      isActive: data.isActive !== undefined ? data.isActive : true
    }
  });
}

/**
 * Update mission active status
 * @param missionId - Mission ID to update
 * @param isActive - New active status
 * @returns Updated mission
 */
export async function updateMissionStatus(
  missionId: string,
  isActive: boolean
) {
  return prisma.mission.update({
    where: { id: missionId },
    data: { isActive }
  });
}

/**
 * Get mission completion rate for a user
 * @param userId - User ID to query
 * @returns Completion rate percentage
 */
export async function getMissionCompletionRate(userId: string): Promise<number> {
  const [userTransactions, totalActiveMissions] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: {
        userId,
        missionId: { not: null }
      },
      select: { missionId: true }
    }),
    prisma.mission.count({ where: { isActive: true } })
  ]);

  // Count unique missions from transactions
  const completedMissionIds = new Set(
    userTransactions
      .map(t => t.missionId)
      .filter((id): id is string => id !== null)
  );

  const completedCount = completedMissionIds.size;

  if (totalActiveMissions === 0) return 0;
  return Math.round((completedCount / totalActiveMissions) * 100);
}
