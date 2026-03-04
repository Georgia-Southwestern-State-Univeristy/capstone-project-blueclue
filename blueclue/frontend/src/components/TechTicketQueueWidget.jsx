import { useState, useMemo, useCallback } from 'react'
import RefreshButton from './RefreshButton'
import { getAllTickets } from '../services/ticketService'

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

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// ── Ticket Card ──────────────────────────────────────────────────────────────

function TechTicketCard({
  ticket, technicians, onTicketClick,
  onStatusChange, onAssignmentChange,
  updatingTicketId, assigningTicketId, ticketErrors,
}) {
  const statusColor = getStatusColor(ticket.status)

  return (
    <div
      className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-blue-400 cursor-pointer`}
      onClick={() => onTicketClick(ticket.id)}
    >
      {/* Ticket-Specific Error */}
      {ticketErrors[ticket.id] && (
        <div className="mb-3 p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-200">
          <strong>Error:</strong> {ticketErrors[ticket.id]}
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm leading-tight whitespace-normal break-words">
              {ticket.subject}
            </h3>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[10px] text-gray-400 mb-0.5">Client Selected</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400">ID: {ticket.id} | {formatDate(ticket.created_at)}</p>
      </div>

      {/* Description Preview */}
      <p className="text-gray-300 text-sm mb-4 whitespace-normal break-words">{ticket.description}</p>

      {/* Status Dropdown */}
      <div className="mb-3">
        <label className="block text-xs text-gray-400 mb-1">Status:</label>
        <select
          value={ticket.status}
          onChange={(e) => onStatusChange(ticket.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={updatingTicketId === ticket.id || ticket.status === 'closed' || ticket.status === 'cancelled'}
          className={`w-full px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${statusColor.badge} border border-gray-600 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="open">{updatingTicketId === ticket.id && ticket.status === 'open' ? '⏳ ' : ''}Open</option>
          <option value="in_progress">{updatingTicketId === ticket.id && ticket.status === 'in_progress' ? '⏳ ' : ''}In Progress</option>
          <option value="waiting_on_customer">{updatingTicketId === ticket.id && ticket.status === 'waiting_on_customer' ? '⏳ ' : ''}Waiting on Customer</option>
          <option value="resolved">{updatingTicketId === ticket.id && ticket.status === 'resolved' ? '⏳ ' : ''}Resolved</option>
          <option value="closed">{updatingTicketId === ticket.id && ticket.status === 'closed' ? '⏳ ' : ''}Closed</option>
          <option value="cancelled">{updatingTicketId === ticket.id && ticket.status === 'cancelled' ? '⏳ ' : ''}Cancelled</option>
        </select>
        {updatingTicketId === ticket.id && <p className="text-blue-400 text-[10px] mt-1">Updating...</p>}
        {(ticket.status === 'closed' || ticket.status === 'cancelled') && (
          <p className="text-xs text-gray-500 mt-1">{ticket.status === 'cancelled' ? 'Cancelled' : 'Closed'} tickets cannot be modified</p>
        )}
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
                    ticket.ai_confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Math.round(ticket.ai_confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      ticket.ai_confidence >= 0.7 ? 'bg-green-500' :
                      ticket.ai_confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(ticket.ai_confidence * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Info */}
      <div className="mb-3 p-2 bg-gray-900 bg-opacity-50 rounded text-xs">
        <p className="text-gray-400"><strong className="text-gray-300">Requested by:</strong></p>
        <p className="text-gray-200">
          {ticket.customer_name || 'Unknown'}
          {ticket.customer_email && <span className="text-gray-400 block text-xs">{ticket.customer_email}</span>}
        </p>
      </div>

      {/* Assignment Dropdown (only when assignment is enabled) */}
      {onAssignmentChange && (
        <div className="p-2 bg-gray-900 bg-opacity-50 rounded text-xs">
          <label htmlFor={`assign-${ticket.id}`} className="block text-gray-400 mb-1">
            <strong className="text-gray-300">Assign to Technician:</strong>
          </label>
          <select
            id={`assign-${ticket.id}`}
            value={ticket.assigned_to || ''}
            onChange={(e) => onAssignmentChange(ticket.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={assigningTicketId === ticket.id || ticket.status === 'closed' || ticket.status === 'cancelled'}
            className="w-full px-2 py-1.5 rounded-md text-sm bg-gray-800 border border-gray-600 text-gray-200 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Unassigned</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>{tech.full_name}</option>
            ))}
          </select>
          {assigningTicketId === ticket.id && <p className="text-blue-400 text-[10px] mt-1">Updating...</p>}
        </div>
      )}
    </div>
  )
}

// ── Main Queue Widget ────────────────────────────────────────────────────────

export default function TechTicketQueueWidget({
  tickets: externalTickets,
  loading,
  technicians = [],
  onTicketClick,
  onStatusChange,
  onAssignmentChange,
  updatingTicketId,
  assigningTicketId,
  ticketErrors,
  includeCancelled = true,
}) {
  const showAssignment = !!onAssignmentChange
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ status: [], priority: [], assignmentStatus: [] })
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

  // Compute tickets
  const activeTickets = useMemo(
    () => (includeCancelled ? tickets : tickets.filter(t => t.status !== 'cancelled')),
    [tickets, includeCancelled]
  )

  const assignedCount = activeTickets.filter(t => t.assigned_to_name && t.assigned_to_name !== 'null').length
  const unassignedCount = activeTickets.length - assignedCount
  const assignmentSegments = [
    { label: 'Assigned', count: assignedCount, color: '#3b82f6' },
    { label: 'Unassigned', count: unassignedCount, color: '#6b7280' },
  ]

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const cur = prev[filterType]
      return { ...prev, [filterType]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
    })
  }

  const resetFilters = () => { setFilters({ status: [], priority: [], assignmentStatus: [] }); setSearchQuery('') }

  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.assignmentStatus.length > 0 || searchQuery.trim() !== ''

  const filteredTickets = useMemo(() => {
    let result = includeCancelled ? tickets : tickets.filter(t => t.status !== 'cancelled')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => {
        const fields = [t.id?.toString(), t.subject, t.description, t.customer_name, t.customer_email, t.assigned_to_name, t.assigned_to_email, t.category, t.priority, t.status].filter(Boolean).join(' ').toLowerCase()
        return fields.includes(q)
      })
    }
    if (filters.status.length > 0) result = result.filter(t => filters.status.includes(t.status))
    if (filters.priority.length > 0) result = result.filter(t => filters.priority.includes(t.priority))
    if (filters.assignmentStatus.length > 0) {
      result = result.filter(t => {
        const isAssigned = t.assigned_to_name && t.assigned_to_name !== 'null'
        if (filters.assignmentStatus.includes('assigned') && !isAssigned) return false
        if (filters.assignmentStatus.includes('unassigned') && isAssigned) return false
        return true
      })
    }
    return result
  }, [tickets, includeCancelled, searchQuery, filters])

  const sortedTickets = useMemo(
    () => [...filteredTickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [filteredTickets]
  )

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-gray-700">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
          {/* Title + Mini Pie (assignment pie only when assignment is enabled) */}
          <div className="flex items-center gap-4">
            <h2 className="text-xl lg:text-2xl font-bold text-white">Ticket Queue</h2>
            {showAssignment && (
              <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-600">
                <svg viewBox="0 0 40 40" className="w-10 h-10">
                  {activeTickets.length === 0 ? (
                    <circle cx="20" cy="20" r="16" fill="#374151" />
                  ) : (
                    assignmentSegments.map((segment, i) => {
                      const total = activeTickets.length || 1
                      const percent = (segment.count / total) * 100
                      if (percent === 0) return null
                      const offset = assignmentSegments.slice(0, i).reduce((sum, s) => sum + (s.count / total) * 100, 0)
                      const startAngle = offset * 3.6
                      const endAngle = (offset + percent) * 3.6
                      const startRad = ((startAngle - 90) * Math.PI) / 180
                      const endRad = ((endAngle - 90) * Math.PI) / 180
                      const largeArc = percent > 50 ? 1 : 0
                      const r = 16
                      return (
                        <path
                          key={segment.label}
                          d={percent >= 100
                            ? 'M 20 4 A 16 16 0 1 1 20 36 A 16 16 0 1 1 20 4 Z'
                            : `M 20 20 L ${20 + r * Math.cos(startRad)} ${20 + r * Math.sin(startRad)} A ${r} ${r} 0 ${largeArc} 1 ${20 + r * Math.cos(endRad)} ${20 + r * Math.sin(endRad)} Z`}
                          fill={segment.color}
                        />
                      )
                    })
                  )}
                  <circle cx="20" cy="20" r="10" fill="#111827" />
                </svg>
                <div className="text-xs">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-300">{assignedCount} Assigned</span></div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /><span className="text-gray-300">{unassignedCount} Unassigned</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tickets by ID, subject, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" title="Clear search">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
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
                  {filters.status.length + filters.priority.length + filters.assignmentStatus.length + (searchQuery.trim() !== '' ? 1 : 0)}
                </span>
              )}
            </button>
            <RefreshButton onRefresh={handleRefresh} disabled={refreshing || loading} />
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <div className={`grid grid-cols-1 ${showAssignment ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
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
              {showAssignment && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Assignment</h3>
                  <div className="space-y-1">
                    {['assigned', 'unassigned'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                        <input type="checkbox" checked={filters.assignmentStatus.includes(status)} onChange={() => handleFilterChange('assignmentStatus', status)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                        <span className="text-sm text-gray-300">{status === 'assigned' ? 'Assigned to Someone' : 'Unassigned'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
          <div className="p-4 lg:p-6">
            <p className="text-sm text-gray-400 mb-4">
              Showing <strong className="text-gray-200">{filteredTickets.length}</strong> of <strong className="text-gray-200">{tickets.length}</strong> ticket{tickets.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedTickets.map(ticket => (
                <TechTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  technicians={technicians}
                  onTicketClick={onTicketClick}
                  onStatusChange={onStatusChange}
                  onAssignmentChange={onAssignmentChange}
                  updatingTicketId={updatingTicketId}
                  assigningTicketId={assigningTicketId}
                  ticketErrors={ticketErrors}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
