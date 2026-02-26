import { useState, useEffect, useMemo, useCallback } from 'react'
import BaseWidget from './BaseWidget'

// Fallback colors when the DB doesn't provide a color_code
const CATEGORY_COLORS = {
  general: '#6B7280',
  technical: '#3B82F6',
  billing: '#10B981',
  account: '#8B5CF6',
  feature_request: '#F59E0B',
  hardware: '#EF4444',
  software: '#06B6D4',
  network: '#EC4899',
  login: '#F97316',
  other: '#64748B',
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * TicketCategoriesWidget
 * Pie chart breaking down tickets by category with color-coded legend.
 * Click a segment to drill down and see tickets for that category.
 *
 * @param {Object}   props
 * @param {Array}    props.tickets           - Full ticket array (used for drill-down list)
 * @param {Function} [props.onRefresh]       - Parent refresh callback
 * @param {string|null} [props.activeCategory] - Currently selected category key
 * @param {Function} [props.onCategorySelect] - Called with category key or null
 */
function TicketCategoriesWidget({
  tickets = [],
  onRefresh = null,
  activeCategory = null,
  onCategorySelect = null,
  onTicketClick = null,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [apiData, setApiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch category breakdown from analytics API
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('blueclue_token')
      const res = await fetch(`${API_BASE_URL}/analytics/category-breakdown`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setApiData(json.data || [])
    } catch (err) {
      console.error('Category breakdown fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    await fetchData()
    if (onRefresh) await onRefresh()
  }, [fetchData, onRefresh])

  // Build segments from API data, falling back to client-side computation
  const { segments, total } = useMemo(() => {
    if (apiData && apiData.length > 0) {
      const total = apiData.reduce((sum, r) => sum + r.count, 0)
      return {
        total,
        segments: apiData.map((r) => ({
          key: r.category,
          label: r.display_name,
          count: r.count,
          percentage: r.percentage,
          color: r.color_code || CATEGORY_COLORS[r.category] || '#6B7280',
        })),
      }
    }
    // Fallback: compute from tickets prop
    const counts = {}
    tickets.forEach((t) => {
      const cat = t.category || 'general'
      counts[cat] = (counts[cat] || 0) + 1
    })
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const total = tickets.length
    return {
      total,
      segments: entries.map(([key, count]) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        color: CATEGORY_COLORS[key] || '#6B7280',
      })),
    }
  }, [apiData, tickets])

  // Tickets within the selected category (for drill-down)
  const drillDownTickets = useMemo(() => {
    if (!activeCategory) return []
    return tickets.filter((t) => (t.category || 'general') === activeCategory)
  }, [tickets, activeCategory])

  // ---------- SVG Pie helpers ----------

  const getSlicePath = (startPct, endPct, radius = 40, isHovered = false) => {
    const r = isHovered ? radius + 2 : radius
    const cx = 50
    const cy = 50
    const startAngle = ((startPct / 100) * 360 - 90) * (Math.PI / 180)
    const endAngle = ((endPct / 100) * 360 - 90) * (Math.PI / 180)
    const largeArc = endPct - startPct > 50 ? 1 : 0
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)

    // For 100% (single category), draw full circle
    if (endPct - startPct >= 99.9) {
      return [
        `M ${cx} ${cy - r}`,
        `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
        `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
        'Z',
      ].join(' ')
    }

    return [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ')
  }

  // Pre-compute cumulative percentages
  const slices = useMemo(() => {
    let cumulative = 0
    return segments.map((seg) => {
      const start = cumulative
      cumulative += seg.percentage
      return { ...seg, startPct: start, endPct: cumulative }
    })
  }, [segments])

  // Center label
  const centerLabel =
    hoveredIndex !== null ? slices[hoveredIndex]?.label : 'Total'
  const centerValue =
    hoveredIndex !== null ? slices[hoveredIndex]?.count : total
  const centerColor =
    hoveredIndex !== null ? slices[hoveredIndex]?.color : '#ffffff'

  const handleSliceClick = (key) => {
    if (!onCategorySelect) return
    onCategorySelect(activeCategory === key ? null : key)
  }

  const priorityColors = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-blue-400',
  }

  return (
    <BaseWidget
      title="Ticket Categories"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      }
      onRefresh={handleRefresh}
      isLoading={loading && !apiData}
      error={error}
      isEmpty={total === 0 && !loading}
      emptyMessage="No tickets to display"
      emptyIcon={
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      noPadding
    >
      <div className="flex flex-col items-center gap-4 px-4 py-4 md:px-6">
        {/* Pie Chart */}
        <div className="relative w-40 h-40 flex-shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {total === 0 ? (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="#374151"
              />
            ) : (
              slices.map((slice, i) => {
                if (slice.percentage === 0) return null
                const isHovered = hoveredIndex === i
                const isActive = activeCategory === slice.key
                const path = getSlicePath(
                  slice.startPct,
                  slice.endPct,
                  40,
                  isHovered
                )

                return (
                  <path
                    key={slice.key}
                    d={path}
                    fill={slice.color}
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      filter:
                        isHovered || isActive
                          ? `drop-shadow(0 0 6px ${slice.color})`
                          : 'none',
                      opacity:
                        hoveredIndex !== null && !isHovered
                          ? 0.35
                          : activeCategory && !isActive
                          ? 0.35
                          : 1,
                      transformOrigin: '50px 50px',
                      transform: isActive && !isHovered ? 'scale(1.03)' : 'none',
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handleSliceClick(slice.key)}
                  />
                )
              })
            )}
          </svg>

          {/* Center display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-2xl font-bold transition-colors duration-200"
              style={{ color: centerColor }}
            >
              {centerValue}
            </span>
            <span className="text-[10px] text-gray-400 max-w-[70px] text-center truncate">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Color-coded legend */}
        <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5">
          {slices.map((slice, i) => {
            const isActive = activeCategory === slice.key
            return (
              <button
                key={slice.key}
                onClick={() => handleSliceClick(slice.key)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`
                  flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-200 text-left
                  ${isActive ? 'ring-1' : ''}
                  hover:bg-gray-800
                `}
                style={{
                  backgroundColor:
                    hoveredIndex === i || isActive
                      ? `${slice.color}15`
                      : 'transparent',
                  ringColor: isActive ? slice.color : undefined,
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform duration-200"
                  style={{
                    backgroundColor: slice.color,
                    transform:
                      hoveredIndex === i || isActive
                        ? 'scale(1.4)'
                        : 'scale(1)',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-300 truncate leading-tight">
                    {slice.label}
                  </p>
                  <p className="text-xs font-semibold text-white leading-tight">
                    {slice.count}{' '}
                    <span className="text-[10px] font-normal text-gray-500">
                      ({slice.percentage}%)
                    </span>
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Active category indicator */}
        {activeCategory && (
          <button
            onClick={() => onCategorySelect(null)}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 pb-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear category filter
          </button>
        )}
      </div>

      {/* Drill-down ticket list */}
      {activeCategory && (
        <div className="border-t border-gray-800 px-4 py-3 md:px-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{
                  backgroundColor:
                    slices.find((s) => s.key === activeCategory)?.color || '#6B7280',
                }}
              />
              {slices.find((s) => s.key === activeCategory)?.label || activeCategory}
              <span className="text-xs font-normal text-gray-400">
                ({drillDownTickets.length})
              </span>
            </h4>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {drillDownTickets.length === 0 ? (
              <p className="text-gray-500 text-xs py-2">No tickets in this category.</p>
            ) : (
              drillDownTickets.slice(0, 20).map((t) => (
                <div
                  key={t.id || t.ticket_id}
                  className={`flex items-center justify-between p-2 bg-gray-800/60 rounded border border-gray-700/50 text-xs hover:bg-gray-700/60 transition-colors ${onTicketClick ? 'cursor-pointer hover:border-blue-500/50' : ''}`}
                  onClick={() => onTicketClick?.(t)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 font-mono flex-shrink-0">
                      {t.ticket_number || `#${t.id || t.ticket_id}`}
                    </span>
                    <span className="text-white truncate">{t.subject || t.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span
                      className={`capitalize ${priorityColors[t.priority] || 'text-gray-400'}`}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        t.status === 'open'
                          ? 'bg-green-900/40 text-green-400'
                          : t.status === 'in_progress'
                          ? 'bg-blue-900/40 text-blue-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {(t.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
            {drillDownTickets.length > 20 && (
              <p className="text-gray-500 text-[10px] text-center pt-1">
                Showing 20 of {drillDownTickets.length} tickets
              </p>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  )
}

export default TicketCategoriesWidget
