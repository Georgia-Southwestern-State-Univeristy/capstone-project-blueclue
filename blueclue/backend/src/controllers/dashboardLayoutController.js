// src/controllers/dashboardLayoutController.js
import DashboardLayout from '../models/DashboardLayout.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { validateLayoutWidgets } from './widgetController.js';

// ─── Active Layout ───────────────────────────────────────────────

/**
 * GET /api/dashboard-layouts
 * Query: ?type=management
 */
export const getActiveLayout = async (req, res) => {
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
};

/**
 * PUT /api/dashboard-layouts
 * Body: { type, layoutData, hiddenWidgets, layoutVersion }
 */
export const saveActiveLayout = async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { type = 'management', layoutData, hiddenWidgets = [], layoutVersion = 1 } = req.body;

    if (!layoutData) {
      throw new BadRequestError('layoutData is required');
    }

    // Validate that user has access to all widgets in the layout
    const { valid, deniedWidgets } = validateLayoutWidgets(layoutData, userRole);
    if (!valid) {
      throw new ForbiddenError(
        `Your role (${userRole}) does not have access to these widgets: ${deniedWidgets.join(', ')}`
      );
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
};

/**
 * DELETE /api/dashboard-layouts
 * Query: ?type=management
 */
export const deleteActiveLayout = async (req, res) => {
    const userId = req.user.id;
    const dashboardType = req.query.type || 'management';

    const deleted = await DashboardLayout.deleteActiveLayout(userId, dashboardType);

    res.json({ success: deleted });
};

// ─── Saved / Named Layouts ───────────────────────────────────────

/**
 * GET /api/dashboard-layouts/saved
 * Query: ?type=management
 */
export const getSavedLayouts = async (req, res) => {
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
};

/**
 * POST /api/dashboard-layouts/saved
 * Body: { type, name, layoutData, hiddenWidgets }
 */
export const createSavedLayout = async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { type = 'management', name, layoutData, hiddenWidgets = [] } = req.body;

    if (!name || !layoutData) {
      throw new BadRequestError('name and layoutData are required');
    }

    // Validate that user has access to all widgets in the layout
    const { valid, deniedWidgets } = validateLayoutWidgets(layoutData, userRole);
    if (!valid) {
      throw new ForbiddenError(
        `Your role (${userRole}) does not have access to these widgets: ${deniedWidgets.join(', ')}`
      );
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
};

/**
 * PATCH /api/dashboard-layouts/saved/:id
 * Body: { name }
 */
export const renameSavedLayout = async (req, res) => {
    const userId = req.user.id;
    const layoutId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (!name) {
      throw new BadRequestError('name is required');
    }

    const updated = await DashboardLayout.renameSavedLayout(layoutId, userId, name);

    if (!updated) {
      throw new NotFoundError('Layout not found or access denied');
    }

    res.json({ layout: updated });
};

/**
 * DELETE /api/dashboard-layouts/saved/:id
 */
export const deleteSavedLayout = async (req, res) => {
    const userId = req.user.id;
    const layoutId = parseInt(req.params.id, 10);

    const deleted = await DashboardLayout.deleteSavedLayout(layoutId, userId);

    if (!deleted) {
      throw new NotFoundError('Layout not found or access denied');
    }

    res.json({ success: true });
};
