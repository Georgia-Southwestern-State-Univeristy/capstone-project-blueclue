import { useState } from 'react'

/**
 * Heatmap Component for Analytics Dashboard
 * Shows activity patterns by day/hour
 */
function Heatmap({
  data = [],
  title = 'Activity Heatmap',
  height = 200
}) {
  const [hoveredCell, setHoveredCell] = useState(null)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  // 24 hours grid referenced by hourIndex in the map below
  const _hours = Array.from({ length: 24 }, (_, i) => i)

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  // Find max value for color scaling
  const allCounts = data.flatMap(d => d.hours?.map(h => h.count) || [])
  const maxCount = Math.max(...allCounts, 1)

  // Color scale (blue gradient)
  const getColor = (count) => {
    if (count === 0) return '#1f2937' // gray-800
    const intensity = count / maxCount
    const alpha = Math.max(0.2, intensity)
    return `rgba(59, 130, 246, ${alpha})` // blue with varying opacity
  }

  const cellWidth = 100 / 24
  const _cellHeight = 100 / 7

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      
      <div className="flex">
        {/* Day labels */}
        <div className="flex flex-col justify-around pr-2" style={{ width: '40px' }}>
          {dayNames.map((day, i) => (
            <span key={i} className="text-xs text-gray-400 text-right">{day}</span>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex-1 relative">
          <svg viewBox="0 0 100 70" className="w-full" style={{ height: `${height}px` }}>
            {data.map((dayData, dayIndex) => (
              dayData.hours?.map((hourData, hourIndex) => {
                const isHovered = hoveredCell?.day === dayIndex && hoveredCell?.hour === hourIndex
                return (
                  <rect
                    key={`${dayIndex}-${hourIndex}`}
                    x={hourIndex * cellWidth + 0.5}
                    y={dayIndex * (70 / 7) + 0.5}
                    width={cellWidth - 1}
                    height={(70 / 7) - 1}
                    fill={getColor(hourData.count)}
                    rx="1"
                    className="cursor-pointer transition-all duration-150"
                    style={{
                      stroke: isHovered ? '#fff' : 'transparent',
                      strokeWidth: isHovered ? 0.5 : 0
                    }}
                    onMouseEnter={() => setHoveredCell({ day: dayIndex, hour: hourIndex, count: hourData.count })}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                )
              })
            ))}
          </svg>

          {/* Hour labels */}
          <div className="flex justify-between mt-2 px-0.5">
            {[0, 6, 12, 18, 23].map(h => (
              <span key={h} className="text-xs text-gray-500">{h}:00</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip - fixed height to prevent layout shift */}
      <div className="mt-4 text-center h-6">
        {hoveredCell && (
          <>
            <span className="text-sm text-gray-400">
              {dayNames[hoveredCell.day]} at {hoveredCell.hour}:00 - {hoveredCell.hour + 1}:00
            </span>
            <span className="ml-2 text-sm font-semibold text-white">
              {hoveredCell.count} tickets
            </span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <span className="text-xs text-gray-500">Less</span>
        <div className="flex gap-1">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded"
              style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500">More</span>
      </div>
    </div>
  )
}

export default Heatmap
