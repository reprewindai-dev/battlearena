const logger = require('../config/logger');
const { pool } = require('../config/database');

class AuditService {
  constructor() {
    this.batchSize = 100;
    this.flushInterval = 30000; // 30 seconds
    this.pendingLogs = [];
    this.flushTimer = null;
    this.startFlushTimer();
  }

  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.pendingLogs.length > 0) {
        this.flushLogs();
      }
    }, this.flushInterval);
  }

  async logEconomyEvent(eventType, userId, details, metadata = {}) {
    try {
      const logEntry = {
        event_type: eventType,
        user_id: userId,
        details: JSON.stringify(details),
        metadata: JSON.stringify(metadata),
        ip_address: metadata.ip || null,
        user_agent: metadata.userAgent || null,
        created_at: new Date()
      };

      // Add to pending logs
      this.pendingLogs.push(logEntry);

      // Flush if batch size reached
      if (this.pendingLogs.length >= this.batchSize) {
        await this.flushLogs();
      }

      logger.info(`Economy event logged: ${eventType} for user ${userId}`);
      
    } catch (error) {
      logger.error('Failed to log economy event:', error);
    }
  }

  async flushLogs() {
    if (this.pendingLogs.length === 0) {
      return;
    }

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      const client = await pool.connect();
      
      const values = logsToFlush.map((log, index) => {
        const baseIndex = index * 7;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
      }).join(', ');

      const flatParams = logsToFlush.flatMap(log => [
        log.event_type,
        log.user_id,
        log.details,
        log.metadata,
        log.ip_address,
        log.user_agent,
        log.created_at
      ]);

      const query = `
        INSERT INTO economy_audit_logs (
          event_type, user_id, details, metadata, ip_address, user_agent, created_at
        ) VALUES ${values}
      `;

      await client.query(query, flatParams);
      client.release();

      logger.debug(`Flushed ${logsToFlush.length} audit logs`);
      
    } catch (error) {
      logger.error('Failed to flush audit logs:', error);
      // Re-add logs to pending for retry
      this.pendingLogs.unshift(...logsToFlush);
    }
  }

  async getAuditLogs(filters = {}, options = {}) {
    try {
      const {
        userId = null,
        eventType = null,
        startDate = null,
        endDate = null
      } = filters;

      const {
        limit = 100,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      let query = `
        SELECT eal.*, u.username
        FROM economy_audit_logs eal
        LEFT JOIN users u ON eal.user_id = u.id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND eal.user_id = $${paramIndex++}`;
        params.push(userId);
      }

      if (eventType) {
        query += ` AND eal.event_type = $${paramIndex++}`;
        params.push(eventType);
      }

      if (startDate) {
        query += ` AND eal.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND eal.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }

      // Add sorting
      const validSortFields = ['created_at', 'event_type', 'user_id'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY eal.${sortField} ${sortDirection}`;

      // Add pagination
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM economy_audit_logs eal
        WHERE 1=1
      `;

      const countParams = [];
      let countParamIndex = 1;

      if (userId) {
        countQuery += ` AND eal.user_id = $${countParamIndex++}`;
        countParams.push(userId);
      }

      if (eventType) {
        countQuery += ` AND eal.event_type = $${countParamIndex++}`;
        countParams.push(eventType);
      }

      if (startDate) {
        countQuery += ` AND eal.created_at >= $${countParamIndex++}`;
        countParams.push(startDate);
      }

      if (endDate) {
        countQuery += ` AND eal.created_at <= $${countParamIndex++}`;
        countParams.push(endDate);
      }

      const countResult = await pool.query(countQuery, countParams);

      return {
        logs: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      };

    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  async getUserActivitySummary(userId, period = '24h') {
    try {
      let interval;
      switch (period) {
        case '1h':
          interval = "1 hour";
          break;
        case '24h':
          interval = "24 hours";
          break;
        case '7d':
          interval = "7 days";
          break;
        case '30d':
          interval = "30 days";
          break;
        default:
          interval = "24 hours";
      }

      const query = `
        SELECT 
          event_type,
          COUNT(*) as count,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence
        FROM economy_audit_logs
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY event_type
        ORDER BY count DESC
      `;

      const result = await pool.query(query, [userId]);

      return {
        userId,
        period,
        activities: result.rows
      };

    } catch (error) {
      logger.error('Failed to get user activity summary:', error);
      throw error;
    }
  }

  async getSystemActivityStats(period = '24h') {
    try {
      let interval;
      switch (period) {
        case '1h':
          interval = "1 hour";
          break;
        case '24h':
          interval = "24 hours";
          break;
        case '7d':
          interval = "7 days";
          break;
        case '30d':
          interval = "30 days";
          break;
        default:
          interval = "24 hours";
      }

      // Event type distribution
      const eventTypeQuery = `
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM economy_audit_logs
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY event_type
        ORDER BY count DESC
      `;

      const eventTypeResult = await pool.query(eventTypeQuery);

      // Hourly activity trend
      const hourlyQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as events,
          COUNT(DISTINCT user_id) as unique_users
        FROM economy_audit_logs
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour
      `;

      const hourlyResult = await pool.query(hourlyQuery);

      // Top active users
      const topUsersQuery = `
        SELECT 
          user_id,
          u.username,
          COUNT(*) as activity_count
        FROM economy_audit_logs eal
        LEFT JOIN users u ON eal.user_id = u.id
        WHERE eal.created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY user_id, u.username
        ORDER BY activity_count DESC
        LIMIT 10
      `;

      const topUsersResult = await pool.query(topUsersQuery);

      return {
        period,
        eventTypeStats: eventTypeResult.rows,
        hourlyTrend: hourlyResult.rows,
        topUsers: topUsersResult.rows
      };

    } catch (error) {
      logger.error('Failed to get system activity stats:', error);
      throw error;
    }
  }

  async detectAnomalousActivity(userId, period = '24h') {
    try {
      const summary = await this.getUserActivitySummary(userId, period);
      
      const anomalies = [];
      
      // Check for unusually high activity
      const totalEvents = summary.activities.reduce((sum, activity) => sum + parseInt(activity.count), 0);
      
      if (totalEvents > 100) {
        anomalies.push({
          type: 'high_activity',
          severity: 'medium',
          description: `Unusually high activity: ${totalEvents} events in ${period}`,
          data: { totalEvents, period }
        });
      }

      // Check for rapid token purchases
      const purchases = summary.activities.find(a => a.event_type === 'token_purchase');
      if (purchases && parseInt(purchases.count) > 5) {
        anomalies.push({
          type: 'rapid_purchases',
          severity: 'high',
          description: `Rapid token purchases: ${purchases.count} purchases in ${period}`,
          data: { purchaseCount: purchases.count, period }
        });
      }

      // Check for unusual spending patterns
      const spending = summary.activities.find(a => a.event_type === 'token_spending');
      if (spending && parseInt(spending.count) > 50) {
        anomalies.push({
          type: 'high_spending',
          severity: 'medium',
          description: `High spending activity: ${spending.count} spending events in ${period}`,
          data: { spendingCount: spending.count, period }
        });
      }

      // Check for payout requests
      const payouts = summary.activities.find(a => a.event_type === 'payout_request');
      if (payouts && parseInt(payouts.count) > 3) {
        anomalies.push({
          type: 'multiple_payouts',
          severity: 'high',
          description: `Multiple payout requests: ${payouts.count} requests in ${period}`,
          data: { payoutCount: payouts.count, period }
        });
      }

      return {
        userId,
        period,
        anomalies,
        riskScore: anomalies.reduce((score, anomaly) => {
          return score + (anomaly.severity === 'high' ? 30 : anomaly.severity === 'medium' ? 15 : 5);
        }, 0)
      };

    } catch (error) {
      logger.error('Failed to detect anomalous activity:', error);
      throw error;
    }
  }

  async exportAuditLogs(filters = {}, format = 'json') {
    try {
      const { logs } = await this.getAuditLogs(filters, { limit: 10000 });
      
      if (format === 'csv') {
        const csvHeader = 'id,event_type,user_id,username,details,metadata,ip_address,user_agent,created_at\n';
        const csvRows = logs.map(log => {
          const details = JSON.parse(log.details || '{}');
          const metadata = JSON.parse(log.metadata || '{}');
          
          return [
            log.id,
            log.event_type,
            log.user_id,
            log.username || '',
            JSON.stringify(details).replace(/"/g, '""'),
            JSON.stringify(metadata).replace(/"/g, '""'),
            log.ip_address || '',
            log.user_agent || '',
            log.created_at
          ].map(field => `"${field}"`).join(',');
        }).join('\n');
        
        return csvHeader + csvRows;
      }
      
      return logs;
      
    } catch (error) {
      logger.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  async cleanupOldLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const query = `
        DELETE FROM economy_audit_logs
        WHERE created_at < $1
        RETURNING id
      `;
      
      const result = await pool.query(query, [cutoffDate]);
      
      logger.info(`Cleaned up ${result.rows.length} old audit logs (older than ${retentionDays} days)`);
      
      return {
        deletedCount: result.rows.length,
        cutoffDate
      };
      
    } catch (error) {
      logger.error('Failed to cleanup old audit logs:', error);
      throw error;
    }
  }

  // Graceful shutdown
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining logs
    await this.flushLogs();
    
    logger.info('Audit service shutdown complete');
  }
}

// Singleton instance
const auditService = new AuditService();

// Process shutdown handling
process.on('SIGINT', async () => {
  await auditService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await auditService.shutdown();
  process.exit(0);
});

module.exports = auditService;
