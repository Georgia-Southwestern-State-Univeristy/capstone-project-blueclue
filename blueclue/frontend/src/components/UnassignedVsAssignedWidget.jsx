import { useState, useMemo, useCallback } from 'react'
import BaseWidget from './BaseWidget'
import { getAllTickets } from '../services/ticketService'

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#eab308' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
]

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'billing', label: 'Billing' },
  { value: 'account', label: 'Account' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'network', label: 'Network' },
  { value: 'login', label: 'Login' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_customer', label: 'Waiting on Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reopened', label: 'Reopened' },
]

/**
 * Donut chart widget showing assigned vs unassigned tickets.
 * Includes dropdown filters for priority, category, and status.
 * Clicking a segment calls onFilter with 'assigned' | 'unassigned' | null (toggle off).
 *
 * @param {Object} props
 * @param {Array}  props.tickets          - Full ticket array from parent
 * @param {Function} [props.onRefresh]    - Callback for manual refresh
 * @param {string|null} [props.activeFilter] - Currently active filter value
 * @param {Function} [props.onFilter]     - Called with 'assigned' | 'unassigned' | null
 * @param {Object} [props.widgetFilters]  - { priority, category, status } current filter values
 * @param {Function} [props.onWidgetFilterChange] - Called with (filterKey, value) when a dropdown changes
 */
function UnassignedVsAssignedWidget({
  tickets: externalTickets = [],
  activeFilter = null,
  onFilter = null,
  widgetFilters = {},
  onWidgetFilterChange = null,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [localTickets, setLocalTickets] = useState(null)

  const tickets = localTickets || externalTickets

  // Self-refresh: fetch tickets independently so the refresh button works
  const handleRefresh = useCallback(async () => {
    try {
      const response = await getAllTickets()
      setLocalTickets(response.data || [])
    } catch (err) {
      console.error('Assignment Status refresh failed:', err)
    }
  }, [])

  // Apply widget-level filters (priority, category, status) to tickets
  const filteredByDropdowns = useMemo(() => {
    let result = tickets
    if (widgetFilters.priority) {
      result = result.filter((t) => t.priority === widgetFilters.priority)
    }
    if (widgetFilters.category) {
      result = result.filter((t) => t.category === widgetFilters.category)
    }
    if (widgetFilters.status) {
      result = result.filter((t) => t.status === widgetFilters.status)
    }
    return result
  }, [tickets, widgetFilters])

  const activeDropdownCount = [widgetFilters.priority, widgetFilters.category, widgetFilters.status].filter(Boolean).length

  // Compute segments from filtered tickets
  const { segments, total } = useMemo(() => {
    const assigned = filteredByDropdowns.filter(
      (t) => t.assigned_to_name && t.assigned_to_name !== 'null'
    ).length
    const unassigned = filteredByDropdowns.length - assigned

    return {
      total: filteredByDropdowns.length,
      segments: [
        { key: 'assigned', label: 'Assigned', count: assigned, color: '#22c55e' },
        { key: 'unassigned', label: 'Unassigned', count: unassigned, color: '#f97316' },
      ],
    }
  }, [filteredByDropdowns])

  // SVG arc helper
  const getArcPath = (percent, offset, radius = 40) => {
    if (percent >= 100) {
      // Full circle — draw two half-arcs
      return [
        `M 50 ${50 - radius} A ${radius} ${radius} 0 1 1 50 ${50 + radius}`,
        `M 50 ${50 + radius} A ${radius} ${radius} 0 1 1 50 ${50 - radius}`,
      ].join(' ')
    }
    const startAngle = offset * 3.6
    const endAngle = (offset + percent) * 3.6
    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180
    const largeArc = percent > 50 ? 1 : 0
    const cx = 50
    const cy = 50
    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  // Center label
  const centerLabel =
    hoveredIndex !== null ? segments[hoveredIndex].label : 'Total'
  const centerValue =
    hoveredIndex !== null ? segments[hoveredIndex].count : total
  const centerColor =
    hoveredIndex !== null ? segments[hoveredIndex].color : '#ffffff'

  const handleSegmentClick = (key) => {
    if (!onFilter) return
    onFilter(activeFilter === key ? null : key)
  }

  return (
    <BaseWidget
      title="Assignment Status"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      }
      onRefresh={handleRefresh}
      isEmpty={tickets.length === 0}
      emptyMessage="No tickets to display"
      emptyIcon={
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      noPadding
      headerExtra={
        activeDropdownCount > 0 ? (
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
            {activeDropdownCount} filter{activeDropdownCount > 1 ? 's' : ''}
          </span>
        ) : null
      }
    >
      <div className="flex flex-col items-center gap-4 px-4 py-4">
        {/* Filter dropdowns */}
        <div className="w-full flex flex-wrap gap-2">
          {/* Priority filter */}
          <select
            value={widgetFilters.priority || ''}
            onChange={(e) => onWidgetFilterChange?.('priority', e.target.value || null)}
            className={`flex-1 min-w-0 text-xs rounded-md border px-2 py-1.5 bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer ${
              widgetFilters.priority
                ? 'border-blue-500 text-white'
                : 'border-gray-600 text-gray-400'
            }`}
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={widgetFilters.category || ''}
            onChange={(e) => onWidgetFilterChange?.('category', e.target.value || null)}
            className={`flex-1 min-w-0 text-xs rounded-md border px-2 py-1.5 bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer ${
              widgetFilters.category
                ? 'border-blue-500 text-white'
                : 'border-gray-600 text-gray-400'
            }`}
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={widgetFilters.status || ''}
            onChange={(e) => onWidgetFilterChange?.('status', e.target.value || null)}
            className={`flex-1 min-w-0 text-xs rounded-md border px-2 py-1.5 bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer ${
              widgetFilters.status
                ? 'border-blue-500 text-white'
                : 'border-gray-600 text-gray-400'
            }`}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active filter pills + clear all */}
        {activeDropdownCount > 0 && (
          <div className="w-full flex flex-wrap items-center gap-1.5">
            {widgetFilters.priority && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-gray-700 text-gray-300 rounded-full pl-2 pr-1 py-0.5">
                {PRIORITY_OPTIONS.find((p) => p.value === widgetFilters.priority)?.label}
                <button
                  onClick={() => onWidgetFilterChange?.('priority', null)}
                  className="hover:text-white transition-colors ml-0.5"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {widgetFilters.category && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-gray-700 text-gray-300 rounded-full pl-2 pr-1 py-0.5">
                {CATEGORY_OPTIONS.find((c) => c.value === widgetFilters.category)?.label}
                <button
                  onClick={() => onWidgetFilterChange?.('category', null)}
                  className="hover:text-white transition-colors ml-0.5"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {widgetFilters.status && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-gray-700 text-gray-300 rounded-full pl-2 pr-1 py-0.5">
                {STATUS_OPTIONS.find((s) => s.value === widgetFilters.status)?.label}
                <button
                  onClick={() => onWidgetFilterChange?.('status', null)}
                  className="hover:text-white transition-colors ml-0.5"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => {
                onWidgetFilterChange?.('priority', null)
                onWidgetFilterChange?.('category', null)
                onWidgetFilterChange?.('status', null)
              }}
              className="text-[10px] text-gray-500 hover:text-white transition-colors ml-auto"
            >
              Clear all
            </button>
          </div>
        )}

        {/* "Showing X of Y" subtitle when filters narrow the set */}
        {activeDropdownCount > 0 && (
          <p className="text-[10px] text-gray-500 -mt-2">
            Showing {filteredByDropdowns.length} of {tickets.length} tickets
          </p>
        )}
        {/* Donut Chart */}
        <div className="relative flex-shrink-0" style={{ width: 'clamp(120px, 40%, 160px)', aspectRatio: '1 / 1' }}>
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
                fill="none"
                stroke="#374151"
                strokeWidth="12"
              />
            ) : (
              segments.map((seg, i) => {
                const percent = (seg.count / total) * 100
                if (percent === 0) return null
                const offset = segments
                  .slice(0, i)
                  .reduce((sum, s) => sum + (s.count / total) * 100, 0)
                const isHovered = hoveredIndex === i
                const isActive = activeFilter === seg.key
                const path = getArcPath(percent, offset, isHovered ? 42 : 40)

                return (
                  <path
                    key={seg.key}
                    d={path}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isHovered || isActive ? 15 : 12}
                    strokeLinecap="butt"
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      filter:
                        isHovered || isActive
                          ? `drop-shadow(0 0 6px ${seg.color})`
                          : 'none',
                      opacity:
                        hoveredIndex !== null && !isHovered
                          ? 0.4
                          : activeFilter && !isActive
                          ? 0.4
                          : 1,
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handleSegmentClick(seg.key)}
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
            <span className="text-[10px] text-gray-400">{centerLabel}</span>
          </div>
        </div>

        {/* Legend / stats */}
        <div className="flex gap-4 w-full justify-center">
          {segments.map((seg, i) => {
            const pct = total > 0 ? ((seg.count / total) * 100).toFixed(0) : 0
            const isActive = activeFilter === seg.key
            return (
              <button
                key={seg.key}
                onClick={() => handleSegmentClick(seg.key)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`
                  flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200 text-left
                  ${isActive ? 'ring-1' : ''}
                  hover:bg-gray-800
                `}
                style={{
                  backgroundColor:
                    hoveredIndex === i || isActive
                      ? `${seg.color}15`
                      : 'transparent',
                  ringColor: isActive ? seg.color : undefined,
                  borderColor: isActive ? seg.color : 'transparent',
                }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200"
                  style={{
                    backgroundColor: seg.color,
                    transform:
                      hoveredIndex === i || isActive
                        ? 'scale(1.4)'
                        : 'scale(1)',
                  }}
                />
                <div>
                  <p className="text-xs text-gray-400">
                    {seg.label}
                  </p>
                  <p className="text-lg font-bold text-white leading-tight">
                    {seg.count}{' '}
                    <span className="text-xs font-normal text-gray-500">
                      ({pct}%)
                    </span>
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Active filter indicator */}
        {activeFilter && (
          <button
            onClick={() => onFilter(null)}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 pb-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filter
          </button>
        )}
      </div>
    </BaseWidget>
  )
}

export default UnassignedVsAssignedWidget
