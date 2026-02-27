// src/models/UserThemePreference.js
import pool from '../config/database.js';

const DEFAULT_CUSTOM_SLOTS = {
  accent:      '#2563eb',
  pageBg:      '#030712',
  cardBg:      '#1f2937',
  sidebarBg:   '#111827',
  textColor:   '#ffffff',
  borderColor: '#374151',
};

class UserThemePreference {
  /**
   * Get a user's theme preferences (creates default row if none exists)
   */
  static async getByUserId(userId) {
    const result = await pool.query(
      `SELECT * FROM user_theme_preferences WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length > 0) return result.rows[0];

    // Create default preferences for the user
    const insert = await pool.query(
      `INSERT INTO user_theme_preferences (user_id, theme, accent, custom_override, custom_slots, saved_themes)
       VALUES ($1, 'dark', 'blue', false, $2, '[]')
       RETURNING *`,
      [userId, JSON.stringify(DEFAULT_CUSTOM_SLOTS)]
    );
    return insert.rows[0];
  }

  /**
   * Update a user's active theme preferences
   */
  static async update(userId, { theme, accent, customOverride, customSlots }) {
    const result = await pool.query(
      `INSERT INTO user_theme_preferences (user_id, theme, accent, custom_override, custom_slots, saved_themes)
       VALUES ($1, $2, $3, $4, $5, '[]')
       ON CONFLICT (user_id) DO UPDATE SET
         theme = EXCLUDED.theme,
         accent = EXCLUDED.accent,
         custom_override = EXCLUDED.custom_override,
         custom_slots = EXCLUDED.custom_slots
       RETURNING *`,
      [userId, theme, accent, customOverride, JSON.stringify(customSlots)]
    );
    return result.rows[0];
  }

  /**
   * Save a named theme (add to saved_themes array)
   */
  static async saveTheme(userId, themeName, themeData) {
    // Ensure user has a row first
    await this.getByUserId(userId);

    // Add the theme to the saved_themes JSONB array
    const result = await pool.query(
      `UPDATE user_theme_preferences
       SET saved_themes = COALESCE(saved_themes, '[]'::jsonb) || $2::jsonb
       WHERE user_id = $1
       RETURNING *`,
      [userId, JSON.stringify([{ id: Date.now(), name: themeName, ...themeData, created_at: new Date().toISOString() }])]
    );
    return result.rows[0];
  }

  /**
   * Delete a saved theme by its id
   */
  static async deleteSavedTheme(userId, themeId) {
    // Remove the theme with matching id from saved_themes array
    const result = await pool.query(
      `UPDATE user_theme_preferences
       SET saved_themes = (
         SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(saved_themes, '[]'::jsonb)) AS elem
         WHERE (elem->>'id')::bigint != $2
       )
       WHERE user_id = $1
       RETURNING *`,
      [userId, themeId]
    );
    return result.rows[0];
  }

  /**
   * Rename a saved theme
   */
  static async renameSavedTheme(userId, themeId, newName) {
    const pref = await this.getByUserId(userId);
    const themes = pref.saved_themes || [];
    const updated = themes.map(t =>
      (String(t.id) === String(themeId)) ? { ...t, name: newName } : t
    );
    const result = await pool.query(
      `UPDATE user_theme_preferences SET saved_themes = $2 WHERE user_id = $1 RETURNING *`,
      [userId, JSON.stringify(updated)]
    );
    return result.rows[0];
  }
}

export default UserThemePreference;
