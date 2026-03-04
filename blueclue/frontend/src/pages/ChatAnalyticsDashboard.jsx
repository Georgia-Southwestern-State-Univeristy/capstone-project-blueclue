import { useState, useEffect, useCallback } from 'react'
import { getChatAnalytics, getChatKnowledgeGaps } from '../services/chatService'

// ─── Tiny SVG bar chart ─────────────────────────────────────────────────────
function BarChart({ data = [], valueKey = 'count', labelKey = 'label', color = '#3b82f6', height = 120 }) {
  if (!data.length) return <p className="text-gray-500 text-sm text-center py-6">No data</p>
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  const barW = Math.max(8, Math.floor(400 / data.length) - 4)
  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${data.length * (barW + 4)} ${height + 24}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = Math.round(((d[valueKey] || 0) / max) * height)
          const x = i * (barW + 4)
          return (
            <g key={i}>
              <rect x={x} y={height - h} width={barW} height={h} rx={2} fill={color} opacity={0.85} />
              {data.length <= 15 && (
                <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">
                  {d[labelKey]}
                </text>
              )}
              <title>{`${d[labelKey]}: ${d[valueKey]}`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Donut chart (resolution breakdown) ─────────────────────────────────────
function DonutChart({ slices = [] }) {
  if (!slices.length) return <p className="text-gray-500 text-sm text-center py-6">No data</p>
  const total = slices.reduce((s, x) => s + (x.value || 0), 0)
  if (!total) return <p className="text-gray-500 text-sm text-center py-6">No data</p>
  const cx = 60, cy = 60, r = 50, ir = 30
  const START = -Math.PI / 2
  // Pre-compute cumulative start angles without mutating any variable inside a map callback
  const startAngles = []
  let cursor = START
  for (const s of slices) {
    startAngles.push(cursor)
    cursor += (s.value / total) * 2 * Math.PI
  }
  const paths = slices.map((s, i) => {
    const a0 = startAngles[i]
    const sweep = (s.value / total) * 2 * Math.PI
    const a1 = a0 + sweep
    const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0)
    const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1)
    const ix1 = cx + ir * Math.cos(a0), iy1 = cy + ir * Math.sin(a0)
    const ix2 = cx + ir * Math.cos(a1), iy2 = cy + ir * Math.sin(a1)
    const largeArc = sweep > Math.PI ? 1 : 0
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
    return { ...s, d }
  })
  return (
    <div className="flex items-center gap-6">
      <svg width={120} height={120}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.9}>
            <title>{p.label}: {p.value}</title>
          </path>
        ))}
      </svg>
      <ul className="space-y-1 text-sm">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-300">{s.label}</span>
            <span className="text-gray-400 ml-auto pl-4">{s.value}</span>
            <span className="text-gray-500 text-xs">{total ? `${Math.round(s.value / total * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Peak heatmap ───────────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function PeakHeatmap({ data = [] }) {
  if (!data.length) return <p className="text-gray-500 text-sm text-center py-6">No data</p>
  const max = Math.max(...data.map(d => d.count || 0), 1)
  const grid = {}
  data.forEach(d => { grid[`${d.day_of_week}_${d.hour}`] = d.count || 0 })
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="w-8 text-gray-500 font-normal pr-1 text-right">Hr</th>
            {DAYS.map(d => <th key={d} className="w-8 text-gray-500 font-normal">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 24 }, (_, h) => (
            <tr key={h}>
              <td className="text-gray-500 pr-1 text-right">{h}</td>
              {DAYS.map((_, dow) => {
                const v = grid[`${dow}_${h}`] || 0
                const intensity = Math.round((v / max) * 100)
                return (
                  <td key={dow} className="w-7 h-3 text-center rounded-sm"
                    style={{ background: `rgba(59,130,246,${(intensity / 100).toFixed(2)})` }}
                    title={`${DAYS[dow]} ${h}:00 — ${v}`}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'blue' }) {
  const ring = { blue: 'border-blue-800', green: 'border-emerald-800', yellow: 'border-yellow-700', purple: 'border-purple-700' }
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${ring[accent] || ring.blue}`}>
      <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
      <div className="text-gray-400 text-sm mt-0.5">{label}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────────────
const PERIODS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
]

export default function ChatAnalyticsDashboard() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [gapData, setGapData] = useState(null)
  const [gapLoading, setGapLoading] = useState(true)

  const load = useCallback(async (p) => {
    setLoading(true)
    setGapLoading(true)
    setError(null)
    try {
      const [result, gaps] = await Promise.allSettled([
        getChatAnalytics(p),
        getChatKnowledgeGaps(20),
      ])
      if (result.status === 'fulfilled') setData(result.value)
      else setError(result.reason?.message || 'Failed to load analytics')
      if (gaps.status === 'fulfilled') setGapData(gaps.value)
    } finally {
      setLoading(false)
      setGapLoading(false)
    }
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const ov = data?.overview || {}
  const fb = data?.feedback || {}
  const deflect = data?.deflection || {}
  const resolution = data?.resolutionBreakdown || {}
  const daily = (data?.dailyTrend || []).map(d => ({ label: d.date?.slice(5), count: Number(d.conversations) }))
  const intents = data?.topIntents || []
  const peak = data?.peakUsage || []
  const techUsage = data?.techModeUsage || {}

  const deflectRate = deflect.deflection_rate != null
    ? `${Number(deflect.deflection_rate).toFixed(1)}%`
    : '—'

  const resSlices = [
    { label: 'Resolved', value: Number(resolution.resolved || 0), color: '#10b981' },
    { label: 'Escalated', value: Number(resolution.escalated || 0), color: '#f59e0b' },
    { label: 'Open', value: Number(resolution.open || 0), color: '#3b82f6' },
  ]

  const fbTotal = (Number(fb.positive) || 0) + (Number(fb.negative) || 0) + (Number(fb.no_rating) || 0)
  const fbRate = fbTotal ? `${Math.round(((Number(fb.positive) || 0) / fbTotal) * 100)}%` : '—'

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Chat Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Chatbot performance & engagement metrics</p>
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${period === p.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Conversations" value={ov.total_conversations} accent="blue" />
              <StatCard label="Total Messages" value={ov.total_messages} accent="blue" />
              <StatCard label="Avg Msgs / Conv" value={ov.avg_messages_per_conversation != null ? Number(ov.avg_messages_per_conversation).toFixed(1) : '—'} accent="purple" />
              <StatCard label="Tech Mode Convs" value={techUsage.tech_mode_conversations} sub={`${techUsage.tech_mode_users ?? '—'} unique techs`} accent="green" />
            </div>

            {/* Ticket deflection / Resolution / Feedback row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Deflection */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-4 text-gray-200">Ticket Deflection</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Suggestions shown</span>
                    <span className="text-white">{deflect.suggestions_shown ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Articles clicked</span>
                    <span className="text-white">{deflect.clicked ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tickets cancelled</span>
                    <span className="text-green-400">{deflect.tickets_cancelled ?? '—'}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold">
                    <span className="text-gray-300">Deflection rate</span>
                    <span className="text-emerald-400 text-lg">{deflectRate}</span>
                  </div>
                </div>
              </div>

              {/* Resolution */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-4 text-gray-200">Resolution Breakdown</h2>
                <DonutChart slices={resSlices} />
              </div>

              {/* Feedback */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-4 text-gray-200">Feedback</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-gray-400 flex-1">Positive</span>
                    <span className="text-white">{fb.positive ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-gray-400 flex-1">Negative</span>
                    <span className="text-white">{fb.negative ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-600 flex-shrink-0" />
                    <span className="text-gray-400 flex-1">No rating</span>
                    <span className="text-white">{fb.no_rating ?? 0}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold">
                    <span className="text-gray-300">Positive rate</span>
                    <span className="text-green-400 text-lg">{fbRate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily trend */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
              <h2 className="font-semibold mb-4 text-gray-200">
                Daily Conversations
                {daily.length ? ` (${daily.length} days)` : ''}
              </h2>
              <BarChart data={daily} valueKey="count" labelKey="label" color="#3b82f6" height={100} />
            </div>

            {/* Top intents + Peak heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top intents */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-4 text-gray-200">Top Intents</h2>
                {intents.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs">
                        <th className="text-left pb-2">Intent</th>
                        <th className="text-right pb-2">Count</th>
                        <th className="text-right pb-2 pl-4">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intents.map((row, i) => {
                        const total = intents.reduce((s, r) => s + Number(r.count || 0), 0)
                        const pct = total ? Math.round(Number(row.count) / total * 100) : 0
                        return (
                          <tr key={i} className="border-t border-gray-700">
                            <td className="py-1.5 text-gray-300 capitalize">{row.intent}</td>
                            <td className="text-right text-white">{row.count}</td>
                            <td className="text-right text-gray-500 pl-4">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                {pct}%
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : <p className="text-gray-500 text-sm">No intent data</p>}
              </div>

              {/* Peak usage heatmap */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-4 text-gray-200">Peak Usage Heatmap</h2>
                <p className="text-gray-500 text-xs mb-3">Hour (0–23) × Day of week</p>
                <PeakHeatmap data={peak} />
              </div>
            </div>

            {/* NPS + Satisfaction trend + Knowledge gaps */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* NPS */}
              <div className="bg-gray-800 rounded-xl p-5 border border-purple-800">
                <h2 className="font-semibold mb-4 text-gray-200">Net Promoter Score</h2>
                {gapLoading ? (
                  <p className="text-gray-500 text-sm text-center py-6">Loading…</p>
                ) : (
                  <NpsGauge
                    score={gapData?.npsBreakdown?.score}
                    breakdown={gapData?.npsBreakdown}
                  />
                )}
              </div>

              {/* Satisfaction trend */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-4 text-gray-200">Satisfaction Trend</h2>
                <p className="text-gray-500 text-xs mb-3">Weekly avg star rating (1–5)</p>
                {gapLoading ? (
                  <p className="text-gray-500 text-sm text-center py-6">Loading…</p>
                ) : gapData?.satisfactionTrend?.length ? (
                  <BarChart
                    data={(gapData.satisfactionTrend).map(d => ({
                      label: d.week?.slice(5) ?? '',
                      count: Number(d.avg_rating ?? 0).toFixed(1),
                    }))}
                    valueKey="count"
                    labelKey="label"
                    color="#a855f7"
                    height={80}
                  />
                ) : (
                  <p className="text-gray-500 text-sm text-center py-6">No survey data yet</p>
                )}
              </div>

              {/* Knowledge gaps count */}
              <div className="bg-gray-800 rounded-xl p-5 border border-yellow-700">
                <h2 className="font-semibold mb-2 text-gray-200">Knowledge Gap Summary</h2>
                {gapLoading ? (
                  <p className="text-gray-500 text-sm text-center py-6">Loading…</p>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-yellow-400 text-center mt-2">
                      {gapData?.gaps?.length ?? '—'}
                    </div>
                    <p className="text-gray-500 text-xs text-center mt-1">unresolved gaps</p>
                    <p className="text-gray-400 text-xs text-center mt-3 leading-relaxed">
                      {gapData?.gaps?.length >= 15
                        ? 'High gap count — consider KB updates'
                        : gapData?.gaps?.length > 0
                          ? 'Review gaps below'
                          : 'No significant gaps detected'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Knowledge gaps table */}
            {!gapLoading && gapData?.gaps?.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
                <h2 className="font-semibold mb-4 text-gray-200">Top Knowledge Gaps</h2>
                <p className="text-gray-500 text-xs mb-3">Queries with low-confidence responses or negative feedback — review for KB improvements</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-700">
                        <th className="text-left pb-2 pr-4">Query</th>
                        <th className="text-right pb-2 px-3">Occurrences</th>
                        <th className="text-right pb-2 px-3">Low Conf.</th>
                        <th className="text-right pb-2 px-3">Disliked</th>
                        <th className="text-left pb-2 pl-3">First seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapData.gaps.map((gap, i) => (
                        <tr key={i} className="border-t border-gray-700 hover:bg-gray-750">
                          <td className="py-2 pr-4 text-gray-300 max-w-xs truncate" title={gap.query_text}>
                            {gap.query_text}
                          </td>
                          <td className="text-right px-3 text-white">{gap.occurrence_count}</td>
                          <td className="text-right px-3 text-yellow-400">{gap.low_confidence_count}</td>
                          <td className="text-right px-3 text-red-400">{gap.thumbs_down_count}</td>
                          <td className="pl-3 text-gray-500 text-xs">
                            {gap.first_seen ? new Date(gap.first_seen).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
