import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { getRecentAssignmentActivity } from '../services/ticketService'

/**
 * Hourly timeline bar chart showing ticket submissions over the last 3 days,
 * with a recent assignment activity feed below.
 */
function TicketTimeline({ tickets = [], onRefresh = null, isRefreshing = false, onTicketClick = null }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const scrollRef = useRef(null)
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [showActivity, setShowActivity] = useState(true)

  // Scroll to rightmost position on mobile
  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollLeft = el.scrollWidth
    }
  }, [])

  useEffect(() => {
    scrollToEnd()
    // Also scroll on resize in case orientation changes
    window.addEventListener('resize', scrollToEnd)
    return () => window.removeEventListener('resize', scrollToEnd)
  }, [scrollToEnd, tickets])

  // Fetch recent assignment activity
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await getRecentAssignmentActivity(20)
      setActivity(res.data || [])
    } catch (err) {
      // Log error for debugging but don't break the UI
      console.error('Assignment activity fetch failed:', err)
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity, tickets]) // re-fetch when tickets change (after refresh)

  // Build 72 hourly buckets (3 days * 24 hours), ending at current hour
  const buckets = useMemo(() => {
    const now = new Date()
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    const totalHours = 72
    const data = []

    for (let i = totalHours - 1; i >= 0; i--) {
      const hourStart = new Date(currentHour.getTime() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

      const count = tickets.filter(t => {
        const d = new Date(t.created_at)
        return d >= hourStart && d < hourEnd
      }).length

      const assignCount = activity.filter(a => {
        const d = new Date(a.created_at)
        return d >= hourStart && d < hourEnd && a.change_type !== 'ticket_cancelled'
      }).length

      const cancelCount = activity.filter(a => {
        const d = new Date(a.created_at)
        return d >= hourStart && d < hourEnd && a.change_type === 'ticket_cancelled'
      }).length

      data.push({ hourStart, count, assignCount, cancelCount })
    }

    return data
  }, [tickets, activity])

  const maxCount = Math.max(...buckets.map(b => b.count + b.assignCount + b.cancelCount), 1)
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const totalAssignments = buckets.reduce((sum, b) => sum + b.assignCount, 0)
  const totalCancellations = buckets.reduce((sum, b) => sum + b.cancelCount, 0)

  // Day boundary labels — deduplicate and enforce minimum spacing
  const dayLabels = useMemo(() => {
    const labels = []
    let lastDay = null
    buckets.forEach((b, i) => {
      const day = b.hourStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      if (day !== lastDay) {
        labels.push({ index: i, label: day })
        lastDay = day
      }
    })
    // Filter out labels that would overlap (within 15% of each other)
    const filtered = []
    labels.forEach((l) => {
      const pct = (l.index / buckets.length) * 100
      if (filtered.length === 0 || pct - (filtered[filtered.length - 1].index / buckets.length) * 100 >= 15) {
        filtered.push(l)
      }
    })
    return filtered
  }, [buckets])

  const formatHour = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white">Ticket Timeline</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />
              Submissions ({total})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
              Assignments ({totalAssignments})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-400 inline-block" />
              Cancellations ({totalCancellations})
            </span>
            <span>Last 3 days</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title={isRefreshing ? 'Refreshing...' : 'Refresh timeline'}
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chart area — scrollable on mobile only, allow tooltips to overflow */}
      <div
        ref={scrollRef}
        className="flex-1 flex flex-col justify-end min-h-0 overflow-x-visible overflow-y-hidden pt-16 pr-8 scrollbar-hide md:scrollbar-default"
        style={{ WebkitOverflowScrolling: 'touch', position: 'relative', zIndex: 1 }}
      >
        <div className="flex items-end gap-1 h-36 md:min-w-0" style={{ minWidth: '500px' }}>
          {buckets.map((bucket, i) => {
            const totalHeight = bucket.count + bucket.assignCount + bucket.cancelCount
            const submitPct = totalHeight > 0 ? Math.max((bucket.count / maxCount) * 100, bucket.count > 0 ? 3 : 0) : 0
            const assignPct = totalHeight > 0 ? Math.max((bucket.assignCount / maxCount) * 100, bucket.assignCount > 0 ? 3 : 0) : 0
            const cancelPct = totalHeight > 0 ? Math.max((bucket.cancelCount / maxCount) * 100, bucket.cancelCount > 0 ? 3 : 0) : 0
            const isHovered = hoveredIndex === i

            // Adjust tooltip position for right-most bar
            const isRightMost = i === buckets.length - 1

            return (
              <div
                key={i}
                className="flex-1 min-w-[6px] max-w-[16px] relative group cursor-pointer"
                style={{ height: '100%' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Stacked bar: submissions (bottom, blue) + assignments (middle, green) + cancellations (top, gray) */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-stretch justify-end h-full">
                  {bucket.cancelCount > 0 && (
                    <div
                      className="w-full rounded-t-sm transition-all duration-150"
                      style={{
                        height: `${cancelPct}%`,
                        backgroundColor: isHovered ? '#9ca3af' : '#6b7280',
                        opacity: hoveredIndex !== null && !isHovered ? 0.3 : 1,
                      }}
                    />
                  )}
                  {bucket.assignCount > 0 && (
                    <div
                      className={`w-full transition-all duration-150 ${bucket.cancelCount === 0 ? 'rounded-t-sm' : ''}`}
                      style={{
                        height: `${assignPct}%`,
                        backgroundColor: isHovered ? '#34d399' : '#6ee7b7',
                        opacity: hoveredIndex !== null && !isHovered ? 0.3 : 1,
                      }}
                    />
                  )}
                  {bucket.count > 0 && (
                    <div
                      className={`w-full transition-all duration-150 ${bucket.assignCount === 0 && bucket.cancelCount === 0 ? 'rounded-t-sm' : ''}`}
                      style={{
                        height: `${submitPct}%`,
                        backgroundColor: isHovered ? '#3b82f6' : '#60a5fa',
                        opacity: hoveredIndex !== null && !isHovered ? 0.3 : 1,
                      }}
                    />
                  )}
                </div>

                {/* Tooltip — allow overflow for right-most bar */}
                {isHovered && (
                  <div
                    className="absolute top-0 bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 pointer-events-none"
                    style={
                      isRightMost
                        ? { right: 0, left: 'auto', transform: 'translateY(-100%)' }
                        : { left: '50%', transform: 'translateX(-50%) translateY(-100%)' }
                    }
                  >
                    <p className="font-medium">{formatHour(bucket.hourStart)}</p>
                    <p className="text-gray-400">
                      {bucket.hourStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-blue-400">{bucket.count} {bucket.count === 1 ? 'submission' : 'submissions'}</p>
                    <p className="text-emerald-400">{bucket.assignCount} {bucket.assignCount === 1 ? 'assignment' : 'assignments'}</p>
                    <p className="text-gray-400">{bucket.cancelCount} {bucket.cancelCount === 1 ? 'cancellation' : 'cancellations'}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Day labels below chart */}
        <div className="relative h-5 mt-2 border-t border-gray-800 md:min-w-0 overflow-hidden" style={{ minWidth: '500px' }}>
          {dayLabels.map((d, i) => (
            <span
              key={i}
              className="absolute text-[10px] md:text-xs text-gray-500 top-1 whitespace-nowrap"
              style={{ left: `${(d.index / buckets.length) * 100}%` }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Assignment Activity Feed */}
      <div className="mt-4 border-t border-gray-700 pt-3">
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors mb-2 w-full"
        >
          <svg className={`w-4 h-4 transition-transform ${showActivity ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Assignment Activity
          {activity.length > 0 && (
            <span className="text-xs text-gray-500 font-normal">({activity.length})</span>
          )}
        </button>

        {showActivity && (
          <div className="max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 space-y-0 pr-1">
            {activityLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full" />
                <span className="text-xs text-gray-500 ml-2">Loading activity...</span>
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">No assignment activity yet.</p>
            ) : (
              activity.map((entry, idx) => {
                const details = entry.change_details || {}
                const isLast = idx === activity.length - 1

                // Determine event type styling
                let icon, color, bgColor, description
                const isUnassignLegacy = entry.change_type === 'assignment' && (entry.new_value === 'unassigned' || entry.new_value === null)

                if (entry.change_type === 'ticket_cancelled') {
                  color = 'text-gray-400'
                  bgColor = 'bg-gray-700'
                  icon = (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )
                  const cancelInfo = details
                  const cancelledBy = cancelInfo.cancelled_by_name || entry.changed_by_name || 'Unknown'
                  const cancelReason = cancelInfo.reason || 'No reason provided'
                  const cancelExtra = cancelInfo.details
                  description = (
                    <span>
                      <span className="text-white font-medium">{cancelledBy}</span>
                      {' cancelled '}
                      {onTicketClick ? (
                        <button onClick={() => onTicketClick(entry.ticket_id)} className="text-blue-300 hover:text-blue-200 hover:underline font-medium">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</button>
                      ) : (
                        <span className="text-blue-300">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</span>
                      )}
                      {' — '}
                      <span className="text-gray-300">{cancelReason}</span>
                      {cancelExtra && <span className="text-gray-500"> — {cancelExtra}</span>}
                    </span>
                  )
                } else if (entry.change_type === 'ticket_unassigned' || isUnassignLegacy) {
                  color = 'text-red-400'
                  bgColor = 'bg-red-900/30'
                  icon = (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h12a6 6 0 00-6-6zM21 12h-6" />
                    </svg>
                  )
                  const prevAssignee = details.previous_assignee_name || entry.old_value_name || (entry.old_value && entry.old_value !== 'unassigned' ? `User #${entry.old_value}` : 'technician')
                  description = (
                    <span>
                      <span className="text-white font-medium">{details.unassigned_by_name || entry.changed_by_name || 'System'}</span>
                      {' unassigned '}
                      <span className="text-gray-300">{prevAssignee}</span>
                      {' from '}
                      {onTicketClick ? (
                        <button onClick={() => onTicketClick(entry.ticket_id)} className="text-blue-300 hover:text-blue-200 hover:underline font-medium">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</button>
                      ) : (
                        <span className="text-blue-300">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</span>
                      )}
                    </span>
                  )
                } else if (entry.change_type === 'ticket_reassigned') {
                  color = 'text-yellow-400'
                  bgColor = 'bg-yellow-900/30'
                  icon = (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  )
                  const fromName = details.previous_assignee_name || entry.old_value_name || `User #${entry.old_value}`
                  const toName = details.assigned_to_name || entry.new_value_name || `User #${entry.new_value}`
                  description = (
                    <span>
                      <span className="text-white font-medium">{details.assigned_by_name || entry.changed_by_name || 'System'}</span>
                      {' reassigned '}
                      {onTicketClick ? (
                        <button onClick={() => onTicketClick(entry.ticket_id)} className="text-blue-300 hover:text-blue-200 hover:underline font-medium">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</button>
                      ) : (
                        <span className="text-blue-300">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</span>
                      )}
                      {' from '}
                      <span className="text-gray-300">{fromName}</span>
                      {' to '}
                      <span className="text-green-300 font-medium">{toName}</span>
                    </span>
                  )
                } else {
                  // ticket_assigned or legacy assignment
                  color = 'text-blue-400'
                  bgColor = 'bg-blue-900/30'
                  icon = (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )
                  // For rich entries, use change_details. For legacy, resolve name from joined query.
                  const assigneeName = details.assigned_to_name || entry.new_value_name || `User #${entry.new_value}`
                  const assignerName = details.assigned_by_name || (entry.change_type === 'assignment' ? null : entry.changed_by_name) || 'System'
                  description = (
                    <span>
                      {onTicketClick ? (
                        <button onClick={() => onTicketClick(entry.ticket_id)} className="text-blue-300 hover:text-blue-200 hover:underline font-medium">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</button>
                      ) : (
                        <span className="text-blue-300">#{entry.ticket_number || details.ticket_number || entry.ticket_id}</span>
                      )}
                      {' assigned to '}
                      <span className="text-green-300 font-medium">{assigneeName}</span>
                      {' by '}
                      <span className="text-white font-medium">{assignerName}</span>
                      {details.action === 'bulk_assign' && <span className="text-gray-500 text-xs ml-1">(bulk)</span>}
                    </span>
                  )
                }

                const timeAgo = formatRelativeTime(entry.created_at)

                return (
                  <div key={entry.id} className="flex gap-2 items-start">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${bgColor} ${color}`}>
                        {icon}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-700 my-0.5 min-h-[8px]" />}
                    </div>

                    {/* Content */}
                    <div className="pb-2 flex-1 min-w-0">
                      <div className="text-xs text-gray-300 leading-relaxed">
                        {description}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{timeAgo}</span>
                        {entry.ticket_subject && (
                          <span className="text-xs text-gray-600 truncate max-w-[200px]" title={entry.ticket_subject}>
                            &mdash; {entry.ticket_subject}
                          </span>
                        )}
                      </div>
                      {entry.comment && (
                        <div className="mt-0.5 text-xs text-gray-400 italic bg-gray-800/50 rounded px-1.5 py-0.5 border-l-2 border-gray-600 inline-block">
                          &ldquo;{entry.comment}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Format a timestamp as relative time (e.g. "2m ago", "3h ago", "Jan 5")
 */
function formatRelativeTime(dateStr) {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default TicketTimeline
