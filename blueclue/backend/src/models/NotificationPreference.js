// src/models/NotificationPreference.js
import pool from '../config/database.js';

const DEFAULTS = {
  browser_notifications: true,
  email_notifications: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  type_assignment: true,
  type_overdue: true,
  type_update_request: true,
  type_mention: true,
  type_ticket_cancelled: true,
  type_ring_request: true,
  type_ring_response: true,
  type_update_fulfilled: true,
  type_update_overdue: true,
  type_chat_handoff: true,
  type_update_request_reminder: true,
};

class NotificationPreference {
  /**
   * Get preferences for a user (creates default row if none exists)
   */
  static async getByUserId(userId) {
    const result = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length > 0) return this.#toApiFormat(result.rows[0]);

    // Insert default row
    const insert = await pool.query(
      `INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
    return this.#toApiFormat(insert.rows[0]);
  }

  /**
   * Upsert preferences for a user
   */
  static async upsert(userId, prefs) {
    const result = await pool.query(
      `INSERT INTO notification_preferences
         (user_id, browser_notifications, email_notifications,
          quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
          type_assignment, type_overdue, type_update_request, type_mention,
          type_ticket_cancelled, type_ring_request, type_ring_response,
          type_update_fulfilled, type_update_overdue, type_chat_handoff,
          type_update_request_reminder, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         browser_notifications       = EXCLUDED.browser_notifications,
         email_notifications         = EXCLUDED.email_notifications,
         quiet_hours_enabled         = EXCLUDED.quiet_hours_enabled,
         quiet_hours_start           = EXCLUDED.quiet_hours_start,
         quiet_hours_end             = EXCLUDED.quiet_hours_end,
         type_assignment             = EXCLUDED.type_assignment,
         type_overdue                = EXCLUDED.type_overdue,
         type_update_request         = EXCLUDED.type_update_request,
         type_mention                = EXCLUDED.type_mention,
         type_ticket_cancelled       = EXCLUDED.type_ticket_cancelled,
         type_ring_request           = EXCLUDED.type_ring_request,
         type_ring_response          = EXCLUDED.type_ring_response,
         type_update_fulfilled       = EXCLUDED.type_update_fulfilled,
         type_update_overdue         = EXCLUDED.type_update_overdue,
         type_chat_handoff           = EXCLUDED.type_chat_handoff,
         type_update_request_reminder = EXCLUDED.type_update_request_reminder,
         updated_at                  = NOW()
       RETURNING *`,
      [
        userId,
        prefs.browserNotifications ?? DEFAULTS.browser_notifications,
        prefs.emailNotifications ?? DEFAULTS.email_notifications,
        prefs.quietHoursEnabled ?? DEFAULTS.quiet_hours_enabled,
        prefs.quietHoursStart ?? DEFAULTS.quiet_hours_start,
        prefs.quietHoursEnd ?? DEFAULTS.quiet_hours_end,
        prefs.types?.assignment ?? DEFAULTS.type_assignment,
        prefs.types?.overdue ?? DEFAULTS.type_overdue,
        prefs.types?.update_request ?? DEFAULTS.type_update_request,
        prefs.types?.mention ?? DEFAULTS.type_mention,
        prefs.types?.ticket_cancelled ?? DEFAULTS.type_ticket_cancelled,
        prefs.types?.ring_request ?? DEFAULTS.type_ring_request,
        prefs.types?.ring_response ?? DEFAULTS.type_ring_response,
        prefs.types?.update_fulfilled ?? DEFAULTS.type_update_fulfilled,
        prefs.types?.update_overdue ?? DEFAULTS.type_update_overdue,
        prefs.types?.chat_handoff ?? DEFAULTS.type_chat_handoff,
        prefs.types?.update_request_reminder ?? DEFAULTS.type_update_request_reminder,
      ]
    );
    return this.#toApiFormat(result.rows[0]);
  }

  /** Map DB row to API shape used by frontend */
  static #toApiFormat(row) {
    return {
      browserNotifications: row.browser_notifications,
      emailNotifications: row.email_notifications,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      types: {
        assignment: row.type_assignment,
        overdue: row.type_overdue,
        update_request: row.type_update_request,
        mention: row.type_mention,
        ticket_cancelled: row.type_ticket_cancelled,
        ring_request: row.type_ring_request,
        ring_response: row.type_ring_response,
        update_fulfilled: row.type_update_fulfilled,
        update_overdue: row.type_update_overdue,
        chat_handoff: row.type_chat_handoff,
        update_request_reminder: row.type_update_request_reminder,
      },
    };
  }
}

export default NotificationPreference;
