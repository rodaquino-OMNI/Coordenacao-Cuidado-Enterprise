/**
 * Authentication Routes
 * RESTful API endpoints for authentication and authorization
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';
import { strictRateLimiter, lenientRateLimiter } from '../middleware/rateLimiter';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'Other']).optional()
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
});

const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
});

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register',
  strictRateLimiter,
  validateRequest(RegisterSchema),
  async (req, res) => {
    try {
      const userData = req.body;

      // Mock implementation
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: userData.email,
        name: userData.name,
        roles: ['user'],
        createdAt: new Date()
      };

      const accessToken = 'mock_access_token';
      const refreshToken = 'mock_refresh_token';

      logger.info('User registered', { userId: user.id, email: user.email });

      res.status(201).json({
        message: 'Registration successful',
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 3600
        }
      });
    } catch (error) {
      logger.error('Registration failed', { error });
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
router.post('/login',
  strictRateLimiter,
  validateRequest(LoginSchema),
  async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      // Mock implementation
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email,
        name: 'John Doe',
        roles: ['user']
      };

      const accessToken = 'mock_access_token';
      const refreshToken = 'mock_refresh_token';
      const expiresIn = rememberMe ? 2592000 : 3600; // 30 days or 1 hour

      logger.info('User logged in', { userId: user.id, email: user.email });

      res.json({
        message: 'Login successful',
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn
        }
      });
    } catch (error) {
      logger.error('Login failed', { error });
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (invalidate tokens)
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  lenientRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user!.id;

      // Mock implementation - invalidate tokens in database/redis
      logger.info('User logged out', { userId });

      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout failed', { error });
      res.status(500).json({ error: 'Logout failed' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
  strictRateLimiter,
  validateRequest(RefreshTokenSchema),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      // Mock implementation
      const newAccessToken = 'new_mock_access_token';
      const newRefreshToken = 'new_mock_refresh_token';

      res.json({
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 3600
        }
      });
    } catch (error) {
      logger.error('Token refresh failed', { error });
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
  strictRateLimiter,
  validateRequest(ForgotPasswordSchema),
  async (req, res) => {
    try {
      const { email } = req.body;

      // Mock implementation - send email with reset token
      logger.info('Password reset requested', { email });

      res.json({
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    } catch (error) {
      logger.error('Password reset request failed', { error });
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  strictRateLimiter,
  validateRequest(ResetPasswordSchema),
  async (req, res) => {
    try {
      const { token, password } = req.body;

      // Mock implementation - validate token and update password
      logger.info('Password reset completed');

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      logger.error('Password reset failed', { error });
      res.status(400).json({ error: 'Invalid or expired reset token' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
router.post('/change-password',
  authenticateToken,
  strictRateLimiter,
  validateRequest(ChangePasswordSchema),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      // Mock implementation
      logger.info('Password changed', { userId });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Password change failed', { error });
      res.status(400).json({ error: 'Failed to change password' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email',
  strictRateLimiter,
  validateRequest(VerifyEmailSchema),
  async (req, res) => {
    try {
      const { token } = req.body;

      // Mock implementation
      logger.info('Email verified');

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      logger.error('Email verification failed', { error });
      res.status(400).json({ error: 'Invalid or expired verification token' });
    }
  }
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Private
 */
router.post('/resend-verification',
  authenticateToken,
  strictRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user!.id;

      // Mock implementation
      logger.info('Verification email resent', { userId });

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      logger.error('Failed to resend verification email', { error });
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  }
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me',
  authenticateToken,
  lenientRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user!.id;

      // Mock implementation
      const user = {
        id: userId,
        email: req.user!.email,
        name: 'John Doe',
        roles: req.user!.roles,
        permissions: req.user!.permissions,
        emailVerified: true,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      res.json(user);
    } catch (error) {
      logger.error('Failed to get current user', { error });
      res.status(500).json({ error: 'Failed to get user information' });
    }
  }
);

/**
 * @route   GET /api/v1/auth/session
 * @desc    Validate session
 * @access  Public (optional auth)
 */
router.get('/session',
  optionalAuth,
  lenientRateLimiter,
  async (req, res) => {
    try {
      if (!req.user) {
        return res.json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          roles: req.user.roles
        }
      });
    } catch (error) {
      logger.error('Session validation failed', { error });
      res.status(500).json({ error: 'Failed to validate session' });
    }
  }
);

export default router;
