import { useState, useMemo, useCallback } from 'react'
import RefreshButton from './RefreshButton'
import useContainerSize from '../hooks/useContainerSize'
import { getAllTickets } from '../services/ticketService'
import { getUserId } from '../services/authService'
import { formatDate as _fmtDate } from '../utils/dateFormatter'

// ── Helpers ──────────────────────────────────────────────────────────────

const getStatusColor = (status) => {
  const m = {
    open:                { bg: 'bg-yellow-950', border: 'border-yellow-700', text: 'text-yellow-400', badge: 'bg-yellow-900 text-yellow-300' },
    in_progress:         { bg: 'bg-blue-950',   border: 'border-blue-700',   text: 'text-blue-400',   badge: 'bg-blue-900 text-blue-300' },
    waiting_on_customer: { bg: 'bg-purple-950',  border: 'border-purple-700', text: 'text-purple-400', badge: 'bg-purple-900 text-purple-300' },
    resolved:            { bg: 'bg-green-950',   border: 'border-green-700',  text: 'text-green-400',  badge: 'bg-green-900 text-green-300' },
    closed:              { bg: 'bg-gray-800',    border: 'border-gray-600',   text: 'text-gray-400',   badge: 'bg-gray-700 text-gray-300' },
    cancelled:           { bg: 'bg-gray-900',    border: 'border-gray-600',   text: 'text-gray-400',   badge: 'bg-gray-700 text-gray-300' },
  }
  return m[status] || m.open
}

const getPriorityColor = (p) => {
  const m = { low: 'bg-blue-900 text-blue-300', medium: 'bg-yellow-900 text-yellow-300', high: 'bg-orange-900 text-orange-300', critical: 'bg-red-900 text-red-300' }
  return m[p] || 'bg-gray-700 text-gray-300'
}

const formatStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const formatDate = (d) => _fmtDate(d)

// ── Component ────────────────────────────────────────────────────────────

export default function MyAssignedTicketsWidget({ tickets: externalTickets = [], loading, onTicketClick }) {
  const [containerRef, { width: containerWidth }] = useContainerSize()
  const ticketCols = containerWidth >= 900 ? 3 : containerWidth >= 550 ? 2 : 1
  const filterCols = containerWidth >= 600 ? 2 : 1
  const headerRow = containerWidth >= 700

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ status: [], priority: [] })
  const [localTickets, setLocalTickets] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const tickets = localTickets || externalTickets
  const currentUserId = getUserId()

  // Only tickets assigned to me
  const myTickets = useMemo(
    () => tickets.filter(t => t.assigned_to === currentUserId),
    [tickets, currentUserId]
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await getAllTickets()
      setLocalTickets(response.data || [])
    } catch (err) {
      console.error('MyAssignedTickets refresh error:', err)
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
    let result = myTickets
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => {
        const fields = [t.id?.toString(), t.ticket_number, t.subject, t.description, t.customer_name, t.customer_email, t.category, t.priority, t.status].filter(Boolean).join(' ').toLowerCase()
        return fields.includes(q)
      })
    }
    if (filters.status.length > 0) result = result.filter(t => filters.status.includes(t.status))
    if (filters.priority.length > 0) result = result.filter(t => filters.priority.includes(t.priority))
    return result
  }, [myTickets, searchQuery, filters])

  const sortedTickets = useMemo(
    () => [...filteredTickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [filteredTickets]
  )

  return (
    <div ref={containerRef} className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className={`flex gap-4 mb-4 ${headerRow ? 'flex-row justify-between items-center' : 'flex-col'}`}>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-white">My Assigned Tickets</h2>
              <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-600 text-xs">
                <span className="text-gray-300">{myTickets.length} ticket{myTickets.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tickets by ID, subject, customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                {showFilters ? 'Hide' : 'Show'} Filters
                {hasActiveFilters && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {filters.status.length + filters.priority.length + (searchQuery.trim() !== '' ? 1 : 0)}
                  </span>
                )}
              </button>
              <RefreshButton onRefresh={handleRefresh} disabled={refreshing} />
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${filterCols}, minmax(0, 1fr))` }}>
                {/* Status */}
                <div>
                  <h3 className="font-semibold text-white mb-2">Status</h3>
                  <div className="space-y-1">
                    {['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'cancelled'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                        <input type="checkbox" checked={filters.status.includes(s)} onChange={() => handleFilterChange('status', s)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                        <span className="text-sm text-gray-300">{formatStatus(s)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Priority */}
                <div>
                  <h3 className="font-semibold text-white mb-2">Priority</h3>
                  <div className="space-y-1">
                    {['low', 'medium', 'high', 'critical'].map(p => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                        <input type="checkbox" checked={filters.priority.includes(p)} onChange={() => handleFilterChange('priority', p)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                        <span className="text-sm text-gray-300">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={resetFilters} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm font-medium">Clear All Filters</button>
              </div>
            </div>
          )}
        </div>

        {/* Count bar */}
        {filteredTickets.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-700 flex items-center justify-end bg-gray-800/30">
            <span className="text-sm text-gray-400">
              {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </span>
          </div>
        )}

        {/* Empty states */}
        {myTickets.length === 0 && !loading && (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-lg">No tickets are currently assigned to you</p>
          </div>
        )}
        {myTickets.length > 0 && filteredTickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-lg">No tickets match your filters</p>
            <button onClick={resetFilters} className="mt-4 px-4 py-2 text-blue-400 hover:text-blue-300 font-medium">Clear Filters</button>
          </div>
        )}
        {loading && myTickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-400">Loading tickets...</p>
          </div>
        )}

        {/* Ticket Cards Grid */}
        {filteredTickets.length > 0 && (
          <div className="p-6 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ticketCols}, minmax(0, 1fr))` }}>
              {sortedTickets.map(ticket => {
                const statusColor = getStatusColor(ticket.status)
                return (
                  <div
                    key={ticket.id}
                    onClick={() => onTicketClick?.(ticket.id)}
                    className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer select-none`}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-sm leading-tight break-words">{ticket.subject}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_number || `#${ticket.id}`} &middot; {formatDate(ticket.created_at)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2 break-words">{ticket.description}</p>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded font-medium ${statusColor.badge}`}>{formatStatus(ticket.status)}</span>
                      {ticket.category && <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{ticket.category}</span>}
                    </div>

                    {/* Customer */}
                    <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {ticket.customer_name || 'Unknown'}
                      </span>
                    </div>

                    {/* AI Classification */}
                    {ticket.ai_classified && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-indigo-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          AI
                        </span>
                        {ticket.ai_confidence != null && (
                          <span className={`font-medium ${ticket.ai_confidence >= 0.7 ? 'text-green-400' : ticket.ai_confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {Math.round(ticket.ai_confidence * 100)}%
                          </span>
                        )}
                        {ticket.ai_fallback_used && <span className="text-yellow-500">Fallback</span>}
                      </div>
                    )}
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
