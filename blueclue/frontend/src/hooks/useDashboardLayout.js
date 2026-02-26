import { useState, useCallback } from 'react'

/**
 * Custom hook for managing dashboard widget layouts with localStorage persistence.
 * 
 * @param {string} dashboardKey - Unique key for the dashboard (e.g., 'management', 'technician')
 * @param {Object} defaultLayouts - Default responsive layouts { lg: [...], md: [...], sm: [...] }
 * @param {number} [version=1] - Layout version; bump to invalidate stale cached layouts
 * @returns {Object} Layout state and handlers
 */
export default function useDashboardLayout(dashboardKey, defaultLayouts, version = 1) {
  const storageKey = `blueclue_dashboard_layout_${dashboardKey}`
  const versionKey = `${storageKey}_v`

  // Load saved layouts from localStorage, falling back to defaults
  const loadLayouts = () => {
    try {
      // Check version — if stale, discard saved layout
      const savedVersion = parseInt(localStorage.getItem(versionKey), 10)
      if (savedVersion !== version) {
        localStorage.removeItem(storageKey)
        localStorage.setItem(versionKey, String(version))
        return defaultLayouts
      }

      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with defaults to handle new widgets added after save
        const merged = {}
        for (const breakpoint of Object.keys(defaultLayouts)) {
          const savedBp = parsed[breakpoint] || []
          const defaultBp = defaultLayouts[breakpoint] || []
          const savedKeys = new Set(savedBp.map(item => item.i))
          // Keep saved positions, add any new widgets from defaults
          merged[breakpoint] = [
            ...savedBp,
            ...defaultBp.filter(item => !savedKeys.has(item.i))
          ]
        }
        return merged
      }
    } catch (e) {
      console.warn('Failed to load dashboard layout:', e)
    }
    return defaultLayouts
  }

  const [layouts, setLayouts] = useState(loadLayouts)
  const [isEditMode, setIsEditMode] = useState(false)

  // Handle layout change from react-grid-layout
  const onLayoutChange = useCallback((currentLayout, allLayouts) => {
    setLayouts(allLayouts)
    try {
      localStorage.setItem(storageKey, JSON.stringify(allLayouts))
    } catch (e) {
      console.warn('Failed to save dashboard layout:', e)
    }
  }, [storageKey])

  // Reset to default layout
  const resetLayout = useCallback(() => {
    setLayouts(defaultLayouts)
    try {
      localStorage.removeItem(storageKey)
    } catch (e) {
      console.warn('Failed to clear saved layout:', e)
    }
  }, [defaultLayouts, storageKey])

  // Toggle edit/lock mode
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev)
  }, [])

  return {
    layouts,
    isEditMode,
    onLayoutChange,
    resetLayout,
    toggleEditMode,
  }
}
