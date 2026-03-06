import { useState, useEffect, useCallback } from 'react'
import BaseWidget from './BaseWidget'
import { useTicketSocket } from '../hooks/useTicketSocket'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const PRIORITY_BADGE = {
  critical: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    ring: 'ring-red-500/30',
    dot: 'bg-red-500',
    pulse: true,
  },
  high: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    ring: 'ring-orange-500/30',
    dot: 'bg-orange-500',
    pulse: false,
  },
}

/**
 * Format hours into a human-readable relative string
 */
const formatTimeSince = (hours) => {
  if (hours < 1) return '< 1h ago'
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.floor(hours / 24)
  const remHours = Math.round(hours % 24)
  if (days === 1) return remHours > 0 ? `1d ${remHours}h ago` : '1d ago'
  return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`
}

/**
 * EscalationsWidget
 * Displays critical/high-priority tickets that require management attention.
 * Each ticket shows the escalation reason, time since creation, and quick action buttons.
 *
 * @param {Object}   props
 * @param {Function} [props.onRefresh]       - Parent refresh callback
 * @param {Function} [props.onView]          - Called with ticket when "View" is clicked
 * @param {Function} [props.onReassign]      - Called with ticket when "Reassign" is clicked
 * @param {Function} [props.onResolve]       - Called with ticket when "Resolve" is clicked
 */
function EscalationsWidget({
  onView = null,
  onReassign = null,
  onResolve = null,
}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [priorityFilter, setPriorityFilter] = useState(null) // null | 'critical' | 'high'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('blueclue_token')
      const res = await fetch(`${API_BASE_URL}/analytics/escalations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      console.error('Escalations fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Socket-driven refresh ── */
  useTicketSocket(fetchData)

  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // Counts
  const criticalCount = data.filter((t) => t.priority === 'critical').length
  const highCount = data.filter((t) => t.priority === 'high').length

  const filtered = priorityFilter
    ? data.filter((t) => t.priority === priorityFilter)
    : data

  return (
    <BaseWidget
      title="Escalations"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      onRefresh={handleRefresh}
      isLoading={loading && data.length === 0}
      error={error}
      isEmpty={data.length === 0 && !loading}
      emptyMessage="No escalated tickets right now"
      emptyIcon={null}
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
        {/* Priority filter tabs */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setPriorityFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full transition-all ${
              !priorityFilter
                ? 'bg-gray-600 text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            All ({data.length})
          </button>
          {criticalCount > 0 && (
            <button
              onClick={() =>
                setPriorityFilter(priorityFilter === 'critical' ? null : 'critical')
              }
              className={`text-xs px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1 ${
                priorityFilter === 'critical'
                  ? 'bg-red-500/20 text-red-400 font-medium ring-1 ring-red-500/30'
                  : 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Critical ({criticalCount})
            </button>
          )}
          {highCount > 0 && (
            <button
              onClick={() =>
                setPriorityFilter(priorityFilter === 'high' ? null : 'high')
              }
              className={`text-xs px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1 ${
                priorityFilter === 'high'
                  ? 'bg-orange-500/20 text-orange-400 font-medium ring-1 ring-orange-500/30'
                  : 'text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
              High ({highCount})
            </button>
          )}
        </div>

        {/* Ticket list */}
        <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
          {filtered.length === 0 && !loading ? (
            <p className="text-gray-500 text-xs py-3 text-center">
              No tickets match this filter.
            </p>
          ) : (
            filtered.map((ticket) => {
              const style = PRIORITY_BADGE[ticket.priority] || PRIORITY_BADGE.high
              const isSLABreach = ticket.escalation_reason
                ?.toLowerCase()
                .includes('breach')

              return (
                <div
                  key={ticket.id}
                  className={`
                    rounded-lg border p-3 transition-all duration-200 cursor-pointer
                    ${style.bg} ${style.ring} ring-1
                    hover:brightness-110
                  `}
                  onClick={() => onView?.(ticket)}
                >
                  {/* Row 1: priority badge + ticket number + time */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${style.dot} inline-block`}
                        />
                        {ticket.priority}
                      </span>
                      <span className="text-gray-400 font-mono text-xs">
                        {ticket.ticket_number || `#${ticket.id}`}
                      </span>
                      {style.pulse && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatTimeSince(parseFloat(ticket.hours_since_created))}
                    </span>
                  </div>

                  {/* Row 2: subject */}
                  <p className="text-sm text-white truncate mb-1">
                    {ticket.subject}
                  </p>

                  {/* Row 3: escalation reason */}
                  <p
                    className={`text-[11px] mb-2 ${
                      isSLABreach ? 'text-red-400 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {isSLABreach && (
                      <svg
                        className="w-3 h-3 inline mr-1 -mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    )}
                    {ticket.escalation_reason}
                  </p>

                  {/* Row 4: meta + quick actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
                      {ticket.assigned_to_name &&
                      ticket.assigned_to_name.trim() ? (
                        <span className="text-gray-300 truncate">
                          {ticket.assigned_to_name}
                        </span>
                      ) : (
                        <span className="text-orange-400">Unassigned</span>
                      )}
                      <span>•</span>
                      <span className="truncate">
                        {ticket.customer_name || 'Unknown'}
                      </span>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onView?.(ticket) }}
                        title="View ticket"
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onReassign?.(ticket) }}
                        title="Reassign ticket"
                        className="p-1.5 rounded hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onResolve?.(ticket) }}
                        title="Mark resolved"
                        className="p-1.5 rounded hover:bg-green-500/20 text-gray-400 hover:text-green-400 transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </BaseWidget>
  )
}

export default EscalationsWidget
