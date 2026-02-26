import pool from '../config/database.js';

/**
 * UpdateRequest Model
 * Manages formal status update requests from management to technicians
 */
class UpdateRequest {
  /**
   * Create a new update request
   * @param {number} ticketId - Ticket ID
   * @param {number} requestedBy - Manager requesting the update
   * @param {number} assignedTo - Technician to provide update
   * @param {string} message - Optional question/request message
   * @param {Date} deadline - When the update is due
   * @returns {Promise<Object>} Created update request
   */
  static async create(ticketId, requestedBy, assignedTo, message, deadline) {
    const result = await pool.query(
      `INSERT INTO ticket_update_requests 
       (ticket_id, requested_by, assigned_to, message, deadline) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [ticketId, requestedBy, assignedTo, message, deadline]
    );
    
    return result.rows[0];
  }

  /**
   * Get an update request by ID with full details
   * @param {number} id - Update request ID
   * @returns {Promise<Object|null>} Update request with user and ticket details
   */
  static async getById(id) {
    const result = await pool.query(
      `SELECT 
        ur.*,
        t.subject as ticket_subject,
        t.status as ticket_status,
        t.priority as ticket_priority,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.email as requester_email,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assignee.email as assignee_email,
        fulfiller.first_name as fulfiller_first_name,
        fulfiller.last_name as fulfiller_last_name
       FROM ticket_update_requests ur
       JOIN tickets t ON ur.ticket_id = t.id
       JOIN users requester ON ur.requested_by = requester.id
       JOIN users assignee ON ur.assigned_to = assignee.id
       LEFT JOIN users fulfiller ON ur.fulfilled_by = fulfiller.id
       WHERE ur.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Get all pending update requests for a technician
   * @param {number} techId - Technician user ID
   * @returns {Promise<Array>} Array of pending update requests
   */
  static async getPendingForTech(techId) {
    const result = await pool.query(
      `SELECT 
        ur.*,
        t.subject as ticket_subject,
        t.status as ticket_status,
        t.priority as ticket_priority,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.email as requester_email,
        EXTRACT(EPOCH FROM (ur.deadline - CURRENT_TIMESTAMP))/3600 as hours_remaining,
        CASE 
          WHEN ur.deadline < CURRENT_TIMESTAMP THEN 'overdue'
          WHEN ur.deadline < CURRENT_TIMESTAMP + INTERVAL '1 hour' THEN 'urgent'
          ELSE 'normal'
        END as urgency
       FROM ticket_update_requests ur
       JOIN tickets t ON ur.ticket_id = t.id
       JOIN users requester ON ur.requested_by = requester.id
       WHERE ur.assigned_to = $1 
         AND ur.status = 'pending'
       ORDER BY ur.deadline ASC`,
      [techId]
    );
    
    return result.rows;
  }

  /**
   * Get all update requests for a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<Array>} Array of update requests for the ticket
   */
  static async getByTicketId(ticketId) {
    const result = await pool.query(
      `SELECT 
        ur.*,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        fulfiller.first_name as fulfiller_first_name,
        fulfiller.last_name as fulfiller_last_name
       FROM ticket_update_requests ur
       JOIN users requester ON ur.requested_by = requester.id
       JOIN users assignee ON ur.assigned_to = assignee.id
       LEFT JOIN users fulfiller ON ur.fulfilled_by = fulfiller.id
       WHERE ur.ticket_id = $1
       ORDER BY ur.created_at DESC`,
      [ticketId]
    );
    
    return result.rows;
  }

  /**
   * Fulfill an update request
   * @param {number} id - Update request ID
   * @param {number} fulfilledBy - User ID submitting the update
   * @param {Object} response - Response details
   * @returns {Promise<Object>} Updated request
   */
  static async fulfill(id, fulfilledBy, response) {
    const {
      responseText,
      isResolved,
      needsMoreTime,
      isBlocked,
      blockerDescription,
      estimatedCompletion
    } = response;

    const result = await pool.query(
      `UPDATE ticket_update_requests 
       SET status = 'fulfilled',
           fulfilled_at = CURRENT_TIMESTAMP,
           fulfilled_by = $2,
           response_text = $3,
           is_resolved = $4,
           needs_more_time = $5,
           is_blocked = $6,
           blocker_description = $7,
           estimated_completion = $8,
           response_time_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
       WHERE id = $1
       RETURNING *`,
      [id, fulfilledBy, responseText, isResolved, needsMoreTime, isBlocked, 
       blockerDescription, estimatedCompletion]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Update request not found');
    }
    
    return result.rows[0];
  }

  /**
   * Request deadline extension
   * @param {number} id - Update request ID
   * @param {Date} newDeadline - Requested new deadline
   * @returns {Promise<Object>} Updated request
   */
  static async requestExtension(id, newDeadline) {
    const result = await pool.query(
      `UPDATE ticket_update_requests 
       SET extension_requested = TRUE,
           extension_deadline = $2
       WHERE id = $1
       RETURNING *`,
      [id, newDeadline]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Update request not found');
    }
    
    return result.rows[0];
  }

  /**
   * Approve or deny extension request
   * @param {number} id - Update request ID
   * @param {boolean} approved - Whether extension is approved
   * @returns {Promise<Object>} Updated request
   */
  static async handleExtension(id, approved) {
    const result = await pool.query(
      `UPDATE ticket_update_requests 
       SET extension_approved = $2,
           deadline = CASE 
             WHEN $2 = TRUE THEN extension_deadline 
             ELSE deadline 
           END
       WHERE id = $1
       RETURNING *`,
      [id, approved]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Update request not found');
    }
    
    return result.rows[0];
  }

  /**
   * Mark request as reminded
   * @param {number} id - Update request ID
   * @returns {Promise<Object>} Updated request
   */
  static async markReminded(id) {
    const result = await pool.query(
      `UPDATE ticket_update_requests 
       SET reminded_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    return result.rows[0];
  }

  /**
   * Mark overdue requests as overdue status
   * @returns {Promise<Array>} Newly marked overdue requests
   */
  static async markOverdueRequests() {
    const result = await pool.query(
      `UPDATE ticket_update_requests 
       SET status = 'overdue'
       WHERE status = 'pending' 
         AND deadline < CURRENT_TIMESTAMP
       RETURNING *`
    );
    
    return result.rows;
  }

  /**
   * Get requests needing reminder (50% of deadline elapsed, not yet reminded)
   * @returns {Promise<Array>} Requests needing reminder
   */
  static async getRequestsNeedingReminder() {
    const result = await pool.query(
      `SELECT 
        ur.*,
        t.subject as ticket_subject,
        assignee.email as assignee_email,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
       FROM ticket_update_requests ur
       JOIN tickets t ON ur.ticket_id = t.id
       JOIN users assignee ON ur.assigned_to = assignee.id
       WHERE ur.status = 'pending'
         AND ur.reminded_at IS NULL
         AND CURRENT_TIMESTAMP > (ur.created_at + (ur.deadline - ur.created_at) * 0.5)`
    );
    
    return result.rows;
  }

  /**
   * Mark update request as reminded
   * @param {number} id - Update request ID
   * @returns {Promise<void>}
   */
  static async markAsReminded(id) {
    await pool.query(
      `UPDATE ticket_update_requests 
       SET reminded_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Cancel an update request
   * @param {number} id - Update request ID
   * @returns {Promise<Object>} Updated request
   */
  static async cancel(id) {
    const result = await pool.query(
      `UPDATE ticket_update_requests 
       SET status = 'cancelled'
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Update request not found or already fulfilled');
    }
    
    return result.rows[0];
  }

  /**
   * Get overdue requests
   * @returns {Promise<Array>} Overdue requests with details
   */
  static async getOverdueRequests() {
    const result = await pool.query(
      `SELECT * FROM overdue_update_requests 
       ORDER BY hours_overdue DESC`
    );
    
    return result.rows;
  }

  /**
   * Get statistics for a technician
   * @param {number} techId - Technician user ID
   * @param {number} days - Number of days to look back (default 30)
   * @returns {Promise<Object>} Statistics
   */
  static async getTechStats(techId, days = 30) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'fulfilled' THEN 1 END) as fulfilled_count,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
        AVG(EXTRACT(EPOCH FROM (fulfilled_at - created_at))/3600) as avg_response_hours,
        AVG(CASE 
          WHEN status = 'fulfilled' AND fulfilled_at <= deadline 
          THEN EXTRACT(EPOCH FROM (deadline - fulfilled_at))/3600 
        END) as avg_time_before_deadline
       FROM ticket_update_requests
       WHERE assigned_to = $1 
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '${days} days'`,
      [techId]
    );
    
    return result.rows[0];
  }

  /**
   * Get all pending requests (for management overview)
   * @returns {Promise<Array>} All pending requests
   */
  static async getAllPending() {
    const result = await pool.query(
      `SELECT * FROM pending_update_requests 
       ORDER BY deadline ASC`
    );
    
    return result.rows;
  }

  /**
   * Get average response time analytics per technician
   * @param {number} days - Number of days to analyze (default 30)
   * @returns {Promise<Array>} Response time statistics by technician
   */
  static async getResponseTimeAnalytics(days = 30) {
    const result = await pool.query(
      `SELECT 
         u.id as tech_id,
         u.first_name,
         u.last_name,
         u.email,
         COUNT(ur.id) as total_responses,
         ROUND(AVG(ur.response_time_seconds)) as avg_response_time_seconds,
         ROUND(AVG(ur.response_time_seconds) / 3600, 1) as avg_response_time_hours,
         MIN(ur.response_time_seconds) as min_response_time_seconds,
         MAX(ur.response_time_seconds) as max_response_time_seconds,
         COUNT(CASE WHEN ur.response_time_seconds <= 3600 THEN 1 END) as responses_within_1hr,
         COUNT(CASE WHEN ur.response_time_seconds <= 14400 THEN 1 END) as responses_within_4hrs,
         COUNT(CASE WHEN ur.response_time_seconds <= 28800 THEN 1 END) as responses_within_8hrs
       FROM ticket_update_requests ur
       JOIN users u ON u.id = ur.fulfilled_by
       WHERE ur.status = 'fulfilled'
         AND ur.response_time_seconds IS NOT NULL
         AND ur.fulfilled_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
       GROUP BY u.id, u.first_name, u.last_name, u.email
       ORDER BY avg_response_time_seconds ASC`,
      [days]
    );
    
    return result.rows;
  }
}

export default UpdateRequest;
