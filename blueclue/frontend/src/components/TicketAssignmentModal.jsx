import { useState, useEffect, useMemo } from 'react'

/**
 * TicketAssignmentModal
 * Modal for bulk ticket assignment with filters, search, and multi-select
 */
function TicketAssignmentModal({ isOpen, onClose, tickets = [], onAssign }) {
  // State
  const [selectedTickets, setSelectedTickets] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterAge, setFilterAge] = useState('all')

  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setSelectedTickets([])
        setSearchQuery('')
        setFilterPriority('all')
        setFilterCategory('all')
        setFilterAge('all')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Calculate ticket age in days
  const calculateAge = (createdAt) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now - created)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Get age category
  const getAgeCategory = (days) => {
    if (days === 0) return 'new'
    if (days <= 3) return '1-3'
    if (days <= 7) return '4-7'
    return '8+'
  }

  // Filter and search tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Only show unassigned tickets
      if (ticket.assigned_to_name && ticket.assigned_to_name !== 'null') return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          ticket.ticket_id?.toString().includes(query) ||
          ticket.ticket_number?.toLowerCase().includes(query) ||
          ticket.subject?.toLowerCase().includes(query) ||
          ticket.description?.toLowerCase().includes(query) ||
          ticket.requester_name?.toLowerCase().includes(query) ||
          ticket.customer_name?.toLowerCase().includes(query) ||
          ticket.category?.toLowerCase().includes(query)
        
        if (!matchesSearch) return false
      }

      // Priority filter
      if (filterPriority !== 'all' && ticket.priority !== filterPriority) {
        return false
      }

      // Category filter
      if (filterCategory !== 'all' && ticket.category !== filterCategory) {
        return false
      }

      // Age filter
      if (filterAge !== 'all') {
        const age = calculateAge(ticket.created_at)
        const ageCategory = getAgeCategory(age)
        if (ageCategory !== filterAge) return false
      }

      return true
    })
  }, [tickets, searchQuery, filterPriority, filterCategory, filterAge])

  // Get unique categories from tickets
  const categories = useMemo(() => {
    const cats = new Set(tickets.map(t => t.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [tickets])

  // Toggle individual ticket
  const handleSelectTicket = (ticketId) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    )
  }

  // Handle assignment
  const handleAssign = () => {
    if (selectedTickets.length > 0 && onAssign) {
      onAssign(selectedTickets)
    }
  }

  // Priority badge colors
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'bg-green-600 text-white'
      case 'medium': return 'bg-yellow-600 text-white'
      case 'high': return 'bg-orange-600 text-white'
      case 'critical': return 'bg-red-600 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Assign Tickets</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-gray-700 space-y-4">
          {/* Search Bar */}
          <div>
            <input
              type="text"
              placeholder="Search tickets by ID, title, requester, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Age Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Age (days)</label>
              <select
                value={filterAge}
                onChange={(e) => setFilterAge(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Ages</option>
                <option value="new">New (today)</option>
                <option value="1-3">1-3 days</option>
                <option value="4-7">4-7 days</option>
                <option value="8+">8+ days</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-400">
            Showing {filteredTickets.length} unassigned ticket{filteredTickets.length !== 1 ? 's' : ''}
            {selectedTickets.length > 0 && (
              <span className="ml-2 text-blue-400">
                ({selectedTickets.length} selected)
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 px-6">
            No unassigned tickets found
          </div>
        ) : (
          <>
            {/* Table Header - fixed above the scrollable area */}
            <div className="px-6 border-b border-gray-700">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[25%]" />
                </colgroup>
                <thead>
                  <tr className="text-left text-sm font-medium text-gray-400">
                    <th className="pb-3"></th>
                    <th className="pb-3">Ticket ID</th>
                    <th className="pb-3">Priority</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Age</th>
                    <th className="pb-3">Requester</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Table Body */}
            <div className="flex-1 overflow-auto px-6 py-2">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[25%]" />
                </colgroup>
                <tbody className="divide-y divide-gray-800">
                  {filteredTickets.map(ticket => {
                    const age = calculateAge(ticket.created_at)
                    const isSelected = selectedTickets.includes(ticket.ticket_id)
                  
                  return (
                    <tr
                      key={ticket.ticket_id}
                      className={`hover:bg-gray-800 transition-colors ${isSelected ? 'bg-gray-800/50' : ''}`}
                    >
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectTicket(ticket.ticket_id)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-white font-medium">
                          {ticket.ticket_number || `#${ticket.ticket_id}`}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">
                        {ticket.category || 'N/A'}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">
                        {age === 0 ? 'Today' : age === 1 ? '1 day' : `${age} days`}
                      </td>
                      <td className="py-3 text-gray-300">
                        {ticket.customer_name || ticket.requester_name || 'Unknown'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={selectedTickets.length === 0}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              selectedTickets.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            Assign {selectedTickets.length > 0 ? `(${selectedTickets.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TicketAssignmentModal
