import { useState, useEffect } from 'react'
import TicketForm from '../components/TicketForm'
import Alert from '../components/Alert'
import LoadingSpinner from '../components/LoadingSpinner'
import { createTicket, getAllTickets } from '../services/ticketService'

function ClientDashboard() {
  // State management
  const [alert, setAlert] = useState(null)
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
  }, [])

  // Fetch all tickets from API
  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const data = await getAllTickets()
      // Filter tickets to show only those from current user
      // TODO: This filtering should be done on the backend once authentication is implemented
      const userTickets = Array.isArray(data) ? data : (data.tickets || [])
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

  // Handle form submission
  const handleSubmit = async (formData) => {
    try {
      const response = await createTicket(formData)
      
      // Show success alert
      const ticketId = response.ticket?.ticket_id
      setAlert({
        type: 'success',
        message: ticketId 
          ? `Ticket #${ticketId} created successfully!`
          : 'Ticket submitted successfully!'
      })

      // Refresh ticket list
      await fetchTickets()
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

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-blue-900 text-blue-100'
      case 'in progress':
        return 'bg-yellow-900 text-yellow-100'
      case 'resolved':
        return 'bg-green-900 text-green-100'
      case 'closed':
        return 'bg-gray-700 text-gray-100'
      default:
        return 'bg-gray-700 text-gray-100'
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

      {/* Ticket submission form section */}
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Submit a New Ticket</h2>
        <TicketForm onSubmit={handleSubmit} />
      </div>

      {/* Tickets list section */}
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
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
                  <tr key={ticket.ticket_id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">#{ticket.ticket_id}</td>
                    <td className="py-3 px-4 text-gray-300">{ticket.subject || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status || 'Unknown'}
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
    </div>
  )
}

export default ClientDashboard
