import { useState, useEffect, useCallback } from 'react'
import BaseWidget from './BaseWidget'
import { getMyTicketUpdates } from '../services/ticketService'
import { formatTimeAgo } from '../utils/dateFormatter'

const CHANGE_TYPE_CONFIG = {
  status_change:      { label: 'Status Changed',    color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
  priority_change:    { label: 'Priority Changed',  color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
  category_change:    { label: 'Category Changed',  color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  field_edited:       { label: 'Field Edited',      color: 'text-gray-400',   bgColor: 'bg-gray-400/10' },
  ticket_assigned:    { label: 'Assigned',           color: 'text-green-400',  bgColor: 'bg-green-400/10' },
  ticket_reassigned:  { label: 'Reassigned',         color: 'text-blue-400',   bgColor: 'bg-blue-400/10' },
  ticket_unassigned:  { label: 'Unassigned',         color: 'text-red-400',    bgColor: 'bg-red-400/10' },
  assignment:         { label: 'Assignment',         color: 'text-green-400',  bgColor: 'bg-green-400/10' },
  ticket_cancelled:   { label: 'Cancelled',          color: 'text-red-400',    bgColor: 'bg-red-400/10' },
  update_requested:   { label: 'Update Requested',  color: 'text-cyan-400',   bgColor: 'bg-cyan-400/10' },
  update_fulfilled:   { label: 'Update Fulfilled',  color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  ticket_deleted:     { label: 'Deleted',            color: 'text-red-500',    bgColor: 'bg-red-500/10' },
  ticket_reopened:    { label: 'Reopened',           color: 'text-amber-400',  bgColor: 'bg-amber-400/10' },
}

function getConfig(changeType) {
  return CHANGE_TYPE_CONFIG[changeType] || { label: changeType, color: 'text-gray-400', bgColor: 'bg-gray-400/10' }
}

function getIcon(changeType) {
  switch (changeType) {
    case 'status_change':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    case 'priority_change':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    case 'ticket_assigned':
    case 'assignment':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'ticket_reassigned':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    case 'ticket_cancelled':
    case 'ticket_deleted':
    case 'ticket_unassigned':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    case 'update_requested':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    case 'update_fulfilled':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'ticket_reopened':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      )
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
  }
}

function buildDescription(entry) {
  const who = entry.changed_by_name?.trim() || 'System'

  switch (entry.change_type) {
    case 'status_change':
      return `${who} changed status from "${entry.old_value}" to "${entry.new_value}"`
    case 'priority_change':
      return `${who} changed priority from "${entry.old_value}" to "${entry.new_value}"`
    case 'category_change':
      return `${who} changed category from "${entry.old_value}" to "${entry.new_value}"`
    case 'ticket_assigned':
    case 'assignment': {
      const assignee = entry.change_details?.assigned_to_name || entry.new_value
      return `Assigned to ${assignee}`
    }
    case 'ticket_reassigned': {
      const from = entry.change_details?.previous_assignee_name || entry.old_value
      const to = entry.change_details?.assigned_to_name || entry.new_value
      return `Reassigned from ${from} to ${to}`
    }
    case 'ticket_unassigned':
      return `Ticket unassigned`
    case 'ticket_cancelled':
      return `Ticket cancelled by ${who}`
    case 'ticket_reopened':
      return `Ticket reopened by ${who}`
    case 'update_requested':
      return `Update requested by ${who}`
    case 'update_fulfilled':
      return `Update fulfilled by ${who}`
    case 'field_edited':
      return `${who} edited "${entry.field_name}"`
    default:
      return `${who} — ${getConfig(entry.change_type).label}`
  }
}

export default function ClientTicketUpdatesWidget({ onTicketClick }) {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMyTicketUpdates(100)
      setUpdates(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load updates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUpdates() }, [fetchUpdates])

  const filtered = filter === 'all'
    ? updates
    : updates.filter(u => u.change_type === filter)

  const changeTypes = [...new Set(updates.map(u => u.change_type))].sort()

  return (
    <BaseWidget
      title="Ticket Update Log"
      icon={
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      }
      onRefresh={fetchUpdates}
      autoRefreshInterval={60000}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Filter bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All ({updates.length})
          </button>
          {changeTypes.map(ct => {
            const cfg = getConfig(ct)
            const count = updates.filter(u => u.change_type === ct).length
            return (
              <button
                key={ct}
                onClick={() => setFilter(ct)}
                className={`text-xs px-2 py-1 rounded whitespace-nowrap ${filter === ct ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {cfg.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Update list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading updates...</div>
          )}
          {error && (
            <div className="flex items-center justify-center py-8 text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-sm gap-1">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>No updates yet</span>
            </div>
          )}
          {!loading && !error && filtered.map((entry) => {
            const cfg = getConfig(entry.change_type)
            return (
              <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-gray-800 hover:bg-gray-800/40 transition-colors cursor-pointer" onClick={() => onTicketClick?.(entry.ticket_id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onTicketClick?.(entry.ticket_id)}>
                <div className={`mt-0.5 shrink-0 p-1 rounded ${cfg.bgColor} ${cfg.color}`}>
                  {getIcon(entry.change_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-blue-400 shrink-0">
                      {entry.ticket_number || `#${entry.ticket_id}`}
                    </span>
                    <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-gray-500 ml-auto shrink-0">{formatTimeAgo(entry.created_at) || 'just now'}</span>
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
