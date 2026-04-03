import { useState, useMemo, useCallback } from 'react'
import RefreshButton from './RefreshButton'
import SearchWithHistory from './SearchWithHistory'
import useContainerSize from '../hooks/useContainerSize'
import { getAllTickets } from '../services/ticketService'
import { formatDate as _fmtDate } from '../utils/dateFormatter'

// ── Utility functions ────────────────────────────────────────────────────────

const getStatusColor = (status) => {
  const statusColors = {
    open:                { bg: 'bg-yellow-950', border: 'border-yellow-700', text: 'text-yellow-400', badge: 'bg-yellow-900 text-yellow-300' },
    in_progress:         { bg: 'bg-blue-950',   border: 'border-blue-700',   text: 'text-blue-400',   badge: 'bg-blue-900 text-blue-300' },
    waiting_on_customer: { bg: 'bg-purple-950',  border: 'border-purple-700', text: 'text-purple-400', badge: 'bg-purple-900 text-purple-300' },
    resolved:            { bg: 'bg-green-950',   border: 'border-green-700',  text: 'text-green-400',  badge: 'bg-green-900 text-green-300' },
    closed:              { bg: 'bg-gray-800',    border: 'border-gray-600',   text: 'text-gray-400',   badge: 'bg-gray-700 text-gray-300' },
    cancelled:           { bg: 'bg-gray-900',    border: 'border-gray-600',   text: 'text-gray-400',   badge: 'bg-gray-700 text-gray-300' },
  }
  return statusColors[status] || statusColors.open
}

const getPriorityColor = (priority) => {
  const priorityColors = {
    low: 'bg-blue-900 text-blue-300',
    medium: 'bg-yellow-900 text-yellow-300',
    high: 'bg-orange-900 text-orange-300',
    critical: 'bg-red-900 text-red-300',
  }
  return priorityColors[priority] || 'bg-gray-700 text-gray-300'
}

const formatStatus = (status) =>
  status.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const formatDate = (dateString) => _fmtDate(dateString)

// ── Main Queue Widget ────────────────────────────────────────────────────────

export default function TechTicketQueueWidget({
  tickets: externalTickets,
  loading,
  onTicketClick,
  includeCancelled = true,
}) {
  const [containerRef, { width: containerWidth }] = useContainerSize()
  const ticketCols = containerWidth >= 900 ? 3 : containerWidth >= 550 ? 2 : 1
  const headerRow = containerWidth >= 700

  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ status: [], priority: [] })
  const [localTickets, setLocalTickets] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Use local tickets if we've self-refreshed, otherwise use parent's tickets
  const tickets = localTickets || externalTickets

  // Reset local tickets when parent data changes so we stay in sync
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await getAllTickets()
      setLocalTickets(response.data || [])
    } catch (err) {
      console.error('TechTicketQueue refresh error:', err)
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }, [])

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const cur = prev[filterType]
      return { ...prev, [filterType]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
    })
  }

  const resetFilters = () => { setFilters({ status: [], priority: [] }); setSearchQuery('') }

  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || searchQuery.trim() !== ''

  const filteredTickets = useMemo(() => {
    let result = includeCancelled ? tickets : tickets.filter(t => t.status !== 'cancelled')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => {
        const fields = [t.id?.toString(), t.subject, t.description, t.customer_name, t.customer_email, t.category, t.priority, t.status].filter(Boolean).join(' ').toLowerCase()
        return fields.includes(q)
      })
    }
    if (filters.status.length > 0) result = result.filter(t => filters.status.includes(t.status))
    if (filters.priority.length > 0) result = result.filter(t => filters.priority.includes(t.priority))
    return result
  }, [tickets, includeCancelled, searchQuery, filters])

  const sortedTickets = useMemo(
    () => [...filteredTickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [filteredTickets]
  )

  return (
    <div ref={containerRef} className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className={`flex gap-4 mb-4 ${headerRow ? 'flex-row justify-between items-center' : 'flex-col'}`}>
          {/* Title */}
          <h2 className="text-2xl font-bold text-white">Ticket Queue</h2>

          {/* Search Bar */}
          <div className="flex-1 max-w-md">
            <SearchWithHistory
              searchType="ticket"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets by ID, subject, customer..."
              className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              showClearButton={false}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showFilters ? 'Hide' : 'Show'} Filters
              {hasActiveFilters && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {filters.status.length + filters.priority.length + (searchQuery.trim() !== '' ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title={refreshing || loading ? 'Refreshing...' : 'Refresh tickets'}
              className={`w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all ${refreshing || loading ? 'animate-spin' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Filter */}
              <div>
                <h3 className="font-semibold text-white mb-2">Status</h3>
                <div className="space-y-1">
                  {['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'cancelled'].map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                      <input type="checkbox" checked={filters.status.includes(status)} onChange={() => handleFilterChange('status', status)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                      <span className="text-sm text-gray-300">{formatStatus(status)}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Priority Filter */}
              <div>
                <h3 className="font-semibold text-white mb-2">Priority</h3>
                <div className="space-y-1">
                  {['low', 'medium', 'high', 'critical'].map(priority => (
                    <label key={priority} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                      <input type="checkbox" checked={filters.priority.includes(priority)} onChange={() => handleFilterChange('priority', priority)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                      <span className="text-sm text-gray-300">{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {/* Filter Actions */}
            <div className="mt-3 flex justify-end">
              <button onClick={resetFilters} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm font-medium">Clear All Filters</button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="ml-3 text-gray-400">Loading tickets...</span>
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-2xl text-gray-500 mb-2">📭</p>
            <p className="text-gray-400 text-lg">No tickets found</p>
            <p className="text-gray-500 text-sm mt-2">All tickets have been resolved and closed!</p>
          </div>
        )}

        {!loading && tickets.length > 0 && filteredTickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-2xl text-gray-500 mb-2">🔍</p>
            <p className="text-gray-400 text-lg">No tickets match your filters</p>
            <button onClick={resetFilters} className="mt-4 px-4 py-2 text-blue-400 hover:text-blue-300 font-medium">Clear Filters</button>
          </div>
        )}

        {!loading && filteredTickets.length > 0 && (
          <div className="p-6">
            <p className="text-sm text-gray-400 mb-4">
              Showing <strong className="text-gray-200">{filteredTickets.length}</strong> of <strong className="text-gray-200">{tickets.length}</strong> ticket{tickets.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </p>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ticketCols}, minmax(0, 1fr))` }}>
              {sortedTickets.map((ticket) => {
                const statusColor = getStatusColor(ticket.status)
                return (
                  <div
                    key={ticket.id}
                    className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-blue-400 cursor-pointer`}
                    onClick={() => onTicketClick(ticket.id)}
                  >
                    {/* Ticket Header */}
                    <div className="mb-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-sm leading-tight whitespace-normal break-words">
                            {ticket.subject}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[10px] text-gray-400 mb-0.5">Priority</span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">ID: {ticket.id} | {formatDate(ticket.created_at)}</p>
                    </div>

                    {/* Description Preview */}
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2 break-words">
                      {ticket.description}
                    </p>

                    {/* Status Badge */}
                    <div className="mb-3">
                      <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${statusColor.badge}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </div>

                    {/* AI Classification */}
                    {ticket.ai_classified && (
                      <div className="mb-3 p-2 bg-indigo-950 bg-opacity-60 border border-indigo-800 rounded text-xs">
                        <div className="flex items-center gap-1 mb-2">
                          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="font-semibold text-indigo-300">AI Classification</span>
                          {ticket.ai_fallback_used && (
                            <span className="ml-auto text-yellow-500 text-[10px]" title="Fallback classification used">⚠ Fallback</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Category:</span>
                            <span className="text-indigo-200 font-medium capitalize">{ticket.category}</span>
                          </div>

                          {/* Priority Comparison */}
                          <div className="border-t border-indigo-800 pt-1.5 mt-1.5">
                            {ticket.user_priority && (
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-400">User Priority:</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPriorityColor(ticket.user_priority)}`}>
                                  {ticket.user_priority.charAt(0).toUpperCase() + ticket.user_priority.slice(1)}
                                </span>
                              </div>
                            )}
                            {ticket.ai_priority && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">AI Priority:</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPriorityColor(ticket.ai_priority)}`}>
                                  {ticket.ai_priority.charAt(0).toUpperCase() + ticket.ai_priority.slice(1)}
                                </span>
                              </div>
                            )}
                            {ticket.user_priority && ticket.ai_priority && ticket.user_priority !== ticket.ai_priority && (
                              <div className="mt-1 text-[10px] text-yellow-400 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Priority mismatch detected
                              </div>
                            )}
                          </div>

                          {ticket.ai_confidence != null && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-400">Confidence:</span>
                                <span className={`font-medium ${
                                  ticket.ai_confidence >= 0.7 ? 'text-green-400' :
                                  ticket.ai_confidence >= 0.4 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {Math.round(ticket.ai_confidence * 100)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    ticket.ai_confidence >= 0.7 ? 'bg-green-500' :
                                    ticket.ai_confidence >= 0.4 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.round(ticket.ai_confidence * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Customer Info - Who Requested */}
                    <div className="p-2 bg-gray-900 bg-opacity-50 rounded text-xs">
                      <p className="text-gray-400">
                        <strong className="text-gray-300">Requested by:</strong>
                      </p>
                      <p className="text-gray-200">
                        {ticket.customer_name || 'Unknown'}
                        {ticket.customer_email && (
                          <span className="text-gray-400 block text-xs">{ticket.customer_email}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
