import { useState } from 'react'

/**
 * RequestAssignmentModal
 * Confirmation modal for a technician requesting assignment to an unassigned ticket.
 * Shows ticket details and allows an optional note.
 */
function RequestAssignmentModal({ isOpen, onClose, ticket, onConfirm, isSubmitting }) {
  const [note, setNote] = useState('')

  if (!isOpen || !ticket) return null

  const handleConfirm = () => {
    onConfirm(ticket.id, note)
  }

  const handleClose = () => {
    setNote('')
    onClose()
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-blue-900 text-blue-300',
      medium: 'bg-yellow-900 text-yellow-300',
      high: 'bg-orange-900 text-orange-300',
      critical: 'bg-red-900 text-red-300',
    }
    return colors[priority] || 'bg-gray-700 text-gray-300'
  }

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

  const ageDays = ticket.age_days ? Math.floor(ticket.age_days) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-60"
        onClick={!isSubmitting ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Request Assignment
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Info banner */}
          <div className="p-3 bg-blue-950 border border-blue-800 rounded-lg text-sm text-blue-200">
            <p>You are requesting to be assigned to this ticket. Once confirmed, the ticket will be assigned to you and its status will be updated to <strong>In Progress</strong>.</p>
          </div>

          {/* Ticket details */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Ticket</p>
              <h4 className="text-white font-semibold">{ticket.subject}</h4>
              <p className="text-xs text-gray-400 mt-1">ID: {ticket.id} &bull; Created: {formatDate(ticket.created_at)}</p>
            </div>

            <p className="text-gray-300 text-sm line-clamp-3">{ticket.description}</p>

            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
              </span>
              <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-700 text-gray-300 capitalize">
                {ticket.category?.replace(/_/g, ' ')}
              </span>
              {ageDays > 0 && (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${ageDays > 7 ? 'bg-red-900 text-red-300' : ageDays > 3 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                  {ageDays} day{ageDays !== 1 ? 's' : ''} old
                </span>
              )}
            </div>

            {/* Requester info */}
            {ticket.customer_name && (
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-400">Requested by</p>
                <p className="text-sm text-gray-200">{ticket.customer_name}</p>
                {ticket.customer_email && (
                  <p className="text-xs text-gray-400">{ticket.customer_email}</p>
                )}
              </div>
            )}
          </div>

          {/* Optional note */}
          <div>
            <label htmlFor="assignment-note" className="block text-sm font-medium text-gray-300 mb-1">
              Note <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="assignment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about why you're requesting this ticket..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Requesting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Assignment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RequestAssignmentModal
