import { useState, useEffect, useCallback } from 'react'

/**
 * RefreshButton — Standard refresh button used across all widgets.
 *
 * Matches the style from BaseWidget (gray circle, w-7 h-7, spin animation).
 * Each button refreshes ONLY the widget it belongs to via its `onRefresh` callback.
 * Displays an "updated just now / Xs ago / Xm ago" timestamp after each refresh.
 *
 * @param {Object} props
 * @param {Function} props.onRefresh  - Async callback that refreshes the parent widget's data
 * @param {boolean}  [props.disabled] - Externally disable the button (e.g. widget is loading)
 * @param {string}   [props.className] - Additional classes on the outer button
 */
export default function RefreshButton({ onRefresh, disabled = false, className = '' }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [, setTick] = useState(0)

  // Re-render the last-refreshed text periodically
  useEffect(() => {
    if (!lastRefreshed) return
    const timer = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(timer)
  }, [lastRefreshed])

  // Format "last refreshed" relative time (matches BaseWidget)
  const formatLastRefreshed = () => {
    if (!lastRefreshed) return null
    const seconds = Math.round((Date.now() - lastRefreshed.getTime()) / 1000)
    if (seconds < 5) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    return `${minutes}m ago`
  }

  const handleClick = useCallback(async () => {
    if (!onRefresh || isRefreshing || disabled) return
    setIsRefreshing(true)
    try {
      await onRefresh()
      setLastRefreshed(new Date())
    } catch (err) {
      console.error('Widget refresh failed:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, isRefreshing, disabled])

  return (
    <div className="flex items-center gap-2">
      {lastRefreshed && (
        <span className="text-[10px] text-gray-500 hidden sm:inline">
          updated {formatLastRefreshed()}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={isRefreshing || disabled}
        title={isRefreshing ? 'Refreshing…' : 'Refresh'}
        className={`
          w-7 h-7 flex items-center justify-center rounded-full
          bg-gray-700 hover:bg-gray-600
          disabled:bg-gray-800 disabled:cursor-not-allowed
          transition-all
          ${isRefreshing ? 'animate-spin' : ''}
          ${className}
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
    </div>
  )
}
