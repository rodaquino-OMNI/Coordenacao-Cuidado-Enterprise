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

      // Mock implementation
      const profile = {
        userId,
        level: 12,
        totalPoints: 3450,
        currentLevelPoints: 450,
        nextLevelPoints: 1000,
        rank: 'Silver',
        badges: [
          {
            id: 'badge-1',
            name: 'Health Warrior',
            description: 'Tracked health data for 7 consecutive days',
            earnedAt: new Date(),
            icon: '🏆'
          },
          {
            id: 'badge-2',
            name: 'Early Adopter',
            description: 'One of the first 100 users',
            earnedAt: new Date(),
            icon: '🌟'
          }
        ],
        achievements: [
          {
            id: 'achievement-1',
            title: 'Consistent Tracker',
            progress: 75,
            target: 100,
            reward: 500
          }
        ],
        streaks: {
          current: 7,
          longest: 15,
          lastActivity: new Date()
        },
        statistics: {
          totalActivities: 125,
          daysActive: 45,
          referrals: 3
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

      // Mock implementation
      const pointsHistory = [
        {
          id: 'points-1',
          points: 50,
          reason: 'Completed health assessment',
          category: 'health_tracking',
          earnedAt: new Date(),
          metadata: {}
        },
        {
          id: 'points-2',
          points: 100,
          reason: '7-day streak bonus',
          category: 'achievement',
          earnedAt: new Date(),
          metadata: { streak: 7 }
        }
      ];

      res.json({
        pointsHistory,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: pointsHistory.length,
          totalPages: Math.ceil(pointsHistory.length / Number(limit))
        },
        summary: {
          totalPoints: 3450,
          pointsThisWeek: 250,
          pointsThisMonth: 890
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

      // Mock implementation
      const award = {
        id: `award-${Date.now()}`,
        userId,
        points,
        reason,
        category,
        metadata,
        awardedBy: req.user!.id,
        awardedAt: new Date()
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

      // Mock implementation
      const leaderboard = [
        {
          rank: 1,
          userId: 'user-1',
          userName: 'João Silva',
          points: 5600,
          level: 15,
          badge: 'Gold',
          avatar: null
        },
        {
          rank: 2,
          userId: 'user-2',
          userName: 'Maria Santos',
          points: 4800,
          level: 14,
          badge: 'Silver',
          avatar: null
        }
      ];

      res.json({
        leaderboard,
        timeframe,
        category: category || 'overall',
        lastUpdated: new Date(),
        userPosition: {
          rank: 45,
          points: 3450
        }
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
      // Mock implementation
      const badges = [
        {
          id: 'badge-1',
          name: 'Health Warrior',
          description: 'Track health data for 7 consecutive days',
          icon: '🏆',
          rarity: 'common',
          requirement: 'Track health for 7 days straight'
        },
        {
          id: 'badge-2',
          name: 'Early Adopter',
          description: 'One of the first 100 users',
          icon: '🌟',
          rarity: 'rare',
          requirement: 'Join in the first 100 users'
        },
        {
          id: 'badge-3',
          name: 'Health Master',
          description: 'Complete 100 health assessments',
          icon: '💎',
          rarity: 'epic',
          requirement: 'Complete 100 assessments'
        }
      ];

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

      // Mock implementation
      const earnedBadges = [
        {
          id: 'badge-1',
          name: 'Health Warrior',
          description: 'Tracked health data for 7 consecutive days',
          earnedAt: new Date(),
          icon: '🏆',
          rarity: 'common'
        }
      ];

      res.json({
        badges: earnedBadges,
        totalEarned: earnedBadges.length,
        totalAvailable: 15
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

      // Mock implementation
      const achievements = [
        {
          id: 'achievement-1',
          title: 'Consistent Tracker',
          description: 'Track health data 100 times',
          progress: 75,
          target: 100,
          reward: 500,
          status: 'in_progress'
        },
        {
          id: 'achievement-2',
          title: 'Social Butterfly',
          description: 'Refer 10 friends',
          progress: 3,
          target: 10,
          reward: 1000,
          status: 'in_progress'
        },
        {
          id: 'achievement-3',
          title: 'First Steps',
          description: 'Complete your first health assessment',
          progress: 1,
          target: 1,
          reward: 100,
          status: 'completed',
          completedAt: new Date()
        }
      ];

      res.json({
        achievements,
        completed: achievements.filter(a => a.status === 'completed').length,
        inProgress: achievements.filter(a => a.status === 'in_progress').length
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

      // Mock implementation
      const streak = {
        userId,
        current: 7,
        longest: 15,
        lastActivity: new Date(),
        nextMilestone: 10,
        milestoneReward: 200,
        calendar: [
          { date: '2024-01-15', active: true },
          { date: '2024-01-14', active: true },
          { date: '2024-01-13', active: true }
        ]
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
      // Mock implementation
      const stats = {
        totalPointsAwarded: 567890,
        activeUsers: 1250,
        totalBadgesEarned: 3450,
        averagePointsPerUser: 454,
        topLevel: 25,
        averageLevel: 8,
        leaderboardData: {
          daily: { topScore: 850, participants: 450 },
          weekly: { topScore: 5600, participants: 890 },
          monthly: { topScore: 18900, participants: 1200 }
        },
        engagementMetrics: {
          dailyActiveUsers: 450,
          weeklyActiveUsers: 890,
          monthlyActiveUsers: 1200
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
