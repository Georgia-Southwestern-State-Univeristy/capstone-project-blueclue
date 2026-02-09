import { useMemo, useState, useRef, useEffect, useCallback } from 'react'

/**
 * Hourly timeline bar chart showing ticket submissions over the last 3 days.
 * Each bar = 1 hour, rightmost bar = current hour.
 */
function TicketTimeline({ tickets = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const scrollRef = useRef(null)

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

      data.push({ hourStart, count })
    }

    return data
  }, [tickets])

  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  const total = buckets.reduce((sum, b) => sum + b.count, 0)

  // Day boundary labels
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
    return labels
  }, [buckets])

  const formatHour = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white">Submission Timeline</h3>
        <span className="text-xs text-gray-500">Last 3 days &middot; {total} tickets</span>
      </div>

      {/* Chart area — scrollable on mobile only */}
      <div ref={scrollRef} className="flex-1 flex flex-col justify-end min-h-0 overflow-x-auto md:overflow-x-visible overflow-y-hidden pt-16">
        <div className="flex items-end gap-1 h-36 md:min-w-0" style={{ minWidth: '500px' }}>
          {buckets.map((bucket, i) => {
            const heightPct = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 100, 4) : 0
            const isHovered = hoveredIndex === i

            return (
              <div
                key={i}
                className="flex-1 min-w-[6px] max-w-[16px] relative group cursor-pointer"
                style={{ height: '100%' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Bar */}
                <div className="absolute bottom-0 left-0 right-0 flex items-end h-full">
                  <div
                    className="w-full rounded-t-sm transition-all duration-150"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isHovered ? '#3b82f6' : '#60a5fa',
                      opacity: hoveredIndex !== null && !isHovered ? 0.3 : 1,
                    }}
                  />
                </div>

                {/* Tooltip — positioned inside the clipped area */}
                {isHovered && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                    <p className="font-medium">{formatHour(bucket.hourStart)}</p>
                    <p className="text-gray-400">
                      {bucket.hourStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-blue-400">{bucket.count} {bucket.count === 1 ? 'ticket' : 'tickets'}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Day labels below chart */}
        <div className="relative h-5 mt-2 border-t border-gray-800 md:min-w-0" style={{ minWidth: '500px' }}>
          {dayLabels.map((d, i) => (
            <span
              key={i}
              className="absolute text-xs text-gray-500 top-1 whitespace-nowrap"
              style={{ left: `${(d.index / buckets.length) * 100}%` }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TicketTimeline
