import { useState, useCallback, useRef } from 'react'

/**
 * Custom hook for managing dashboard widget layouts with localStorage persistence.
 * Supports hiding/showing widgets via the Widget Gallery.
 *
 * @param {string} dashboardKey - Unique key for the dashboard (e.g., 'management', 'technician')
 * @param {Object} defaultLayouts - Default responsive layouts { lg: [...], md: [...], sm: [...] }
 * @param {number} [version=1] - Layout version; bump to invalidate stale cached layouts
 * @returns {Object} Layout state and handlers
 */
export default function useDashboardLayout(dashboardKey, defaultLayouts, version = 1) {
  const storageKey = `blueclue_dashboard_layout_${dashboardKey}`
  const versionKey = `${storageKey}_v`
  const hiddenKey = `${storageKey}_hidden`

  // Load hidden widget keys from localStorage
  const loadHidden = () => {
    try {
      const saved = localStorage.getItem(hiddenKey)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  }

  // Helper: filter hidden widgets from layouts
  const filterHidden = (layoutsObj, hidden) => {
    if (hidden.size === 0) return layoutsObj
    const filtered = {}
    for (const bp of Object.keys(layoutsObj)) {
      filtered[bp] = layoutsObj[bp].filter(item => !hidden.has(item.i))
    }
    return filtered
  }

  // Load saved layouts from localStorage, falling back to defaults
  const loadLayouts = () => {
    const hidden = loadHidden()
    try {
      // Check version — if stale, discard saved layout
      const savedVersion = parseInt(localStorage.getItem(versionKey), 10)
      if (savedVersion !== version) {
        localStorage.removeItem(storageKey)
        localStorage.setItem(versionKey, String(version))
        return filterHidden(defaultLayouts, hidden)
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
          // Keep saved positions but restore constraints from defaults
          merged[breakpoint] = [
            ...savedBp.map(item => {
              const defaultItem = defaultBp.find(d => d.i === item.i)
              if (defaultItem) {
                return {
                  ...item,
                  minW: item.minW ?? defaultItem.minW,
                  minH: item.minH ?? defaultItem.minH,
                  maxW: item.maxW ?? defaultItem.maxW,
                  maxH: item.maxH ?? defaultItem.maxH,
                }
              }
              return item
            }),
            ...defaultBp.filter(item => !savedKeys.has(item.i))
          ].filter(item => !hidden.has(item.i))
        }
        return merged
      }
    } catch (e) {
      console.warn('Failed to load dashboard layout:', e)
    }
    return filterHidden(defaultLayouts, hidden)
  }

  const [layouts, setLayouts] = useState(loadLayouts)
  const [hiddenWidgets, setHiddenWidgets] = useState(loadHidden)
  const [isEditMode, setIsEditMode] = useState(false)

  // Ref used by DashboardGrid to skip the spurious onLayoutChange
  // that fires when edit mode toggles (RGL re-renders due to
  // dragConfig/resizeConfig prop changes)
  const editModeToggledRef = useRef(false)

  // Persist hidden widgets to localStorage
  const saveHidden = useCallback((hidden) => {
    try {
      localStorage.setItem(hiddenKey, JSON.stringify([...hidden]))
    } catch (e) {
      console.warn('Failed to save hidden widgets:', e)
    }
  }, [hiddenKey])

  // Handle layout change from react-grid-layout
  // Merges incoming layouts with current state to preserve constraints
  // (minW/minH/maxW/maxH) and breakpoints not present in the callback.
  const onLayoutChange = useCallback((currentLayout, allLayouts) => {
    setLayouts(prev => {
      const merged = {}
      // Merge each breakpoint from allLayouts with constraints from prev/defaults
      for (const bp of Object.keys(allLayouts)) {
        const incoming = allLayouts[bp] || []
        merged[bp] = incoming.map(item => {
          const existing = (prev[bp] || []).find(e => e.i === item.i) ||
                           defaultLayouts[bp]?.find(d => d.i === item.i)
          return {
            ...item,
            minW: item.minW ?? existing?.minW,
            minH: item.minH ?? existing?.minH,
            maxW: item.maxW ?? existing?.maxW,
            maxH: item.maxH ?? existing?.maxH,
          }
        })
      }
      // Preserve breakpoints from previous state not present in allLayouts
      for (const bp of Object.keys(prev)) {
        if (!merged[bp]) merged[bp] = prev[bp]
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(merged))
      } catch (e) {
        console.warn('Failed to save dashboard layout:', e)
      }
      return merged
    })
  }, [storageKey, defaultLayouts])

  // Add a widget back to the dashboard
  const addWidget = useCallback((key, dropPosition = null) => {
    // Remove from hidden set
    setHiddenWidgets(prev => {
      const next = new Set(prev)
      next.delete(key)
      saveHidden(next)
      return next
    })
    // Add layout items for all breakpoints
    setLayouts(prev => {
      const next = {}
      for (const bp of Object.keys(defaultLayouts)) {
        // Remove any placeholder items from previous operations
        const bpItems = [...(prev[bp] || [])].filter(item =>
          item.i !== '__dropping-elem__' && item.i !== '__drop_phantom__'
        )
        const exists = bpItems.some(item => item.i === key)
        if (!exists) {
          const defaultItem = defaultLayouts[bp]?.find(item => item.i === key)
          if (defaultItem) {
            const maxY = bpItems.length > 0
              ? Math.max(...bpItems.map(item => item.y + item.h))
              : 0
            bpItems.push({
              ...defaultItem,
              x: dropPosition?.x ?? defaultItem.x,
              y: dropPosition?.y ?? maxY,
            })
          }
        }
        next[bp] = bpItems
      }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [defaultLayouts, storageKey, saveHidden])

  // Remove (hide) a widget from the dashboard
  const removeWidget = useCallback((key) => {
    // Add to hidden set
    setHiddenWidgets(prev => {
      const next = new Set(prev)
      next.add(key)
      saveHidden(next)
      return next
    })
    // Remove from all breakpoint layouts
    setLayouts(prev => {
      const next = {}
      for (const bp of Object.keys(prev)) {
        next[bp] = prev[bp].filter(item => item.i !== key)
      }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey, saveHidden])

  // Reset to default layout and clear hidden widgets
  const resetLayout = useCallback(() => {
    setLayouts(defaultLayouts)
    setHiddenWidgets(new Set())
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(hiddenKey)
    } catch (e) {
      console.warn('Failed to clear saved layout:', e)
    }
  }, [defaultLayouts, storageKey, hiddenKey])

  // Toggle edit/lock mode
  const toggleEditMode = useCallback(() => {
    editModeToggledRef.current = true
    setIsEditMode(prev => !prev)
  }, [])

  return {
    layouts,
    isEditMode,
    editModeToggledRef,
    onLayoutChange,
    resetLayout,
    toggleEditMode,
    hiddenWidgets,
    addWidget,
    removeWidget,
  }
}
