const logger = require('../config/logger');
const { pool } = require('../config/database');

class PPVService {
  constructor() {
    this.defaultRevenueShare = 0.70;
  }

  async createPPVEvent(title, description, price, startTime, options = {}) {
    try {
      const {
        battleId = null,
        tournamentId = null,
        endTime = null,
        maxParticipants = null,
        revenueShare = this.defaultRevenueShare
      } = options;

      const query = `
        INSERT INTO ppv_events (
          title, description, price, battle_id, tournament_id,
          start_time, end_time, max_participants, revenue_share,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'upcoming', NOW())
        RETURNING *
      `;

      const result = await pool.query(query, [
        title, description, price, battleId, tournamentId,
        startTime, endTime, maxParticipants, revenueShare
      ]);

      logger.info(`PPV event created: ${title} - $${price}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to create PPV event:', error);
      throw error;
    }
  }

  async purchasePPVAccess(userId, eventId, paymentMethodId) {
    try {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Get event details
        const eventQuery = `
          SELECT * FROM ppv_events
          WHERE id = $1 AND status IN ('upcoming', 'live')
          FOR UPDATE
        `;
        const eventResult = await client.query(eventQuery, [eventId]);

        if (eventResult.rows.length === 0) {
          throw new Error('PPV event not found or not available');
        }

        const event = eventResult.rows[0];

        // Check if already purchased
        const purchaseQuery = `
          SELECT * FROM ppv_purchases
          WHERE user_id = $1 AND event_id = $2 AND status = 'completed'
        `;
        const purchaseResult = await client.query(purchaseQuery, [userId, eventId]);

        if (purchaseResult.rows.length > 0) {
          throw new Error('Access already purchased for this event');
        }

        // Check participant limit
        if (event.max_participants && event.current_participants >= event.max_participants) {
          throw new Error('Event is at maximum capacity');
        }

        // Create payment intent
        const { PaymentService } = require('./PaymentService');
        const paymentService = new PaymentService();
        
        const paymentIntent = await paymentService.createPaymentIntent(
          userId,
          event.price,
          'usd',
          paymentMethodId
        );

        // Create PPV purchase record
        const ppvPurchaseQuery = `
          INSERT INTO ppv_purchases (
            user_id, event_id, amount, provider, provider_transaction_id,
            status, created_at
          ) VALUES ($1, $2, $3, 'stripe', $4, 'pending', NOW())
          RETURNING *
        `;

        const ppvResult = await client.query(ppvPurchaseQuery, [
          userId, eventId, event.price, paymentIntent.paymentIntentId
        ]);

        // Update participant count
        await client.query(`
          UPDATE ppv_events
          SET current_participants = current_participants + 1
          WHERE id = $1
        `, [eventId]);

        await client.query('COMMIT');

        logger.info(`PPV access purchased: user ${userId} for event ${eventId}`);
        
        return {
          purchase: ppvResult.rows[0],
          paymentIntent,
          event
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to purchase PPV access:', error);
      throw error;
    }
  }

  async confirmPPVPurchase(paymentIntentId, userId) {
    try {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Find PPV purchase
        const purchaseQuery = `
          SELECT pp.*, pe.title, pe.start_time
          FROM ppv_purchases pp
          JOIN ppv_events pe ON pp.event_id = pe.id
          WHERE pp.provider_transaction_id = $1 AND pp.user_id = $2
          FOR UPDATE
        `;
        const purchaseResult = await client.query(purchaseQuery, [paymentIntentId, userId]);

        if (purchaseResult.rows.length === 0) {
          throw new Error('PPV purchase not found');
        }

        const purchase = purchaseResult.rows[0];

        // Update purchase status
        await client.query(`
          UPDATE ppv_purchases
          SET status = 'completed', access_granted_at = NOW()
          WHERE id = $1
        `, [purchase.id]);

        // Distribute revenue to participants
        await this.distributePPVRevenue(purchase.event_id, purchase.amount, client);

        await client.query('COMMIT');

        logger.info(`PPV purchase confirmed: ${purchase.id} for event ${purchase.event_id}`);
        
        return {
          purchaseId: purchase.id,
          eventId: purchase.event_id,
          eventTitle: purchase.title,
          startTime: purchase.start_time
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to confirm PPV purchase:', error);
      throw error;
    }
  }

  async distributePPVRevenue(eventId, totalAmount, client) {
    try {
      // Get event details
      const eventQuery = `
        SELECT * FROM ppv_events WHERE id = $1
      `;
      const eventResult = await client.query(eventQuery, [eventId]);
      const event = eventResult.rows[0];

      const creatorShare = totalAmount * event.revenue_share;
      const platformShare = totalAmount * (1 - event.revenue_share);

      // If it's a battle, distribute to battle participants
      if (event.battle_id) {
        const battleQuery = `
          SELECT participant1_id, participant2_id
          FROM battles
          WHERE id = $1
        `;
        const battleResult = await client.query(battleQuery, [event.battle_id]);
        const battle = battleResult.rows[0];

        if (battle) {
          const participantShare = creatorShare / 2;
          
          // Award points to both participants
          for (const participantId of [battle.participant1_id, battle.participant2_id]) {
            if (participantId) {
              await client.query(`
                UPDATE wallets
                SET points_balance = points_balance + $1
                WHERE user_id = $2
              `, [participantShare * 100, participantId]); // Convert to points
            }
          }
        }
      }

      // If it's a tournament, distribute to tournament winners
      if (event.tournament_id) {
        // This would integrate with the tournament service
        // For now, we'll add to CRF
        await client.query(`
          INSERT INTO community_rewards_fund (amount, source, created_at)
          VALUES ($1, 'ppv_revenue', NOW())
        `, [platformShare]);
      }

      logger.info(`PPV revenue distributed: $${totalAmount} for event ${eventId}`);

    } catch (error) {
      logger.error('Failed to distribute PPV revenue:', error);
      throw error;
    }
  }

  async getPPVEvent(eventId) {
    try {
      const query = `
        SELECT pe.*, 
               (SELECT COUNT(*) FROM ppv_purchases WHERE event_id = pe.id AND status = 'completed') as purchases_count
        FROM ppv_events pe
        WHERE pe.id = $1
      `;

      const result = await pool.query(query, [eventId]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('Failed to get PPV event:', error);
      throw error;
    }
  }

  async getPPVEvents(options = {}) {
    try {
      const {
        status = null,
        limit = 20,
        offset = 0,
        startDate = null,
        endDate = null
      } = options;

      let query = `
        SELECT pe.*, 
               (SELECT COUNT(*) FROM ppv_purchases WHERE event_id = pe.id AND status = 'completed') as purchases_count
        FROM ppv_events pe
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND pe.status = $${paramIndex++}`;
        params.push(status);
      }

      if (startDate) {
        query += ` AND pe.start_time >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND pe.start_time <= $${paramIndex++}`;
        params.push(endDate);
      }

      query += `
        ORDER BY pe.start_time DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get PPV events:', error);
      throw error;
    }
  }

  async getUserPPVPurchases(userId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status = null
      } = options;

      let query = `
        SELECT pp.*, pe.title, pe.start_time, pe.end_time, pe.status as event_status
        FROM ppv_purchases pp
        JOIN ppv_events pe ON pp.event_id = pe.id
        WHERE pp.user_id = $1
      `;

      const params = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND pp.status = $${paramIndex++}`;
        params.push(status);
      }

      query += `
        ORDER BY pp.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get user PPV purchases:', error);
      throw error;
    }
  }

  async updatePPVEventStatus(eventId, status) {
    try {
      const query = `
        UPDATE ppv_events
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [status, eventId]);

      if (result.rows.length === 0) {
        throw new Error('PPV event not found');
      }

      logger.info(`PPV event status updated: ${eventId} to ${status}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update PPV event status:', error);
      throw error;
    }
  }
}

module.exports = PPVService;
