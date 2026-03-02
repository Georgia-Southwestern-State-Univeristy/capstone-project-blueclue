// src/controllers/dashboardLayoutController.js
import DashboardLayout from '../models/DashboardLayout.js';

// ─── Active Layout ───────────────────────────────────────────────

/**
 * GET /api/dashboard-layouts
 * Query: ?type=management
 */
export const getActiveLayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardType = req.query.type || 'management';

    const layout = await DashboardLayout.getActiveLayout(userId, dashboardType);

    if (!layout) {
      return res.json({ layout: null });
    }

    res.json({
      layout: {
        id: layout.id,
        layoutData: layout.layout_data,
        hiddenWidgets: layout.hidden_widgets,
        layoutVersion: layout.layout_version,
        updatedAt: layout.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching active layout:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard layout' });
  }
};

/**
 * PUT /api/dashboard-layouts
 * Body: { type, layoutData, hiddenWidgets, layoutVersion }
 */
export const saveActiveLayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'management', layoutData, hiddenWidgets = [], layoutVersion = 1 } = req.body;

    if (!layoutData) {
      return res.status(400).json({ error: 'layoutData is required' });
    }

    const saved = await DashboardLayout.upsertActiveLayout(
      userId, type, layoutData, hiddenWidgets, layoutVersion
    );

    res.json({
      layout: {
        id: saved.id,
        layoutData: saved.layout_data,
        hiddenWidgets: saved.hidden_widgets,
        layoutVersion: saved.layout_version,
        updatedAt: saved.updated_at
      }
    });
  } catch (error) {
    console.error('Error saving active layout:', error);
    res.status(500).json({ error: 'Failed to save dashboard layout' });
  }
};

/**
 * DELETE /api/dashboard-layouts
 * Query: ?type=management
 */
export const deleteActiveLayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardType = req.query.type || 'management';

    const deleted = await DashboardLayout.deleteActiveLayout(userId, dashboardType);

    res.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting active layout:', error);
    res.status(500).json({ error: 'Failed to delete dashboard layout' });
  }
};

// ─── Saved / Named Layouts ───────────────────────────────────────

/**
 * GET /api/dashboard-layouts/saved
 * Query: ?type=management
 */
export const getSavedLayouts = async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardType = req.query.type || 'management';

    const rows = await DashboardLayout.getSavedLayouts(userId, dashboardType);

    const layouts = rows.map(r => ({
      id: r.id,
      name: r.name,
      layoutData: r.layout_data,
      hiddenWidgets: r.hidden_widgets,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json({ layouts });
  } catch (error) {
    console.error('Error fetching saved layouts:', error);
    res.status(500).json({ error: 'Failed to fetch saved layouts' });
  }
};

/**
 * POST /api/dashboard-layouts/saved
 * Body: { type, name, layoutData, hiddenWidgets }
 */
export const createSavedLayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'management', name, layoutData, hiddenWidgets = [] } = req.body;

    if (!name || !layoutData) {
      return res.status(400).json({ error: 'name and layoutData are required' });
    }

    const saved = await DashboardLayout.createSavedLayout(
      userId, type, name, layoutData, hiddenWidgets
    );

    res.status(201).json({
      layout: {
        id: saved.id,
        name: saved.name,
        layoutData: saved.layout_data,
        hiddenWidgets: saved.hidden_widgets,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating saved layout:', error);
    res.status(500).json({ error: 'Failed to create saved layout' });
  }
};

/**
 * PATCH /api/dashboard-layouts/saved/:id
 * Body: { name }
 */
export const renameSavedLayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const layoutId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const updated = await DashboardLayout.renameSavedLayout(layoutId, userId, name);

    if (!updated) {
      return res.status(404).json({ error: 'Layout not found or access denied' });
    }

    res.json({ layout: updated });
  } catch (error) {
    console.error('Error renaming saved layout:', error);
    res.status(500).json({ error: 'Failed to rename saved layout' });
  }
};

/**
 * DELETE /api/dashboard-layouts/saved/:id
 */
export const deleteSavedLayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const layoutId = parseInt(req.params.id, 10);

    const deleted = await DashboardLayout.deleteSavedLayout(layoutId, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Layout not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved layout:', error);
    res.status(500).json({ error: 'Failed to delete saved layout' });
  }
};
