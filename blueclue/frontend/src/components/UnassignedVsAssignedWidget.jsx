import { useState, useMemo } from 'react'
import BaseWidget from './BaseWidget'

/**
 * Donut chart widget showing assigned vs unassigned tickets.
 * Clicking a segment calls onFilter with 'assigned' | 'unassigned' | null (toggle off).
 *
 * @param {Object} props
 * @param {Array}  props.tickets          - Full ticket array from parent
 * @param {Function} [props.onRefresh]    - Callback for manual refresh
 * @param {string|null} [props.activeFilter] - Currently active filter value
 * @param {Function} [props.onFilter]     - Called with 'assigned' | 'unassigned' | null
 */
function UnassignedVsAssignedWidget({
  tickets = [],
  onRefresh = null,
  activeFilter = null,
  onFilter = null,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  // Compute segments
  const { segments, total } = useMemo(() => {
    const assigned = tickets.filter(
      (t) => t.assigned_to_name && t.assigned_to_name !== 'null'
    ).length
    const unassigned = tickets.length - assigned

    return {
      total: tickets.length,
      segments: [
        { key: 'assigned', label: 'Assigned', count: assigned, color: '#22c55e' },
        { key: 'unassigned', label: 'Unassigned', count: unassigned, color: '#f97316' },
      ],
    }
  }, [tickets])

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
      icon="📊"
      onRefresh={onRefresh}
      isEmpty={tickets.length === 0}
      emptyMessage="No tickets to display"
      emptyIcon="📋"
      noPadding
    >
      <div className="flex flex-col items-center gap-4 px-4 py-4 md:px-6">
        {/* Donut Chart */}
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
