import pool from '../config/database.js';

/**
 * TicketCollaborator Model
 * Manages multi-technician collaboration on tickets
 */
class TicketCollaborator {
  /**
   * Add a collaborator to a ticket
   * @param {number} ticketId - Ticket ID
   * @param {number} userId - User ID to add as collaborator
   * @param {string} role - Role: 'primary' or 'assisting'
   * @param {number} addedBy - User ID who is adding the collaborator
   * @param {string} note - Optional note explaining why collaboration is needed
   * @returns {Promise<Object>} Created collaborator record
   */
  static async add(ticketId, userId, role, addedBy, note = null) {
    try {
      const result = await pool.query(
        `INSERT INTO ticket_collaborators 
         (ticket_id, user_id, role, added_by, note) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [ticketId, userId, role, addedBy, note]
      );
      
      return result.rows[0];
    } catch (error) {
      // Handle constraint violations
      if (error.code === '23505') { // Unique violation
        throw new Error('This technician is already assigned to this ticket');
      }
      if (error.message.includes('Maximum 5 technicians')) {
        throw new Error('Maximum 5 technicians allowed per ticket');
      }
      if (error.message.includes('Only one primary')) {
        throw new Error('Only one primary technician allowed per ticket');
      }
      throw error;
    }
  }

  /**
   * Remove a collaborator from a ticket
   * @param {number} ticketId - Ticket ID
   * @param {number} userId - User ID to remove
   * @returns {Promise<Object>} Removed collaborator record
   */
  static async remove(ticketId, userId) {
    const result = await pool.query(
      `DELETE FROM ticket_collaborators 
       WHERE ticket_id = $1 AND user_id = $2 
       RETURNING *`,
      [ticketId, userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Collaborator not found');
    }
    
    return result.rows[0];
  }

  /**
   * Get all collaborators for a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<Array>} Array of collaborators with user details
   */
  static async getByTicketId(ticketId) {
    const result = await pool.query(
      `SELECT 
        tc.*,
        u.email, u.username, u.first_name, u.last_name, u.role as user_role,
        added_by_user.first_name as added_by_first_name,
        added_by_user.last_name as added_by_last_name
       FROM ticket_collaborators tc
       JOIN users u ON tc.user_id = u.id
       LEFT JOIN users added_by_user ON tc.added_by = added_by_user.id
       WHERE tc.ticket_id = $1
       ORDER BY 
         CASE WHEN tc.role = 'primary' THEN 0 ELSE 1 END,
         tc.added_at ASC`,
      [ticketId]
    );
    
    return result.rows;
  }

  /**
   * Get all tickets a user is collaborating on
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of ticket IDs and roles
   */
  static async getByUserId(userId) {
    const result = await pool.query(
      `SELECT tc.*, t.title, t.status, t.priority, t.category
       FROM ticket_collaborators tc
       JOIN tickets t ON tc.ticket_id = t.id
       WHERE tc.user_id = $1
       ORDER BY tc.added_at DESC`,
      [userId]
    );
    
    return result.rows;
  }

  /**
   * Get the primary technician for a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<Object|null>} Primary collaborator or null
   */
  static async getPrimaryByTicketId(ticketId) {
    const result = await pool.query(
      `SELECT 
        tc.*,
        u.email, u.username, u.first_name, u.last_name, u.role as user_role
       FROM ticket_collaborators tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = $1 AND tc.role = 'primary'`,
      [ticketId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Transfer primary role to another technician
   * @param {number} ticketId - Ticket ID
   * @param {number} newPrimaryUserId - User ID of new primary tech
   * @param {number} transferredBy - User ID who initiated the transfer
   * @returns {Promise<Object>} Updated collaborator records
   */
  static async transferPrimary(ticketId, newPrimaryUserId, transferredBy) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if new primary is already a collaborator
      const existing = await client.query(
        `SELECT * FROM ticket_collaborators 
         WHERE ticket_id = $1 AND user_id = $2`,
        [ticketId, newPrimaryUserId]
      );
      
      // Demote current primary to assisting
      await client.query(
        `UPDATE ticket_collaborators 
         SET role = 'assisting' 
         WHERE ticket_id = $1 AND role = 'primary'`,
        [ticketId]
      );
      
      if (existing.rows.length > 0) {
        // Update existing collaborator to primary
        await client.query(
          `UPDATE ticket_collaborators 
           SET role = 'primary' 
           WHERE ticket_id = $1 AND user_id = $2`,
          [ticketId, newPrimaryUserId]
        );
      } else {
        // Add new collaborator as primary
        await client.query(
          `INSERT INTO ticket_collaborators 
           (ticket_id, user_id, role, added_by, note) 
           VALUES ($1, $2, 'primary', $3, 'Transferred primary assignment')`,
          [ticketId, newPrimaryUserId, transferredBy]
        );
      }
      
      await client.query('COMMIT');
      
      // Return updated collaborators
      return await this.getByTicketId(ticketId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if user is a collaborator on a ticket
   * @param {number} ticketId - Ticket ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Collaborator record or null
   */
  static async isCollaborator(ticketId, userId) {
    const result = await pool.query(
      `SELECT * FROM ticket_collaborators 
       WHERE ticket_id = $1 AND user_id = $2`,
      [ticketId, userId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Get collaborator count for a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<number>} Count of collaborators
   */
  static async getCountByTicketId(ticketId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM ticket_collaborators 
       WHERE ticket_id = $1`,
      [ticketId]
    );
    
    return parseInt(result.rows[0].count);
  }

  /**
   * Get workload for a technician (count of tickets they're collaborating on)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Workload statistics
   */
  static async getUserWorkload(userId) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN tc.role = 'primary' THEN 1 ELSE 0 END) as primary_count,
        SUM(CASE WHEN tc.role = 'assisting' THEN 1 ELSE 0 END) as assisting_count,
        SUM(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as active_tickets
       FROM ticket_collaborators tc
       JOIN tickets t ON tc.ticket_id = t.id
       WHERE tc.user_id = $1
       AND t.status NOT IN ('closed', 'resolved', 'cancelled')`,
      [userId]
    );
    
    return result.rows[0];
  }

  /**
   * Remove all collaborators from a ticket
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<number>} Number of collaborators removed
   */
  static async removeAllByTicketId(ticketId) {
    const result = await pool.query(
      `DELETE FROM ticket_collaborators WHERE ticket_id = $1`,
      [ticketId]
    );
    
    return result.rowCount;
  }
}

export default TicketCollaborator;
