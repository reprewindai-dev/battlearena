import { Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const profile = await this.userService.getProfile(req.user.id);

      res.json({
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        tier: profile.tier,
        reputation_score: profile.reputation_score,
        stats: profile.stats,
        wallet: profile.wallet,
        created_at: profile.created_at,
        last_login_at: profile.last_login_at
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { display_name, bio, social_links } = req.body;

      const updatedProfile = await this.userService.updateProfile(req.user.id, {
        display_name,
        bio,
        social_links
      });

      logger.info('User profile updated', { userId: req.user.id });

      res.json({
        id: updatedProfile.id,
        username: updatedProfile.username,
        display_name: updatedProfile.display_name,
        bio: updatedProfile.bio,
        social_links: updatedProfile.social_links,
        updated_at: updatedProfile.updated_at
      });
    } catch (error) {
      next(error);
    }
  };

  getPublicProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      const publicProfile = await this.userService.getPublicProfile(userId);

      res.json({
        id: publicProfile.id,
        username: publicProfile.username,
        display_name: publicProfile.display_name,
        bio: publicProfile.bio,
        avatar_url: publicProfile.avatar_url,
        tier: publicProfile.tier,
        reputation_score: publicProfile.reputation_score,
        stats: publicProfile.stats,
        created_at: publicProfile.created_at
      });
    } catch (error) {
      next(error);
    }
  };

  getLeaderboard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tier, limit = 50, offset = 0 } = req.query;

      const leaderboard = await this.userService.getLeaderboard({
        tier: tier as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        users: leaderboard.users,
        total: leaderboard.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      next(error);
    }
  };
}
