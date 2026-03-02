// src/controllers/themeController.js
import UserThemePreference from '../models/UserThemePreference.js';

/**
 * Get the authenticated user's theme preferences
 * GET /api/themes
 */
export const getThemePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const pref = await UserThemePreference.getByUserId(userId);

    res.json({
      status: 'success',
      data: {
        theme: pref.theme,
        accent: pref.accent,
        customOverride: pref.custom_override,
        customSlots: pref.custom_slots,
        savedThemes: pref.saved_themes || [],
      },
    });
  } catch (error) {
    console.error('Error fetching theme preferences:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch theme preferences' });
  }
};

/**
 * Update the authenticated user's active theme preferences
 * PUT /api/themes
 */
export const updateThemePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { theme, accent, customOverride, customSlots } = req.body;

    // Validation
    if (theme && !['dark', 'light'].includes(theme)) {
      return res.status(400).json({ status: 'error', message: 'theme must be "dark" or "light"' });
    }
    if (accent && !['blue', 'green', 'purple', 'highcontrast', 'custom'].includes(accent)) {
      return res.status(400).json({ status: 'error', message: 'Invalid accent value' });
    }

    // Merge with existing to allow partial updates
    const existing = await UserThemePreference.getByUserId(userId);
    const pref = await UserThemePreference.update(userId, {
      theme: theme ?? existing.theme,
      accent: accent ?? existing.accent,
      customOverride: customOverride ?? existing.custom_override,
      customSlots: customSlots ?? existing.custom_slots,
    });

    res.json({
      status: 'success',
      message: 'Theme preferences updated',
      data: {
        theme: pref.theme,
        accent: pref.accent,
        customOverride: pref.custom_override,
        customSlots: pref.custom_slots,
        savedThemes: pref.saved_themes || [],
      },
    });
  } catch (error) {
    console.error('Error updating theme preferences:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update theme preferences' });
  }
};

/**
 * Save a named custom theme
 * POST /api/themes/saved
 */
export const saveTheme = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, theme, accent, customOverride, customSlots } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Theme name is required' });
    }
    if (name.length > 50) {
      return res.status(400).json({ status: 'error', message: 'Theme name must be 50 characters or less' });
    }

    const pref = await UserThemePreference.saveTheme(userId, name.trim(), {
      theme, accent, customOverride, customSlots,
    });

    res.status(201).json({
      status: 'success',
      message: 'Theme saved',
      data: { savedThemes: pref.saved_themes || [] },
    });
  } catch (error) {
    console.error('Error saving theme:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save theme' });
  }
};

/**
 * Delete a saved theme
 * DELETE /api/themes/saved/:id
 */
export const deleteSavedTheme = async (req, res) => {
  try {
    const userId = req.user.id;
    const themeId = parseInt(req.params.id);

    if (isNaN(themeId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid theme ID' });
    }

    const pref = await UserThemePreference.deleteSavedTheme(userId, themeId);
    if (!pref) {
      return res.status(404).json({ status: 'error', message: 'Theme not found' });
    }

    res.json({
      status: 'success',
      message: 'Saved theme deleted',
      data: { savedThemes: pref.saved_themes || [] },
    });
  } catch (error) {
    console.error('Error deleting saved theme:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete saved theme' });
  }
};

/**
 * Rename a saved theme
 * PATCH /api/themes/saved/:id
 */
export const renameSavedTheme = async (req, res) => {
  try {
    const userId = req.user.id;
    const themeId = parseInt(req.params.id);
    const { name } = req.body;

    if (isNaN(themeId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid theme ID' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const pref = await UserThemePreference.renameSavedTheme(userId, themeId, name.trim());

    res.json({
      status: 'success',
      message: 'Saved theme renamed',
      data: { savedThemes: pref.saved_themes || [] },
    });
  } catch (error) {
    console.error('Error renaming saved theme:', error);
    res.status(500).json({ status: 'error', message: 'Failed to rename saved theme' });
  }
};
