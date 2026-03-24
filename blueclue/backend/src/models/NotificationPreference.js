// src/models/NotificationPreference.js
import pool from '../config/database.js';

const DEFAULTS = {
  browser_notifications: true,
  email_notifications: true,
  type_assignment: true,
  type_overdue: true,
  type_update_request: true,
  type_mention: true,
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
          type_assignment, type_overdue, type_update_request, type_mention, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         browser_notifications = EXCLUDED.browser_notifications,
         email_notifications   = EXCLUDED.email_notifications,
         type_assignment       = EXCLUDED.type_assignment,
         type_overdue          = EXCLUDED.type_overdue,
         type_update_request   = EXCLUDED.type_update_request,
         type_mention          = EXCLUDED.type_mention,
         updated_at            = NOW()
       RETURNING *`,
      [
        userId,
        prefs.browserNotifications ?? DEFAULTS.browser_notifications,
        prefs.emailNotifications ?? DEFAULTS.email_notifications,
        prefs.types?.assignment ?? DEFAULTS.type_assignment,
        prefs.types?.overdue ?? DEFAULTS.type_overdue,
        prefs.types?.update_request ?? DEFAULTS.type_update_request,
        prefs.types?.mention ?? DEFAULTS.type_mention,
      ]
    );
    return this.#toApiFormat(result.rows[0]);
  }

  /** Map DB row to API shape used by frontend */
  static #toApiFormat(row) {
    return {
      browserNotifications: row.browser_notifications,
      emailNotifications: row.email_notifications,
      types: {
        assignment: row.type_assignment,
        overdue: row.type_overdue,
        update_request: row.type_update_request,
        mention: row.type_mention,
      },
    };
  }
}

export default NotificationPreference;
