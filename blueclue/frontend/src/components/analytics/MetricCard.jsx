/**
 * Metric Card Component for Analytics Dashboard
 * Displays a single metric with optional comparison to previous period
 */
function MetricCard({
  title,
  value,
  subtitle,
  change = null,
  changeLabel = 'vs previous period',
  icon = null,
  color = 'blue',
  onClick = null,
  loading = false,
  format = 'number'
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    gray: 'bg-gray-800 border-gray-700 text-gray-400'
  }

  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A'
    
    switch (format) {
      case 'percent':
        return `${val.toFixed(1)}%`
      case 'hours':
        return `${val.toFixed(1)}h`
      case 'number':
      default:
        return typeof val === 'number' ? val.toLocaleString() : val
    }
  }

  const getChangeColor = () => {
    if (change === null || change === undefined) return 'text-gray-500'
    if (change < 0) return 'text-green-400' // Negative change is good (less time)
    if (change > 0) return 'text-red-400'   // Positive change is bad (more time)
    return 'text-gray-500'
  }

  const getChangeIcon = () => {
    if (change === null || change === undefined) return null
    if (change < 0) return '↓'
    if (change > 0) return '↑'
    return '→'
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-2/3 mb-3"></div>
        <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-700 rounded w-1/3"></div>
      </div>
    )
  }

  return (
    <div 
      className={`
        rounded-lg border p-4 transition-all duration-200
        ${colorClasses[color] || colorClasses.gray}
        ${onClick ? 'cursor-pointer hover:scale-102 hover:shadow-lg' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-medium text-gray-400">{title}</h4>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">
          {formatValue(value)}
        </span>
        
        {change !== null && change !== undefined && (
          <span className={`text-sm font-medium flex items-center gap-0.5 ${getChangeColor()}`}>
            {getChangeIcon()} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
      
      {change !== null && change !== undefined && changeLabel && (
        <p className="text-xs text-gray-600 mt-1">{changeLabel}</p>
      )}
    </div>
  )
}

export default MetricCard
