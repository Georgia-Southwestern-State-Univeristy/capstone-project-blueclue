import { useState, useEffect } from 'react'
import TicketSubmissionModal from '../components/TicketSubmissionModal'
import TicketDetailView from '../components/TicketDetailView'
import Alert from '../components/Alert'
import LoadingSpinner from '../components/LoadingSpinner'
import TicketTimeline from '../components/TicketTimeline'
import { createTicket, getAllTickets, getAllTicketsForTimeline } from '../services/ticketService'
import { getCurrentUser } from '../services/authService'

function ClientDashboard() {
  // State management
  const [alert, setAlert] = useState(null)
  const [tickets, setTickets] = useState([])
  const [timelineTickets, setTimelineTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTimelineLoading, setIsTimelineLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Fetch tickets on component mount
  useEffect(() => {
    // Get current user info
    const user = getCurrentUser()
    setCurrentUser(user)

    fetchTickets()
    fetchTimelineTickets()
  }, [])

  // Fetch all tickets from API
  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const data = await getAllTickets()
      // Tickets are now filtered by the backend based on user role
      const userTickets = Array.isArray(data) ? data : (data.data || data.tickets || [])
      setTickets(userTickets)
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
      setAlert({
        type: 'error',
        message: 'Failed to load tickets. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch all tickets for timeline (no filtering)
  const fetchTimelineTickets = async () => {
    try {
      setIsTimelineLoading(true)
      const data = await getAllTicketsForTimeline()
      const allTickets = Array.isArray(data) ? data : (data.data || data.tickets || [])
      setTimelineTickets(allTickets)
    } catch (error) {
      console.error('Failed to fetch timeline tickets:', error)
      // Don't show error alert for timeline - just use empty array
      setTimelineTickets([])
    } finally {
      setIsTimelineLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (formData) => {
    try {
      const response = await createTicket(formData)
      // Show success alert
      const ticketId = response.ticket?.id || response.ticket?.ticket_id || response.data?.id || response.data?.ticket_id
      setAlert({
        type: 'success',
        message: ticketId
          ? `Ticket #${ticketId} created successfully!`
          : 'Ticket submitted successfully!'
      })

      // Close modal
      setIsModalOpen(false)

      // Refresh ticket list
      await fetchTickets()
      await fetchTimelineTickets()
    } catch (error) {
      console.error('Failed to create ticket:', error)
      setAlert({
        type: 'error',
        message: error.message || 'Failed to submit ticket. Please try again.'
      })
      throw error
    }
  }

  // Clear alert
  const handleAlertClose = () => {
    setAlert(null)
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Format status text for display
  const formatStatus = (status) => {
    if (!status) return 'Unknown'
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get status badge color
  const getStatusColor = (status) => {
    const normalizedStatus = status?.toLowerCase().replace(/_/g, ' ')
    switch (normalizedStatus) {
      case 'open':
        return 'bg-yellow-900 text-yellow-300'
      case 'in progress':
        return 'bg-blue-900 text-blue-300'
      case 'waiting on customer':
        return 'bg-purple-900 text-purple-300'
      case 'resolved':
        return 'bg-green-900 text-green-300'
      case 'closed':
        return 'bg-gray-700 text-gray-300'
      case 'cancelled':
        return 'bg-gray-700 text-gray-300'
      default:
        return 'bg-gray-700 text-gray-300'
    }
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-2">Client Dashboard</h1>
      <p className="text-gray-400 mb-6">
        Submit support tickets and track their status
      </p>

      {/* Alert display */}
      {alert && (
        <div className="mb-6">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={handleAlertClose}
            autoDismiss={alert.type === 'success' ? 5000 : 0}
          />
        </div>
      )}


      {/* Timeline section */}
      <div className="mb-8">
        <TicketTimeline tickets={timelineTickets} onRefresh={fetchTimelineTickets} isRefreshing={isTimelineLoading} onTicketClick={(id) => { setSelectedTicketId(id); setIsDetailOpen(true) }} />
      </div>

      {/* Ticket Submission Modal */}
      <TicketSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {/* Tickets list section */}
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">

        {/* Submit Ticket Button at top of Your Tickets */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Submit Ticket
          </button>
        </div>
        <h2 className="text-xl font-semibold text-white mb-4">Your Tickets</h2>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : tickets.length === 0 ? (
          /* Empty state */
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">No tickets submitted yet</p>
            <p className="text-gray-600 text-sm mt-2">Submit a ticket above to get started</p>
          </div>
        ) : (
          /* Tickets table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Ticket ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Subject</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => { setSelectedTicketId(ticket.id); setIsDetailOpen(true) }}
                    title="Click to view ticket details"
                  >
                    <td className="py-3 px-4 text-white font-medium">#{ticket.id}</td>
                    <td className="py-3 px-4 text-gray-300">{ticket.subject || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{formatDate(ticket.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Ticket Detail View Modal */}
      <TicketDetailView
        ticketId={selectedTicketId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTicketUpdated={() => { fetchTickets(); fetchTimelineTickets() }}
      />
    </div>
  )
}

export default ClientDashboard
