/**
 * Widget Library — public API
 *
 * Provides helper functions for querying the widget registry,
 * generating gallery items, building default layouts, and
 * filtering widgets by role/category/search.
 *
 * Usage:
 *   import { getWidgetsForRole, buildGalleryItems, buildDefaultLayouts } from '../widgets'
 */

import WIDGET_REGISTRY, { ROLES, ROLE_GROUPS, CATEGORIES } from './widgetRegistry'

// ── Re-exports ───────────────────────────────────────────────────────────────
export { WIDGET_REGISTRY, ROLES, ROLE_GROUPS, CATEGORIES }

// ── Lookup helpers ───────────────────────────────────────────────────────────

/** Get a single widget definition by key */
export function getWidget(key) {
  return WIDGET_REGISTRY.find(w => w.key === key) ?? null
}

/** Get all registered widget keys */
export function getAllWidgetKeys() {
  return WIDGET_REGISTRY.map(w => w.key)
}

// ── Filtering ────────────────────────────────────────────────────────────────

/**
 * Return widgets that a given role is permitted to see.
 * @param {string} role - One of ROLES.*
 * @param {Object} [options]
 * @param {string} [options.category] - Filter by CATEGORIES.*
 * @param {string} [options.search] - Free-text filter on name/description
 * @returns {Array} Filtered widget definitions
 */
export function getWidgetsForRole(role, { category, search } = {}) {
  let widgets = WIDGET_REGISTRY.filter(w => w.permissions.includes(role))
  if (category) {
    widgets = widgets.filter(w => w.category === category)
  }
  if (search) {
    const q = search.toLowerCase()
    widgets = widgets.filter(
      w => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
    )
  }
  return widgets
}

/**
 * Return widgets filtered by category.
 * @param {string} category - One of CATEGORIES.*
 */
export function getWidgetsByCategory(category) {
  return WIDGET_REGISTRY.filter(w => w.category === category)
}

// ── Gallery items ────────────────────────────────────────────────────────────

/**
 * Build the `galleryItems` array expected by WidgetGallery from the registry.
 * Optionally filters by role.
 *
 * @param {Object} [options]
 * @param {string} [options.role] - Only include widgets permitted for this role
 * @param {string[]} [options.keys] - Explicit list of widget keys to include
 * @returns {Array<{ key, label, description, defaultW, defaultH }>}
 */
export function buildGalleryItems({ role, keys } = {}) {
  let widgets = WIDGET_REGISTRY
  if (role) {
    widgets = widgets.filter(w => w.permissions.includes(role))
  }
  if (keys) {
    const keySet = new Set(keys)
    widgets = widgets.filter(w => keySet.has(w.key))
  }
  return widgets.map(w => ({
    key: w.key,
    label: w.name,
    description: w.description,
    defaultW: w.size.defaultW,
    defaultH: w.size.defaultH,
  }))
}

// ── Default layouts ──────────────────────────────────────────────────────────

/**
 * Build default grid layouts from the registry for a set of widget keys.
 *
 * Arranges widgets vertically in the order given, full-width where possible.
 * Override positions by passing a `positionOverrides` map.
 *
 * @param {string[]} widgetKeys - Ordered list of widget keys to include
 * @param {Object} [options]
 * @param {Object} [options.positionOverrides] - Map of key → { x, y, w, h } per breakpoint
 * @param {{ lg: number, md: number, sm: number }} [options.cols] - Column counts per breakpoint
 * @returns {{ lg: Array, md: Array, sm: Array }}
 */
export function buildDefaultLayouts(widgetKeys, { positionOverrides = {}, cols = { lg: 12, md: 12, sm: 6 } } = {}) {
  const layouts = { lg: [], md: [], sm: [] }

  for (const bp of Object.keys(layouts)) {
    const maxCols = cols[bp] || 12
    let cursorY = 0

    for (const key of widgetKeys) {
      const widget = getWidget(key)
      if (!widget) continue

      const override = positionOverrides[key]?.[bp]
      const w = Math.min(override?.w ?? widget.size.defaultW, maxCols)
      const h = override?.h ?? widget.size.defaultH
      const x = override?.x ?? 0
      const y = override?.y ?? cursorY

      layouts[bp].push({
        i: key,
        x, y, w, h,
        minW: Math.min(widget.size.minW, maxCols),
        minH: widget.size.minH,
        maxW: Math.min(widget.size.maxW, maxCols),
        maxH: widget.size.maxH,
      })

      cursorY = y + h
    }
  }

  return layouts
}

// ── Widget config builder ────────────────────────────────────────────────────

/**
 * Build the `widgetConfig` array expected by DashboardGrid.
 *
 * Each entry: { key, label, component }
 * The `componentMap` argument maps widget keys to already-rendered JSX.
 * This keeps the registry decoupled from specific prop-passing logic
 * that lives in each dashboard page.
 *
 * @param {string[]} widgetKeys - Keys to include (order preserved)
 * @param {Object<string, React.ReactNode>} componentMap - key → <Component ...props />
 * @returns {Array<{ key: string, label: string, component: React.ReactNode }>}
 */
export function buildWidgetConfig(widgetKeys, componentMap) {
  return widgetKeys
    .map(key => {
      const widget = getWidget(key)
      if (!widget) return null
      const component = componentMap[key]
      if (!component) return null
      return {
        key: widget.key,
        label: widget.name,
        component,
      }
    })
    .filter(Boolean)
}
