import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { getAssignmentRequests, approveAssignmentRequest, denyAssignmentRequest } from '../services/ticketService'

/**
 * PendingRequestsWidget
 * Displays pending technician assignment requests with quick approve/deny actions.
 * Designed for the Management Dashboard right sidebar or main area.
 */
const PendingRequestsWidget = forwardRef(({ onAction }, ref) => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(null) // request id being acted on
  const [denyingId, setDenyingId] = useState(null)
  const [denyReason, setDenyReason] = useState('')
  const [successMessage, setSuccessMessage] = useState(null)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getAssignmentRequests({ status: 'pending' })
      setRequests(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load requests')
      console.error('Error fetching assignment requests:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Expose refresh to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchRequests
  }))

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleApprove = async (requestId) => {
    try {
      setActionInProgress(requestId)
      await approveAssignmentRequest(requestId)
      setRequests(prev => prev.filter(r => r.id !== requestId))
      showSuccess('Request approved - ticket assigned!')
      if (onAction) onAction('approved', requestId)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDeny = async (requestId) => {
    try {
      setActionInProgress(requestId)
      await denyAssignmentRequest(requestId, denyReason)
      setRequests(prev => prev.filter(r => r.id !== requestId))
      setDenyingId(null)
      setDenyReason('')
      showSuccess('Request denied.')
      if (onAction) onAction('denied', requestId)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionInProgress(null)
    }
  }

  const formatTimeAgo = (dateStr) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  }

  const priorityColors = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">Assignment Requests</h3>
          {requests.length > 0 && (
            <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {requests.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
          title="Refresh"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="mx-4 mt-3 p-2 bg-green-900 bg-opacity-50 border border-green-700 rounded text-green-300 text-sm text-center">
          {successMessage}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-200">x</button>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
        {loading && requests.length === 0 ? (
          <div className="text-center py-6">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">--</div>
            <p className="text-gray-400 text-sm">No pending assignment requests</p>
            <p className="text-gray-600 text-xs mt-1">Requests from technicians will appear here</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {/* Tech name + time */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {(request.requester_first_name?.[0] || '?').toUpperCase()}
                    {(request.requester_last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {request.requester_first_name} {request.requester_last_name}
                    </p>
                    <p className="text-gray-500 text-xs capitalize">{request.requester_role?.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className="text-gray-500 text-xs">{formatTimeAgo(request.created_at)}</span>
              </div>

              {/* Ticket info */}
              <div className="mb-2 p-2 bg-gray-750 bg-opacity-50 rounded border border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  {request.ticket_priority && (
                    <span className={`w-2 h-2 rounded-full ${priorityColors[request.ticket_priority] || 'bg-gray-500'}`}></span>
                  )}
                  <p className="text-gray-200 text-sm font-medium truncate" title={request.ticket_title}>
                    {request.ticket_title || `Ticket #${request.ticket_id}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {request.ticket_category && <span>{request.ticket_category}</span>}
                  {request.ticket_priority && (
                    <span className="capitalize">{request.ticket_priority}</span>
                  )}
                  {request.ticket_status && (
                    <span className="capitalize">{request.ticket_status}</span>
                  )}
                </div>
              </div>

              {/* Note */}
              {request.note && (
                <div className="mb-3 text-gray-400 text-xs italic border-l-2 border-gray-600 pl-2">
                  &quot;{request.note}&quot;
                </div>
              )}

              {/* Deny reason input */}
              {denyingId === request.id ? (
                <div className="mb-2 space-y-2">
                  <input
                    type="text"
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    placeholder="Reason for denial (optional)"
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDeny(request.id)
                      if (e.key === 'Escape') { setDenyingId(null); setDenyReason('') }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeny(request.id)}
                      disabled={actionInProgress === request.id}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 px-3 rounded transition-colors"
                    >
                      {actionInProgress === request.id ? 'Denying...' : 'Confirm Deny'}
                    </button>
                    <button
                      onClick={() => { setDenyingId(null); setDenyReason('') }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium py-1.5 px-3 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Action buttons */
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={actionInProgress === request.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 px-3 rounded transition-colors flex items-center justify-center gap-1"
                  >
                    {actionInProgress === request.id ? (
                      <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full"></span>
                    ) : (
                      'Approve'
                    )}
                  </button>
                  <button
                    onClick={() => setDenyingId(request.id)}
                    disabled={actionInProgress === request.id}
                    className="flex-1 bg-red-600 bg-opacity-30 hover:bg-opacity-50 border border-red-700 disabled:opacity-50 text-red-300 text-xs font-medium py-1.5 px-3 rounded transition-colors"
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
})

PendingRequestsWidget.displayName = 'PendingRequestsWidget'

export default PendingRequestsWidget
