import { useState, useCallback, useEffect, useMemo, Fragment } from 'react'
import BaseWidget from './BaseWidget'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/* ── Column definitions ── */
const COLUMNS = [
  { key: 'tech_name',                label: 'Technician',      align: 'left',   sortable: true },
  { key: 'resolved_30d',             label: 'Resolved (30d)',  align: 'center', sortable: true },
  { key: 'avg_resolution_hours',     label: 'Avg Resolution',  align: 'center', sortable: true },
  { key: 'avg_first_response_hours', label: 'First Response',  align: 'center', sortable: true },
  { key: 'open_tickets',             label: 'Open',            align: 'center', sortable: true },
  { key: 'resolution_rate',          label: 'Resolution %',    align: 'center', sortable: true },
  { key: 'satisfaction_score',       label: 'CSAT',            align: 'center', sortable: true },
]

/* ── Helpers ── */
const fmtHours = (h) => {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h}h`
  return `${(h / 24).toFixed(1)}d`
}

const rateColor = (pct) => {
  if (pct >= 80) return 'text-green-400'
  if (pct >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

const rateBg = (pct) => {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

/* ── Component ── */
export default function TechPerformanceWidget({ onRefresh, onTechClick, autoRefreshInterval = 120000 }) {
  const [techs, setTechs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortKey, setSortKey] = useState('resolved_30d')
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [expandedTech, setExpandedTech] = useState(null)

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('blueclue_token')
      const res = await fetch(`${API_BASE_URL}/analytics/tech-performance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setTechs(json.data || [])
    } catch (err) {
      console.error('TechPerformanceWidget fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!autoRefreshInterval) return
    const id = setInterval(fetchData, autoRefreshInterval)
    return () => clearInterval(id)
  }, [fetchData, autoRefreshInterval])

  /* ── Sorting ── */
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'tech_name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    return [...techs].sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]
      // nulls last
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [techs, sortKey, sortDir])

  /* ── Toggle expand ── */
  const toggleExpand = (techId) => {
    setExpandedTech(prev => prev === techId ? null : techId)
  }

  /* ── Render cell value ── */
  const renderCell = (tech, col) => {
    const v = tech[col.key]
    switch (col.key) {
      case 'tech_name':
        return (
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">{tech.tech_name}</p>
            <p className="text-xs text-gray-500 truncate">{tech.email}</p>
          </div>
        )
      case 'resolved_30d':
        return (
          <span className={`text-sm font-bold ${v > 0 ? 'text-white' : 'text-gray-600'}`}>
            {v}
          </span>
        )
      case 'avg_resolution_hours':
      case 'avg_first_response_hours':
        return <span className="text-sm text-gray-300">{fmtHours(v)}</span>
      case 'open_tickets':
        return (
          <span className={`text-sm font-medium ${v > 5 ? 'text-amber-400' : v > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
            {v}
          </span>
        )
      case 'resolution_rate':
        return (
          <div className="flex items-center justify-center gap-2">
            <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${rateBg(v)}`} style={{ width: `${v}%` }} />
            </div>
            <span className={`text-sm font-medium ${rateColor(v)}`}>{v}%</span>
          </div>
        )
      case 'satisfaction_score':
        if (v == null) return <span className="text-xs text-gray-600 italic">N/A</span>
        return (
          <span className={`text-sm font-medium ${v >= 4 ? 'text-green-400' : v >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
            {v.toFixed(1)}
          </span>
        )
      default:
        return <span className="text-sm text-gray-300">{v ?? '—'}</span>
    }
  }

  /* ── Sort icon ── */
  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) {
      return (
        <svg className="w-3 h-3 text-gray-600 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return (
      <svg className="w-3 h-3 text-blue-400 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {sortDir === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
    )
  }

  return (
    <BaseWidget
      title="Technician Performance"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      headerExtra={
        techs.length > 0 ? (
          <span className="text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
            {techs.length} techs
          </span>
        ) : null
      }
      onRefresh={() => { fetchData(); if (onRefresh) onRefresh() }}
      isLoading={loading}
      error={error}
      isEmpty={techs.length === 0}
      emptyMessage="No technician data available."
      emptyIcon={
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      noPadding
    >
      {/* Scrollable table */}
      <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-700/60">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap select-none ${
                    col.sortable ? 'cursor-pointer hover:text-gray-200 transition-colors' : ''
                  } ${col.align === 'center' ? 'text-center' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((tech, idx) => {
              const isExpanded = expandedTech === tech.tech_id
              return (
                <Fragment key={tech.tech_id}>
                  <tr
                    onClick={() => toggleExpand(tech.tech_id)}
                    className={`cursor-pointer transition-colors ${
                      isExpanded
                        ? 'bg-blue-950/30'
                        : idx % 2 === 0
                          ? 'bg-gray-900/30 hover:bg-gray-800/50'
                          : 'bg-gray-900/10 hover:bg-gray-800/50'
                    }`}
                  >
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${col.align === 'center' ? 'text-center' : ''}`}
                      >
                        {renderCell(tech, col)}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr className="bg-blue-950/20">
                      <td colSpan={COLUMNS.length} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-4">
                          {/* Quick stats cards */}
                          <div className="grid grid-cols-2 gap-3 flex-1">
                            <div className="bg-gray-900/60 rounded-lg p-2.5 border border-gray-700/50 text-center">
                              <p className="text-lg font-bold text-white">{tech.total_assigned}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Assigned</p>
                            </div>
                            <div className="bg-gray-900/60 rounded-lg p-2.5 border border-gray-700/50 text-center">
                              <p className="text-lg font-bold text-blue-400">{tech.resolved_30d}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Resolved (30d)</p>
                            </div>
                            <div className="bg-gray-900/60 rounded-lg p-2.5 border border-gray-700/50 text-center">
                              <p className={`text-lg font-bold ${tech.open_tickets > 5 ? 'text-amber-400' : 'text-gray-300'}`}>
                                {tech.open_tickets}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Open Now</p>
                            </div>
                            <div className="bg-gray-900/60 rounded-lg p-2.5 border border-gray-700/50 text-center">
                              <p className={`text-lg font-bold ${rateColor(tech.resolution_rate)}`}>
                                {tech.resolution_rate}%
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Resolution Rate</p>
                            </div>
                          </div>

                          {/* Action button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onTechClick) onTechClick(tech)
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-2 rounded-lg transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  )
}
