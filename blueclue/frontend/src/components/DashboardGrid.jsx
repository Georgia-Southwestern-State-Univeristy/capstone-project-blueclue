import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'

/**
 * DashboardGrid – wraps react-grid-layout v2 with consistent styling,
 * edit-mode toggle, drag handles, and persistence support.
 *
 * @param {Object} props
 * @param {Object} props.layouts           – Responsive layouts { lg: [...], md: [...], sm: [...] }
 * @param {Function} props.onLayoutChange  – (currentLayout, allLayouts) => void
 * @param {boolean} props.isEditMode       – Whether drag/resize is enabled
 * @param {Function} props.toggleEditMode  – Toggle edit mode
 * @param {Function} props.resetLayout     – Reset to default layout
 * @param {Array} props.widgetConfig       – Array of { key, label, component } objects
 * @param {number} [props.rowHeight=60]    – Grid row height in px
 * @param {Array} [props.margin]           – [horizontal, vertical] margin between items
 * @param {Object} [props.cols]            – Column counts per breakpoint { lg, md, sm, xs }
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
}) {
  // v2: useContainerWidth replaces WidthProvider HOC
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 })

  return (
    <div ref={containerRef}>
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
          {widgetConfig.map(({ key, component }) => (
            <div key={key} className="relative overflow-hidden rounded-lg">
              {/* Edit mode: drag handle overlay on the widget header */}
              {isEditMode && (
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
  )
}
