import { useState, useCallback, useEffect, useMemo } from 'react'
import BaseWidget from './BaseWidget'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/* ── Time-range options ── */
const TIME_RANGES = [
  { value: '7d',  label: 'Week' },
  { value: '30d', label: 'Month' },
  { value: 'all', label: 'All Time' },
]

/* ── Bar colours per rank ── */
const BAR_COLORS = [
  'from-blue-500  to-blue-400',   // 1
  'from-cyan-500  to-cyan-400',   // 2
  'from-teal-500  to-teal-400',   // 3
  'from-green-500 to-green-400',  // 4
  'from-lime-500  to-lime-400',   // 5
  'from-yellow-500 to-yellow-400',// 6
  'from-amber-500 to-amber-400',  // 7
  'from-orange-500 to-orange-400',// 8
  'from-rose-500  to-rose-400',   // 9
  'from-pink-500  to-pink-400',   // 10
]

/* ── Helpers ── */
const fmtHours = (h) => {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h}h`
  return `${(h / 24).toFixed(1)}d`
}

/* ── Component ── */
export default function TopRequestersWidget({ onRefresh, onUserClick, autoRefreshInterval = 120000 }) {
  const [requesters, setRequesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState('30d')
  const [expandedUser, setExpandedUser] = useState(null) // user_id or null

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('blueclue_token')
      const res = await fetch(
        `${API_BASE_URL}/analytics/top-requesters?timeRange=${timeRange}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRequesters(json.data || [])
    } catch (err) {
      console.error('TopRequestersWidget fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Auto-refresh ── */
  useEffect(() => {
    if (!autoRefreshInterval) return
    const id = setInterval(fetchData, autoRefreshInterval)
    return () => clearInterval(id)
  }, [fetchData, autoRefreshInterval])

  /* ── Max ticket count (for bar scale) ── */
  const maxCount = useMemo(
    () => Math.max(1, ...requesters.map(r => r.ticket_count)),
    [requesters],
  )

  /* ── Toggle drill-down ── */
  const handleRowClick = (user) => {
    if (expandedUser === user.user_id) {
      setExpandedUser(null)
    } else {
      setExpandedUser(user.user_id)
      if (onUserClick) onUserClick(user)
    }
  }

  /* ── Render ── */
  return (
    <BaseWidget
      title="Top Requesters"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      headerExtra={
        requesters.length > 0 ? (
          <span className="text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
            {requesters.length}
          </span>
        ) : null
      }
      onRefresh={() => { fetchData(); if (onRefresh) onRefresh() }}
      isLoading={loading}
      error={error}
      isEmpty={requesters.length === 0}
      emptyMessage="No ticket data for the selected range."
      emptyIcon={
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      noPadding
    >
      {/* ── Time-range toggle ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-gray-500 text-xs">
          Showing top {requesters.length} by ticket volume
        </p>
        <div className="flex bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`text-xs font-medium px-3 py-1 transition-all ${
                timeRange === value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bar chart list ── */}
      <div className="px-4 pb-4 space-y-1.5">
        {requesters.map((user, idx) => {
          const pct = Math.round((user.ticket_count / maxCount) * 100)
          const isExpanded = expandedUser === user.user_id
          const barColor = BAR_COLORS[idx % BAR_COLORS.length]

          return (
            <div key={user.user_id}>
              {/* Row */}
              <button
                onClick={() => handleRowClick(user)}
                className={`w-full text-left group relative rounded-lg border transition-all ${
                  isExpanded
                    ? 'border-blue-500/40 bg-gray-800'
                    : 'border-gray-700/50 hover:border-gray-600 bg-gray-800/40 hover:bg-gray-800'
                }`}
              >
                {/* Background bar */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${barColor} opacity-[0.08] group-hover:opacity-[0.14] transition-opacity`}
                  style={{ width: `${pct}%` }}
                />

                <div className="relative flex items-center gap-3 px-3 py-2.5">
                  {/* Rank badge */}
                  <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                    idx < 3
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-gray-700 text-gray-400 border border-gray-600'
                  }`}>
                    {idx + 1}
                  </span>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {user.user_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div>
                      <p className="text-sm font-bold text-white">{user.ticket_count}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Tickets</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-300">{fmtHours(user.avg_resolution_hours)}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg Res</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${user.open_ticket_count > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {user.open_ticket_count}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Open</p>
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded detail pane */}
              {isExpanded && (
                <div className="ml-9 mt-1 mb-2 p-3 bg-gray-800/60 border border-gray-700 rounded-lg text-xs space-y-2 animate-[fadeIn_150ms_ease-out]">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-900/50 rounded-lg p-2 text-center border border-gray-700/50">
                      <p className="text-lg font-bold text-white">{user.ticket_count}</p>
                      <p className="text-gray-500">Total Tickets</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 text-center border border-gray-700/50">
                      <p className="text-lg font-bold text-gray-300">{fmtHours(user.avg_resolution_hours)}</p>
                      <p className="text-gray-500">Avg Resolution</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 text-center border border-gray-700/50">
                      <p className={`text-lg font-bold ${user.open_ticket_count > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {user.open_ticket_count}
                      </p>
                      <p className="text-gray-500">Open Now</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-500">{user.email}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (onUserClick) onUserClick(user) }}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Ticket History
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </BaseWidget>
  )
}
