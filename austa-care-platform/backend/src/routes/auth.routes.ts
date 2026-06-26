/**
 * Authentication Routes
 * RESTful API endpoints for authentication and authorization
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { validateRequest } from '../middleware/validation';
import { strictRateLimiter, lenientRateLimiter } from '../middleware/rateLimiter';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { config } from '../config/config';

const router = Router();

// JWT Configuration
const JWT_SECRET = config.jwt.secret;
const JWT_REFRESH_SECRET = config.jwt.refreshSecret || config.jwt.secret;
const JWT_EXPIRY = config.jwt.expiry || '1h';
const JWT_REFRESH_EXPIRY = config.jwt.refreshExpiry || '7d';

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
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Generate access and refresh tokens
 */
function generateTokens(userId: string, email: string, rememberMe: boolean = false) {
  const accessToken = jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: rememberMe ? '30d' : JWT_REFRESH_EXPIRY } as jwt.SignOptions
  );

  const expiresIn = rememberMe ? 2592000 : 3600; // 30 days or 1 hour

  return { accessToken, refreshToken, expiresIn };
}

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
      const { email, password, name, phone, cpf, dateOfBirth, gender } = req.body;

      // Parse name into first and last name
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            ...(phone ? [{ phone }] : []),
            ...(cpf ? [{ cpf }] : []),
          ],
        },
      });

      if (existingUser) {
        return res.status(409).json({ error: 'User with this email, phone, or CPF already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Find or create a default organization (in production, organization would be provided)
      let organization = await prisma.organization.findFirst();
      if (!organization) {
        organization = await prisma.organization.create({
          data: {
            name: 'Default Organization',
            type: 'CLINIC',
            taxId: '00.000.000/0001-00',
            address: {},
            phone: '',
            email: 'admin@default.org',
          },
        });
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone: phone || '',
          cpf,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          organizationId: organization.id,
        },
      });

      // Generate tokens
      const tokens = generateTokens(user.id, user.email);

      // Log registration
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entity: 'user',
          entityId: user.id,
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      logger.info('User registered', { userId: user.id, email: user.email });

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roles: [user.role],
          createdAt: user.createdAt,
        },
        tokens,
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

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Account is inactive or suspended' });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate tokens
      const tokens = generateTokens(user.id, user.email, rememberMe);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Log login
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'authentication',
          entityId: user.id,
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      logger.info('User logged in', { userId: user.id, email: user.email });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roles: [user.role],
        },
        tokens,
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

      // Log logout
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT',
          entity: 'authentication',
          entityId: userId,
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

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

      // Verify refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Generate new tokens (token rotation)
      const tokens = generateTokens(user.id, user.email);

      res.json({ tokens });
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

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });

      // Always return success to prevent user enumeration
      if (!user) {
        return res.json({
          message: 'If an account exists with this email, a password reset link has been sent',
        });
      }

      // Generate password reset token (expires in 1 hour)
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password_reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Store token in user metadata (in production, use a dedicated table or Redis)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          metadata: {
            ...((user.metadata as any) || {}),
            passwordResetToken: resetToken,
            passwordResetRequestedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('Password reset requested', { email, userId: user.id });

      res.json({
        message: 'If an account exists with this email, a password reset link has been sent',
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

      // Verify reset token
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      if (decoded.type !== 'password_reset') {
        return res.status(400).json({ error: 'Invalid token type' });
      }

      // Find user
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Verify token matches stored token
      const metadata = (user.metadata as any) || {};
      if (metadata.passwordResetToken !== token) {
        return res.status(400).json({ error: 'Token has already been used or is invalid' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          metadata: {
            ...metadata,
            passwordResetToken: null,
            passwordResetRequestedAt: null,
            passwordLastChangedAt: new Date().toISOString(),
          },
        },
      });

      // Log password reset
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'password_reset',
          entityId: user.id,
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

      logger.info('Password reset completed', { userId: user.id });

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

      // Find user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.password) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          metadata: {
            ...((user.metadata as any) || {}),
            passwordLastChangedAt: new Date().toISOString(),
          },
        },
      });

      // Log password change
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'password_change',
          entityId: userId,
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
        },
      });

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

      // Verify token
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      if (decoded.type !== 'email_verification') {
        return res.status(400).json({ error: 'Invalid token type' });
      }

      // Update user
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { emailVerified: true },
      });

      logger.info('Email verified', { userId: decoded.userId });

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

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.emailVerified) {
        return res.json({ message: 'Email is already verified' });
      }

      // Generate new verification token
      const verificationToken = jwt.sign(
        { userId: user.id, type: 'email_verification' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Store token in user metadata
      await prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...((user.metadata as any) || {}),
            emailVerificationToken: verificationToken,
            emailVerificationSentAt: new Date().toISOString(),
          },
        },
      });

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

      // Get full user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          lastLoginAt: true,
          organizationId: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        roles: [user.role],
        permissions: req.user!.permissions || [],
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt,
        organizationId: user.organizationId,
      });
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
          roles: req.user.roles,
        },
      });
    } catch (error) {
      logger.error('Session validation failed', { error });
      res.status(500).json({ error: 'Failed to validate session' });
    }
  }
);

export default router;
