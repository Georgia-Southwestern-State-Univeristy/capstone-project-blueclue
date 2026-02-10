import { useState, useEffect } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import DonutChart from '../components/DonutChart'
import TicketTimeline from '../components/TicketTimeline'
import PieChart from '../components/PieChart'
import { getAllTickets, updateTicketStatus } from '../services/ticketService'

/**
 * Status badge styling map
 */
const getStatusColor = (status) => {
  const statusColors = {
    open: { bg: 'bg-yellow-950', border: 'border-yellow-700', text: 'text-yellow-400', badge: 'bg-yellow-900 text-yellow-300' },
    in_progress: { bg: 'bg-blue-950', border: 'border-blue-700', text: 'text-blue-400', badge: 'bg-blue-900 text-blue-300' },
    waiting_on_customer: { bg: 'bg-purple-950', border: 'border-purple-700', text: 'text-purple-400', badge: 'bg-purple-900 text-purple-300' },
    resolved: { bg: 'bg-green-950', border: 'border-green-700', text: 'text-green-400', badge: 'bg-green-900 text-green-300' },
    closed: { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-400', badge: 'bg-gray-700 text-gray-300' }
  }
  return statusColors[status] || statusColors.open
}

/**
 * Priority badge styling map
 */
const getPriorityColor = (priority) => {
  const priorityColors = {
    low: 'bg-blue-900 text-blue-300',
    medium: 'bg-yellow-900 text-yellow-300',
    high: 'bg-orange-900 text-orange-300',
    critical: 'bg-red-900 text-red-300'
  }
  return priorityColors[priority] || 'bg-gray-700 text-gray-300'
}

/**
 * Format status text for display
 */
const formatStatus = (status) => {
  return status.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/**
 * Format date for display
 */
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function TechnicianDashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [updatingTicketId, setUpdatingTicketId] = useState(null)
  const [ticketErrors, setTicketErrors] = useState({}) // Per-ticket errors
  const [searchQuery, setSearchQuery] = useState('')

  // Filter state
  const [filters, setFilters] = useState({
    status: [],
    priority: [],
    assignmentStatus: [] // 'assigned', 'unassigned'
  })

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getAllTickets()
      setTickets(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load tickets')
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle status change for a ticket
  const handleStatusChange = async (ticketId, newStatus) => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    const previousStatus = ticket.status

    // Optimistic update - immediately update UI
    setTickets(prevTickets =>
      prevTickets.map(t =>
        t.id === ticketId ? { ...t, status: newStatus } : t
      )
    )
    setUpdatingTicketId(ticketId)
    
    // Clear any existing error for this ticket
    setTicketErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[ticketId]
      return newErrors
    })

    try {
      // Call API to update status
      await updateTicketStatus(ticketId, newStatus)
      
      // Success! Refresh to get latest data
      await fetchTickets()
    } catch (err) {
      // Error occurred - revert to previous status
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticketId ? { ...t, status: previousStatus } : t
        )
      )
      
      // Set ticket-specific error
      setTicketErrors(prev => ({
        ...prev,
        [ticketId]: err.message || 'Failed to update status'
      }))
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setTicketErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[ticketId]
          return newErrors
        })
      }, 5000)
    } finally {
      setUpdatingTicketId(null)
    }
  }

  // Handle filter checkbox changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const currentValues = prev[filterType]
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value]

      return { ...prev, [filterType]: newValues }
    })
  }

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      status: [],
      priority: [],
      assignmentStatus: []
    })
    setSearchQuery('')
  }

  // Apply filters to tickets
  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
      // Search filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase()
        const searchableFields = [
          ticket.id?.toString(),
          ticket.subject,
          ticket.description,
          ticket.customer_name,
          ticket.customer_email,
          ticket.assigned_to_name,
          ticket.assigned_to_email,
          ticket.category,
          ticket.priority,
          ticket.status
        ].filter(Boolean).join(' ').toLowerCase()
        
        if (!searchableFields.includes(query)) {
          return false
        }
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(ticket.status)) {
        return false
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(ticket.priority)) {
        return false
      }

      // Assignment status filter
      if (filters.assignmentStatus.length > 0) {
        const isAssigned = ticket.assigned_to_name && ticket.assigned_to_name !== 'null'
        if (filters.assignmentStatus.includes('assigned') && !isAssigned) {
          return false
        }
        if (filters.assignmentStatus.includes('unassigned') && isAssigned) {
          return false
        }
      }

      return true
    })
  }

  // Calculate ticket statistics
  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    waiting: tickets.filter(t => t.status === 'waiting_on_customer').length,
    total: tickets.length
  }

  // Donut chart segment data
  const donutSegments = [
    { label: 'Open', count: stats.open, color: '#60a5fa' },
    { label: 'In Progress', count: stats.in_progress, color: '#93c5fd' },
    { label: 'Waiting', count: stats.waiting, color: '#a78bfa' },
    { label: 'Resolved', count: stats.resolved, color: '#3b82f6' },
    { label: 'Closed', count: stats.closed, color: '#6b7280' },
  ]

  // Priority pie chart data
  const prioritySegments = [
    { label: 'Low', count: tickets.filter(t => t.priority === 'low').length, color: '#3b82f6' },
    { label: 'Medium', count: tickets.filter(t => t.priority === 'medium').length, color: '#eab308' },
    { label: 'High', count: tickets.filter(t => t.priority === 'high').length, color: '#f97316' },
    { label: 'Critical', count: tickets.filter(t => t.priority === 'critical').length, color: '#ef4444' },
  ]

  // Get filtered and sorted tickets
  const filteredTickets = getFilteredTickets()
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })

  // Check if any filters are active
  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.assignmentStatus.length > 0 || searchQuery.trim() !== ''

  return (
    <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Technician Dashboard</h1>
        <p className="text-gray-400">
          View and manage all support tickets. Ready to filter by assigned technician when authentication is implemented.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <Alert 
            type="error" 
            message={error}
            onClose={() => setError(null)}
          />
        </div>
      )}

      {/* Bar Chart (TicketTimeline) above Pie Charts */}
      <div className="mb-8">
        <TicketTimeline tickets={tickets} onRefresh={fetchTickets} isRefreshing={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DonutChart segments={donutSegments} total={stats.total} />
        <PieChart segments={prioritySegments} title="Priority Breakdown" />
      </div>

      {/* Ticket Queue with Filters */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
        <div className="p-6 border-b border-gray-700">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold text-white">Ticket Queue</h2>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tickets by ID, subject, customer, etc..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    title="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
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
                    {filters.status.length + filters.priority.length + filters.assignmentStatus.length + (searchQuery.trim() !== '' ? 1 : 0)}
                  </span>
                )}
              </button>
              <button
                onClick={fetchTickets}
                disabled={loading}
                title={loading ? 'Refreshing...' : 'Refresh tickets'}
                className={`w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all ${loading ? 'animate-spin' : ''}`}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <h3 className="font-semibold text-white mb-2">
                    Status
                  </h3>
                  <div className="space-y-1">
                    {['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={() => handleFilterChange('status', status)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-300">{formatStatus(status)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <h3 className="font-semibold text-white mb-2">
                    Priority
                  </h3>
                  <div className="space-y-1">
                    {['low', 'medium', 'high', 'critical'].map(priority => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={filters.priority.includes(priority)}
                          onChange={() => handleFilterChange('priority', priority)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-300">{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Assignment Filter */}
                <div>
                  <h3 className="font-semibold text-white mb-2">
                    Assignment
                  </h3>
                  <div className="space-y-1">
                    {['assigned', 'unassigned'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={filters.assignmentStatus.includes(status)}
                          onChange={() => handleFilterChange('assignmentStatus', status)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-300">
                          {status === 'assigned' ? 'Assigned to Someone' : 'Unassigned'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner message="Loading tickets..." />
          </div>
        )}

        {/* Empty State */}
        {!loading && tickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-2xl text-gray-500 mb-2">📭</p>
            <p className="text-gray-400 text-lg">No tickets found</p>
            <p className="text-gray-500 text-sm mt-2">All tickets have been resolved and closed!</p>
          </div>
        )}

        {/* No Results for Filters */}
        {!loading && tickets.length > 0 && filteredTickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-2xl text-gray-500 mb-2">🔍</p>
            <p className="text-gray-400 text-lg">No tickets match your filters</p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-blue-400 hover:text-blue-300 font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Tickets Grid */}
        {!loading && filteredTickets.length > 0 && (
          <div className="p-6">
            <p className="text-sm text-gray-400 mb-4">
              Showing <strong className="text-gray-200">{filteredTickets.length}</strong> of <strong className="text-gray-200">{tickets.length}</strong> ticket{tickets.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedTickets.map((ticket) => {
                const statusColor = getStatusColor(ticket.status)
                return (
                  <div
                    key={ticket.id}
                    className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-blue-400`}
                  >
                    {/* Ticket-Specific Error Message */}
                    {ticketErrors[ticket.id] && (
                      <div className="mb-3 p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-200">
                        <strong>Error:</strong> {ticketErrors[ticket.id]}
                      </div>
                    )}

                    {/* Ticket Header */}
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
                    <p className="text-gray-300 text-sm mb-4 whitespace-normal break-words">
                      {ticket.description}
                    </p>

                    {/* Status Dropdown */}
                    <div className="mb-3">
                      <label className="block text-xs text-gray-400 mb-1">Status:</label>
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        disabled={updatingTicketId === ticket.id || ticket.status === 'closed'}
                        className={`w-full px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${statusColor.badge} border border-gray-600 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="open">{updatingTicketId === ticket.id && ticket.status === 'open' ? '⏳ ' : ''}Open</option>
                        <option value="in_progress">{updatingTicketId === ticket.id && ticket.status === 'in_progress' ? '⏳ ' : ''}In Progress</option>
                        <option value="waiting_on_customer">{updatingTicketId === ticket.id && ticket.status === 'waiting_on_customer' ? '⏳ ' : ''}Waiting on Customer</option>
                        <option value="resolved">{updatingTicketId === ticket.id && ticket.status === 'resolved' ? '⏳ ' : ''}Resolved</option>
                        <option value="closed">{updatingTicketId === ticket.id && ticket.status === 'closed' ? '⏳ ' : ''}Closed</option>
                      </select>
                      {ticket.status === 'closed' && (
                        <p className="text-xs text-gray-500 mt-1">Closed tickets cannot be modified</p>
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
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Priority:</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                            </span>
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
                    <div className="mb-3 p-2 bg-gray-900 bg-opacity-50 rounded text-xs">
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

                    {/* Assignment Info - Who it's Assigned To */}
                    <div className="p-2 bg-gray-900 bg-opacity-50 rounded text-xs">
                      <p className="text-gray-400">
                        <strong className="text-gray-300">Assigned to:</strong>
                      </p>
                      <p className="text-gray-200">
                        {ticket.assigned_to_name ? (
                          <>
                            {ticket.assigned_to_name}
                            {ticket.assigned_to_email && (
                              <span className="text-gray-400 block text-xs">{ticket.assigned_to_email}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-blue-400 font-medium">Unassigned</span>
                        )}
                      </p>
                    </div>

                    {/* TODO: When authentication is implemented, add action buttons here */}
                    {/* Examples: Assign to Me, View Details, Update Status */}
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

export default TechnicianDashboard
