import { useState, useCallback, useRef, useEffect } from 'react'
import { getUserId } from '../services/authService'
import { getWidget } from '../widgets'
import {
  fetchActiveLayout,
  saveActiveLayout as saveActiveLayoutApi,
  deleteActiveLayout as deleteActiveLayoutApi,
  fetchSavedLayouts,
  createSavedLayout as createSavedLayoutApi,
  renameSavedLayoutApi,
  deleteSavedLayoutApi,
} from '../services/dashboardLayoutService'

const DB_SAVE_DEBOUNCE_MS = 2000

/**
 * Custom hook for managing dashboard widget layouts with localStorage + database persistence.
 * Supports hiding/showing widgets via the Widget Gallery.
 * Supports saving/loading named custom layouts.
 *
 * localStorage serves as instant cache; database is the source of truth.
 * Layout changes are auto-saved to the DB with a debounce.
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
  const savedLayoutsKey = `${storageKey}_saved`

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

  // ─── Database sync refs ────────────────────────────────────────
  const dbSaveTimerRef = useRef(null)
  const latestLayoutRef = useRef(layouts)
  const latestHiddenRef = useRef(hiddenWidgets)
  const dbLoadedRef = useRef(false) // prevent auto-save from triggering during initial DB load
  const mountedRef = useRef(true)

  // Keep refs in sync with state
  useEffect(() => { latestLayoutRef.current = layouts }, [layouts])
  useEffect(() => { latestHiddenRef.current = hiddenWidgets }, [hiddenWidgets])
  useEffect(() => { return () => { mountedRef.current = false } }, [])

  // Debounced save to database
  const scheduleDatabaseSave = useCallback(() => {
    if (!getUserId()) return // not logged in
    if (!dbLoadedRef.current) return // skip until initial DB load completes

    if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current)
    dbSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveActiveLayoutApi(
          dashboardKey,
          latestLayoutRef.current,
          [...latestHiddenRef.current],
          version
        )
      } catch (e) {
        console.warn('Failed to save layout to database:', e)
      }
    }, DB_SAVE_DEBOUNCE_MS)
  }, [dashboardKey, version])

  // Load layout from database on mount
  useEffect(() => {
    let cancelled = false
    const loadFromDb = async () => {
      if (!getUserId()) {
        dbLoadedRef.current = true
        return
      }
      try {
        const dbLayout = await fetchActiveLayout(dashboardKey)
        if (cancelled) return
        if (dbLayout && dbLayout.layoutData) {
          const hiddenArr = dbLayout.hiddenWidgets || []
          const hidden = new Set(hiddenArr)

          // Merge DB layout with defaults (handle new widgets added since save)
          const merged = {}
          for (const breakpoint of Object.keys(defaultLayouts)) {
            const savedBp = dbLayout.layoutData[breakpoint] || []
            const defaultBp = defaultLayouts[breakpoint] || []
            const savedKeys = new Set(savedBp.map(item => item.i))
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

          setLayouts(merged)
          setHiddenWidgets(hidden)
          // Update localStorage cache
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged))
            localStorage.setItem(hiddenKey, JSON.stringify([...hidden]))
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn('Failed to load layout from database, using localStorage fallback:', e)
      } finally {
        if (!cancelled) dbLoadedRef.current = true
      }
    }
    loadFromDb()
    return () => { cancelled = true }
  }, [dashboardKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
    scheduleDatabaseSave()
  }, [storageKey, defaultLayouts, scheduleDatabaseSave])

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
      // If displaced layouts are provided from the drag-and-drop phantom preview,
      // use them directly — items are already positioned to match what the user saw
      if (dropPosition?.displacedLayouts) {
        const PHANTOM = '__drop_phantom__'
        const next = {}
        for (const bp of Object.keys(defaultLayouts)) {
          const displaced = dropPosition.displacedLayouts[bp]
          if (!displaced) { next[bp] = prev[bp] || []; continue }
          next[bp] = displaced
            .map(item => {
              if (item.i === PHANTOM) {
                // Replace phantom placeholder with the real widget
                const defaultItem = defaultLayouts[bp]?.find(d => d.i === key)
                const reg = getWidget(key)
                return {
                  i: key,
                  x: item.x,
                  y: item.y,
                  w: item.w,
                  h: item.h,
                  minW: defaultItem?.minW ?? reg?.size?.minW,
                  minH: defaultItem?.minH ?? reg?.size?.minH,
                  maxW: defaultItem?.maxW ?? reg?.size?.maxW,
                  maxH: defaultItem?.maxH ?? reg?.size?.maxH,
                }
              }
              // Preserve constraints from previous state or defaults
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
            .filter(item => item.i !== '__dropping-elem__')
        }
        try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      }

      // Fallback: programmatic addWidget (e.g., from gallery button click)
      const next = {}
      for (const bp of Object.keys(defaultLayouts)) {
        // Remove any placeholder items from previous operations
        const bpItems = [...(prev[bp] || [])].filter(item =>
          item.i !== '__dropping-elem__' && item.i !== '__drop_phantom__'
        )
        const exists = bpItems.some(item => item.i === key)
        if (!exists) {
          const defaultItem = defaultLayouts[bp]?.find(item => item.i === key)
          const maxY = bpItems.length > 0
            ? Math.max(...bpItems.map(item => item.y + item.h))
            : 0
          if (defaultItem) {
            bpItems.push({
              ...defaultItem,
              x: dropPosition?.x ?? defaultItem.x,
              y: dropPosition?.y ?? maxY,
            })
          } else {
            // Widget not in default layouts — build from registry sizes
            const reg = getWidget(key)
            if (reg) {
              const { defaultW, defaultH, minW, minH, maxW, maxH } = reg.size
              bpItems.push({
                i: key,
                x: dropPosition?.x ?? 0,
                y: dropPosition?.y ?? maxY,
                w: defaultW, h: defaultH,
                minW, minH, maxW, maxH,
              })
            }
          }
        }
        next[bp] = bpItems
      }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    scheduleDatabaseSave()
  }, [defaultLayouts, storageKey, saveHidden, scheduleDatabaseSave])

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
    scheduleDatabaseSave()
  }, [storageKey, saveHidden, scheduleDatabaseSave])

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
    // Also delete from database
    if (getUserId()) {
      deleteActiveLayoutApi(dashboardKey).catch(e =>
        console.warn('Failed to delete layout from database:', e)
      )
    }
  }, [defaultLayouts, storageKey, hiddenKey, dashboardKey])

  // ─── Saved custom layouts (database-backed) ────────────────────

  const [savedLayouts, setSavedLayouts] = useState([])

  // Load saved layouts from database on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!getUserId()) return
      try {
        const dbSaved = await fetchSavedLayouts(dashboardKey)
        if (cancelled) return
        if (!Array.isArray(dbSaved)) throw new Error('Invalid saved layouts response')
        // Map API response to the shape used by the UI
        const mapped = dbSaved.map(s => ({
          id: s.id,
          name: s.name,
          createdAt: s.createdAt,
          layouts: s.layoutData,
          hidden: s.hiddenWidgets || [],
        }))
        setSavedLayouts(mapped)
        // Also cache in localStorage
        try { localStorage.setItem(savedLayoutsKey, JSON.stringify(mapped)) } catch { /* ignore */ }
      } catch (e) {
        console.warn('Failed to load saved layouts from database, using localStorage fallback:', e)
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem(savedLayoutsKey)
          if (raw && !cancelled) setSavedLayouts(JSON.parse(raw))
        } catch { /* ignore */ }
      }
    }
    load()
    return () => { cancelled = true }
  }, [dashboardKey, savedLayoutsKey])

  // Save the current layout + hidden state under a user-chosen name
  const saveCustomLayout = useCallback(async (name) => {
    if (!name || !name.trim()) return false
    try {
      if (getUserId()) {
        const created = await createSavedLayoutApi(dashboardKey, name.trim(), layouts, [...hiddenWidgets])
        const entry = {
          id: created.id,
          name: created.name,
          createdAt: created.createdAt,
          layouts: created.layoutData,
          hidden: created.hiddenWidgets || [],
        }
        setSavedLayouts(prev => {
          const next = [entry, ...prev]
          try { localStorage.setItem(savedLayoutsKey, JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
      } else {
        // Fallback to localStorage-only
        const entry = {
          id: `layout_${Date.now()}`,
          name: name.trim(),
          createdAt: new Date().toISOString(),
          layouts: layouts,
          hidden: [...hiddenWidgets],
        }
        setSavedLayouts(prev => {
          const next = [entry, ...prev]
          try { localStorage.setItem(savedLayoutsKey, JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
      }
      return true
    } catch (e) {
      console.warn('Failed to save custom layout:', e)
      return false
    }
  }, [layouts, hiddenWidgets, savedLayoutsKey, dashboardKey])

  // Load a previously saved layout by id
  const loadCustomLayout = useCallback((id) => {
    const entry = savedLayouts.find(e => e.id === id)
    if (!entry) return false

    const hidden = new Set(entry.hidden || [])
    setHiddenWidgets(hidden)
    saveHidden(hidden)

    // Merge saved layouts with defaults to handle any new widgets added since save
    const merged = {}
    for (const breakpoint of Object.keys(defaultLayouts)) {
      const savedBp = entry.layouts[breakpoint] || []
      const defaultBp = defaultLayouts[breakpoint] || []
      const savedKeys = new Set(savedBp.map(item => item.i))
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

    setLayouts(merged)
    try { localStorage.setItem(storageKey, JSON.stringify(merged)) } catch { /* ignore */ }
    scheduleDatabaseSave()
    return true
  }, [defaultLayouts, storageKey, saveHidden, savedLayouts, scheduleDatabaseSave])

  // Delete a saved layout by id
  const deleteCustomLayout = useCallback(async (id) => {
    try {
      if (getUserId()) {
        await deleteSavedLayoutApi(id)
      }
    } catch (e) {
      console.warn('Failed to delete saved layout from database:', e)
    }
    setSavedLayouts(prev => {
      const next = prev.filter(e => e.id !== id)
      try { localStorage.setItem(savedLayoutsKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [savedLayoutsKey])

  // Rename a saved layout
  const renameCustomLayout = useCallback(async (id, newName) => {
    if (!newName || !newName.trim()) return
    try {
      if (getUserId()) {
        await renameSavedLayoutApi(id, newName.trim())
      }
    } catch (e) {
      console.warn('Failed to rename saved layout in database:', e)
    }
    setSavedLayouts(prev => {
      const next = prev.map(e => e.id === id ? { ...e, name: newName.trim() } : e)
      try { localStorage.setItem(savedLayoutsKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [savedLayoutsKey])

  // Toggle edit/lock mode
  // Suppress onLayoutChange during BOTH transitions (lock ↔ unlock).
  // The gallery sidebar (w-72 ≈ 288px) shares a flex row with the grid.
  //   • Unlocking — sidebar appears → container narrows → RGL reflows
  //   • Locking   — sidebar hides  → container widens  → RGL reflows
  // In both cases the reflow fires onLayoutChange with positions adapted
  // to the new width, which would overwrite the user's saved layout.
  // The 600ms window absorbs the initial prop-change event plus the
  // subsequent width-change event from useContainerWidth, without
  // blocking intentional drag/resize edits that happen later.
  const toggleEditMode = useCallback(() => {
    editModeToggledRef.current = true
    setTimeout(() => { editModeToggledRef.current = false }, 600)
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
    // Saved layouts
    savedLayouts,
    saveCustomLayout,
    loadCustomLayout,
    deleteCustomLayout,
    renameCustomLayout,
  }
}
