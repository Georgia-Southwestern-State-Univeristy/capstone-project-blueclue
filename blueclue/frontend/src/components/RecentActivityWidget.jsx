import { useState, useEffect, useCallback } from 'react'
import BaseWidget from './BaseWidget'
import { getRecentTicketActivity } from '../services/analyticsService'

const CHANGE_TYPE_CONFIG = {
  status_change:      { label: 'Status Changed',   color: 'text-yellow-400', icon: '🔄' },
  priority_change:    { label: 'Priority Changed',  color: 'text-orange-400', icon: '⚡' },
  category_change:    { label: 'Category Changed',  color: 'text-purple-400', icon: '📁' },
  field_edited:       { label: 'Field Edited',      color: 'text-gray-400',   icon: '✏️' },
  ticket_assigned:    { label: 'Assigned',           color: 'text-green-400',  icon: '👤' },
  ticket_reassigned:  { label: 'Reassigned',         color: 'text-blue-400',   icon: '🔀' },
  ticket_unassigned:  { label: 'Unassigned',         color: 'text-red-400',    icon: '❌' },
  assignment:         { label: 'Assignment',         color: 'text-green-400',  icon: '👤' },
  ticket_cancelled:   { label: 'Cancelled',          color: 'text-red-400',    icon: '🚫' },
  update_requested:   { label: 'Update Requested',  color: 'text-cyan-400',   icon: '📝' },
  update_fulfilled:   { label: 'Update Fulfilled',  color: 'text-emerald-400', icon: '✅' },
  ticket_deleted:     { label: 'Deleted',            color: 'text-red-500',    icon: '🗑️' },
  ticket_reopened:    { label: 'Reopened',           color: 'text-amber-400',  icon: '🔓' },
}

function getConfig(changeType) {
  return CHANGE_TYPE_CONFIG[changeType] || { label: changeType, color: 'text-gray-400', icon: '📋' }
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

function buildDescription(entry) {
  const cfg = getConfig(entry.change_type)
  const who = entry.changed_by_name?.trim() || 'System'

  if (entry.change_type === 'status_change') {
    return `${who} changed status from "${entry.old_value}" to "${entry.new_value}"`
  }
  if (entry.change_type === 'priority_change') {
    return `${who} changed priority from "${entry.old_value}" to "${entry.new_value}"`
  }
  if (entry.change_type === 'category_change') {
    return `${who} changed category from "${entry.old_value}" to "${entry.new_value}"`
  }
  if (entry.change_type === 'ticket_assigned' || entry.change_type === 'assignment') {
    const assignee = entry.change_details?.assigned_to_name || entry.new_value
    return `${who} assigned to ${assignee}`
  }
  if (entry.change_type === 'ticket_reassigned') {
    const from = entry.change_details?.previous_assignee_name || entry.old_value
    const to = entry.change_details?.assigned_to_name || entry.new_value
    return `${who} reassigned from ${from} to ${to}`
  }
  if (entry.change_type === 'ticket_unassigned') {
    return `${who} unassigned ticket`
  }
  if (entry.change_type === 'ticket_cancelled') {
    return `${who} cancelled ticket`
  }
  if (entry.change_type === 'field_edited') {
    return `${who} edited "${entry.field_name}"`
  }
  return `${who} — ${cfg.label}`
}

export default function RecentActivityWidget() {
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getRecentTicketActivity(100)
      setActivity(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const filtered = filter === 'all'
    ? activity
    : activity.filter(a => a.change_type === filter)

  const changeTypes = [...new Set(activity.map(a => a.change_type))].sort()

  return (
    <BaseWidget
      title="Recent Activity"
      icon={
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      onRefresh={fetchActivity}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Filter bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All ({activity.length})
          </button>
          {changeTypes.map(ct => {
            const cfg = getConfig(ct)
            const count = activity.filter(a => a.change_type === ct).length
            return (
              <button
                key={ct}
                onClick={() => setFilter(ct)}
                className={`text-xs px-2 py-1 rounded whitespace-nowrap ${filter === ct ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {cfg.icon} {cfg.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading...</div>
          )}
          {error && (
            <div className="flex items-center justify-center py-8 text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm">No activity found</div>
          )}
          {!loading && !error && filtered.map((entry) => {
            const cfg = getConfig(entry.change_type)
            return (
              <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                <span className="text-sm mt-0.5 shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-blue-400 shrink-0">
                      {entry.ticket_number || `#${entry.ticket_id}`}
                    </span>
                    <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-gray-500 ml-auto shrink-0">{formatTime(entry.created_at)}</span>
                  </div>
                  {entry.ticket_subject && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">{entry.ticket_subject}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">{buildDescription(entry)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </BaseWidget>
  )
}
