import { useState, useEffect, useMemo, useRef } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

const RANGE_OPTIONS = [
  { value: '7d',  label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m',  label: '6 Months' },
  { value: '1y',  label: '1 Year' },
]

const COLORS = {
  opened:   { line: '#f97316', fill: 'rgba(249,115,22,0.12)' },
  resolved: { line: '#22c55e', fill: 'rgba(34,197,94,0.12)' },
}

export default function TicketTrendWidget() {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [_FetchKey, setFetchKey] = useState(0)
  const [hoverIdx, setHoverIdx] = useState(null)

  // Trigger loading state synchronously when range changes
  const handleRangeChange = (newRange) => {
    setRange(newRange)
    setLoading(true)
    setFetchKey(k => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/analytics/ticket-trend?range=${encodeURIComponent(range)}`, {
      headers: getAuthHeaders(),
    })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(json => { if (!cancelled) setData(json.data ?? []) })
      .catch(() => { if (!cancelled) setData([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range])

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

  // Compute chart geometry in actual pixel coordinates
  const chart = useMemo(() => {
    if (!data.length || !size.w || !size.h) return null
    const maxVal = Math.max(...data.flatMap(d => [d.opened, d.resolved]), 1)
    const marginLeft = 32
    const marginRight = 8
    const marginTop = 8
    const marginBottom = 20
    const W = size.w - marginLeft - marginRight
    const H = size.h - marginTop - marginBottom
    const step = W / Math.max(data.length - 1, 1)

    const toX = i => marginLeft + i * step
    const toY = v => marginTop + H * (1 - v / maxVal)

    const openedPts = data.map((d, i) => [toX(i), toY(d.opened)])
    const resolvedPts = data.map((d, i) => [toX(i), toY(d.resolved)])

    const polyline = pts => pts.map(p => p.join(',')).join(' ')
    const areaPath = pts => {
      const bottom = marginTop + H
      const top = pts.map(p => `${p[0]},${p[1]}`).join(' L')
      return `M${top} L${pts[pts.length - 1][0]},${bottom} L${pts[0][0]},${bottom} Z`
    }

    // Y-axis gridlines
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: toY(maxVal * f),
      label: Math.round(maxVal * f),
    }))

    return { W, H, maxVal, openedPts, resolvedPts, polyline, areaPath, gridLines, step, marginLeft, marginRight, marginTop, marginBottom, toX }
  }, [data, size])

  // Format period labels
  const formatLabel = raw => {
    const d = new Date(raw)
    if (range === '1y') return d.toLocaleDateString(undefined, { month: 'short' })
    if (range === '90d' || range === '6m') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Summary stats
  const totalOpened = data.reduce((s, d) => s + d.opened, 0)
  const totalResolved = data.reduce((s, d) => s + d.resolved, 0)

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-lg border border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <h3 className="text-xs font-bold text-white">Ticket Trend</h3>
        </div>
        <select
          value={range}
          onChange={e => handleRangeChange(e.target.value)}
          className="text-[10px] bg-gray-800 border border-gray-700 text-gray-300 rounded px-1.5 py-0.5
                     focus:border-blue-500 focus:outline-none"
        >
          {RANGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Legend + stats */}
      <div className="flex items-center gap-4 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.opened.line }} />
          Opened <span className="font-semibold text-white">{totalOpened}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.resolved.line }} />
          Resolved <span className="font-semibold text-white">{totalResolved}</span>
        </span>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 px-2 pb-2 relative" ref={containerRef}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !chart ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-500">
            No data for this period
          </div>
        ) : (
          <>
          <svg width={size.w} height={size.h} className="block"
            onMouseLeave={() => setHoverIdx(null)}>
            {/* Grid lines */}
            {chart.gridLines.map((g, i) => (
              <g key={i}>
                <line x1={chart.marginLeft} y1={g.y} x2={size.w - chart.marginRight} y2={g.y} stroke="#374151" strokeWidth="1" />
                <text x={chart.marginLeft - 6} y={g.y + 4} textAnchor="end" fill="#6b7280" fontSize="10">{g.label}</text>
              </g>
            ))}

            {/* Area fills */}
            <path d={chart.areaPath(chart.openedPts)} fill={COLORS.opened.fill} />
            <path d={chart.areaPath(chart.resolvedPts)} fill={COLORS.resolved.fill} />

            {/* Lines */}
            <polyline points={chart.polyline(chart.openedPts)} fill="none"
              stroke={COLORS.opened.line} strokeWidth="2" strokeLinejoin="round" />
            <polyline points={chart.polyline(chart.resolvedPts)} fill="none"
              stroke={COLORS.resolved.line} strokeWidth="2" strokeLinejoin="round" />

            {/* Hover vertical line */}
            {hoverIdx !== null && (
              <line
                x1={chart.toX(hoverIdx)} y1={chart.marginTop}
                x2={chart.toX(hoverIdx)} y2={chart.marginTop + chart.H}
                stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"
              />
            )}

            {/* Dots – highlighted on hover */}
            {data.length <= 31 && chart.openedPts.map((p, i) => (
              <circle key={`o${i}`} cx={p[0]} cy={p[1]}
                r={hoverIdx === i ? 5 : 3} fill={COLORS.opened.line}
                style={{ transition: 'r 0.1s' }} />
            ))}
            {data.length <= 31 && chart.resolvedPts.map((p, i) => (
              <circle key={`r${i}`} cx={p[0]} cy={p[1]}
                r={hoverIdx === i ? 5 : 3} fill={COLORS.resolved.line}
                style={{ transition: 'r 0.1s' }} />
            ))}

            {/* Invisible hit areas per data point for hover detection */}
            {data.map((_, i) => (
              <rect
                key={`hit${i}`}
                x={chart.toX(i) - chart.step / 2}
                y={chart.marginTop}
                width={chart.step}
                height={chart.H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            ))}

            {/* X-axis labels (start, middle, end) */}
            {data.length > 0 && [0, Math.floor(data.length / 2), data.length - 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map(idx => (
                <text key={idx} x={chart.toX(idx)} y={size.h - 4}
                  textAnchor="middle" fill="#6b7280" fontSize="10">
                  {formatLabel(data[idx].period)}
                </text>
              ))}
          </svg>

          {/* Tooltip */}
          {hoverIdx !== null && data[hoverIdx] && (() => {
            const tipW = 130
            const rawX = chart.toX(hoverIdx)
            const clampedX = Math.max(4, Math.min(rawX - tipW / 2, size.w - tipW - 4))
            return (
              <div
                className="absolute pointer-events-none z-10 bg-gray-800 border border-gray-600 rounded-md
                           px-2.5 py-1.5 shadow-lg"
                style={{ left: clampedX, top: 4, minWidth: tipW }}
              >
                <div className="text-[10px] text-gray-400 mb-1 font-medium">
                  {formatLabel(data[hoverIdx].period)}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.opened.line }} />
                  <span className="text-gray-300">Opened</span>
                  <span className="ml-auto font-semibold text-white">{data[hoverIdx].opened}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.resolved.line }} />
                  <span className="text-gray-300">Resolved</span>
                  <span className="ml-auto font-semibold text-white">{data[hoverIdx].resolved}</span>
                </div>
              </div>
            )
          })()}
          </>
        )}
      </div>
    </div>
  )
}
