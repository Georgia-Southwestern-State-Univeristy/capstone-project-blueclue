import { useState } from 'react'
import TicketForm from '../components/TicketForm'
import Alert from '../components/Alert'
import { createTicket } from '../services/ticketService'

function CustomerPortal() {
  // Alert state
  const [alert, setAlert] = useState(null)

  // Handle form submission
  const handleSubmit = async (formData) => {
    try {
      const response = await createTicket(formData)
      
      // Show success alert with ticket ID
      const ticketId = response.ticket?.ticket_id
      setAlert({
        type: 'success',
        message: ticketId 
          ? `Ticket #${ticketId} created successfully!`
          : 'Ticket submitted successfully!'
      })
    } catch (err) {
      // Log error for debugging
      console.error('Failed to create ticket:', err)
      
      // Show error alert with user-friendly message
      setAlert({
        type: 'error',
        message: err.message || 'Failed to submit ticket. Please try again.'
      })
      
      // Re-throw to let TicketForm know submission failed
      throw err
    }
  }

  // Clear alert
  const handleAlertClose = () => {
    setAlert(null)
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-4">Ticket Submission</h1>
      <p className="text-gray-400 mb-6">
        Submit a new support ticket or check the status of existing tickets.
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
      
      {/* Ticket submission form */}
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
        <h2 className="text-xl font-semibold text-white mb-4">Submit a Ticket</h2>
        <TicketForm onSubmit={handleSubmit} />
      </div>

      {/* Placeholder for ticket list */}
      <div className="mt-6 bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
        <h2 className="text-xl font-semibold text-white mb-4">Your Tickets</h2>
        <p className="text-gray-500 italic">Your submitted tickets will appear here...</p>
      </div>
    </div>
  )
}

export default CustomerPortal
