import { useState, useCallback, useEffect, useMemo } from 'react'
import BaseWidget from './BaseWidget'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/* ── Action-type styling ── */
const ACTION_TYPES = {
  overdue: {
    label: 'Overdue',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    row:   'border-red-500/20 hover:border-red-500/40 bg-red-950/20',
    dot:   'bg-red-500',
    actionBtn: 'bg-red-600 hover:bg-red-500 text-white',
    actionLabel: 'Resolve',
  },
  unassigned_urgent: {
    label: 'Unassigned Urgent',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    row:   'border-orange-500/20 hover:border-orange-500/40 bg-orange-950/20',
    dot:   'bg-orange-500',
    actionBtn: 'bg-blue-600 hover:bg-blue-500 text-white',
    actionLabel: 'Assign',
  },
  due_today: {
    label: 'Due Today',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    row:   'border-yellow-500/20 hover:border-yellow-500/40 bg-yellow-950/20',
    dot:   'bg-yellow-500',
    actionBtn: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    actionLabel: 'View',
  },
}

const PRIORITY_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
}

/* ── Component ── */
export default function TodaysActionsWidget({ onRefresh, onAction, autoRefreshInterval = 60000 }) {
  const [data, setData] = useState({ actions: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // null = all

  /* ── Fetch ── */
  const fetchActions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('blueclue_token')
      const res = await fetch(`${API_BASE_URL}/analytics/todays-actions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData({ actions: json.data || [], summary: json.summary || {} })
    } catch (err) {
      console.error('TodaysActionsWidget fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchActions() }, [fetchActions])

  /* ── Auto-refresh ── */
  useEffect(() => {
    if (!autoRefreshInterval) return
    const id = setInterval(fetchActions, autoRefreshInterval)
    return () => clearInterval(id)
  }, [fetchActions, autoRefreshInterval])

  /* ── Filtered list ── */
  const filteredActions = useMemo(() => {
    if (!activeFilter) return data.actions
    return data.actions.filter(a => a.action_type === activeFilter)
  }, [data.actions, activeFilter])

  /* ── Total count ── */
  const totalCount = data.actions.length

  /* ── Handle action click ── */
  const handleAction = (item) => {
    if (onAction) onAction(item)
  }

  /* ── Format date / time helpers ── */
  const formatDue = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = d - now
    const diffHrs = Math.round(diffMs / 3600000)
    if (diffHrs < 0) {
      const overdue = Math.abs(diffHrs)
      if (overdue < 24) return `${overdue}h overdue`
      return `${Math.round(overdue / 24)}d overdue`
    }
    if (diffHrs === 0) return 'Due now'
    if (diffHrs < 24) return `${diffHrs}h left`
    return `${Math.round(diffHrs / 24)}d left`
  }

  const formatCreatedAge = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffHrs = Math.round((now - d) / 3600000)
    if (diffHrs < 1) return 'just now'
    if (diffHrs < 24) return `${diffHrs}h ago`
    return `${Math.round(diffHrs / 24)}d ago`
  }

  /* ── Render ── */
  return (
    <BaseWidget
      title="Today's Actions"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
      headerExtra={
        totalCount > 0 ? (
          <span className="text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        ) : null
      }
      onRefresh={() => { fetchActions(); if (onRefresh) onRefresh() }}
      isLoading={loading}
      error={error}
      isEmpty={totalCount === 0}
      emptyMessage="No urgent actions for today — all clear!"
      emptyIcon={
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      }
      noPadding
      className="col-span-full"
    >
      {/* ── Summary filter tabs ── */}
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2">
        {/* All tab */}
        <button
          onClick={() => setActiveFilter(null)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            !activeFilter
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          All
          <span className="font-bold">{totalCount}</span>
        </button>

        {/* Per-type tabs */}
        {Object.entries(ACTION_TYPES).map(([key, cfg]) => {
          const count = data.summary[key] || 0
          if (count === 0) return null
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(activeFilter === key ? null : key)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                activeFilter === key
                  ? cfg.badge
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {cfg.icon}
              {cfg.label}
              <span className="font-bold">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Actions list ── */}
      <div className="px-4 pb-4 space-y-2 max-h-96 overflow-y-auto">
        {filteredActions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No items match this filter.</p>
        ) : (
          filteredActions.map((item) => {
            const cfg = ACTION_TYPES[item.action_type] || ACTION_TYPES.due_today
            return (
              <div
                key={`${item.action_type}-${item.id}`}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${cfg.row}`}
              >
                {/* Status dot */}
                <div className="flex-shrink-0">
                  <span className={`block w-2.5 h-2.5 rounded-full ${cfg.dot} ${
                    item.action_type === 'overdue' ? 'animate-pulse' : ''
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-gray-500 font-mono text-xs">
                      {item.ticket_number || `#${item.id}`}
                    </span>
                    <span className={`text-xs capitalize font-medium ${PRIORITY_COLORS[item.priority] || 'text-gray-400'}`}>
                      {item.priority}
                    </span>
                    {item.action_type === 'overdue' && item.resolution_due_at && (
                      <span className="text-red-400 text-xs font-medium">
                        {formatDue(item.resolution_due_at)}
                      </span>
                    )}
                    {item.action_type === 'due_today' && item.resolution_due_at && (
                      <span className="text-yellow-400 text-xs font-medium">
                        {formatDue(item.resolution_due_at)}
                      </span>
                    )}
                    {item.action_type === 'unassigned_urgent' && item.created_at && (
                      <span className="text-orange-400/70 text-xs">
                        opened {formatCreatedAge(item.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm truncate">{item.subject}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {item.action_label}
                    {item.assigned_to_name && item.assigned_to_name !== 'null' && (
                      <span className="ml-2 text-gray-400">→ {item.assigned_to_name}</span>
                    )}
                  </p>
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleAction(item)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${cfg.actionBtn}`}
                >
                  {cfg.actionLabel}
                </button>
              </div>
            )
          })
        )}
      </div>
    </BaseWidget>
  )
}
