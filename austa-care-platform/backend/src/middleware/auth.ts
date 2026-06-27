import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface JwtPayload {
  userId?: string;
  id?: string;
  email?: string;
  roles?: string[];
  role?: string;
  permissions?: string[];
  organizationId?: string;
  name?: string;
}

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

/**
 * JWT Authentication middleware
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Access denied. No token provided.' }
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = {
      id: decoded.userId || decoded.id || '',
      email: decoded.email || '',
      roles: decoded.roles || ['user'],
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Access denied. Token has expired.' }
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Access denied. Invalid token.' }
      });
      return;
    }

    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Access denied. Token verification failed.' }
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (requiredRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
      return;
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const hasRequiredRole = roles.some(role => req.user!.roles.includes(role));

    if (!hasRequiredRole) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied. Insufficient permissions.' }
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = {
      id: decoded.userId || decoded.id || '',
      email: decoded.email || '',
      roles: decoded.roles || ['user'],
      permissions: decoded.permissions || []
    };
  } catch {
    // Token invalid — continue without user info
  }

  next();
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (requiredPermissions: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
      return;
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const hasRequiredPermission = permissions.some(permission =>
      req.user!.permissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied. Missing required permissions.' }
      });
      return;
    }

    next();
  };
};

/**
 * Alias for authenticateToken for backward compatibility
 */
export const authMiddleware = authenticateToken;
