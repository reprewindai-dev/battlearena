import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, email, password, date_of_birth, country_code, accept_terms, accept_privacy } = req.body;

      const result = await this.authService.register({
        username,
        email,
        password,
        date_of_birth,
        country_code,
        accept_terms,
        accept_privacy
      });

      logger.info('User registered successfully', { userId: result.user.id, email });

      res.status(201).json({
        user_id: result.user.id,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: 3600,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          is_verified: result.user.is_verified,
          tier: result.user.tier
        }
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      const result = await this.authService.login(email, password);

      logger.info('User logged in successfully', { userId: result.user.id, email });

      res.json({
        user_id: result.user.id,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: 3600,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          is_verified: result.user.is_verified,
          tier: result.user.tier
        }
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.body;

      const result = await this.authService.refreshToken(refresh_token);

      res.json({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: 3600
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        await this.authService.logout(token);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;

      await this.authService.forgotPassword(email);

      res.json({ message: 'Password reset email sent' });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, new_password } = req.body;

      await this.authService.resetPassword(token, new_password);

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.body;

      await this.authService.verifyEmail(token);

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;

      await this.authService.resendVerification(email);

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      next(error);
    }
  };
}
