import LoadingSpinner from './LoadingSpinner'

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateString }
}

const formatStatus = (status) => {
  if (!status) return 'Unknown'
  return status.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const getStatusColor = (status) => {
  const s = status?.toLowerCase().replace(/_/g, ' ')
  switch (s) {
    case 'open':               return 'bg-yellow-900 text-yellow-300'
    case 'in progress':        return 'bg-blue-900 text-blue-300'
    case 'waiting on customer': return 'bg-purple-900 text-purple-300'
    case 'resolved':           return 'bg-green-900 text-green-300'
    case 'closed':
    case 'cancelled':          return 'bg-gray-700 text-gray-300'
    default:                   return 'bg-gray-700 text-gray-300'
  }
}

/**
 * ClientTicketListWidget — displays the client's ticket table with submit button.
 */
export default function ClientTicketListWidget({ tickets, isLoading, onTicketClick, onSubmitClick }) {
  return (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm h-full flex flex-col">
      {/* Submit Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onSubmitClick}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Submit Ticket
        </button>
      </div>

      <h2 className="text-xl font-semibold text-white mb-4">Your Tickets</h2>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-lg">No tickets submitted yet</p>
          <p className="text-gray-600 text-sm mt-2">Submit a ticket above to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
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
              {tickets.map(ticket => (
                <tr
                  key={ticket.id}
                  className="border-b border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => onTicketClick(ticket.id)}
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
  )
}
