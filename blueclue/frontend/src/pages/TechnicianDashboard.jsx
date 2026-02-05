import { useState, useEffect } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { getAllTickets } from '../services/ticketService'

/**
 * Status badge styling map
 */
const getStatusColor = (status) => {
  const statusColors = {
    open: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
    in_progress: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
    waiting_on_customer: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
    resolved: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
    closed: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' }
  }
  return statusColors[status] || statusColors.open
}

/**
 * Priority badge styling map
 */
const getPriorityColor = (priority) => {
  const priorityColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  }
  return priorityColors[priority] || 'bg-gray-100 text-gray-800'
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
  }

  // Apply filters to tickets
  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
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
    total: tickets.length
  }

  // Get filtered and sorted tickets
  const filteredTickets = getFilteredTickets()
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })

  // Check if any filters are active
  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.assignmentStatus.length > 0

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Technician Dashboard</h1>
        <p className="text-gray-600">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Tickets</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats.total}</p>
            </div>
            <div className="text-4xl text-gray-300">📋</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-yellow-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-600 text-sm font-medium">Open</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.open}</p>
            </div>
            <div className="text-4xl">⭐</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">In Progress</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.in_progress}</p>
            </div>
            <div className="text-4xl">⚙️</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-green-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Resolved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.resolved}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
      </div>

      {/* Ticket Queue with Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Ticket Queue</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                🔍 {showFilters ? 'Hide' : 'Show'} Filters
                {hasActiveFilters && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {filters.status.length + filters.priority.length + filters.assignmentStatus.length}
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
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Filter */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    📊 Status
                  </h3>
                  <div className="space-y-2">
                    {['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={() => handleFilterChange('status', status)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">{formatStatus(status)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    ⚡ Priority
                  </h3>
                  <div className="space-y-2">
                    {['low', 'medium', 'high', 'critical'].map(priority => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={filters.priority.includes(priority)}
                          onChange={() => handleFilterChange('priority', priority)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Assignment Filter */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    👤 Assignment
                  </h3>
                  <div className="space-y-2">
                    {['assigned', 'unassigned'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={filters.assignmentStatus.includes(status)}
                          onChange={() => handleFilterChange('assignmentStatus', status)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">
                          {status === 'assigned' ? 'Assigned to Someone' : 'Unassigned'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && <LoadingSpinner message="Loading tickets..." />}

        {/* Empty State */}
        {!loading && tickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-2xl text-gray-400 mb-2">📭</p>
            <p className="text-gray-500 text-lg">No tickets found</p>
            <p className="text-gray-400 text-sm mt-2">All tickets have been resolved and closed!</p>
          </div>
        )}

        {/* No Results for Filters */}
        {!loading && tickets.length > 0 && filteredTickets.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-2xl text-gray-400 mb-2">🔍</p>
            <p className="text-gray-500 text-lg">No tickets match your filters</p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Tickets Grid */}
        {!loading && filteredTickets.length > 0 && (
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Showing <strong>{filteredTickets.length}</strong> of <strong>{tickets.length}</strong> ticket{tickets.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedTickets.map((ticket) => {
                const statusColor = getStatusColor(ticket.status)
                return (
                  <div
                    key={ticket.id}
                    className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 hover:shadow-md transition-shadow`}
                  >
                    {/* Ticket Header */}
                    <div className="mb-3">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-800 text-sm leading-tight flex-1 pr-2">
                          {ticket.subject}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">ID: {ticket.id} | {formatDate(ticket.created_at)}</p>
                    </div>

                    {/* Description Preview */}
                    <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                      {ticket.description}
                    </p>

                    {/* Status Badge */}
                    <div className="mb-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColor.badge}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </div>

                    {/* AI Classification (Placeholder for future enhancement) */}
                    {ticket.ai_classified && (
                      <div className="mb-3 p-2 bg-white bg-opacity-50 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">
                            <strong>AI Category:</strong> {ticket.category}
                          </span>
                          {ticket.ai_confidence && (
                            <span className="text-gray-500">
                              ({Math.round(ticket.ai_confidence * 100)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Customer Info - Who Requested */}
                    <div className="mb-3 p-2 bg-white bg-opacity-50 rounded text-xs">
                      <p className="text-gray-600">
                        <strong>Requested by:</strong>
                      </p>
                      <p className="text-gray-700">
                        {ticket.customer_name || 'Unknown'}
                        {ticket.customer_email && (
                          <span className="text-gray-500 block text-xs">{ticket.customer_email}</span>
                        )}
                      </p>
                    </div>

                    {/* Assignment Info - Who it's Assigned To */}
                    <div className="p-2 bg-white bg-opacity-50 rounded text-xs">
                      <p className="text-gray-600">
                        <strong>Assigned to:</strong>
                      </p>
                      <p className="text-gray-700">
                        {ticket.assigned_to_name ? (
                          <>
                            {ticket.assigned_to_name}
                            {ticket.assigned_to_email && (
                              <span className="text-gray-500 block text-xs">{ticket.assigned_to_email}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-orange-600 font-medium">Unassigned</span>
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

      {/* Note for future development */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Note:</strong> When authentication is implemented, this dashboard will automatically filter tickets assigned to the logged-in technician and show only their queue. Users will also be able to:
        <ul className="list-disc list-inside ml-2 mt-2">
          <li>Claim unassigned tickets</li>
          <li>Update ticket status and priority</li>
          <li>Add notes and resolution details</li>
          <li>View ticket history and AI classification details</li>
        </ul>
      </div>
    </div>
  )
}

export default TechnicianDashboard
