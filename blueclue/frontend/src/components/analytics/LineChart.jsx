import { useState } from 'react'

/**
 * Line Chart Component for Analytics Dashboard
 * Renders a line graph with hover interactions
 */
function LineChart({ 
  data = [], 
  xKey = 'date', 
  yKey = 'value',
  yKey2 = null,
  title = 'Trend',
  color = '#3b82f6',
  color2 = '#10b981',
  height = 200,
  showGrid = true,
  formatX = (val) => val,
  formatY = (val) => val,
  unit = '',
  yLabel = '',
  y2Label = ''
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null)

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

  // Calculate bounds
  const values = data.map(d => d[yKey]).filter(v => v !== null && v !== undefined)
  const values2 = yKey2 ? data.map(d => d[yKey2]).filter(v => v !== null && v !== undefined) : []
  const allValues = [...values, ...values2]
  
  const minY = Math.min(0, Math.min(...allValues))
  const maxY = Math.max(...allValues) * 1.1 || 10
  const range = maxY - minY || 1

  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }
  const chartWidth = 100
  const chartHeight = height

  // Calculate points
  const getX = (index) => padding.left + (index / (data.length - 1 || 1)) * (chartWidth - padding.left - padding.right)
  const getY = (value) => chartHeight - padding.bottom - ((value - minY) / range) * (chartHeight - padding.top - padding.bottom)

  // Create path
  const createPath = (key) => {
    return data
      .map((d, i) => {
        const x = getX(i)
        const y = getY(d[key] ?? 0)
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
      })
      .join(' ')
  }

  // Create area fill path
  const createArea = (key) => {
    const linePath = data
      .map((d, i) => {
        const x = getX(i)
        const y = getY(d[key] ?? 0)
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
      })
      .join(' ')
    
    const lastX = getX(data.length - 1)
    const firstX = getX(0)
    const bottomY = getY(minY)
    
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }

  // Y-axis ticks
  const yTicks = 5
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minY + (range * i) / yTicks)

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {(yLabel || y2Label) && (
          <div className="flex gap-4 text-xs">
            {yLabel && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5" style={{ backgroundColor: color }}></div>
                <span className="text-gray-400">{yLabel}</span>
              </div>
            )}
            {y2Label && yKey2 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5" style={{ backgroundColor: color2 }}></div>
                <span className="text-gray-400">{y2Label}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="relative">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full" 
          style={{ height: `${height}px` }}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {showGrid && yTickValues.map((tick, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={getY(tick)}
              x2={chartWidth - padding.right}
              y2={getY(tick)}
              stroke="#374151"
              strokeWidth="0.2"
              strokeDasharray="2,2"
            />
          ))}

          {/* Y-axis labels */}
          {yTickValues.map((tick, i) => (
            <text
              key={i}
              x={padding.left - 5}
              y={getY(tick)}
              fill="#9ca3af"
              fontSize="3"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatY(tick.toFixed(0))}
            </text>
          ))}

          {/* Area fill */}
          <path
            d={createArea(yKey)}
            fill={`${color}20`}
          />
          {yKey2 && (
            <path
              d={createArea(yKey2)}
              fill={`${color2}15`}
            />
          )}

          {/* Main line */}
          <path
            d={createPath(yKey)}
            fill="none"
            stroke={color}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Secondary line */}
          {yKey2 && (
            <path
              d={createPath(yKey2)}
              fill="none"
              stroke={color2}
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1,0.5"
            />
          )}

          {/* Data points */}
          {data.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(d[yKey] ?? 0)}
                r={hoveredPoint === i ? '1.5' : '0.8'}
                fill={color}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {yKey2 && d[yKey2] !== undefined && (
                <circle
                  cx={getX(i)}
                  cy={getY(d[yKey2] ?? 0)}
                  r={hoveredPoint === i ? '1.5' : '0.8'}
                  fill={color2}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              )}
            </g>
          ))}

          {/* X-axis labels (show a few) */}
          {data.filter((_item, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d) => {
            const actualIndex = data.indexOf(d)
            return (
              <text
                key={actualIndex}
                x={getX(actualIndex)}
                y={chartHeight - padding.bottom + 10}
                fill="#9ca3af"
                fontSize="3"
                textAnchor="middle"
              >
                {formatX(d[xKey])}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint !== null && data[hoveredPoint] && (
          <div 
            className="absolute bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm pointer-events-none z-10 shadow-lg"
            style={{
              left: `${(hoveredPoint / (data.length - 1)) * 100}%`,
              top: '0',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="text-gray-400 text-xs mb-1">{formatX(data[hoveredPoint][xKey])}</div>
            <div className="text-white font-semibold">
              {formatY(data[hoveredPoint][yKey])}{unit}
            </div>
            {yKey2 && data[hoveredPoint][yKey2] !== undefined && (
              <div className="text-gray-300 text-xs">
                {formatY(data[hoveredPoint][yKey2])}{unit}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LineChart
