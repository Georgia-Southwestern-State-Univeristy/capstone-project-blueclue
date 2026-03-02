// src/models/DashboardLayout.js
import pool from '../config/database.js';

class DashboardLayout {
  // ─── Active layout (auto-saved) ────────────────────────────────

  /**
   * Get the active layout for a user + dashboard type
   * @param {number} userId
   * @param {string} dashboardType - e.g. 'management', 'technician'
   * @returns {Promise<Object|null>}
   */
  static async getActiveLayout(userId, dashboardType = 'management') {
    const result = await pool.query(
      `SELECT id, layout_data, hidden_widgets, layout_version, updated_at
       FROM user_dashboard_layouts
       WHERE user_id = $1 AND dashboard_type = $2`,
      [userId, dashboardType]
    );
    return result.rows[0] || null;
  }

  /**
   * Upsert (save or update) the active layout
   * @param {number} userId
   * @param {string} dashboardType
   * @param {Object} layoutData - The responsive layout object { lg: [...], md: [...], ... }
   * @param {Array} hiddenWidgets - Array of hidden widget key strings
   * @param {number} layoutVersion
   * @returns {Promise<Object>}
   */
  static async upsertActiveLayout(userId, dashboardType, layoutData, hiddenWidgets = [], layoutVersion = 1) {
    const result = await pool.query(
      `INSERT INTO user_dashboard_layouts (user_id, dashboard_type, layout_data, hidden_widgets, layout_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, dashboard_type)
       DO UPDATE SET layout_data = EXCLUDED.layout_data,
                     hidden_widgets = EXCLUDED.hidden_widgets,
                     layout_version = EXCLUDED.layout_version
       RETURNING id, layout_data, hidden_widgets, layout_version, updated_at`,
      [userId, dashboardType, JSON.stringify(layoutData), JSON.stringify(hiddenWidgets), layoutVersion]
    );
    return result.rows[0];
  }

  /**
   * Delete the active layout (reset to default)
   * @param {number} userId
   * @param {string} dashboardType
   * @returns {Promise<boolean>}
   */
  static async deleteActiveLayout(userId, dashboardType = 'management') {
    const result = await pool.query(
      `DELETE FROM user_dashboard_layouts WHERE user_id = $1 AND dashboard_type = $2`,
      [userId, dashboardType]
    );
    return result.rowCount > 0;
  }

  // ─── Named saved layouts ───────────────────────────────────────

  /**
   * Get all saved layouts for a user + dashboard type
   * @param {number} userId
   * @param {string} dashboardType
   * @returns {Promise<Array>}
   */
  static async getSavedLayouts(userId, dashboardType = 'management') {
    const result = await pool.query(
      `SELECT id, name, layout_data, hidden_widgets, created_at, updated_at
       FROM user_saved_layouts
       WHERE user_id = $1 AND dashboard_type = $2
       ORDER BY created_at DESC`,
      [userId, dashboardType]
    );
    return result.rows;
  }

  /**
   * Create a new named saved layout
   * @param {number} userId
   * @param {string} dashboardType
   * @param {string} name
   * @param {Object} layoutData
   * @param {Array} hiddenWidgets
   * @returns {Promise<Object>}
   */
  static async createSavedLayout(userId, dashboardType, name, layoutData, hiddenWidgets = []) {
    const result = await pool.query(
      `INSERT INTO user_saved_layouts (user_id, dashboard_type, name, layout_data, hidden_widgets)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, layout_data, hidden_widgets, created_at, updated_at`,
      [userId, dashboardType, name, JSON.stringify(layoutData), JSON.stringify(hiddenWidgets)]
    );
    return result.rows[0];
  }

  /**
   * Rename a saved layout
   * @param {number} id - Saved layout row ID
   * @param {number} userId - Owner check
   * @param {string} newName
   * @returns {Promise<Object|null>}
   */
  static async renameSavedLayout(id, userId, newName) {
    const result = await pool.query(
      `UPDATE user_saved_layouts SET name = $1 WHERE id = $2 AND user_id = $3
       RETURNING id, name, updated_at`,
      [newName, id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a saved layout
   * @param {number} id - Saved layout row ID
   * @param {number} userId - Owner check
   * @returns {Promise<boolean>}
   */
  static async deleteSavedLayout(id, userId) {
    const result = await pool.query(
      `DELETE FROM user_saved_layouts WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rowCount > 0;
  }
}

export default DashboardLayout;
