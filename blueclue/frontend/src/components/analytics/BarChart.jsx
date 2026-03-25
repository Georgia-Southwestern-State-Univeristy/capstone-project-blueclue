import { useState, useRef, useEffect } from 'react'

/**
 * Bar Chart Component for Analytics Dashboard
 * Supports horizontal and vertical bars, stacked bars
 */
function BarChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  title = 'Bar Chart',
  color: _color = '#3b82f6', // eslint-disable-line no-unused-vars
  horizontal = false,
  height = 250,
  formatValue = (val) => val,
  onBarClick = null,
  showValues = true,
  maxBars = 10,
  colorMap = null
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(500)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(Math.round(entry.contentRect.width))
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

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

  // Limit data if needed
  const displayData = data.slice(0, maxBars)
  const maxValue = Math.max(...displayData.map(d => d[yKey])) || 1

  // Default color palette
  const defaultColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]

  const getBarColor = (item, index) => {
    if (colorMap && item[xKey] && colorMap[item[xKey]]) {
      return colorMap[item[xKey]]
    }
    if (item.color) return item.color
    return defaultColors[index % defaultColors.length]
  }

  if (horizontal) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {displayData.map((item, index) => {
            const barWidth = (item[yKey] / maxValue) * 100
            const barColor = getBarColor(item, index)
            const isHovered = hoveredIndex === index

            return (
              <div 
                key={index}
                className={`group ${onBarClick ? 'cursor-pointer' : ''}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onBarClick && onBarClick(item)}
              >
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-300 truncate max-w-[60%]">
                    {item[xKey]}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {formatValue(item[yKey])}
                  </span>
                </div>
                <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: barColor,
                      opacity: hoveredIndex !== null && !isHovered ? 0.5 : 1,
                      boxShadow: isHovered ? `0 0 10px ${barColor}` : 'none'
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Vertical bar chart
  const barSpacing = 8
  const chartWidth = containerWidth
  const chartHeight = height
  const padding = { top: 25, right: 20, bottom: 45, left: 55 }
  const availableWidth = chartWidth - padding.left - padding.right
  const barWidth = (availableWidth - barSpacing * (displayData.length - 1)) / displayData.length

  const getX = (index) => padding.left + index * (barWidth + barSpacing)
  const getBarHeight = (value) => ((value / maxValue) * (chartHeight - padding.top - padding.bottom))
  const getY = (value) => chartHeight - padding.bottom - getBarHeight(value)

  // Y-axis ticks
  const yTicks = 5
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue * i) / yTicks)

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="relative" ref={containerRef}>
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
                strokeWidth="0.5"
                strokeDasharray="4,3"
              />
              <text
                x={padding.left - 4}
                y={getY(tick)}
                fill="#9ca3af"
                fontSize="11"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatValue(tick.toFixed(0))}
              </text>
            </g>
          ))}

          {/* Bars */}
          {displayData.map((item, index) => {
            const barColor = getBarColor(item, index)
            const isHovered = hoveredIndex === index
            const barHeight = getBarHeight(item[yKey])

            return (
              <g 
                key={index}
                className={onBarClick ? 'cursor-pointer' : ''}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onBarClick && onBarClick(item)}
              >
                <rect
                  x={getX(index)}
                  y={getY(item[yKey])}
                  width={barWidth}
                  height={barHeight}
                  fill={barColor}
                  rx="2"
                  className="transition-all duration-200"
                  style={{
                    opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1,
                    filter: isHovered ? `drop-shadow(0 0 4px ${barColor})` : 'none'
                  }}
                />
                {/* Value label */}
                {showValues && barHeight > 10 && (
                  <text
                    x={getX(index) + barWidth / 2}
                    y={getY(item[yKey]) + 12}
                    fill="white"
                    fontSize="10"
                    textAnchor="middle"
                    dominantBaseline="hanging"
                  >
                    {formatValue(item[yKey])}
                  </text>
                )}
              </g>
            )
          })}

          {/* X-axis labels */}
          {displayData.map((item, index) => (
            <text
              key={index}
              x={getX(index) + barWidth / 2}
              y={chartHeight - padding.bottom + 16}
              fill="#9ca3af"
              fontSize="11"
              textAnchor="middle"
              className="truncate"
            >
              {typeof item[xKey] === 'string' ? item[xKey].substring(0, 8) : item[xKey]}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && displayData[hoveredIndex] && (
          <div 
            className="absolute bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm pointer-events-none z-10 shadow-lg"
            style={{
              left: `${(getX(hoveredIndex) + barWidth / 2) / chartWidth * 100}%`,
              bottom: `${(getBarHeight(displayData[hoveredIndex][yKey]) / chartHeight * 100) + 15}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="text-gray-400 text-xs">{displayData[hoveredIndex][xKey]}</div>
            <div className="text-white font-semibold">{formatValue(displayData[hoveredIndex][yKey])}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BarChart
