import { useState } from 'react'

/**
 * Stacked Bar Chart Component for Status Distribution
 */
function StackedBarChart({
  data = [],
  xKey = 'date',
  stackKeys = [],
  title = 'Status Distribution',
  height = 250,
  colors = {},
  formatX = (val) => val,
  showLegend = true
}) {
  const [hoveredBar, setHoveredBar] = useState(null)

  const defaultColors = {
    open: '#60a5fa',
    in_progress: '#fbbf24',
    waiting_on_customer: '#a78bfa',
    resolved: '#34d399',
    closed: '#6b7280',
    cancelled: '#ef4444',
    reopened: '#f97316'
  }

  const colorMap = { ...defaultColors, ...colors }

  if (!data || data.length === 0 || stackKeys.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  // Calculate max total for scaling
  const totals = data.map(d => stackKeys.reduce((sum, key) => sum + (d[key] || 0), 0))
  const maxTotal = Math.max(...totals, 1)

  // Chart dimensions
  const padding = { top: 20, right: 10, bottom: 40, left: 40 }
  const chartWidth = 100
  const chartHeight = height
  const barSpacing = 2
  const availableWidth = chartWidth - padding.left - padding.right
  const barWidth = (availableWidth - barSpacing * (data.length - 1)) / data.length

  const getX = (index) => padding.left + index * (barWidth + barSpacing)
  const getBarHeight = (value) => ((value / maxTotal) * (chartHeight - padding.top - padding.bottom))
  const getY = (value) => chartHeight - padding.bottom - getBarHeight(value)

  // Y-axis ticks
  const yTicks = 5
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxTotal * i) / yTicks))

  const formatLabel = (key) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      
      {showLegend && (
        <div className="flex flex-wrap gap-4 mb-4">
          {stackKeys.map(key => (
            <div key={key} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colorMap[key] || '#6b7280' }}
              />
              <span className="text-xs text-gray-400">{formatLabel(key)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full"
          style={{ height: `${height}px` }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y-axis grid and labels */}
          {yTickValues.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={getY(tick)}
                x2={chartWidth - padding.right}
                y2={getY(tick)}
                stroke="#374151"
                strokeWidth="0.2"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 3}
                y={getY(tick)}
                fill="#9ca3af"
                fontSize="3"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Stacked bars */}
          {data.map((item, barIndex) => {
            let currentY = chartHeight - padding.bottom
            const isHovered = hoveredBar?.barIndex === barIndex

            return (
              <g 
                key={barIndex}
                onMouseEnter={() => setHoveredBar({ barIndex, data: item })}
                onMouseLeave={() => setHoveredBar(null)}
                className="cursor-pointer"
              >
                {stackKeys.map((key) => {
                  const value = item[key] || 0
                  const segmentHeight = getBarHeight(value)
                  const y = currentY - segmentHeight
                  currentY = y

                  return (
                    <rect
                      key={key}
                      x={getX(barIndex)}
                      y={y}
                      width={barWidth}
                      height={segmentHeight}
                      fill={colorMap[key] || '#6b7280'}
                      className="transition-all duration-200"
                      style={{
                        opacity: hoveredBar !== null && !isHovered ? 0.4 : 1
                      }}
                    />
                  )
                })}
                {/* Hover highlight border */}
                {isHovered && (
                  <rect
                    x={getX(barIndex) - 0.5}
                    y={getY(totals[barIndex]) - 0.5}
                    width={barWidth + 1}
                    height={getBarHeight(totals[barIndex]) + 1}
                    fill="none"
                    stroke="white"
                    strokeWidth="0.3"
                    rx="1"
                  />
                )}
              </g>
            )
          })}

          {/* X-axis labels */}
          {data.map((item, index) => {
            // Show fewer labels if there are many bars
            if (data.length > 20 && index % Math.ceil(data.length / 10) !== 0 && index !== data.length - 1) {
              return null
            }
            return (
              <text
                key={index}
                x={getX(index) + barWidth / 2}
                y={chartHeight - padding.bottom + 8}
                fill="#9ca3af"
                fontSize="2.5"
                textAnchor="middle"
              >
                {formatX(item[xKey])}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hoveredBar && (
          <div 
            className="absolute bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm pointer-events-none z-10 shadow-lg"
            style={{
              left: `${((getX(hoveredBar.barIndex) + barWidth / 2) / chartWidth) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="text-gray-400 text-xs mb-1">{formatX(hoveredBar.data[xKey])}</div>
            {stackKeys.map(key => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-gray-300 text-xs">{formatLabel(key)}:</span>
                <span className="text-white font-semibold text-xs">{hoveredBar.data[key] || 0}</span>
              </div>
            ))}
            <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
              <span className="text-gray-400 text-xs">Total:</span>
              <span className="text-white font-semibold text-xs">
                {stackKeys.reduce((sum, key) => sum + (hoveredBar.data[key] || 0), 0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StackedBarChart
