import pool from '../config/database.js';

/**
 * RingRequest Model
 * Manages urgent help requests between technicians (Ring for Help feature)
 */
class RingRequest {
  /**
   * Create a new ring request
   * @param {number} ticketId - Ticket ID
   * @param {number} requestingTechId - Technician requesting help
   * @param {number} targetTechId - Technician being requested
   * @param {string} urgencyLevel - 'low', 'medium', or 'high'
   * @param {string} message - Optional message explaining the need
   * @returns {Promise<Object>} Created ring request
   */
  static async create(ticketId, requestingTechId, targetTechId, urgencyLevel, message = null) {
    try {
      const result = await pool.query(
        `INSERT INTO ring_requests 
         (ticket_id, requesting_tech_id, target_tech_id, urgency_level, message) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [ticketId, requestingTechId, targetTechId, urgencyLevel, message]
      );
      
      return result.rows[0];
    } catch (error) {
      if (error.message.includes('no_self_ring')) {
        throw new Error('Cannot send ring request to yourself');
      }
      throw error;
    }
  }

  /**
   * Get a ring request by ID
   * @param {number} id - Ring request ID
   * @returns {Promise<Object|null>} Ring request with user and ticket details
   */
  static async getById(id) {
    const result = await pool.query(
      `SELECT 
        rr.*,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.email as requester_email,
        target.first_name as target_first_name,
        target.last_name as target_last_name,
        target.email as target_email,
        target.dnd_enabled as target_dnd_enabled,
        target.dnd_until as target_dnd_until,
        t.subject as ticket_subject,
        t.priority as ticket_priority,
        t.status as ticket_status
       FROM ring_requests rr
       JOIN users requester ON rr.requesting_tech_id = requester.id
       JOIN users target ON rr.target_tech_id = target.id
       JOIN tickets t ON rr.ticket_id = t.id
       WHERE rr.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Get all incoming pending ring requests for a technician
   * @param {number} techId - Technician user ID
   * @param {boolean} includeExpired - Include expired (>5min) requests
   * @returns {Promise<Array>} Array of pending ring requests
   */
  static async getIncomingRequests(techId, includeExpired = false) {
    const expiryCondition = includeExpired 
      ? '' 
      : `AND rr.created_at > NOW() - INTERVAL '5 minutes'`;

    const result = await pool.query(
      `SELECT 
        rr.*,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.email as requester_email,
        t.subject as ticket_subject,
        t.priority as ticket_priority,
        t.id as ticket_id
       FROM ring_requests rr
       JOIN users requester ON rr.requesting_tech_id = requester.id
       JOIN tickets t ON rr.ticket_id = t.id
       WHERE rr.target_tech_id = $1 
         AND rr.status = 'pending'
         ${expiryCondition}
       ORDER BY rr.created_at DESC`,
      [techId]
    );
    
    return result.rows;
  }

  /**
   * Get all outgoing ring requests for a technician
   * @param {number} techId - Technician user ID
   * @returns {Promise<Array>} Array of sent ring requests
   */
  static async getOutgoingRequests(techId) {
    const result = await pool.query(
      `SELECT 
        rr.*,
        target.first_name as target_first_name,
        target.last_name as target_last_name,
        target.email as target_email,
        t.subject as ticket_subject,
        t.priority as ticket_priority
       FROM ring_requests rr
       JOIN users target ON rr.target_tech_id = target.id
       JOIN tickets t ON rr.ticket_id = t.id
       WHERE rr.requesting_tech_id = $1 
       ORDER BY rr.created_at DESC
       LIMIT 20`,
      [techId]
    );
    
    return result.rows;
  }

  /**
   * Respond to a ring request (accept or decline)
   * @param {number} id - Ring request ID
   * @param {string} status - 'accepted' or 'declined'
   * @returns {Promise<Object>} Updated ring request
   */
  static async respond(id, status) {
    const result = await pool.query(
      `UPDATE ring_requests 
       SET status = $2,
           responded_at = NOW(),
           response_time_seconds = EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER
       WHERE id = $1 
         AND status = 'pending'
       RETURNING *`,
      [id, status]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Ring request not found or already responded to');
    }
    
    return result.rows[0];
  }

  /**
   * Mark expired ring requests as timeout
   * @param {number} minutes - Age in minutes to consider expired (default 5)
   * @returns {Promise<Array>} Array of timed-out requests
   */
  static async timeoutExpired(minutes = 5) {
    const result = await pool.query(
      `UPDATE ring_requests 
       SET status = 'timeout',
           responded_at = NOW(),
           response_time_seconds = EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER
       WHERE status = 'pending' 
         AND created_at < NOW() - ($1 || ' minutes')::INTERVAL
       RETURNING *`,
      [minutes]
    );
    
    return result.rows;
  }

  /**
   * Check if a user can send more ring requests (rate limiting)
   * @param {number} userId - User ID to check
   * @param {number} maxPerHour - Maximum rings per hour (default 3)
   * @param {number} cooldownMinutes - Cooldown between rings (default 10)
   * @returns {Promise<Object>} { canSend: boolean, reason: string, nextAvailable: Date }
   */
  static async checkRateLimit(userId, maxPerHour = 3, cooldownMinutes = 10) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check cooldown (last request must be >10 minutes ago)
      const cooldownCheck = await client.query(
        `SELECT last_request_at 
         FROM ring_request_rate_limit 
         WHERE user_id = $1 
           AND last_request_at > NOW() - ($2 || ' minutes')::INTERVAL`,
        [userId, cooldownMinutes]
      );

      if (cooldownCheck.rows.length > 0) {
        const nextAvailable = new Date(cooldownCheck.rows[0].last_request_at);
        nextAvailable.setMinutes(nextAvailable.getMinutes() + cooldownMinutes);
        await client.query('COMMIT');
        return {
          canSend: false,
          reason: 'cooldown',
          nextAvailable,
          message: `Please wait ${cooldownMinutes} minutes between ring requests`
        };
      }

      // Check hourly limit (max 3 per hour)
      const hourlyCheck = await client.query(
        `SELECT request_count, window_start 
         FROM ring_request_rate_limit 
         WHERE user_id = $1 
           AND window_start > NOW() - INTERVAL '1 hour'`,
        [userId]
      );

      if (hourlyCheck.rows.length > 0) {
        const { request_count, window_start } = hourlyCheck.rows[0];
        if (request_count >= maxPerHour) {
          const nextAvailable = new Date(window_start);
          nextAvailable.setHours(nextAvailable.getHours() + 1);
          await client.query('COMMIT');
          return {
            canSend: false,
            reason: 'hourly_limit',
            nextAvailable,
            message: `Maximum ${maxPerHour} ring requests per hour. Try again later.`
          };
        }
      }

      await client.query('COMMIT');
      return { canSend: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record a ring request for rate limiting
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  static async recordRequest(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if there's a record in current hour window
      const existing = await client.query(
        `SELECT id, request_count 
         FROM ring_request_rate_limit 
         WHERE user_id = $1 
           AND window_start > NOW() - INTERVAL '1 hour'`,
        [userId]
      );

      if (existing.rows.length > 0) {
        // Update existing record
        await client.query(
          `UPDATE ring_request_rate_limit 
           SET request_count = request_count + 1,
               last_request_at = NOW()
           WHERE id = $1`,
          [existing.rows[0].id]
        );
      } else {
        // Create new record
        await client.query(
          `INSERT INTO ring_request_rate_limit 
           (user_id, request_count, window_start, last_request_at) 
           VALUES ($1, 1, NOW(), NOW())`,
          [userId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get metrics for a technician's responsiveness
   * @param {number} techId - Technician user ID
   * @returns {Promise<Object>} Metrics including acceptance rate, avg response time
   */
  static async getMetrics(techId) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status != 'pending') as total_requests,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
        COUNT(*) FILTER (WHERE status = 'declined') as declined_count,
        COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count,
        ROUND(AVG(response_time_seconds) FILTER (WHERE status != 'pending')) as avg_response_seconds,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'accepted')::DECIMAL / 
           NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0)) * 100
        ) as acceptance_rate_percent
       FROM ring_requests 
       WHERE target_tech_id = $1`,
      [techId]
    );
    
    return result.rows[0] || {
      total_requests: 0,
      accepted_count: 0,
      declined_count: 0,
      timeout_count: 0,
      avg_response_seconds: null,
      acceptance_rate_percent: null
    };
  }

  /**
   * Check if target technician is available (not in DND mode)
   * @param {number} techId - Technician user ID
   * @returns {Promise<boolean>} True if available, false if in DND
   */
  static async isAvailable(techId) {
    const result = await pool.query(
      `SELECT dnd_enabled, dnd_until 
       FROM users 
       WHERE id = $1`,
      [techId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Technician not found');
    }
    
    const { dnd_enabled, dnd_until } = result.rows[0];
    
    // Check if DND is enabled and still active
    if (dnd_enabled && dnd_until && new Date(dnd_until) > new Date()) {
      return false;
    }
    
    return true;
  }

  /**
   * Get recent ring requests for a ticket
   * @param {number} ticketId - Ticket ID
   * @param {number} hours - Look back this many hours (default 24)
   * @returns {Promise<Array>} Array of ring requests for the ticket
   */
  static async getByTicketId(ticketId, hours = 24) {
    const result = await pool.query(
      `SELECT 
        rr.*,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        target.first_name as target_first_name,
        target.last_name as target_last_name
       FROM ring_requests rr
       JOIN users requester ON rr.requesting_tech_id = requester.id
       JOIN users target ON rr.target_tech_id = target.id
       WHERE rr.ticket_id = $1 
         AND rr.created_at > NOW() - ($2 || ' hours')::INTERVAL
       ORDER BY rr.created_at DESC`,
      [ticketId, hours]
    );
    
    return result.rows;
  }
}

export default RingRequest;
