import { useState, useEffect, useCallback, useMemo } from 'react'
import BaseWidget from './BaseWidget'
import { getDeletedTickets, restoreTicket } from '../services/ticketService'

const PRIORITY_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
}

const STATUS_COLORS = {
  open: 'text-green-400',
  in_progress: 'text-blue-400',
  waiting_on_customer: 'text-yellow-400',
  resolved: 'text-purple-400',
  closed: 'text-gray-400',
  cancelled: 'text-gray-500',
  reopened: 'text-cyan-400',
}

const CATEGORY_LABELS = {
  general: 'General',
  technical: 'Technical',
  billing: 'Billing',
  account: 'Account',
  feature_request: 'Feature Request',
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network',
  login: 'Login',
  other: 'Other',
}

/**
 * DeletedTicketsWidget
 * Displays soft-deleted tickets with search, filter, and restore capabilities.
 * Management/admin only.
 */
function DeletedTicketsWidget({ onTicketClick = null, autoRefreshInterval = 0 }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const [restoreSuccess, setRestoreSuccess] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getDeletedTickets()
      setTickets(response.data || [])
    } catch (err) {
      console.error('Deleted tickets fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  const handleRestore = useCallback(async (ticketId, e) => {
    e?.stopPropagation()
    if (restoringId) return

    setRestoringId(ticketId)
    setRestoreSuccess(null)
    try {
      await restoreTicket(ticketId)
      setTickets(prev => prev.filter(t => t.id !== ticketId))
      setRestoreSuccess(ticketId)
      // Clear success message after 3s
      setTimeout(() => setRestoreSuccess(null), 3000)
    } catch (err) {
      console.error('Restore ticket error:', err)
      setError(`Failed to restore ticket: ${err.message}`)
    } finally {
      setRestoringId(null)
    }
  }, [restoringId])

  // Filtered + searched tickets
  const filteredTickets = useMemo(() => {
    let result = tickets

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(t =>
        (t.subject && t.subject.toLowerCase().includes(q)) ||
        (t.ticket_number && t.ticket_number.toLowerCase().includes(q)) ||
        (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      )
    }

    if (priorityFilter) {
      result = result.filter(t => t.priority === priorityFilter)
    }
    if (categoryFilter) {
      result = result.filter(t => t.category === categoryFilter)
    }
    if (statusFilter) {
      result = result.filter(t => t.status === statusFilter)
    }

    return result
  }, [tickets, searchQuery, priorityFilter, categoryFilter, statusFilter])

  // Unique values for filter dropdowns
  const uniqueCategories = useMemo(() => [...new Set(tickets.map(t => t.category).filter(Boolean))].sort(), [tickets])
  const uniqueStatuses = useMemo(() => [...new Set(tickets.map(t => t.status).filter(Boolean))].sort(), [tickets])
  const uniquePriorities = useMemo(() => [...new Set(tickets.map(t => t.priority).filter(Boolean))], [tickets])

  const hasActiveFilters = searchQuery || priorityFilter || categoryFilter || statusFilter

  const clearFilters = () => {
    setSearchQuery('')
    setPriorityFilter('')
    setCategoryFilter('')
    setStatusFilter('')
  }

  const formatDeletedDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) return 'Just now'
      return `${diffHours}h ago`
    }
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <BaseWidget
      title="Deleted Tickets"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      }
      onRefresh={handleRefresh}
      autoRefreshInterval={autoRefreshInterval}
      isLoading={loading && tickets.length === 0}
      error={error}
      isEmpty={tickets.length === 0 && !loading}
      emptyMessage="No deleted tickets"
      emptyIcon={
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      }
      noPadding
      headerExtra={
        tickets.length > 0 ? (
          <span className="text-xs font-bold bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">
            {tickets.length}
          </span>
        ) : null
      }
    >
      <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
        {/* Success toast */}
        {restoreSuccess && (
          <div className="mb-3 p-2 bg-green-900/40 border border-green-700/50 rounded-lg text-green-400 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ticket restored successfully
          </div>
        )}

        {/* Search bar */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search deleted tickets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-500"
          >
            <option value="">All Priorities</option>
            {uniquePriorities.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-500"
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-500"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1 ml-auto"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-xs text-gray-500 mb-2">
            {filteredTickets.length} of {tickets.length} deleted tickets
          </p>
        )}

        {/* Ticket list */}
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {filteredTickets.length === 0 && !loading ? (
            <p className="text-gray-500 text-xs py-3 text-center">
              {hasActiveFilters ? 'No tickets match your filters.' : 'No deleted tickets.'}
            </p>
          ) : (
            filteredTickets.map(ticket => (
              <div
                key={ticket.id}
                className="rounded-lg border p-3 transition-all duration-200 bg-gray-800/40 border-gray-700/50 hover:brightness-110 hover:border-gray-600"
              >
                {/* Row 1: ticket number + deleted date */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-400 font-mono text-xs flex-shrink-0">
                      {ticket.ticket_number || `#${ticket.id}`}
                    </span>
                    <span className={`text-[10px] font-medium uppercase ${STATUS_COLORS[ticket.status] || 'text-gray-400'}`}>
                      {ticket.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    Deleted {formatDeletedDate(ticket.deleted_at)}
                  </span>
                </div>

                {/* Row 2: subject */}
                <p
                  className={`text-sm text-white truncate mb-1.5 ${onTicketClick ? 'cursor-pointer hover:text-blue-300' : ''}`}
                  onClick={() => onTicketClick?.(ticket)}
                >
                  {ticket.subject}
                </p>

                {/* Row 3: meta info */}
                <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-2">
                  <span className={`capitalize ${PRIORITY_COLORS[ticket.priority] || 'text-gray-400'}`}>
                    {ticket.priority}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                  <span>•</span>
                  <span className="truncate">{ticket.customer_name || 'Unknown'}</span>
                  {ticket.deleted_by_name && (
                    <>
                      <span>•</span>
                      <span className="text-gray-500 truncate">by {ticket.deleted_by_name}</span>
                    </>
                  )}
                </div>

                {/* Row 4: restore button */}
                <div className="flex justify-end">
                  <button
                    onClick={(e) => handleRestore(ticket.id, e)}
                    disabled={restoringId === ticket.id}
                    className={`
                      inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-all
                      ${restoringId === ticket.id
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-green-900/40 text-green-400 border border-green-700/50 hover:bg-green-800/50 hover:border-green-600'
                      }
                    `}
                  >
                    {restoringId === ticket.id ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Restoring...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredTickets.length > 0 && (
          <p className="text-[10px] text-gray-600 text-center mt-2">
            {filteredTickets.length} deleted ticket{filteredTickets.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </BaseWidget>
  )
}

export default DeletedTicketsWidget
