import LoadingSpinner from './LoadingSpinner'
import { formatDateTime } from '../utils/dateFormatter'

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return formatDateTime(dateString)
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
      <h2 className="text-xl font-semibold text-white mb-1">Your Tickets</h2>
      <p className="text-xs text-gray-400 mb-4">Track the status of all your submitted tickets</p>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-300 text-lg font-medium mb-1">No tickets yet</p>
          <p className="text-gray-500 text-sm mb-5 max-w-xs">
            Create your first support ticket using the form above, and it will appear here so you can track its progress.
          </p>
          <button
            onClick={onSubmitClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Ticket
          </button>
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
