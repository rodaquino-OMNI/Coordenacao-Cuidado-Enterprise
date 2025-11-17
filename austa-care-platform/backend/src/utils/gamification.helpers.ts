import { PrismaClient, MissionDifficulty } from '@prisma/client';

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
 * @param missionId - Mission ID to award
 * @param points - Points to award
 * @returns Created point transaction
 */
export async function awardAchievement(
  userId: string,
  missionId: string,
  points: number
) {
  // Check if mission already completed
  const existing = await prisma.pointTransaction.findFirst({
    where: { userId, missionId }
  });

  if (existing) {
    throw new Error('Mission already completed by user');
  }

  // Create transaction and update health points in a transaction
  return prisma.$transaction(async (tx) => {
    // Create point transaction
    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        missionId,
        points,
        earnedAt: new Date()
      },
      include: { mission: true }
    });

    // Update or create health points
    await tx.healthPoints.upsert({
      where: { userId },
      create: {
        userId,
        currentPoints: points,
        totalEarned: points,
        level: calculateUserLevel(points)
      },
      update: {
        currentPoints: { increment: points },
        totalEarned: { increment: points },
        level: calculateUserLevel(points) // Will need to recalculate based on new total
      }
    });

    return transaction;
  });
}

/**
 * Get user's missions with optional status filter
 * @param userId - User ID to query
 * @param status - Optional mission status filter
 * @param limit - Maximum number of missions to return
 * @returns Array of missions
 */
export async function getUserMissions(
  userId: string,
  status?: MissionStatus,
  limit: number = 100
) {
  const where: any = {};

  if (status) {
    where.status = status;
  }

  const missions = await prisma.mission.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  // Check which missions user has completed
  const completedMissions = await prisma.pointTransaction.findMany({
    where: { userId },
    select: { missionId: true }
  });

  const completedMissionIds = new Set(
    completedMissions.map(t => t.missionId).filter(Boolean)
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
      where: { status: MissionStatus.ACTIVE }
    })
  ]);

  if (!healthPoints) {
    return {
      currentPoints: 0,
      totalEarned: 0,
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
    ((healthPoints.totalEarned - currentLevelPoints) / 100) * 100
  );

  return {
    currentPoints: healthPoints.currentPoints,
    totalEarned: healthPoints.totalEarned,
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
  // Get completed mission IDs
  const completedMissions = await prisma.pointTransaction.findMany({
    where: { userId },
    select: { missionId: true }
  });

  const completedMissionIds = completedMissions
    .map(t => t.missionId)
    .filter(Boolean) as string[];

  const where: any = {
    status: MissionStatus.ACTIVE,
    id: { notIn: completedMissionIds }
  };

  if (difficulty) {
    where.difficulty = difficulty;
  }

  return prisma.mission.findMany({
    where,
    orderBy: [
      { difficulty: 'asc' },
      { requiredPoints: 'asc' }
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

  if (mission.status !== MissionStatus.ACTIVE) {
    throw new Error('Mission is not active');
  }

  return awardAchievement(userId, missionId, mission.requiredPoints);
}

/**
 * Get leaderboard (top users by points)
 * @param limit - Number of top users to return
 * @returns Array of users with their points
 */
export async function getLeaderboard(limit: number = 10) {
  const topUsers = await prisma.healthPoints.findMany({
    take: limit,
    orderBy: { totalEarned: 'desc' },
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
    totalPoints: hp.totalEarned,
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
      totalEarned: { gt: userPoints.totalEarned }
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
  requiredPoints: number;
  difficulty: MissionDifficulty;
  category?: string;
  status?: MissionStatus;
}) {
  return prisma.mission.create({
    data: {
      title: data.title,
      description: data.description,
      requiredPoints: data.requiredPoints,
      difficulty: data.difficulty,
      category: data.category,
      status: data.status || MissionStatus.ACTIVE
    }
  });
}

/**
 * Update mission status
 * @param missionId - Mission ID to update
 * @param status - New status
 * @returns Updated mission
 */
export async function updateMissionStatus(
  missionId: string,
  status: MissionStatus
) {
  return prisma.mission.update({
    where: { id: missionId },
    data: { status }
  });
}

/**
 * Get mission completion rate for a user
 * @param userId - User ID to query
 * @returns Completion rate percentage
 */
export async function getMissionCompletionRate(userId: string): Promise<number> {
  const [completed, total] = await Promise.all([
    prisma.pointTransaction.count({ where: { userId } }),
    prisma.mission.count({ where: { status: MissionStatus.ACTIVE } })
  ]);

  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
