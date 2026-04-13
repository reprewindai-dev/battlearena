import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { setCache, deleteCache } from '../config/redis';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  date_of_birth?: Date;
  country_code?: string;
  is_verified: boolean;
  is_active: boolean;
  tier: string;
  reputation_score: number;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: Omit<User, 'password_hash'>;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  private readonly ACCESS_TOKEN_EXPIRY = '1h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  private emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  async register(userData: {
    username: string;
    email: string;
    password: string;
    date_of_birth?: string;
    country_code?: string;
    accept_terms: boolean;
    accept_privacy: boolean;
  }): Promise<AuthTokens> {
    const { username, email, password, date_of_birth, country_code, accept_terms, accept_privacy } = userData;

    if (!accept_terms || !accept_privacy) {
      throw createError('Terms and privacy policy must be accepted', 400);
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw createError('User with this email or username already exists', 409);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user and wallet in transaction
    const result = await transaction(async (client) => {
      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, date_of_birth, country_code, tier, reputation_score)
         VALUES ($1, $2, $3, $4, $5, 'novice', 1000.00)
         RETURNING *`,
        [username, email, password_hash, date_of_birth, country_code]
      );

      const user = userResult.rows[0];

      // Create wallet
      await client.query(
        'INSERT INTO wallets (user_id, crowns_balance, points_balance, tokens_balance) VALUES ($1, 0, 0, 0)',
        [user.id]
      );

      // Assign default user role
      const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['user']);
      if (roleResult.rows.length > 0) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [user.id, roleResult.rows[0].id]
        );
      }

      return user;
    });

    // Send verification email
    await this.sendVerificationEmail(result.id, result.email);

    // Generate tokens
    const tokens = await this.generateTokens(result);

    logger.info('User registered successfully', { userId: result.id, email });

    return tokens;
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    // Find user
    const userResult = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (userResult.rows.length === 0) {
      throw createError('Invalid credentials', 401);
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw createError('Invalid credentials', 401);
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const tokens = await this.generateTokens(user);

    logger.info('User logged in successfully', { userId: user.id, email });

    return tokens;
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;
      
      // Check if session exists
      const sessionResult = await query(
        'SELECT user_id FROM user_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
        [refreshToken]
      );

      if (sessionResult.rows.length === 0) {
        throw createError('Invalid refresh token', 401);
      }

      // Get user
      const userResult = await query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw createError('User not found', 404);
      }

      const user = userResult.rows[0];

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Invalidate old refresh token
      await query(
        'DELETE FROM user_sessions WHERE refresh_token = $1',
        [refreshToken]
      );

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      };
    } catch (error) {
      throw createError('Invalid refresh token', 401);
    }
  }

  async logout(accessToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(accessToken, this.JWT_SECRET) as any;
      
      // Delete session
      await query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [decoded.userId]
      );

      // Remove from cache
      await deleteCache(`user:${decoded.userId}`);
    } catch (error) {
      // Token might be invalid, but that's okay for logout
      logger.warn('Logout with invalid token', { error });
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const userResult = await query(
      'SELECT id, username FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not
      return;
    }

    const user = userResult.rows[0];
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token
    await query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );

    // Send reset email
    await this.sendPasswordResetEmail(user.email, user.username, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetResult = await query(
      'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (resetResult.rows.length === 0) {
      throw createError('Invalid or expired reset token', 400);
    }

    const userId = resetResult.rows[0].user_id;
    const password_hash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, userId]
    );

    // Delete reset token
    await query(
      'DELETE FROM password_resets WHERE token = $1',
      [token]
    );

    // Invalidate all sessions
    await query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const verificationResult = await query(
      'SELECT user_id FROM email_verifications WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (verificationResult.rows.length === 0) {
      throw createError('Invalid or expired verification token', 400);
    }

    const userId = verificationResult.rows[0].user_id;

    // Update user verification status
    await query(
      'UPDATE users SET is_verified = true WHERE id = $1',
      [userId]
    );

    // Delete verification token
    await query(
      'DELETE FROM email_verifications WHERE token = $1',
      [token]
    );
  }

  async resendVerification(email: string): Promise<void> {
    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true AND is_verified = false',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or is already verified
      return;
    }

    const user = userResult.rows[0];
    await this.sendVerificationEmail(user.id, user.email);
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const userId = user.id;
    const accessToken = jwt.sign(
      { userId, email: user.email, username: user.username },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    // Store session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, accessToken, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    // Cache user data
    await setCache(`user:${userId}`, user, 3600);

    // Remove password hash from user object
    const { password_hash, ...userWithoutPassword } = user;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userWithoutPassword
    };
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    await query(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await this.emailTransporter.sendMail({
      to: email,
      subject: 'Verify your Arena account',
      html: `
        <h2>Welcome to Arena!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    });
  }

  private async sendPasswordResetEmail(email: string, username: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await this.emailTransporter.sendMail({
      to: email,
      subject: 'Reset your Arena password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${username},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
  }
}
