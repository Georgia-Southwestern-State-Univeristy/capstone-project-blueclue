import { useState } from 'react'

/**
 * TicketAssignmentWidget
 * Displays assignment pie chart with severity color coding and Assign Tickets button.
 */
function TicketAssignmentWidget({ assignedCount = 0, unassignedCount = 0, onAssignTickets }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const segments = [
    { label: 'Assigned', count: assignedCount, color: '#22c55e' },
    { label: 'Unassigned', count: unassignedCount, color: '#6b7280' }
  ]

  const total = assignedCount + unassignedCount
  const safeTotal = total || 1

  // Severity styling based on unassigned count
  const getSeverityStyles = (count) => {
    if (count >= 15) {
      return {
        border: 'border-red-700',
        badge: 'bg-red-700 text-white',
        button: 'bg-red-600 hover:bg-red-700 text-white',
        status: 'High',
        statusColor: 'text-red-400'
      }
    }
    if (count >= 10) {
      return {
        border: 'border-orange-700',
        badge: 'bg-orange-700 text-white',
        button: 'bg-orange-600 hover:bg-orange-700 text-white',
        status: 'Elevated',
        statusColor: 'text-orange-400'
      }
    }
    if (count >= 5) {
      return {
        border: 'border-yellow-700',
        badge: 'bg-yellow-700 text-white',
        button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        status: 'Moderate',
        statusColor: 'text-yellow-400'
      }
    }
    return {
      border: 'border-green-700',
      badge: 'bg-green-700 text-white',
      button: 'bg-green-600 hover:bg-green-700 text-white',
      status: 'Healthy',
      statusColor: 'text-green-400'
    }
  }

  const severity = getSeverityStyles(unassignedCount)

  // Pie slice path builder
  const getSlicePath = (percent, offset, cx = 50, cy = 50, r = 40) => {
    if (percent >= 100) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
    }
    const startAngle = offset * 3.6
    const endAngle = (offset + percent) * 3.6
    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180
    const largeArc = percent > 50 ? 1 : 0
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  const centerLabel = hoveredIndex !== null ? segments[hoveredIndex].label : 'Total'
  const centerValue = hoveredIndex !== null ? segments[hoveredIndex].count : total
  const centerPercent = hoveredIndex !== null
    ? `${Math.round((segments[hoveredIndex].count / safeTotal) * 100)}%`
    : null

  return (
    <div className={`bg-gray-900 rounded-lg border ${severity.border} shadow-sm p-5 max-w-sm`}>
      <h3 className="text-lg font-bold text-white mb-4">Ticket Assignments</h3>

      {/* Pie Chart */}
      <div className="flex flex-col items-center gap-4 mb-4">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: 'visible' }}>
            {total === 0 ? (
              <circle cx="50" cy="50" r="40" fill="#374151" />
            ) : (
              segments.map((segment, i) => {
                const percent = (segment.count / safeTotal) * 100
                if (percent === 0) return null
                const offset = segments.slice(0, i).reduce(
                  (sum, s) => sum + (s.count / safeTotal) * 100, 0
                )
                const isHovered = hoveredIndex === i
                const path = getSlicePath(percent, offset, 50, 50, isHovered ? 42 : 40)
                return (
                  <path
                    key={segment.label}
                    d={path}
                    fill={segment.color}
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 8px ${segment.color})` : 'none',
                      opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                )
              })
            )}
            <circle cx="50" cy="50" r="24" fill="#111827" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-xl font-bold transition-colors duration-200"
              style={{ color: hoveredIndex !== null ? segments[hoveredIndex].color : '#ffffff' }}
            >
              {centerPercent || centerValue}
            </span>
            <span className="text-xs text-gray-400">{centerLabel}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4">
          {segments.map((segment, i) => (
            <div
              key={segment.label}
              className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 transition-colors duration-200"
              style={{ backgroundColor: hoveredIndex === i ? `${segment.color}15` : 'transparent' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className="w-3 h-3 rounded-full transition-transform duration-200"
                style={{ backgroundColor: segment.color, transform: hoveredIndex === i ? 'scale(1.4)' : 'scale(1)' }}
              />
              <div>
                <p className="text-xs text-gray-400">{segment.label}</p>
                <p className="text-sm font-bold text-white">{segment.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status & Button */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-700 pt-4">
        <p className="text-gray-300 text-xs">
          Queue: <span className={`font-semibold ${severity.statusColor}`}>{severity.status}</span>
        </p>
        <button
          type="button"
          onClick={onAssignTickets}
          className={`${severity.button} px-3 py-1 rounded text-sm font-medium transition-colors`}
        >
          Assign Tickets
        </button>
      </div>
    </div>
  )
}

export default TicketAssignmentWidget