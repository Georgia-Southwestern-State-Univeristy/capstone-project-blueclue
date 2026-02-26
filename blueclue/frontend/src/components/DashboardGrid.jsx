import { useState, useMemo, useCallback, useRef } from 'react'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import WidgetGallery from './WidgetGallery'

/**
 * DashboardGrid – wraps react-grid-layout v2 with consistent styling,
 * edit-mode toggle, drag handles, widget gallery sidebar, and persistence support.
 *
 * Uses HTML5 drag-and-drop (not RGL's buggy dropConfig) for gallery→grid drops.
 * Shows a positional drop indicator line while dragging.
 */
export default function DashboardGrid({
  layouts,
  onLayoutChange,
  isEditMode,
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
}) {
  // v2: useContainerWidth replaces WidthProvider HOC
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [showGallery, setShowGallery] = useState(true)
  // Drop indicator position (pixel coords relative to grid container)
  const [dropIndicator, setDropIndicator] = useState(null)
  const dragOverCountRef = useRef(0)

  // Determine current column count based on container width
  const getCurrentCols = useCallback(() => {
    if (width >= 1200) return cols.lg || 12
    if (width >= 996) return cols.md || 12
    if (width >= 768) return cols.sm || 6
    return cols.xs || 1
  }, [width, cols])

  // Grid geometry helpers
  const getGridGeometry = useCallback(() => {
    const currentCols = getCurrentCols()
    const cellWidth = (width - margin[0]) / currentCols
    const cellHeight = rowHeight + margin[1]
    return { currentCols, cellWidth, cellHeight }
  }, [getCurrentCols, width, margin, rowHeight])

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

  // Convert pixel position to snapped grid indicator position
  const computeIndicator = useCallback((clientX, clientY, containerRect, draggedKey) => {
    const { currentCols, cellWidth, cellHeight } = getGridGeometry()
    const dropX = clientX - containerRect.left
    const dropY = clientY - containerRect.top

    const gridCol = Math.max(0, Math.min(Math.floor(dropX / cellWidth), currentCols - 1))
    const gridRow = Math.max(0, Math.floor(dropY / cellHeight))

    // Find the widget being dragged to get its default width
    const galleryItem = galleryItems.find(g => g.key === draggedKey)
    const widgetW = galleryItem?.defaultW || 4
    const widgetH = galleryItem?.defaultH || 4
    const clampedCol = Math.min(gridCol, currentCols - widgetW)

    // Return pixel positions snapped to grid lines
    return {
      x: clampedCol * cellWidth + margin[0],
      y: gridRow * cellHeight + margin[1],
      w: widgetW * cellWidth - margin[0],
      h: widgetH * cellHeight - margin[1],
      gridX: clampedCol,
      gridY: gridRow,
    }
  }, [getGridGeometry, galleryItems, margin])

  // HTML5 drop zone handlers with positional indicator
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)

    const rect = e.currentTarget.getBoundingClientRect()
    const widgetKey = e.dataTransfer.types.includes('text/plain') ? '__pending__' : null
    // We can't read dataTransfer data during dragover (security), so use stored key or placeholder
    const indicator = computeIndicator(e.clientX, e.clientY, rect, widgetKey)
    setDropIndicator(indicator)
  }, [isDragOver, computeIndicator])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dragOverCountRef.current++
    if (!isDragOver) setIsDragOver(true)
  }, [isDragOver])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    dragOverCountRef.current--
    if (dragOverCountRef.current <= 0) {
      dragOverCountRef.current = 0
      setIsDragOver(false)
      setDropIndicator(null)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    dragOverCountRef.current = 0
    setIsDragOver(false)
    setDropIndicator(null)
    const widgetKey = e.dataTransfer.getData('text/plain')
    if (widgetKey && onAddWidget) {
      const rect = e.currentTarget.getBoundingClientRect()
      const indicator = computeIndicator(e.clientX, e.clientY, rect, widgetKey)
      onAddWidget(widgetKey, { x: indicator.gridX, y: indicator.gridY })
    }
  }, [onAddWidget, computeIndicator])

  const hasGallery = galleryItems.length > 0
  const galleryVisible = isEditMode && showGallery && hasGallery

  return (
    <div>
      {/* Edit Mode Controls */}
      <div className="flex items-center justify-end gap-3 mb-4">
        {isEditMode && (
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

      {/* Gallery Sidebar + Grid Layout */}
      <div className="flex gap-0 relative">
        {/* Widget Gallery Sidebar – slides in when edit mode is active */}
        {hasGallery && isEditMode && (
          <div
            className={`shrink-0 self-start sticky top-4 z-30 transition-[width,opacity] duration-300 ease-in-out overflow-hidden
                        ${galleryVisible ? 'w-72 opacity-100' : 'w-0 opacity-0'}`}
          >
            <div className={`w-72 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl
                            max-h-[calc(100vh-8rem)] flex flex-col mr-4 overflow-hidden
                            transition-transform duration-300 ease-in-out
                            ${galleryVisible ? 'translate-x-0' : '-translate-x-full'}`}>
              <WidgetGallery
                allWidgets={galleryItems}
                activeKeys={activeKeys}
                onAddWidget={onAddWidget}
                onClose={() => setShowGallery(false)}
              />
            </div>
          </div>
        )}

        {/* Pull-out tab when gallery is hidden during edit mode */}
        {hasGallery && isEditMode && !showGallery && (
          <div className="shrink-0 self-start sticky top-4 z-50 w-0">
            <button
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-1 pl-2 pr-2.5 py-3 rounded-r-lg
                         bg-gray-800/95 hover:bg-gray-700/95 backdrop-blur-sm
                         border border-l-0 border-gray-600/50 hover:border-blue-500/50
                         text-gray-400 hover:text-blue-400 transition-all shadow-lg
                         group"
              title="Show Widget Gallery"
            >
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <span className="text-[10px] font-medium writing-mode-vertical"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.05em' }}>
              WIDGETS
            </span>
            </button>
          </div>
        )}

        {/* Grid area – shrinks to make room for sidebar */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 relative"
          onDragOver={isEditMode ? handleDragOver : undefined}
          onDragEnter={isEditMode ? handleDragEnter : undefined}
          onDragLeave={isEditMode ? handleDragLeave : undefined}
          onDrop={isEditMode ? handleDrop : undefined}
        >
          {/* Drop position indicator – shows where the widget will land */}
          {isDragOver && dropIndicator && (
            <div
              className="absolute z-40 pointer-events-none transition-[top,left] duration-75 ease-out"
              style={{
                top: dropIndicator.y,
                left: dropIndicator.x,
                width: dropIndicator.w,
                height: dropIndicator.h,
              }}
            >
              {/* Ghost outline of the widget */}
              <div className="w-full h-full rounded-lg border-2 border-blue-400/70 bg-blue-400/10
                              shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <div className="absolute inset-x-3 top-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px] text-blue-400/80 font-medium">Drop here</span>
                </div>
              </div>
            </div>
          )}

          {/* Grid – v2 API: pass width directly, use dragConfig/resizeConfig objects */}
          {mounted && (
            <ResponsiveGridLayout
              className="layout"
              width={width}
              layouts={layouts}
              onLayoutChange={onLayoutChange}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
              cols={cols}
              rowHeight={rowHeight}
              margin={margin}
              dragConfig={{
                enabled: isEditMode,
                handle: '.widget-drag-handle',
              }}
              resizeConfig={{
                enabled: isEditMode,
              }}
            >
              {activeWidgets.map(({ key, component }) => (
                <div key={key} className="relative overflow-hidden rounded-lg">
                  {/* Edit mode: drag handle overlay + remove button */}
                  {isEditMode && (
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
                          }}
                          className="absolute top-1.5 right-1.5 z-30 p-1 rounded-md
                                     bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300
                                     border border-red-500/30 hover:border-red-400/50
                                     transition-all opacity-60 hover:opacity-100"
                          title="Remove widget from dashboard"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                  {/* Widget content – fill grid cell and scroll if needed */}
                  <div className={`h-full overflow-y-auto ${isEditMode ? 'pointer-events-none select-none' : ''}`}>
                    {component}
                  </div>
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>
    </div>
  )
}
