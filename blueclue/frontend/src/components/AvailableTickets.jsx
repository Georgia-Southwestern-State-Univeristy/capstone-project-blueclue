import { useState, useEffect, useMemo } from 'react'
import LoadingSpinner from './LoadingSpinner'
import Alert from './Alert'
import RequestAssignmentModal from './RequestAssignmentModal'
import RefreshButton from './RefreshButton'
import { getAvailableTickets, requestAssignment } from '../services/ticketService'

/**
 * Priority badge styling
 */
const getPriorityColor = (priority) => {
  const priorityColors = {
    low: 'bg-blue-900 text-blue-300',
    medium: 'bg-yellow-900 text-yellow-300',
    high: 'bg-orange-900 text-orange-300',
    critical: 'bg-red-900 text-red-300',
  }
  return priorityColors[priority] || 'bg-gray-700 text-gray-300'
}

/**
 * Format a date to a readable string
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * AvailableTickets Component
 * Displays unassigned tickets in categories the technician has access to.
 * Allows filtering by priority, category, and age.
 * Provides a "Request Assignment" button for claiming tickets.
 */
function AvailableTickets({ onTicketClick }) {
  // Data state
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterAge, setFilterAge] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch available tickets
  const fetchAvailableTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getAvailableTickets()
      setTickets(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load available tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableTickets()
  }, [])

  // Calculate ticket age in days
  const getAgeDays = (ticket) => {
    if (ticket.age_days != null) return Math.floor(ticket.age_days)
    const created = new Date(ticket.created_at)
    const now = new Date()
    return Math.floor((now - created) / (1000 * 60 * 60 * 24))
  }

  // Get age label
  const getAgeLabel = (days) => {
    if (days === 0) return 'Today'
    if (days === 1) return '1 day'
    return `${days} days`
  }

  // Get age category for filtering
  const getAgeCategory = (days) => {
    if (days <= 1) return 'new'
    if (days <= 3) return '1-3'
    if (days <= 7) return '4-7'
    return '8+'
  }

  // Get unique categories from tickets
  const categories = useMemo(() => {
    const cats = [...new Set(tickets.map(t => t.category).filter(Boolean))]
    return cats.sort()
  }, [tickets])

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const searchable = [
          ticket.id?.toString(),
          ticket.subject,
          ticket.description,
          ticket.customer_name,
          ticket.customer_email,
          ticket.category,
          ticket.priority,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(query)) return false
      }

      // Priority filter
      if (filterPriority !== 'all' && ticket.priority !== filterPriority) return false

      // Category filter
      if (filterCategory !== 'all' && ticket.category !== filterCategory) return false

      // Age filter
      if (filterAge !== 'all') {
        const days = getAgeDays(ticket)
        const ageCategory = getAgeCategory(days)
        if (ageCategory !== filterAge) return false
      }

      return true
    })
  }, [tickets, searchQuery, filterPriority, filterCategory, filterAge])

  // Check if any filters are active
  const hasActiveFilters = searchQuery.trim() !== '' || filterPriority !== 'all' || filterCategory !== 'all' || filterAge !== 'all'

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('')
    setFilterPriority('all')
    setFilterCategory('all')
    setFilterAge('all')
  }

  // Handle request assignment
  const handleRequestClick = (ticket) => {
    setSelectedTicket(ticket)
    setIsModalOpen(true)
  }

  const handleConfirmAssignment = async (ticketId, note) => {
    setIsSubmitting(true)
    try {
      await requestAssignment(ticketId, note)
      // Remove the ticket from the list
      setTickets(prev => prev.filter(t => t.id !== ticketId))
      setIsModalOpen(false)
      setSelectedTicket(null)
      setSuccessMessage('Ticket assigned to you successfully!')
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err.message || 'Failed to request assignment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Available Tickets
            </h2>
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {tickets.length}
            </span>
          </div>

          {/* Search and controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(filterPriority !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0) + (filterAge !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            <RefreshButton onRefresh={fetchAvailableTickets} disabled={loading} />
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Age Filter */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Age</label>
                <select
                  value={filterAge}
                  onChange={(e) => setFilterAge(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Ages</option>
                  <option value="new">New (today)</option>
                  <option value="1-3">1-3 days</option>
                  <option value="4-7">4-7 days</option>
                  <option value="8+">8+ days</option>
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="px-6 pt-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="px-6 pt-4">
          <Alert
            type="error"
            message={error}
            onClose={() => setError(null)}
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner message="Loading available tickets..." />
        </div>
      )}

      {/* Empty State */}
      {!loading && tickets.length === 0 && (
        <div className="p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-gray-400 text-lg">No available tickets</p>
          <p className="text-gray-500 text-sm mt-2">
            All tickets are assigned or there are none in your categories.
          </p>
        </div>
      )}

      {/* No Results for Filters */}
      {!loading && tickets.length > 0 && filteredTickets.length === 0 && (
        <div className="p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
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
            Showing <strong className="text-gray-200">{filteredTickets.length}</strong> of{' '}
            <strong className="text-gray-200">{tickets.length}</strong> available ticket{tickets.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' (filtered)'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map(ticket => {
              const ageDays = getAgeDays(ticket)
              return (
                <div
                  key={ticket.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-blue-500 flex flex-col"
                >
                  {/* Header */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3
                        className={`font-bold text-white text-sm leading-tight flex-1 break-words ${onTicketClick ? 'cursor-pointer hover:text-blue-400 transition-colors' : ''}`}
                        onClick={(e) => {
                          if (onTicketClick) {
                            e.stopPropagation();
                            onTicketClick(ticket.id);
                          }
                        }}
                      >
                        {ticket.subject}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      ID: {ticket.id} &bull; {formatDate(ticket.created_at)}
                    </p>
                  </div>

                  {/* Description Preview */}
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2 break-words flex-grow">
                    {ticket.description}
                  </p>

                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 capitalize">
                      {ticket.category?.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                      {ticket.status?.replace(/_/g, ' ')}
                    </span>
                    {ageDays > 0 && (
                      <span className={`px-2 py-0.5 rounded text-xs ${ageDays > 7 ? 'bg-red-900 text-red-300' : ageDays > 3 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                        {getAgeLabel(ageDays)} old
                      </span>
                    )}
                  </div>

                  {/* AI Classification */}
                  {ticket.ai_classified && (
                    <div className="mb-3 p-2 bg-indigo-950 bg-opacity-60 border border-indigo-800 rounded text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold text-indigo-300">AI Classified</span>
                      </div>
                      {ticket.ai_confidence != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Confidence:</span>
                          <span className={`font-medium ${
                            ticket.ai_confidence >= 0.7 ? 'text-green-400' :
                            ticket.ai_confidence >= 0.4 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {Math.round(ticket.ai_confidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Requester Info */}
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

                  {/* Request Assignment Button */}
                  <button
                    onClick={() => handleRequestClick(ticket)}
                    className="w-full mt-auto px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Request Assignment
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Request Assignment Modal */}
      <RequestAssignmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTicket(null)
        }}
        ticket={selectedTicket}
        onConfirm={handleConfirmAssignment}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

export default AvailableTickets
