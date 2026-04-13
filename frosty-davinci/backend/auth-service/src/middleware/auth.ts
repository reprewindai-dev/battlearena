import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getCache } from '../config/redis';
import { query } from '../config/database';
import { createError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    tier: string;
    roles: string[];
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw createError('Access token required', 401);
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    // Check if session exists
    const sessionResult = await query(
      'SELECT user_id FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      throw createError('Invalid or expired token', 401);
    }

    // Get user data from cache or database
    let userData = await getCache(`user:${decoded.userId}`);
    
    if (!userData) {
      const userResult = await query(
        `SELECT u.id, u.email, u.username, u.tier, r.name as role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.id = $1 AND u.is_active = true`,
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw createError('User not found', 404);
      }

      const userRow = userResult.rows[0];
      userData = {
        id: userRow.id,
        email: userRow.email,
        username: userRow.username,
        tier: userRow.tier,
        roles: userRow.rows.map((row: any) => row.role).filter(Boolean)
      };
    }

    req.user = userData;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const requireRole = (requiredRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const hasRole = requiredRoles.some(role => req.user!.roles.includes(role));
    
    if (!hasRole) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};

export const requireTier = (minimumTier: string) => {
  const tierHierarchy = ['novice', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
  
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const userTierIndex = tierHierarchy.indexOf(req.user.tier);
    const requiredTierIndex = tierHierarchy.indexOf(minimumTier);

    if (userTierIndex < requiredTierIndex) {
      return next(createError(`Minimum tier required: ${minimumTier}`, 403));
    }

    next();
  };
};
