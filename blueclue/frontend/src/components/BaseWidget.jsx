import { useState, useEffect, useRef, useCallback } from 'react'
import LoadingSpinner from './LoadingSpinner'

/**
 * BaseWidget - Reusable widget container with consistent styling,
 * refresh mechanism, and error/empty/loading states.
 *
 * @param {Object} props
 * @param {string} props.title - Widget title displayed in the header
 * @param {React.ReactNode} [props.icon] - Icon/emoji shown before the title
 * @param {React.ReactNode} props.children - Widget body content
 * @param {Function} [props.onRefresh] - Callback for manual refresh; enables the refresh button
 * @param {number} [props.autoRefreshInterval=0] - Auto-refresh interval in ms (0 = disabled)
 * @param {boolean} [props.isLoading=false] - Shows a loading overlay
 * @param {string|null} [props.error=null] - Error message to display (replaces children)
 * @param {boolean} [props.isEmpty=false] - If true, shows the empty state (replaces children)
 * @param {string} [props.emptyMessage='No data available'] - Message for empty state
 * @param {string} [props.emptyIcon=''] - Icon/emoji for empty state
 * @param {React.ReactNode} [props.headerExtra] - Extra content rendered in the header row (e.g. filters)
 * @param {string} [props.className] - Additional CSS classes on the outer container
 * @param {boolean} [props.noPadding=false] - Remove body padding (useful for charts)
 * @param {string} [props.minHeight] - Optional min-height for the body area (e.g. '12rem')
 */
function BaseWidget({
  title,
  icon = null,
  children,
  onRefresh = null,
  autoRefreshInterval = 0,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'No data available',
  emptyIcon = null,
  headerExtra = null,
  className = '',
  noPadding = false,
  minHeight = null,
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const intervalRef = useRef(null)

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
      setLastRefreshed(new Date())
    } catch (err) {
      console.error('Widget refresh failed:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, isRefreshing])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshInterval > 0 && onRefresh) {
      intervalRef.current = setInterval(async () => {
        try {
          await onRefresh()
          setLastRefreshed(new Date())
        } catch (err) {
          console.error('Auto-refresh failed:', err)
        }
      }, autoRefreshInterval)

      return () => clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefreshInterval, onRefresh])

  // Format "last refreshed" relative time
  const formatLastRefreshed = () => {
    if (!lastRefreshed) return null
    const seconds = Math.round((Date.now() - lastRefreshed.getTime()) / 1000)
    if (seconds < 5) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    return `${minutes}m ago`
  }

  // Re-render the last-refreshed text periodically
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!lastRefreshed) return
    const timer = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(timer)
  }, [lastRefreshed])

  return (
    <div
      className={`bg-gray-900 rounded-lg border border-gray-700 shadow-sm flex flex-col h-full overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
          <h3 className="text-base font-semibold text-white truncate">{title}</h3>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Last refreshed timestamp */}
          {lastRefreshed && (
            <span className="text-[10px] text-gray-500 hidden sm:inline">
              updated {formatLastRefreshed()}
            </span>
          )}

          {/* Auto-refresh indicator */}
          {autoRefreshInterval > 0 && (
            <span
              className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
              title={`Auto-refresh every ${Math.round(autoRefreshInterval / 1000)}s`}
            />
          )}

          {/* Extra header content (filters, toggles, etc.) */}
          {headerExtra}

          {/* Manual refresh button */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              title={isRefreshing ? 'Refreshing…' : 'Refresh'}
              className={`
                w-7 h-7 flex items-center justify-center rounded-full
                bg-gray-700 hover:bg-gray-600
                disabled:bg-gray-800 disabled:cursor-not-allowed
                transition-all
                ${isRefreshing ? 'animate-spin' : ''}
              `}
            >
              <svg
                className="w-3.5 h-3.5 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        className={`flex-1 relative min-h-0 overflow-y-auto ${noPadding ? '' : 'p-4'}`}
        style={minHeight ? { minHeight } : undefined}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center z-10 rounded-b-lg">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error state */}
        {error ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <svg
              className="w-10 h-10 text-red-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-400 text-sm font-medium mb-1">Something went wrong</p>
            <p className="text-gray-500 text-xs mb-4 max-w-xs">{error}</p>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                {isRefreshing ? 'Retrying…' : 'Retry'}
              </button>
            )}
          </div>
        ) : isEmpty && !isLoading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            {emptyIcon ? (
              <span className="text-3xl mb-3">{emptyIcon}</span>
            ) : (
              <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            )}
            <p className="text-gray-400 text-sm">{emptyMessage}</p>
          </div>
        ) : (
          /* Normal content */
          children
        )}
      </div>
    </div>
  )
}

export default BaseWidget
