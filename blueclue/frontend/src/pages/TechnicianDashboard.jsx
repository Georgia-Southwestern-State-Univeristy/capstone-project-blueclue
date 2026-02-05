import { useState, useEffect } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import DonutChart from '../components/DonutChart'
import PieChart from '../components/PieChart'
import { getAllTickets } from '../services/ticketService'

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
  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.assignmentStatus.length > 0

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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DonutChart segments={donutSegments} total={stats.total} />
        <PieChart segments={prioritySegments} title="Priority Breakdown" />
      </div>

      {/* Ticket Queue with Filters */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Ticket Queue</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
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
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Filter */}
                <div>
                  <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    📊 Status
                  </h3>
                  <div className="space-y-2">
                    {['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
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
                  <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    ⚡ Priority
                  </h3>
                  <div className="space-y-2">
                    {['low', 'medium', 'high', 'critical'].map(priority => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
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
                  <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    👤 Assignment
                  </h3>
                  <div className="space-y-2">
                    {['assigned', 'unassigned'].map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
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
              <div className="mt-4 flex justify-end">
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
                    {/* Ticket Header */}
                    <div className="mb-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-sm leading-tight whitespace-normal break-words">
                            {ticket.subject}
                          </h3>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">ID: {ticket.id} | {formatDate(ticket.created_at)}</p>
                    </div>

                    {/* Description Preview */}
                    <p className="text-gray-300 text-sm mb-4 whitespace-normal break-words">
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
                      <div className="mb-3 p-2 bg-gray-900 bg-opacity-50 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">
                            <strong className="text-gray-300">AI Category:</strong> {ticket.category}
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

      {/* Note for future development */}
      <div className="mt-8 p-4 bg-gray-900 border border-blue-800 rounded-lg text-sm text-blue-300">
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
