import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  social_links?: {
    instagram?: string;
    youtube?: string;
    twitter?: string;
    soundcloud?: string;
  };
  updated_at?: Date;
  tier: string;
  reputation_score: number;
  stats: {
    wins: number;
    losses: number;
    win_rate: number;
    current_streak: number;
  };
  wallet: {
    crowns_balance: number;
    points_balance: number;
    tokens_balance: number;
  };
  created_at: Date;
  last_login_at?: Date;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  tier: string;
  reputation_score: number;
  stats: {
    wins: number;
    losses: number;
    win_rate: number;
    current_streak: number;
  };
  created_at: Date;
}

export interface LeaderboardUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  tier: string;
  reputation_score: number;
  rank: number;
}

export class UserService {
  async getProfile(userId: string): Promise<UserProfile> {
    const userResult = await query(
      `SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url, u.tier, 
              u.social_links, u.reputation_score, u.created_at, u.last_login_at,
              w.crowns_balance, w.points_balance, w.tokens_balance
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw createError('User not found', 404);
    }

    const user = userResult.rows[0];

    // Get battle stats
    const statsResult = await query(
      `SELECT 
         COUNT(CASE WHEN bp.result = 'win' THEN 1 END) as wins,
         COUNT(CASE WHEN bp.result = 'loss' THEN 1 END) as losses,
         COUNT(CASE WHEN bp.result = 'win' THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) as win_rate,
         COALESCE(MAX(CASE WHEN bp.result = 'win' THEN b.created_at END), '1970-01-01') as last_win
       FROM battle_participants bp
       JOIN battles b ON bp.battle_id = b.id
       WHERE bp.user_id = $1 AND b.status = 'completed'`,
      [userId]
    );

    const stats = statsResult.rows[0];
    const currentStreak = await this.getCurrentStreak(userId);

    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      social_links: user.social_links,
      tier: user.tier,
      reputation_score: parseFloat(user.reputation_score),
      stats: {
        wins: parseInt(stats.wins) || 0,
        losses: parseInt(stats.losses) || 0,
        win_rate: parseFloat(stats.win_rate) || 0,
        current_streak: currentStreak
      },
      wallet: {
        crowns_balance: parseInt(user.crowns_balance) || 0,
        points_balance: parseInt(user.points_balance) || 0,
        tokens_balance: parseInt(user.tokens_balance) || 0
      },
      created_at: user.created_at,
      last_login_at: user.last_login_at
    };
  }

  async updateProfile(userId: string, updates: {
    display_name?: string;
    bio?: string;
    social_links?: {
      instagram?: string;
      youtube?: string;
      twitter?: string;
      soundcloud?: string;
    };
  }): Promise<Partial<UserProfile>> {
    const { display_name, bio, social_links } = updates;

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (display_name !== undefined) {
      updateFields.push(`display_name = $${paramIndex++}`);
      updateValues.push(display_name);
    }

    if (bio !== undefined) {
      updateFields.push(`bio = $${paramIndex++}`);
      updateValues.push(bio);
    }

    if (social_links !== undefined) {
      updateFields.push(`social_links = $${paramIndex++}`);
      updateValues.push(JSON.stringify(social_links));
    }

    if (updateFields.length === 0) {
      throw createError('No fields to update', 400);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, display_name, bio, social_links, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
      throw createError('User not found', 404);
    }

    return result.rows[0];
  }

  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const userResult = await query(
      `SELECT id, username, display_name, bio, avatar_url, tier, reputation_score, created_at
       FROM users 
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw createError('User not found', 404);
    }

    const user = userResult.rows[0];

    // Get battle stats
    const statsResult = await query(
      `SELECT 
         COUNT(CASE WHEN bp.result = 'win' THEN 1 END) as wins,
         COUNT(CASE WHEN bp.result = 'loss' THEN 1 END) as losses,
         COUNT(CASE WHEN bp.result = 'win' THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) as win_rate
       FROM battle_participants bp
       JOIN battles b ON bp.battle_id = b.id
       WHERE bp.user_id = $1 AND b.status = 'completed'`,
      [userId]
    );

    const stats = statsResult.rows[0];
    const currentStreak = await this.getCurrentStreak(userId);

    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      tier: user.tier,
      reputation_score: parseFloat(user.reputation_score),
      stats: {
        wins: parseInt(stats.wins) || 0,
        losses: parseInt(stats.losses) || 0,
        win_rate: parseFloat(stats.win_rate) || 0,
        current_streak: currentStreak
      },
      created_at: user.created_at
    };
  }

  async getLeaderboard(options: {
    tier?: string;
    limit: number;
    offset: number;
  }): Promise<{ users: LeaderboardUser[]; total: number }> {
    const { tier, limit, offset } = options;

    let whereClause = 'WHERE u.is_active = true';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (tier) {
      whereClause += ` AND u.tier = $${paramIndex++}`;
      queryParams.push(tier);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get leaderboard entries
    const leaderboardResult = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.tier, u.reputation_score,
              ROW_NUMBER() OVER (ORDER BY u.reputation_score DESC, u.created_at ASC) as rank
       FROM users u
       ${whereClause}
       ORDER BY u.reputation_score DESC, u.created_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...queryParams, limit, offset]
    );

    const users: LeaderboardUser[] = leaderboardResult.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      tier: row.tier,
      reputation_score: parseFloat(row.reputation_score),
      rank: parseInt(row.rank)
    }));

    return { users, total };
  }

  private async getCurrentStreak(userId: string): Promise<number> {
    // Get recent battles to calculate current streak
    const streakResult = await query(
      `SELECT bp.result, b.created_at
       FROM battle_participants bp
       JOIN battles b ON bp.battle_id = b.id
       WHERE bp.user_id = $1 AND b.status = 'completed' AND bp.result IS NOT NULL
       ORDER BY b.created_at DESC
       LIMIT 10`,
      [userId]
    );

    if (streakResult.rows.length === 0) {
      return 0;
    }

    let streak = 0;
    for (const battle of streakResult.rows) {
      if (battle.result === 'win') {
        streak++;
      } else if (battle.result === 'loss') {
        break;
      }
    }

    return streak;
  }
}
