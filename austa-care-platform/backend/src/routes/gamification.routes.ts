/**
 * Gamification Routes
 * RESTful API endpoints for gamification features
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation';
import { defaultRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import prisma from '../config/database';

const router = Router();

// Validation schemas
const UserIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID')
});

const AwardPointsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  points: z.number().min(1, 'Points must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  category: z.enum(['health_tracking', 'engagement', 'education', 'achievement', 'referral']),
  metadata: z.record(z.any()).optional()
});

const LeaderboardQuerySchema = z.object({
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'all_time']).default('weekly'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('10'),
  category: z.enum(['health_tracking', 'engagement', 'education', 'achievement', 'referral', 'overall']).optional()
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Helper: Get user's organizationId from database
 */
async function getUserOrgId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true }
  });
  return user?.organizationId || '';
}

/**
 * @route   GET /api/v1/gamification/user/:userId/profile
 * @desc    Get user gamification profile
 * @access  Private
 */
router.get('/user/:userId/profile',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Fetch real data from HealthPoints and Achievement
      const [healthPoints, achievements, totalMissions] = await Promise.all([
        prisma.healthPoints.findUnique({ where: { userId } }),
        prisma.achievement.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            description: true,
            achievementType: true,
            pointsAwarded: true,
            badgeId: true,
            progress: true,
            isCompleted: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.mission.count({ where: { isActive: true } })
      ]);

      const points = healthPoints || {
        totalPoints: 0,
        availablePoints: 0,
        currentLevel: 1,
        experiencePoints: 0,
        nextLevelAt: 100,
        dailyStreak: 0,
        longestStreak: 0,
        lastActiveDate: new Date(),
        badges: [],
      };

      // Build badges from achievements with badgeId
      const badges = achievements
        .filter(a => a.badgeId && a.isCompleted)
        .map(a => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
          earnedAt: a.completedAt,
          icon: '🏆',
        }));

      const profile = {
        userId,
        level: points.currentLevel,
        totalPoints: points.totalPoints,
        currentLevelPoints: points.experiencePoints,
        nextLevelPoints: points.nextLevelAt,
        rank: points.currentLevel >= 15 ? 'Gold' : points.currentLevel >= 10 ? 'Silver' : 'Bronze',
        badges,
        achievements: achievements.map(a => ({
          id: a.id,
          title: a.name,
          description: a.description,
          progress: a.progress,
          target: 100,
          reward: a.pointsAwarded,
          status: a.isCompleted ? 'completed' : 'in_progress',
          completedAt: a.completedAt,
        })),
        streaks: {
          current: points.dailyStreak,
          longest: points.longestStreak,
          lastActivity: points.lastActiveDate,
        },
        statistics: {
          totalActivities: achievements.length,
          daysActive: points.dailyStreak,
          referrals: 0,
        }
      };

      res.json(profile);
    } catch (error) {
      logger.error('Failed to get gamification profile', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve gamification profile' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/user/:userId/points
 * @desc    Get user points history
 * @access  Private
 */
router.get('/user/:userId/points',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  validateQuery(z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20')
  })),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page, limit } = req.query as any;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [transactions, total, healthPoints] = await Promise.all([
        prisma.pointTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          select: {
            id: true,
            amount: true,
            reason: true,
            sourceType: true,
            metadata: true,
            createdAt: true,
          }
        }),
        prisma.pointTransaction.count({ where: { userId } }),
        prisma.healthPoints.findUnique({ where: { userId } }),
      ]);

      const pointsHistory = transactions.map(t => ({
        id: t.id,
        points: t.amount,
        reason: t.reason,
        category: t.sourceType.toLowerCase(),
        earnedAt: t.createdAt,
        metadata: t.metadata || {},
      }));

      // Calculate weekly and monthly points
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [weeklyPoints, monthlyPoints] = await Promise.all([
        prisma.pointTransaction.aggregate({
          where: { userId, createdAt: { gte: weekAgo }, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        prisma.pointTransaction.aggregate({
          where: { userId, createdAt: { gte: monthAgo }, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
      ]);

      res.json({
        pointsHistory,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        },
        summary: {
          totalPoints: healthPoints?.totalPoints || 0,
          pointsThisWeek: weeklyPoints._sum.amount || 0,
          pointsThisMonth: monthlyPoints._sum.amount || 0,
        }
      });
    } catch (error) {
      logger.error('Failed to get points history', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve points history' });
    }
  }
);

/**
 * @route   POST /api/v1/gamification/points/award
 * @desc    Award points to user (admin only)
 * @access  Private (Admin)
 */
router.post('/points/award',
  requireRole('admin'),
  defaultRateLimiter,
  validateRequest(AwardPointsSchema),
  async (req, res) => {
    try {
      const { userId, points, reason, category, metadata } = req.body;

      // Map category string to SourceType enum
      const sourceTypeMap: Record<string, string> = {
        health_tracking: 'ENGAGEMENT',
        engagement: 'ENGAGEMENT',
        education: 'SURVEY',
        achievement: 'ACHIEVEMENT',
        referral: 'REFERRAL',
      };

      // Get user's organizationId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create or update HealthPoints and PointTransaction in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Upsert health points
        const hp = await tx.healthPoints.upsert({
          where: { userId },
          create: {
            userId,
            organizationId: user.organizationId,
            totalPoints: points,
            availablePoints: points,
            currentLevel: 1,
            experiencePoints: points,
            nextLevelAt: 100,
          },
          update: {
            totalPoints: { increment: points },
            availablePoints: { increment: points },
            experiencePoints: { increment: points },
          }
        });

        // Recalculate level
        const newLevel = Math.floor(hp.totalPoints / 100) + 1;
        if (newLevel !== hp.currentLevel) {
          await tx.healthPoints.update({
            where: { id: hp.id },
            data: {
              currentLevel: newLevel,
              nextLevelAt: (newLevel) * 100,
            }
          });
        }

        // Create point transaction
        const transaction = await tx.pointTransaction.create({
          data: {
            userId,
            healthPointsId: hp.id,
            amount: points,
            type: 'EARNED',
            reason,
            sourceType: (sourceTypeMap[category] || 'ADMIN_ADJUSTMENT') as any,
            metadata: metadata || {},
          }
        });

        return { transaction, healthPointsId: hp.id };
      });

      const award = {
        id: result.transaction.id,
        userId,
        points,
        reason,
        category,
        metadata,
        awardedBy: req.user!.id,
        awardedAt: result.transaction.createdAt,
      };

      logger.info('Points awarded', { userId, points, reason, awardedBy: req.user!.id });
      res.status(201).json(award);
    } catch (error) {
      logger.error('Failed to award points', { error });
      res.status(500).json({ error: 'Failed to award points' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/leaderboard
 * @desc    Get leaderboard
 * @access  Private
 */
router.get('/leaderboard',
  defaultRateLimiter,
  validateQuery(LeaderboardQuerySchema),
  async (req, res) => {
    try {
      const { timeframe, limit, category } = req.query as any;

      // Query top users by totalPoints
      const topUsers = await prisma.healthPoints.findMany({
        orderBy: { totalPoints: 'desc' },
        take: Number(limit),
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      });

      const leaderboard = topUsers.map((hp, index) => ({
        rank: index + 1,
        userId: hp.userId,
        userName: `${hp.user.firstName} ${hp.user.lastName}`,
        points: hp.totalPoints,
        level: hp.currentLevel,
        badge: hp.currentLevel >= 15 ? 'Gold' : hp.currentLevel >= 10 ? 'Silver' : 'Bronze',
        avatar: null,
      }));

      // Get requesting user's position
      let userPosition = null;
      if (req.user) {
        const userHp = await prisma.healthPoints.findUnique({
          where: { userId: req.user.id }
        });
        if (userHp) {
          const higherRanked = await prisma.healthPoints.count({
            where: { totalPoints: { gt: userHp.totalPoints } }
          });
          userPosition = {
            rank: higherRanked + 1,
            points: userHp.totalPoints,
          };
        }
      }

      res.json({
        leaderboard,
        timeframe,
        category: category || 'overall',
        lastUpdated: new Date(),
        userPosition,
      });
    } catch (error) {
      logger.error('Failed to get leaderboard', { error });
      res.status(500).json({ error: 'Failed to retrieve leaderboard' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/badges
 * @desc    Get all available badges
 * @access  Private
 */
router.get('/badges',
  defaultRateLimiter,
  async (req, res) => {
    try {
      // Get distinct badgeIds from achievements (badges are defined by achievements with badgeId)
      const achievements = await prisma.achievement.findMany({
        where: { badgeId: { not: null } },
        distinct: ['badgeId'],
        select: {
          id: true,
          name: true,
          description: true,
          badgeId: true,
          achievementType: true,
          pointsAwarded: true,
        },
      });

      const badges = achievements.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
        icon: '🏆',
        rarity: a.pointsAwarded >= 1000 ? 'epic' : a.pointsAwarded >= 500 ? 'rare' : 'common',
        requirement: a.description || a.name,
      }));

      res.json({ badges });
    } catch (error) {
      logger.error('Failed to get badges', { error });
      res.status(500).json({ error: 'Failed to retrieve badges' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/user/:userId/badges
 * @desc    Get user's earned badges
 * @access  Private
 */
router.get('/user/:userId/badges',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const [earnedAchievements, totalAvailable] = await Promise.all([
        prisma.achievement.findMany({
          where: { userId, badgeId: { not: null }, isCompleted: true },
          select: {
            id: true,
            name: true,
            description: true,
            badgeId: true,
            completedAt: true,
            pointsAwarded: true,
          },
          orderBy: { completedAt: 'desc' },
        }),
        prisma.achievement.count({
          where: { badgeId: { not: null } },
        }),
      ]);

      const earnedBadges = earnedAchievements.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
        earnedAt: a.completedAt,
        icon: '🏆',
        rarity: a.pointsAwarded >= 1000 ? 'epic' : a.pointsAwarded >= 500 ? 'rare' : 'common',
      }));

      res.json({
        badges: earnedBadges,
        totalEarned: earnedBadges.length,
        totalAvailable,
      });
    } catch (error) {
      logger.error('Failed to get user badges', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve badges' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/user/:userId/achievements
 * @desc    Get user achievements progress
 * @access  Private
 */
router.get('/user/:userId/achievements',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const achievements = await prisma.achievement.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          description: true,
          achievementType: true,
          pointsAwarded: true,
          progress: true,
          isCompleted: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const result = achievements.map(a => ({
        id: a.id,
        title: a.name,
        description: a.description || '',
        progress: a.progress,
        target: 100,
        reward: a.pointsAwarded,
        status: a.isCompleted ? 'completed' : 'in_progress',
        completedAt: a.completedAt || undefined,
      }));

      res.json({
        achievements: result,
        completed: result.filter(a => a.status === 'completed').length,
        inProgress: result.filter(a => a.status === 'in_progress').length,
      });
    } catch (error) {
      logger.error('Failed to get achievements', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve achievements' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/user/:userId/streak
 * @desc    Get user activity streak
 * @access  Private
 */
router.get('/user/:userId/streak',
  defaultRateLimiter,
  validateParams(UserIdSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check access
      if (userId !== req.user!.id && !req.user!.roles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const hp = await prisma.healthPoints.findUnique({
        where: { userId },
        select: {
          dailyStreak: true,
          longestStreak: true,
          lastActiveDate: true,
          currentLevel: true,
        }
      });

      if (!hp) {
        return res.json({
          userId,
          current: 0,
          longest: 0,
          lastActivity: null,
          nextMilestone: 10,
          milestoneReward: 200,
          calendar: [],
        });
      }

      // Build calendar for last 7 days from pointTransactions
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentTransactions = await prisma.pointTransaction.findMany({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
          amount: { gt: 0 },
        },
        select: { createdAt: true },
        distinct: ['createdAt'],
      });

      const activeDates = new Set(
        recentTransactions.map(t => t.createdAt.toISOString().split('T')[0])
      );

      const calendar = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        calendar.push({ date: dateStr, active: activeDates.has(dateStr) });
      }

      const nextMilestone = Math.ceil((hp.dailyStreak + 1) / 5) * 5;

      const streak = {
        userId,
        current: hp.dailyStreak,
        longest: hp.longestStreak,
        lastActivity: hp.lastActiveDate,
        nextMilestone,
        milestoneReward: nextMilestone * 20,
        calendar,
      };

      res.json(streak);
    } catch (error) {
      logger.error('Failed to get streak', { error, userId: req.params.userId });
      res.status(500).json({ error: 'Failed to retrieve streak' });
    }
  }
);

/**
 * @route   GET /api/v1/gamification/stats/overview
 * @desc    Get gamification statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats/overview',
  requireRole('admin'),
  defaultRateLimiter,
  async (req, res) => {
    try {
      const [
        totalPointsAgg,
        activeUsersCount,
        totalBadgesCount,
        topLevelUser,
        avgLevelResult,
        dailyStats,
        weeklyStats,
        monthlyStats,
      ] = await Promise.all([
        prisma.healthPoints.aggregate({
          _sum: { totalPoints: true },
        }),
        prisma.healthPoints.count({
          where: {
            lastActiveDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            }
          }
        }),
        prisma.achievement.count({
          where: { badgeId: { not: null }, isCompleted: true },
        }),
        prisma.healthPoints.findFirst({
          orderBy: { currentLevel: 'desc' },
          select: { currentLevel: true },
        }),
        prisma.healthPoints.aggregate({
          _avg: { currentLevel: true },
        }),
        // Daily stats: last 24 hours
        prisma.pointTransaction.aggregate({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          _max: { amount: true },
          _count: { id: true },
        }),
        // Weekly stats: last 7 days
        prisma.pointTransaction.aggregate({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          _max: { amount: true },
          _count: { id: true },
        }),
        // Monthly stats: last 30 days
        prisma.pointTransaction.aggregate({
          where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          _max: { amount: true },
          _count: { id: true },
        }),
      ]);

      const totalUsers = await prisma.healthPoints.count();
      const avgPoints = totalUsers > 0
        ? (totalPointsAgg._sum.totalPoints || 0) / totalUsers
        : 0;

      const stats = {
        totalPointsAwarded: totalPointsAgg._sum.totalPoints || 0,
        activeUsers: activeUsersCount,
        totalBadgesEarned: totalBadgesCount,
        averagePointsPerUser: Math.round(avgPoints),
        topLevel: topLevelUser?.currentLevel || 0,
        averageLevel: Math.round(avgLevelResult._avg.currentLevel || 0),
        leaderboardData: {
          daily: {
            topScore: dailyStats._max.amount || 0,
            participants: dailyStats._count.id || 0,
          },
          weekly: {
            topScore: weeklyStats._max.amount || 0,
            participants: weeklyStats._count.id || 0,
          },
          monthly: {
            topScore: monthlyStats._max.amount || 0,
            participants: monthlyStats._count.id || 0,
          },
        },
        engagementMetrics: {
          dailyActiveUsers: dailyStats._count.id || 0,
          weeklyActiveUsers: weeklyStats._count.id || 0,
          monthlyActiveUsers: activeUsersCount,
        }
      };

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get gamification stats', { error });
      res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

export default router;
