import { useState } from 'react'

const defaultSegments = [
  { label: 'Open', count: 0, color: '#60a5fa' },
  { label: 'In Progress', count: 0, color: '#93c5fd' },
  { label: 'Waiting', count: 0, color: '#a78bfa' },
  { label: 'Resolved', count: 0, color: '#3b82f6' },
  { label: 'Closed', count: 0, color: '#6b7280' },
]

function DonutChart({ segments = defaultSegments, total }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const chartTotal = total ?? segments.reduce((sum, s) => sum + s.count, 0)
  const safeTotal = chartTotal || 1

  // Build arc path for a donut segment
  const getArcPath = (percent, offset, radius = 40) => {
    const startAngle = offset * 3.6
    const endAngle = (offset + percent) * 3.6
    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180
    const largeArc = percent > 50 ? 1 : 0
    const cx = 50, cy = 50

    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  // Center display: show hovered segment or total
  const centerLabel = hoveredIndex !== null ? segments[hoveredIndex].label : 'Total'
  const centerValue = hoveredIndex !== null ? segments[hoveredIndex].count : chartTotal

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6 h-full">
      <h3 className="text-lg font-semibold text-white mb-4">Status Overview</h3>
      <div className="flex flex-col items-center gap-6">
        {/* SVG Donut */}
        <div className="relative w-52 h-52 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: 'visible' }}>
            {chartTotal === 0 ? (
              <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="12" />
            ) : (
              segments.map((segment, i) => {
                const percent = (segment.count / safeTotal) * 100
                if (percent === 0) return null
                const offset = segments.slice(0, i).reduce(
                  (sum, s) => sum + (s.count / safeTotal) * 100, 0
                )
                const isHovered = hoveredIndex === i
                const path = getArcPath(percent, offset, isHovered ? 42 : 40)

                return (
                  <path
                    key={segment.label}
                    d={path}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={isHovered ? 15 : 12}
                    strokeLinecap="butt"
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 6px ${segment.color})` : 'none',
                      opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1,
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                )
              })
            )}
          </svg>
          {/* Center display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-3xl font-bold transition-colors duration-200"
              style={{ color: hoveredIndex !== null ? segments[hoveredIndex].color : '#ffffff' }}
            >
              {centerValue}
            </span>
            <span className="text-xs text-gray-400">{centerLabel}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4">
          {segments.map((segment, i) => (
            <div
              key={segment.label}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 transition-colors duration-200"
              style={{
                backgroundColor: hoveredIndex === i ? `${segment.color}15` : 'transparent',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200"
                style={{
                  backgroundColor: segment.color,
                  transform: hoveredIndex === i ? 'scale(1.4)' : 'scale(1)',
                }}
              ></div>
              <div>
                <p className="text-sm text-gray-400">{segment.label}</p>
                <p className="text-lg font-bold text-white">{segment.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DonutChart
