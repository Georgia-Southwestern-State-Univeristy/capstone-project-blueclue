import { useState, useEffect, useMemo, useRef } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

const STATUS_COLORS = {
  open:                 '#3b82f6', // blue
  in_progress:          '#f97316', // orange
  waiting_on_customer:  '#eab308', // yellow
  resolved:             '#22c55e', // green
  closed:               '#6b7280', // gray
  cancelled:            '#ef4444', // red
  reopened:             '#a855f7', // purple
}

const STATUS_LABELS = {
  open:                'Open',
  in_progress:         'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  resolved:            'Resolved',
  closed:              'Closed',
  cancelled:           'Cancelled',
  reopened:            'Reopened',
}

export default function TicketStatusWidget() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoverIdx, setHoverIdx] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/analytics/ticket-status-breakdown`, {
      headers: getAuthHeaders(),
    })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(json => { if (!cancelled) setData(json.data ?? null) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Track container size for pixel-based chart rendering
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute horizontal bar chart geometry in pixels
  const chart = useMemo(() => {
    if (!data?.statuses?.length || !size.w || !size.h) return null
    const maxCount = Math.max(...data.statuses.map(s => s.count), 1)
    const marginLeft = 120
    const marginRight = 40
    const marginTop = 44 // space for total header
    const marginBottom = 8
    const barAreaW = size.w - marginLeft - marginRight
    const barAreaH = size.h - marginTop - marginBottom
    const barCount = data.statuses.length
    const gap = 6
    const barH = Math.max(Math.min((barAreaH - gap * (barCount - 1)) / barCount, 32), 12)

    const bars = data.statuses.map((s, i) => {
      const y = marginTop + i * (barH + gap)
      const w = (s.count / maxCount) * barAreaW
      const color = STATUS_COLORS[s.status] || '#6b7280'
      const label = STATUS_LABELS[s.status] || s.status
      return { ...s, y, w, barH, color, label, x: marginLeft }
    })

    return { bars, marginLeft, marginRight, marginTop, marginBottom, barAreaW, maxCount }
  }, [data, size])

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-700/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Ticket Status Breakdown
        </h3>
      </div>

      {/* Chart area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent" />
          </div>
        )}

        {!loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
            Unable to load status data
          </div>
        )}

        {!loading && data && chart && (
          <svg
            width={size.w}
            height={size.h}
            style={{ display: 'block' }}
          >
            {/* Total count header */}
            <text x={size.w / 2} y={28} textAnchor="middle" fill="#e5e7eb" fontSize={18} fontWeight="bold">
              {data.total} Tickets
            </text>

            {/* Bars */}
            {chart.bars.map((bar, i) => (
              <g
                key={bar.status}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                {/* Label */}
                <text
                  x={bar.x - 8}
                  y={bar.y + bar.barH / 2 + 1}
                  textAnchor="end"
                  fill={hoverIdx === i ? '#f3f4f6' : '#9ca3af'}
                  fontSize={10}
                  dominantBaseline="middle"
                >
                  {bar.label}
                </text>

                {/* Background track */}
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={chart.barAreaW}
                  height={bar.barH}
                  rx={3}
                  fill="#1f2937"
                />

                {/* Filled bar */}
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={Math.max(bar.w, bar.count > 0 ? 4 : 0)}
                  height={bar.barH}
                  rx={3}
                  fill={bar.color}
                  opacity={hoverIdx === i ? 1 : 0.75}
                />

                {/* Count label */}
                <text
                  x={bar.x + Math.max(bar.w, bar.count > 0 ? 4 : 0) + 6}
                  y={bar.y + bar.barH / 2 + 1}
                  textAnchor="start"
                  fill={hoverIdx === i ? '#f3f4f6' : '#9ca3af'}
                  fontSize={10}
                  fontWeight={hoverIdx === i ? 'bold' : 'normal'}
                  dominantBaseline="middle"
                >
                  {bar.count}
                </text>

                {/* Invisible hit area for hover */}
                <rect
                  x={0}
                  y={bar.y - 3}
                  width={size.w}
                  height={bar.barH + 6}
                  fill="transparent"
                />
              </g>
            ))}
          </svg>
        )}

        {!loading && data && !chart && size.w > 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
            No ticket data
          </div>
        )}
      </div>
    </div>
  )
}
