const logger = require('../config/logger');
const {
  tokenSpendingTotal,
  tokenSpendingAmount,
  walletOperationsTotal
} = require('../config/metrics');

// Rate limiting configuration
const RATE_LIMITS = {
  purchase: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 purchases per 15 minutes
    message: 'Too many purchase attempts, please try again later'
  },
  spend: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 spends per minute
    message: 'Too many spending attempts, please try again later'
  },
  wallet: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 wallet operations per minute
    message: 'Too many wallet operations, please try again later'
  },
  payout: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 payout requests per hour
    message: 'Too many payout requests, please try again later'
  }
};

// Velocity checks for fraud prevention
const velocityCheck = async (userId, operation, amount, redis) => {
  const key = `velocity:${userId}:${operation}`;
  const hourKey = `velocity:${userId}:${operation}:hour`;
  const dayKey = `velocity:${userId}:${operation}:day`;
  
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  const dayAgo = now - (24 * 60 * 60 * 1000);
  
  try {
    const pipeline = redis.multi();
    
    // Clean old entries
    pipeline.zremrangebyscore(key, 0, hourAgo);
    pipeline.zremrangebyscore(hourKey, 0, dayAgo);
    pipeline.zremrangebyscore(dayKey, 0, dayAgo);
    
    // Add current operation
    pipeline.zadd(key, now, `${now}:${amount}`);
    pipeline.zadd(hourKey, now, `${now}:${amount}`);
    pipeline.zadd(dayKey, now, `${now}:${amount}`);
    
    // Get counts
    pipeline.zcard(key);
    pipeline.zcard(hourKey);
    pipeline.zcard(dayKey);
    
    // Get sums
    pipeline.zrange(key, 0, -1, 'WITHSCORES');
    pipeline.zrange(hourKey, 0, -1, 'WITHSCORES');
    pipeline.zrange(dayKey, 0, -1, 'WITHSCORES');
    
    const results = await pipeline.exec();
    
    const [count, hourCount, dayCount, ...amountResults] = results.slice(3);
    
    // Calculate sums from the amount results
    const sumAmounts = (result) => {
      if (!result || !result[1]) return 0;
      const pairs = result[1];
      let sum = 0;
      for (let i = 0; i < pairs.length; i += 2) {
        const parts = pairs[i].split(':');
        if (parts.length === 2) {
          sum += parseFloat(parts[1]) || 0;
        }
      }
      return sum;
    };
    
    const minuteSum = sumAmounts(amountResults[0]);
    const hourSum = sumAmounts(amountResults[1]);
    const daySum = sumAmounts(amountResults[2]);
    
    // Velocity thresholds
    const thresholds = {
      purchase: {
        minute: { count: 3, amount: 100 },
        hour: { count: 10, amount: 500 },
        day: { count: 25, amount: 2000 }
      },
      spend: {
        minute: { count: 50, amount: 1000 },
        hour: { count: 200, amount: 5000 },
        day: { count: 500, amount: 20000 }
      },
      payout: {
        minute: { count: 2, amount: 1000 },
        hour: { count: 5, amount: 5000 },
        day: { count: 10, amount: 10000 }
      }
    };
    
    const threshold = thresholds[operation];
    if (!threshold) return { allowed: true };
    
    // Check velocity limits
    if (count >= threshold.minute.count || minuteSum >= threshold.minute.amount) {
      logger.warn(`Velocity limit exceeded - minute: userId=${userId}, operation=${operation}, count=${count}, amount=${minuteSum}`);
      return {
        allowed: false,
        reason: 'Minute velocity limit exceeded',
        retryAfter: 60
      };
    }
    
    if (hourCount >= threshold.hour.count || hourSum >= threshold.hour.amount) {
      logger.warn(`Velocity limit exceeded - hour: userId=${userId}, operation=${operation}, count=${hourCount}, amount=${hourSum}`);
      return {
        allowed: false,
        reason: 'Hour velocity limit exceeded',
        retryAfter: 3600
      };
    }
    
    if (dayCount >= threshold.day.count || daySum >= threshold.day.amount) {
      logger.warn(`Velocity limit exceeded - day: userId=${userId}, operation=${operation}, count=${dayCount}, amount=${daySum}`);
      return {
        allowed: false,
        reason: 'Day velocity limit exceeded',
        retryAfter: 86400
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    logger.error('Velocity check failed:', error);
    // Allow operation if velocity check fails
    return { allowed: true };
  }
};

// Risk scoring
const calculateRiskScore = async (userId, operation, amount, pool, redis) => {
  try {
    const riskFactors = [];
    let score = 0;
    
    // Check user's purchase history
    const purchaseQuery = `
      SELECT COUNT(*) as purchase_count, 
             COALESCE(SUM(amount), 0) as total_spent,
             MAX(created_at) as last_purchase
      FROM token_purchases 
      WHERE user_id = $1 AND status = 'completed'
    `;
    
    const purchaseResult = await pool.query(purchaseQuery, [userId]);
    const { purchase_count, total_spent, last_purchase } = purchaseResult.rows[0];
    
    // New user risk
    if (purchase_count === 0) {
      score += 20;
      riskFactors.push('new_user');
    }
    
    // Low purchase history risk
    if (purchase_count < 3) {
      score += 10;
      riskFactors.push('low_purchase_history');
    }
    
    // Large amount risk
    if (amount > 100) {
      score += 15;
      riskFactors.push('large_amount');
    }
    
    if (amount > 500) {
      score += 25;
      riskFactors.push('very_large_amount');
    }
    
    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 5;
      riskFactors.push('unusual_hours');
    }
    
    // Recent activity risk
    const recentActivityKey = `recent_activity:${userId}`;
    const recentActivity = await redis.lrange(recentActivityKey, 0, -1);
    if (recentActivity.length > 10) {
      score += 10;
      riskFactors.push('high_activity');
    }
    
    // Failed attempts risk
    const failedAttemptsKey = `failed_attempts:${userId}`;
    const failedAttempts = await redis.get(failedAttemptsKey) || '0';
    if (parseInt(failedAttempts) > 3) {
      score += 20;
      riskFactors.push('multiple_failures');
    }
    
    // Determine risk level
    let riskLevel = 'low';
    if (score >= 50) {
      riskLevel = 'high';
    } else if (score >= 25) {
      riskLevel = 'medium';
    }
    
    return {
      score,
      level: riskLevel,
      factors: riskFactors
    };
    
  } catch (error) {
    logger.error('Risk scoring failed:', error);
    return { score: 0, level: 'low', factors: [] };
  }
};

// Fraud detection middleware
const fraudDetectionMiddleware = (operation) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const amount = req.body?.amount || 0;
    
    if (!userId) {
      return next();
    }
    
    try {
      const { pool, redis } = require('../config/database');
      
      // Velocity check
      const velocityResult = await velocityCheck(userId, operation, amount, redis);
      if (!velocityResult.allowed) {
        walletOperationsTotal
          .labels('velocity_check', 'blocked')
          .inc();
          
        return res.status(429).json({
          error: 'Velocity limit exceeded',
          message: velocityResult.reason,
          retryAfter: velocityResult.retryAfter
        });
      }
      
      // Risk scoring
      const riskScore = await calculateRiskScore(userId, operation, amount, pool, redis);
      
      // Log high-risk operations
      if (riskScore.level === 'high') {
        logger.warn(`High risk operation detected: userId=${userId}, operation=${operation}, amount=${amount}, score=${riskScore.score}, factors=${riskScore.factors.join(',')}`);
      }
      
      // Block very high risk operations
      if (riskScore.score >= 75) {
        walletOperationsTotal
          .labels('fraud_detection', 'blocked')
          .inc();
          
        return res.status(403).json({
          error: 'Operation blocked',
          message: 'High risk operation detected. Please contact support.'
        });
      }
      
      // Add risk info to request for use in other middleware
      req.riskScore = riskScore;
      
      // Record activity
      const activityKey = `recent_activity:${userId}`;
      await redis.lpush(activityKey, JSON.stringify({
        operation,
        amount,
        timestamp: Date.now(),
        riskScore: riskScore.score
      }));
      await redis.ltrim(activityKey, 0, 49); // Keep last 50 activities
      await redis.expire(activityKey, 24 * 60 * 60); // Expire after 24 hours
      
      next();
      
    } catch (error) {
      logger.error('Fraud detection middleware failed:', error);
      // Allow operation if fraud detection fails
      next();
    }
  };
};

// Record failed attempts
const recordFailedAttempt = async (userId, operation, redis) => {
  const key = `failed_attempts:${userId}:${operation}`;
  const current = await redis.incr(key);
  await redis.expire(key, 60 * 60); // Expire after 1 hour
  return current;
};

// Clear failed attempts
const clearFailedAttempts = async (userId, operation, redis) => {
  const key = `failed_attempts:${userId}:${operation}`;
  await redis.del(key);
};

module.exports = {
  RATE_LIMITS,
  velocityCheck,
  calculateRiskScore,
  fraudDetectionMiddleware,
  recordFailedAttempt,
  clearFailedAttempts
};
