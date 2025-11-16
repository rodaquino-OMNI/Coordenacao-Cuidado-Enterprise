import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    logger.info('Login attempt', { email });

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        password: true,
        isActive: true,
        organizationId: true
      }
    });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Update user with refresh token and last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLoginAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    // Return success response (exclude password)
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token: accessToken,
        refreshToken,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, organizationId } = req.body;

    if (!email || !password || !firstName || !lastName || !phone || !organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, firstName, lastName, phone, and organizationId are required'
      });
    }

    logger.info('Registration attempt', { email, firstName, lastName });

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        organizationId,
        isActive: true,
        isVerified: false
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        organizationId: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    });

    logger.info('User registered successfully', { userId: user.id });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user
      }
    });
  } catch (error) {
    logger.error('Registration error', { error });
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    logger.info('Token refresh attempt');

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find user and verify refresh token matches
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        refreshToken: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Optionally generate new refresh token (token rotation)
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Update refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshToken,
        lastActiveAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Token refresh successful',
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    logger.error('Token refresh error', { error });
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as authRoutes };