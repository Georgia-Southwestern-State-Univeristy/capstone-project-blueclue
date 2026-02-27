import { useState, useEffect, useCallback } from 'react'
import BaseWidget from './BaseWidget'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Alert-level config: styling, labels and icons
 */
const ALERT_STYLES = {
  critical: {
    bg: 'bg-red-900/40',
    border: 'border-red-700/60',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400',
    label: 'CRITICAL',
    icon: 'critical',
    pulse: true,
  },
  high: {
    bg: 'bg-orange-900/30',
    border: 'border-orange-700/50',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-400',
    label: 'HIGH',
    icon: 'high',
    pulse: false,
  },
  medium: {
    bg: 'bg-yellow-900/25',
    border: 'border-yellow-700/40',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-400',
    label: 'MEDIUM',
    icon: 'medium',
    pulse: false,
  },
  warning: {
    bg: 'bg-gray-800/60',
    border: 'border-gray-700/50',
    text: 'text-yellow-300',
    badge: 'bg-yellow-500/15 text-yellow-300',
    label: 'WARNING',
    icon: 'warning',
    pulse: false,
  },
}

const PRIORITY_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
}

/**
 * OverdueTicketsWidget
 * Fetches overdue tickets from the analytics API and displays them
 * as an alert-styled list with days overdue, priority, and color coding.
 *
 * @param {Object}   props
 * @param {Function} [props.onRefresh]       - Parent refresh callback
 * @param {Function} [props.onTicketClick]   - Called with ticket object when a row is clicked
 * @param {number}   [props.autoRefreshInterval=0] - Auto-refresh in ms (0 = off)
 */
function OverdueTicketsWidget({
  onRefresh = null,
  onTicketClick = null,
  autoRefreshInterval = 0,
}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterLevel, setFilterLevel] = useState(null) // null = all, or 'critical'|'high'|'medium'|'warning'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('blueclue_token')
      const res = await fetch(`${API_BASE_URL}/analytics/overdue-tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      console.error('Overdue tickets fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    await fetchData()
    if (onRefresh) await onRefresh()
  }, [fetchData, onRefresh])

  // Compute summary counts by alert level
  const summary = {
    critical: data.filter((t) => t.alert_level === 'critical').length,
    high: data.filter((t) => t.alert_level === 'high').length,
    medium: data.filter((t) => t.alert_level === 'medium').length,
    warning: data.filter((t) => t.alert_level === 'warning').length,
  }

  const filteredData = filterLevel
    ? data.filter((t) => t.alert_level === filterLevel)
    : data

  const formatDaysOverdue = (days) => {
    if (days < 1) {
      const hours = Math.round(days * 24)
      return hours <= 1 ? '< 1 hour' : `${hours} hours`
    }
    if (days < 2) return '1 day'
    return `${Math.round(days)} days`
  }

  return (
    <BaseWidget
      title="Overdue Tickets"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      onRefresh={handleRefresh}
      autoRefreshInterval={autoRefreshInterval}
      isLoading={loading && data.length === 0}
      error={error}
      isEmpty={data.length === 0 && !loading}
      emptyMessage="No overdue tickets — great job!"
      emptyIcon={
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      }
      noPadding
      headerExtra={
        data.length > 0 ? (
          <span className="text-xs font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            {data.length}
          </span>
        ) : null
      }
    >
      <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
        {/* Summary badges — click to filter by alert level */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(['critical', 'high', 'medium', 'warning']).map((level) => {
            const count = summary[level]
            if (count === 0) return null
            const style = ALERT_STYLES[level]
            const isActive = filterLevel === level
            return (
              <button
                key={level}
                onClick={() => setFilterLevel(isActive ? null : level)}
                className={`
                  inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-all
                  ${style.badge}
                  ${isActive ? 'ring-1 ring-current scale-105' : 'opacity-80 hover:opacity-100'}
                `}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${
                  level === 'critical' ? 'bg-red-500' :
                  level === 'high' ? 'bg-orange-500' :
                  level === 'medium' ? 'bg-yellow-500' : 'bg-yellow-300'
                }`} />
                {count} {style.label.toLowerCase()}
              </button>
            )
          })}
          {filterLevel && (
            <button
              onClick={() => setFilterLevel(null)}
              className="text-[10px] text-gray-500 hover:text-white transition-colors ml-auto self-center"
            >
              Show all
            </button>
          )}
        </div>

        {/* Ticket list */}
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {filteredData.length === 0 && !loading ? (
            <p className="text-gray-500 text-xs py-3 text-center">
              No tickets match this filter.
            </p>
          ) : (
            filteredData.map((ticket) => {
              const style = ALERT_STYLES[ticket.alert_level] || ALERT_STYLES.warning
              return (
                <button
                  key={ticket.id}
                  onClick={() => onTicketClick?.(ticket)}
                  className={`
                    w-full text-left rounded-lg border p-3 transition-all duration-200
                    ${style.bg} ${style.border}
                    hover:brightness-125 hover:scale-[1.01]
                    ${onTicketClick ? 'cursor-pointer' : 'cursor-default'}
                  `}
                >
                  {/* Row 1: ticket number + days overdue badge */}
                  <div className="flex items-center flex-wrap justify-between gap-x-2 gap-y-0.5 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 font-mono text-xs flex-shrink-0">
                        {ticket.ticket_number || `#${ticket.id}`}
                      </span>
                      <span className={`text-xs font-bold uppercase ${style.text}`}>
                        {style.label}
                      </span>
                      {style.pulse && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${style.text}`}>
                      {formatDaysOverdue(ticket.days_overdue)} overdue
                    </span>
                  </div>

                  {/* Row 2: subject */}
                  <p className="text-sm text-white truncate mb-1.5">
                    {ticket.subject}
                  </p>

                  {/* Row 3: meta info */}
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 overflow-hidden">
                    <span className={`capitalize flex-shrink-0 ${PRIORITY_COLORS[ticket.priority] || 'text-gray-400'}`}>
                      {ticket.priority}
                    </span>
                    <span className="flex-shrink-0">•</span>
                    {ticket.assigned_to_name && ticket.assigned_to_name.trim() ? (
                      <span className="text-gray-300 truncate min-w-0">{ticket.assigned_to_name}</span>
                    ) : (
                      <span className="text-orange-400 flex-shrink-0">Unassigned</span>
                    )}
                    <span className="flex-shrink-0">•</span>
                    <span className="truncate min-w-0">{ticket.customer_name || 'Unknown'}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </BaseWidget>
  )
}

export default OverdueTicketsWidget
