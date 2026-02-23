import { useState, useEffect, useRef, useCallback } from 'react'
import { getTicketById, getTicketHistory, updateTicketStatus } from '../services/ticketService'
import TicketActivityLog from './TicketActivityLog'

/**
 * TicketDetailView
 * Full-screen modal overlay showing expanded ticket details.
 * Responsive layout: sidebar for metadata, main area for content + activity.
 * Supports close (X / Escape / backdrop), minimize (collapse to bottom bar),
 * and inline status updates.
 */
function TicketDetailView({ ticketId, isOpen, onClose, onTicketUpdated }) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [minimized, setMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusError, setStatusError] = useState(null)
  const [statusSuccess, setStatusSuccess] = useState(null)

  const modalRef = useRef(null)
  const previousOverflow = useRef('')

  // ─── Fetch ticket data ───────────────────────────────────────────
  const fetchTicket = useCallback(async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getTicketById(ticketId)
      setTicket(res.data || res)
    } catch (err) {
      setError(err.message || 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    if (isOpen && ticketId) {
      setMinimized(false)
      setActiveTab('details')
      setStatusError(null)
      setStatusSuccess(null)
      fetchTicket()
    }
  }, [isOpen, ticketId, fetchTicket])

  // ─── Body scroll lock ────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !minimized) {
      previousOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previousOverflow.current || 'unset'
    }
    return () => {
      document.body.style.overflow = previousOverflow.current || 'unset'
    }
  }, [isOpen, minimized])

  // ─── Keyboard: Escape closes ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (minimized) {
          onClose()
        } else {
          setMinimized(true)
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, minimized, onClose])

  // ─── Backdrop click ──────────────────────────────────────────────
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  // ─── Status update ───────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (!ticket || statusUpdating) return
    setStatusUpdating(true)
    setStatusError(null)
    setStatusSuccess(null)
    try {
      await updateTicketStatus(ticket.id, newStatus)
      setTicket((prev) => ({ ...prev, status: newStatus }))
      setStatusSuccess(`Status updated to ${formatStatus(newStatus)}`)
      setTimeout(() => setStatusSuccess(null), 3000)
      if (onTicketUpdated) onTicketUpdated(ticket.id, { status: newStatus })
    } catch (err) {
      setStatusError(err.message || 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }

  // ─── Formatting helpers ──────────────────────────────────────────
  const formatStatus = (status) => {
    if (!status) return 'Unknown'
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return ''
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now - d
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const statusColorMap = {
    open: 'bg-yellow-900/60 text-yellow-300 border-yellow-600',
    in_progress: 'bg-blue-900/60 text-blue-300 border-blue-600',
    waiting_on_customer: 'bg-purple-900/60 text-purple-300 border-purple-600',
    resolved: 'bg-green-900/60 text-green-300 border-green-600',
    closed: 'bg-gray-700/60 text-gray-300 border-gray-600',
  }

  const priorityConfig = {
    critical: { color: 'text-red-400', bg: 'bg-red-900/40', dot: 'bg-red-500', border: 'border-red-700' },
    high: { color: 'text-orange-400', bg: 'bg-orange-900/40', dot: 'bg-orange-500', border: 'border-orange-700' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-900/40', dot: 'bg-yellow-500', border: 'border-yellow-700' },
    low: { color: 'text-blue-400', bg: 'bg-blue-900/40', dot: 'bg-blue-500', border: 'border-blue-700' },
  }

  const validTransitions = {
    open: ['in_progress', 'waiting_on_customer', 'resolved', 'closed'],
    in_progress: ['waiting_on_customer', 'resolved', 'open'],
    waiting_on_customer: ['in_progress', 'resolved', 'open'],
    resolved: ['closed', 'in_progress', 'open'],
    closed: [],
  }

  if (!isOpen) return null

  // ─── Minimized bar ───────────────────────────────────────────────
  if (minimized) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 shadow-2xl px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-3 text-left flex-1 min-w-0"
        >
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {ticket?.ticket_number || `Ticket #${ticketId}`}
              {ticket?.subject && (
                <span className="text-gray-400 ml-2 font-normal">— {ticket.subject}</span>
              )}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <button
            onClick={() => setMinimized(false)}
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors"
            title="Expand"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // ─── Full modal overlay ──────────────────────────────────────────
  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch justify-center overflow-hidden"
    >
      <div className="bg-gray-950 w-full max-w-6xl mx-auto flex flex-col h-full md:my-4 md:mx-4 md:rounded-xl md:border md:border-gray-700 md:h-auto md:max-h-[calc(100vh-2rem)] shadow-2xl">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-900/80 md:rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            {ticket && (
              <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">
                {ticket.ticket_number || `#${ticket.id}`}
              </span>
            )}
            <h2 className="text-white font-semibold text-lg truncate">
              {loading ? 'Loading...' : ticket?.subject || 'Ticket Details'}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-3">
            {/* Minimize */}
            <button
              onClick={() => setMinimized(true)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Minimize"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading ticket details...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-md">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={fetchTicket}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : ticket ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* ── Sidebar (right on desktop, top on mobile) ─────── */}
            <aside className="md:w-80 lg:w-96 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-800 overflow-y-auto bg-gray-900/50">
              <div className="p-4 md:p-5 space-y-5">
                {/* Status */}
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Status</label>
                  <span
                    className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                      statusColorMap[ticket.status] || 'bg-gray-700 text-gray-300 border-gray-600'
                    }`}
                  >
                    {formatStatus(ticket.status)}
                  </span>

                  {/* Quick status actions */}
                  {validTransitions[ticket.status]?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {validTransitions[ticket.status].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          disabled={statusUpdating}
                          className="text-xs px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50"
                        >
                          &rarr; {formatStatus(s)}
                        </button>
                      ))}
                    </div>
                  )}

                  {statusSuccess && (
                    <p className="text-green-400 text-xs mt-2">{statusSuccess}</p>
                  )}
                  {statusError && (
                    <p className="text-red-400 text-xs mt-2">{statusError}</p>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Priority</label>
                  {(() => {
                    const p = priorityConfig[ticket.priority] || priorityConfig.low
                    return (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${p.bg} border ${p.border}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
                        <span className={`text-sm font-semibold capitalize ${p.color}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    )
                  })()}
                  {/* Show AI vs user priority if different */}
                  {(ticket.ai_priority || ticket.user_priority) && (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-500">
                      {ticket.ai_priority && ticket.ai_priority !== ticket.priority && (
                        <span>AI: <span className="text-gray-400 capitalize">{ticket.ai_priority}</span></span>
                      )}
                      {ticket.user_priority && ticket.user_priority !== ticket.priority && (
                        <span>User: <span className="text-gray-400 capitalize">{ticket.user_priority}</span></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Category</label>
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 capitalize">
                    {ticket.category?.replace(/_/g, ' ') || '—'}
                  </span>
                  {ticket.ai_classified && (
                    <span className="ml-2 text-xs text-gray-500">
                      AI classified
                      {ticket.ai_confidence != null && (
                        <span className="text-gray-400"> ({Math.round(ticket.ai_confidence * 100)}%)</span>
                      )}
                    </span>
                  )}
                </div>

                <hr className="border-gray-800" />

                {/* Assignee */}
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Assigned To</label>
                  {ticket.assigned_to_name && ticket.assigned_to_name !== 'null' ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {ticket.assigned_to_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{ticket.assigned_to_name}</p>
                        {ticket.assigned_to_email && (
                          <p className="text-gray-500 text-xs">{ticket.assigned_to_email}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Unassigned</p>
                  )}
                </div>

                {/* Requester */}
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Requester</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-bold flex-shrink-0">
                      {(ticket.customer_name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{ticket.customer_name || '—'}</p>
                      {ticket.customer_email && (
                        <p className="text-gray-500 text-xs">{ticket.customer_email}</p>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-gray-800" />

                {/* Dates */}
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block">Created</label>
                    <p className="text-gray-300 text-sm mt-0.5">
                      {formatDate(ticket.created_at)}
                      <span className="text-gray-600 ml-1 text-xs">({formatTimeAgo(ticket.created_at)})</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block">Last Updated</label>
                    <p className="text-gray-300 text-sm mt-0.5">
                      {formatDate(ticket.updated_at)}
                      <span className="text-gray-600 ml-1 text-xs">({formatTimeAgo(ticket.updated_at)})</span>
                    </p>
                  </div>
                  {ticket.resolved_at && (
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block">Resolved</label>
                      <p className="text-gray-300 text-sm mt-0.5">
                        {formatDate(ticket.resolved_at)}
                        {ticket.resolved_by_name && (
                          <span className="text-gray-500 text-xs ml-1">by {ticket.resolved_by_name}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {ticket.closed_at && (
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block">Closed</label>
                      <p className="text-gray-300 text-sm mt-0.5">{formatDate(ticket.closed_at)}</p>
                    </div>
                  )}
                </div>

                {/* SLA Info */}
                {(ticket.response_due_at || ticket.resolution_due_at) && (
                  <>
                    <hr className="border-gray-800" />
                    <div className="space-y-2">
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block">SLA</label>
                      {ticket.response_due_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Response Due</span>
                          <span className={`${new Date(ticket.response_due_at) < new Date() && !ticket.first_response_at ? 'text-red-400' : 'text-gray-300'}`}>
                            {formatDate(ticket.response_due_at)}
                          </span>
                        </div>
                      )}
                      {ticket.resolution_due_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Resolution Due</span>
                          <span className={`${new Date(ticket.resolution_due_at) < new Date() && !ticket.resolved_at ? 'text-red-400' : 'text-gray-300'}`}>
                            {formatDate(ticket.resolution_due_at)}
                          </span>
                        </div>
                      )}
                      {ticket.first_response_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">First Response</span>
                          <span className="text-green-400">{formatDate(ticket.first_response_at)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Reopen count */}
                {ticket.reopen_count > 0 && (
                  <>
                    <hr className="border-gray-800" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-amber-400 font-medium">Reopened {ticket.reopen_count} time{ticket.reopen_count !== 1 ? 's' : ''}</span>
                      {ticket.last_reopened_at && (
                        <span className="text-gray-600">(last {formatTimeAgo(ticket.last_reopened_at)})</span>
                      )}
                    </div>
                  </>
                )}

                {/* Ticket ID */}
                <div className="pt-2">
                  <p className="text-gray-600 text-xs">
                    ID: {ticket.id} &middot; {ticket.ticket_number}
                  </p>
                </div>
              </div>
            </aside>

            {/* ── Main content area ───────────────────────────────── */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Tab bar */}
              <div className="flex items-center border-b border-gray-800 px-4 md:px-6 flex-shrink-0 bg-gray-900/30">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'activity', label: 'Activity' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-400 border-blue-500'
                        : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {activeTab === 'details' && (
                  <div className="space-y-6 max-w-3xl">
                    {/* Subject */}
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                        {ticket.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>Submitted by <span className="text-gray-400">{ticket.customer_name || '—'}</span></span>
                        <span>&middot;</span>
                        <span>{formatTimeAgo(ticket.created_at)}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Description</label>
                      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {ticket.description || <span className="text-gray-600 italic">No description provided.</span>}
                      </div>
                    </div>

                    {/* Resolution */}
                    {ticket.resolution && (
                      <div>
                        <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Resolution</label>
                        <div className="bg-green-900/20 rounded-lg border border-green-800/50 p-4 text-green-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {ticket.resolution}
                        </div>
                      </div>
                    )}

                    {/* AI Classification Details */}
                    {ticket.ai_classified && (
                      <div>
                        <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">AI Classification</label>
                        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-2">
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Category: </span>
                              <span className="text-gray-200 capitalize">{ticket.category?.replace(/_/g, ' ')}</span>
                            </div>
                            {ticket.ai_confidence != null && (
                              <div>
                                <span className="text-gray-500">Confidence: </span>
                                <span className={`font-medium ${
                                  ticket.ai_confidence >= 0.8 ? 'text-green-400' :
                                  ticket.ai_confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {Math.round(ticket.ai_confidence * 100)}%
                                </span>
                              </div>
                            )}
                            {ticket.ai_fallback_used && (
                              <span className="text-amber-500 text-xs bg-amber-900/30 px-2 py-0.5 rounded">Fallback used</span>
                            )}
                          </div>
                          {ticket.ai_keywords_matched && Object.keys(ticket.ai_keywords_matched).length > 0 && (
                            <div className="mt-2">
                              <span className="text-gray-500 text-xs">Matched keywords: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(Array.isArray(ticket.ai_keywords_matched)
                                  ? ticket.ai_keywords_matched
                                  : Object.values(ticket.ai_keywords_matched).flat()
                                ).map((kw, i) => (
                                  <span key={i} className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="max-w-3xl">
                    <TicketActivityLog ticketId={ticket.id} isOpen={true} />
                  </div>
                )}
              </div>
            </main>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TicketDetailView
