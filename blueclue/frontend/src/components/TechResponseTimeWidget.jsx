import { useState, useEffect, useMemo, useRef } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

/** Format hours into a human-readable string */
function fmtHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export default function TechResponseTimeWidget() {
  const [techs, setTechs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hoverIdx, setHoverIdx] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/analytics/tech-performance`, { headers: getAuthHeaders() })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(json => { if (!cancelled) setTechs(json.data ?? []) })
      .catch(() => { if (!cancelled) setTechs([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return techs
    const q = search.toLowerCase()
    return techs.filter(t => t.tech_name.toLowerCase().includes(q))
  }, [techs, search])

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

  // Compute horizontal bar chart geometry
  const chart = useMemo(() => {
    if (!filtered.length || !size.w || !size.h) return null
    const maxVal = Math.max(...filtered.map(t => t.avg_first_response_hours ?? 0), 0.1)
    const marginLeft = 110
    const marginRight = 50
    const marginTop = 4
    const marginBottom = 4
    const barAreaW = size.w - marginLeft - marginRight
    const barAreaH = size.h - marginTop - marginBottom
    const gap = 4
    const barH = Math.max(Math.min((barAreaH - gap * (filtered.length - 1)) / filtered.length, 28), 10)

    const bars = filtered.map((t, i) => {
      const val = t.avg_first_response_hours ?? 0
      const y = marginTop + i * (barH + gap)
      const w = (val / maxVal) * barAreaW
      return { ...t, val, y, w, barH, x: marginLeft }
    })

    return { bars, barAreaW, maxVal }
  }, [filtered, size])

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-700/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tech Response Times
        </h3>
      </div>

      {/* Search bar */}
      <div className="px-3 py-1.5 border-b border-gray-700/40 shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search technician…"
          className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1
                     placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Chart area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent" />
          </div>
        )}

        {!loading && !techs.length && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
            No technician data available
          </div>
        )}

        {!loading && techs.length > 0 && !filtered.length && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
            No results for "{search}"
          </div>
        )}

        {!loading && chart && (
          <svg width={size.w} height={size.h} style={{ display: 'block' }}>
            {chart.bars.map((bar, i) => {
              const isHovered = hoverIdx === i
              // Color bars by speed: fast=green, mid=yellow, slow=red
              const pct = bar.val / chart.maxVal
              const color = pct < 0.33 ? '#22c55e' : pct < 0.66 ? '#eab308' : '#ef4444'

              return (
                <g
                  key={bar.tech_id}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Tech name label */}
                  <text
                    x={bar.x - 8}
                    y={bar.y + bar.barH / 2 + 1}
                    textAnchor="end"
                    fill={isHovered ? '#f3f4f6' : '#9ca3af'}
                    fontSize={10}
                    dominantBaseline="middle"
                  >
                    {bar.tech_name.length > 16 ? bar.tech_name.slice(0, 15) + '…' : bar.tech_name}
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
                    width={Math.max(bar.w, bar.val > 0 ? 4 : 0)}
                    height={bar.barH}
                    rx={3}
                    fill={color}
                    opacity={isHovered ? 1 : 0.7}
                  />

                  {/* Value label */}
                  <text
                    x={bar.x + Math.max(bar.w, bar.val > 0 ? 4 : 0) + 6}
                    y={bar.y + bar.barH / 2 + 1}
                    textAnchor="start"
                    fill={isHovered ? '#f3f4f6' : '#9ca3af'}
                    fontSize={10}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    dominantBaseline="middle"
                  >
                    {fmtHours(bar.val || null)}
                  </text>

                  {/* Invisible hit area */}
                  <rect
                    x={0}
                    y={bar.y - 2}
                    width={size.w}
                    height={bar.barH + 4}
                    fill="transparent"
                  />
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
