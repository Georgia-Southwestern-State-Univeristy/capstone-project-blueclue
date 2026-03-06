import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import WidgetGallery from './WidgetGallery'

const PHANTOM_KEY = '__drop_phantom__'

// ── Layout displacement helpers ──────────────────────────────────────────────
// We run our own compaction so the phantom stays exactly where the cursor is
// and every other widget shifts to make room, including at y=0.

function itemsCollide(a, b) {
  if (a.i === b.i) return false
  if (a.x + a.w <= b.x || a.x >= b.x + b.w) return false   // no column overlap
  if (a.y + a.h <= b.y || a.y >= b.y + b.h) return false    // no row overlap
  return true
}

function firstCollision(item, placed) {
  for (const p of placed) {
    if (itemsCollide(item, p)) return p
  }
  return null
}

/**
 * Compact a layout treating `phantomKey` as an immovable obstacle.
 * Other items compact upward (vertical compaction) but cannot overlap the phantom.
 */
function compactWithPhantom(allItems, phantomKey) {
  const phantom = allItems.find(i => i.i === phantomKey)
  if (!phantom) return allItems

  // Phantom is fixed in place — everything else compacts around it
  const placed = [{ ...phantom }]
  const others = allItems
    .filter(i => i.i !== phantomKey)
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))

  for (const orig of others) {
    const item = { ...orig }
    // Compact upward as far as possible
    while (item.y > 0) {
      item.y--
      if (firstCollision(item, placed)) {
        item.y++ // undo — collision
        break
      }
    }
    // Resolve any remaining overlaps by pushing item below the collider
    let coll
    while ((coll = firstCollision(item, placed))) {
      item.y = coll.y + coll.h
    }
    placed.push(item)
  }
  return placed
}

/**
 * SaveLayoutButton – inline button with popover input for naming and saving layouts.
 */
function SaveLayoutButton({ onSave }) {
  const [showInput, setShowInput] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus()
  }, [showInput])

  const handleSave = () => {
    if (!name.trim()) return
    const success = onSave?.(name.trim())
    if (success !== false) {
      setSaved(true)
      setTimeout(() => { setSaved(false); setShowInput(false); setName('') }, 1200)
    }
  }

  if (saved) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                        bg-green-600/20 border border-green-500/40 text-green-400">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Saved!
      </span>
    )
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowInput(false); setName('') } }}
          placeholder="Layout name..."
          maxLength={30}
          className="px-2.5 py-1 text-xs rounded-lg bg-gray-800 border border-gray-600 text-white
                     placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 w-36"
        />
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-500
                     text-white border border-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={() => { setShowInput(false); setName('') }}
          className="p-1.5 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white
                 border border-gray-600 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      Save Layout
    </button>
  )
}

/**
 * DashboardGrid – wraps react-grid-layout v2 with consistent styling,
 * edit-mode toggle, drag handles, widget gallery sidebar, and persistence support.
 *
 * External drops (gallery→grid) are handled via a "phantom" layout item injected
 * into the external layouts prop. This avoids RGL's internal dropConfig state which
 * causes a flash when the placeholder is removed and the real widget is added.
 * Auto-scrolls the page when dragging near viewport edges.
 */
export default function DashboardGrid({
  layouts,
  onLayoutChange,
  isEditMode,
  editModeToggledRef,
  toggleEditMode,
  resetLayout,
  widgetConfig,
  rowHeight = 60,
  margin = [16, 16],
  cols = { lg: 12, md: 12, sm: 6, xs: 1 },
  // Widget gallery props
  galleryItems = [],
  hiddenWidgets = new Set(),
  onAddWidget,
  onRemoveWidget,
  // Saved layouts props
  savedLayouts = [],
  onSaveLayout,
  onLoadLayout,
  onDeleteLayout,
  onRenameLayout,
}) {
  // v2: useContainerWidth replaces WidthProvider HOC
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 })
  const [showGallery, setShowGallery] = useState(true)

  // Track which gallery widget is currently being dragged
  const draggingKeyRef = useRef(null)
  // Phantom placeholder for external drops – managed in our state, not RGL's
  const [phantomItem, setPhantomItem] = useState(null) // { x, y, w, h }
  const phantomItemRef = useRef(null) // mirror for use in native event listeners
  const lastGridPosRef = useRef(null)

  // Track which widget is "selected" (clicked in edit mode) for keyboard shortcuts
  const [selectedWidget, setSelectedWidget] = useState(null)

  // Track drag state for auto-scroll and CSS classes
  const [isDraggingExternal, setIsDraggingExternal] = useState(false)
  const [isDraggingWidget, setIsDraggingWidget] = useState(false)
  const isDragging = isDraggingExternal || isDraggingWidget

  // Detect mobile viewport — hide gallery entirely on small screens
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Track resize state to skip expensive onLayoutChange during active resizes
  const isResizingRef = useRef(false)
  const pendingLayoutRef = useRef(null)

  // Determine current column count based on container width
  const getCurrentCols = useCallback(() => {
    if (width >= 1200) return cols.lg || 12
    if (width >= 996) return cols.md || 12
    if (width >= 768) return cols.sm || 6
    return cols.xs || 1
  }, [width, cols])

  // Filter widgetConfig to only show non-hidden widgets
  const activeWidgets = useMemo(() =>
    widgetConfig.filter(w => !hiddenWidgets.has(w.key)),
    [widgetConfig, hiddenWidgets]
  )

  // Set of active widget keys (for gallery display)
  const activeKeys = useMemo(() =>
    new Set(activeWidgets.map(w => w.key)),
    [activeWidgets]
  )

  // Merge phantom into layouts and pre-compute displaced positions ourselves.
  // This gives us full control: the phantom stays exactly where the cursor is
  // and every other widget shifts around it (including at y=0).
  const layoutsWithPhantom = useMemo(() => {
    if (!phantomItem) return layouts
    const merged = {}
    for (const bp of Object.keys(layouts)) {
      const numCols = cols[bp] || 12
      const phantomLayout = {
        i: PHANTOM_KEY,
        x: Math.min(phantomItem.x, Math.max(0, numCols - phantomItem.w)),
        y: phantomItem.y,
        w: Math.min(phantomItem.w, numCols),
        h: phantomItem.h,
        isDraggable: false,
        isResizable: false,
      }
      const bpItems = [...(layouts[bp] || []), phantomLayout]
      merged[bp] = compactWithPhantom(bpItems, PHANTOM_KEY)
    }
    return merged
  }, [layouts, phantomItem, cols])

  // Add phantom component to widget children when dragging
  const widgetsToRender = useMemo(() => {
    if (!phantomItem) return activeWidgets
    return [
      ...activeWidgets,
      {
        key: PHANTOM_KEY,
        component: (
          <div className="w-full h-full rounded-lg border-2 border-dashed border-blue-500/60 bg-blue-500/20
                          flex items-center justify-center animate-pulse">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-blue-400 font-medium">Drop here</span>
            </div>
          </div>
        ),
      },
    ]
  }, [activeWidgets, phantomItem])

  // Filter phantom from layout changes before persisting to parent.
  // Also skip the spurious onLayoutChange that fires when edit mode
  // toggles (RGL re-renders due to dragConfig/resizeConfig prop changes).
  // During active resizes, stash the latest layout and apply it on stop
  // to avoid expensive per-frame merge + localStorage writes.
  const handleLayoutChange = useCallback((currentLayout, allLayouts) => {
    if (phantomItem) return // Don't persist while phantom is active
    if (editModeToggledRef?.current) {
      return // Skip layout changes during edit-mode transition window
    }
    if (isResizingRef.current) {
      pendingLayoutRef.current = { currentLayout, allLayouts }
      return // Stash — will apply on resize stop
    }
    onLayoutChange(currentLayout, allLayouts)
  }, [onLayoutChange, phantomItem, editModeToggledRef])

  // Called by WidgetGallery when a drag begins (synchronously sets ref)
  const handleGalleryDragStart = useCallback((widgetKey) => {
    draggingKeyRef.current = widgetKey
    setIsDraggingExternal(true)
  }, [])

  // Keep phantomItemRef in sync so native listeners always read the latest value
  useEffect(() => { phantomItemRef.current = phantomItem }, [phantomItem])

  // Native drag event listeners – always attached when in edit mode.
  // Uses capture phase so events fire before RGL can intercept them.
  // Handlers check draggingKeyRef to only act during gallery drags.
  useEffect(() => {
    if (!isEditMode) return
    const el = containerRef.current
    if (!el) return

    const onDragOver = (e) => {
      if (!draggingKeyRef.current) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'

      // Ensure visual state is active (belt-and-suspenders with handleGalleryDragStart)
      setIsDraggingExternal(true)

      const rect = el.getBoundingClientRect()
      const currentCols = getCurrentCols()
      const containerPad = margin[0]
      const colWidth = (width - containerPad * 2 - margin[0] * (currentCols - 1)) / currentCols
      const cellHeight = rowHeight + margin[1]

      const dropX = e.clientX - rect.left - containerPad
      const dropY = e.clientY - rect.top - containerPad

      const key = draggingKeyRef.current
      const galleryItem = key ? galleryItems.find(g => g.key === key) : null
      const widgetW = galleryItem?.defaultW || 4
      const widgetH = galleryItem?.defaultH || 4

      const gridCol = Math.max(0, Math.min(Math.floor(dropX / (colWidth + margin[0])), currentCols - widgetW))
      const gridRow = Math.max(0, Math.floor(dropY / cellHeight))

      const posKey = `${gridCol},${gridRow}`
      if (lastGridPosRef.current === posKey) return
      lastGridPosRef.current = posKey

      setPhantomItem({ x: gridCol, y: gridRow, w: widgetW, h: widgetH })
    }

    const onDragLeave = (e) => {
      if (!draggingKeyRef.current) return
      // Only clear phantom if cursor truly left the container bounds
      const rect = el.getBoundingClientRect()
      const { clientX, clientY } = e
      if (clientX <= rect.left || clientX >= rect.right ||
          clientY <= rect.top || clientY >= rect.bottom) {
        setPhantomItem(null)
        lastGridPosRef.current = null
      }
    }

    const onDrop = (e) => {
      if (!draggingKeyRef.current) return
      e.preventDefault()
      e.stopPropagation()
      lastGridPosRef.current = null
      const widgetKey = e.dataTransfer.getData('text/plain') || draggingKeyRef.current
      draggingKeyRef.current = null
      const pos = phantomItemRef.current

      setPhantomItem(null)
      setIsDraggingExternal(false)

      if (widgetKey && onAddWidget && pos) {
        onAddWidget(widgetKey, { x: pos.x, y: pos.y })
      }
    }

    // Capture phase = fires parent-first, before RGL children can intercept
    el.addEventListener('dragover', onDragOver, true)
    el.addEventListener('dragleave', onDragLeave, true)
    el.addEventListener('drop', onDrop, true)

    return () => {
      el.removeEventListener('dragover', onDragOver, true)
      el.removeEventListener('dragleave', onDragLeave, true)
      el.removeEventListener('drop', onDrop, true)
    }
  }, [isEditMode, getCurrentCols, width, margin, rowHeight, galleryItems, onAddWidget])

  // RGL internal drag start/stop – track for auto-scroll
  const handleWidgetDragStart = useCallback(() => {
    setIsDraggingWidget(true)
  }, [])

  const handleWidgetDragStop = useCallback(() => {
    setIsDraggingWidget(false)
  }, [])

  // Resize start/stop — skip expensive onLayoutChange during active resize
  const handleResizeStart = useCallback(() => {
    isResizingRef.current = true
    pendingLayoutRef.current = null
  }, [])

  const handleResizeStop = useCallback(() => {
    isResizingRef.current = false
    // Apply the last stashed layout change now that resize is complete
    if (pendingLayoutRef.current) {
      const { currentLayout, allLayouts } = pendingLayoutRef.current
      pendingLayoutRef.current = null
      onLayoutChange(currentLayout, allLayouts)
    }
  }, [onLayoutChange])

  // Clean up external drag if it ends without a drop (e.g., escape key, drag out of window)
  useEffect(() => {
    if (!isDraggingExternal) return
    const handleDragEnd = () => {
      setIsDraggingExternal(false)
      setPhantomItem(null)
      draggingKeyRef.current = null
      lastGridPosRef.current = null
    }
    window.addEventListener('dragend', handleDragEnd)
    return () => window.removeEventListener('dragend', handleDragEnd)
  }, [isDraggingExternal])

  // ── Keyboard shortcuts: Delete = remove selected widget, Escape = exit edit mode ──
  useEffect(() => {
    if (!isEditMode) return
    const handleKeyDown = (e) => {
      // Ignore when user is typing in an input/textarea/contenteditable
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWidget && onRemoveWidget) {
          e.preventDefault()
          onRemoveWidget(selectedWidget)
          setSelectedWidget(null)
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedWidget(null)
        toggleEditMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditMode, selectedWidget, onRemoveWidget, toggleEditMode])

  // Clear selected widget when leaving edit mode
  useEffect(() => {
    if (!isEditMode) setSelectedWidget(null)
  }, [isEditMode])

  // Auto-scroll when dragging near viewport edges
  useEffect(() => {
    if (!isDragging) return
    let rafId = null

    const scrollAtEdge = (clientY) => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const vh = window.innerHeight
        const EDGE_SIZE = 120
        const MAX_SPEED = 40

        if (clientY < EDGE_SIZE) {
          const intensity = 1 - (clientY / EDGE_SIZE)
          window.scrollBy({ top: -Math.round(MAX_SPEED * intensity), behavior: 'instant' })
        } else if (clientY > vh - EDGE_SIZE) {
          const intensity = 1 - ((vh - clientY) / EDGE_SIZE)
          window.scrollBy({ top: Math.round(MAX_SPEED * intensity), behavior: 'instant' })
        }
      })
    }

    const handleDragOverScroll = (e) => scrollAtEdge(e.clientY)
    const handleMouseMove = (e) => { if (isDraggingWidget) scrollAtEdge(e.clientY) }
    const handleTouchMove = (e) => {
      if (isDraggingWidget && e.touches.length > 0) {
        scrollAtEdge(e.touches[0].clientY)
      }
    }

    window.addEventListener('dragover', handleDragOverScroll, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('dragover', handleDragOverScroll)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isDragging, isDraggingWidget])

  const hasGallery = galleryItems.length > 0 && !isMobile
  const galleryVisible = isEditMode && showGallery && hasGallery

  return (
    <div>
      {/* Edit Mode Controls */}
      <div className="flex items-center justify-end gap-3 mb-4">
        {isEditMode && (
          <>
            <span className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 mr-1 select-none">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">Esc</kbd> exit
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">Del</kbd> remove
            </span>
            <SaveLayoutButton onSave={onSaveLayout} />
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                         bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white
                         border border-gray-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Layout
            </button>
          </>
        )}
        <button
          onClick={toggleEditMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                     border transition-colors ${
                       isEditMode
                         ? 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white'
                         : 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white'
                     }`}
        >
          {isEditMode ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock Layout
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Layout
            </>
          )}
        </button>
      </div>

      {/* Grid area – always full width, never affected by gallery */}
      <div
        ref={containerRef}
        className={`relative transition-shadow duration-200
                    ${isEditMode ? 'rgl-edit-mode' : ''}
                    ${isDraggingExternal ? 'external-drop-active ring-2 ring-blue-500/30 ring-inset rounded-lg bg-blue-500/5' : ''}`}
        style={galleryVisible ? { paddingBottom: '240px' } : undefined}
      >
        {/* Grid – v2 API: pass width directly, use dragConfig/resizeConfig objects */}
        {mounted && (
          <ResponsiveGridLayout
            className="layout"
            width={width}
            layouts={layoutsWithPhantom}
            onLayoutChange={handleLayoutChange}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={cols}
            rowHeight={rowHeight}
            margin={margin}
            compactType={phantomItem ? null : "vertical"}
            dragConfig={{
              enabled: isEditMode,
              handle: '.widget-drag-handle',
            }}
            resizeConfig={{
              enabled: isEditMode && !isMobile,
              handles: ['s', 'e', 'se'],
            }}
            onDragStart={handleWidgetDragStart}
            onDragStop={handleWidgetDragStop}
            onResizeStart={handleResizeStart}
            onResizeStop={handleResizeStop}
          >
            {widgetsToRender.map(({ key, component }) => (
              <div
                key={key}
                className={`relative overflow-hidden rounded-lg ${isEditMode && selectedWidget === key ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-950' : ''}`}
                onClick={() => { if (isEditMode && key !== PHANTOM_KEY) setSelectedWidget(prev => prev === key ? null : key) }}
              >
                {/* Edit mode: drag handle overlay + remove button (not on phantom) */}
                {isEditMode && key !== PHANTOM_KEY && (
                  <>
                    <div className="widget-drag-handle absolute inset-x-0 top-0 h-12 z-20 cursor-grab active:cursor-grabbing
                                    flex items-center justify-center rounded-t-lg
                                    bg-blue-500/10 border-2 border-dashed border-blue-500/40
                                    hover:bg-blue-500/20 hover:border-blue-400/60 transition-colors">
                      <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium pointer-events-none select-none">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 8h16M4 16h16" />
                        </svg>
                        Drag to move
                      </div>
                    </div>
                    {/* Remove widget button */}
                    {onRemoveWidget && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveWidget(key)
                          if (selectedWidget === key) setSelectedWidget(null)
                        }}
                        className="absolute top-1.5 right-1.5 z-30 p-1 rounded-md
                                   bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300
                                   border border-red-500/30 hover:border-red-400/50
                                   transition-all opacity-60 hover:opacity-100"
                        title="Remove widget (or press Delete)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
                {/* Widget content – fill grid cell and scroll if needed */}
                <div className={`h-full overflow-y-auto ${isEditMode ? 'pointer-events-none select-none edit-mode-active' : ''}`}>
                  {component}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* ── Bottom overlay gallery panel ── */}
      {hasGallery && isEditMode && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out
                      ${galleryVisible ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: '250px' }}
        >
          {/* Resize handle / grab bar at top */}
          <div className="flex items-center justify-center h-6 bg-gray-900/95 backdrop-blur-sm
                          border-t border-x border-gray-700/60 rounded-t-xl cursor-default select-none">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          {/* Gallery content */}
          <div className="h-[calc(100%-1.5rem)] bg-gray-900/95 backdrop-blur-sm border-x border-gray-700/60 overflow-hidden">
            <WidgetGallery
              allWidgets={galleryItems}
              activeKeys={activeKeys}
              onAddWidget={onAddWidget}
              onClose={() => setShowGallery(false)}
              onDragStartWidget={handleGalleryDragStart}
              savedLayouts={savedLayouts}
              onLoadLayout={onLoadLayout}
              onDeleteLayout={onDeleteLayout}
              onRenameLayout={onRenameLayout}
            />
          </div>
        </div>
      )}

      {/* Pull-up button when gallery is hidden during edit mode */}
      {hasGallery && isEditMode && !showGallery && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setShowGallery(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-t-lg
                       bg-gray-800/95 hover:bg-gray-700/95 backdrop-blur-sm
                       border border-b-0 border-gray-600/50 hover:border-blue-500/50
                       text-gray-400 hover:text-blue-400 transition-all shadow-lg
                       group"
            title="Show Widget Gallery"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-[11px] font-semibold tracking-wide">WIDGETS</span>
          </button>
        </div>
      )}
    </div>
  )
}
