import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getPendingHandoffs,
  claimChatHandoff,
  sendHandoffReply,
  resolveHandoff,
  getHandoffHistory,
  createTicketFromChat,
} from '../services/chatService'
import { getSocket } from '../services/socketService'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

const POLL_INTERVAL_MS = 15_000

/**
 * TechChatPanel
 * ──────────────
 * Shown to technicians in their dashboard.
 * Lists pending handoff requests, allows claiming one, then provides a real-time
 * chat interface to reply to the customer.
 * Also exposes "Create Ticket from Chat" when a conversation is active.
 */
export default function TechChatPanel() {
  const [pending, setPending]           = useState([])
  const [activeConv, setActiveConv]     = useState(null)  // { id, messages[], customer, pastTickets[] }
  const [input, setInput]               = useState('')
  const [sending, setSending]           = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketCreated, setTicketCreated]   = useState(null)  // ticket info after creation
  const [minimized, setMinimized]       = useState(false)
  const messagesEndRef = useRef(null)
  const pollRef        = useRef(null)

  // ── Scroll to bottom on new message ─────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeConv?.messages])

  // ── Load pending handoffs ────────────────────────────────────────────────
  const loadPending = useCallback(async () => {
    try {
      const list = await getPendingHandoffs()
      setPending(list || [])
    } catch { /* non-blocking */ }
  }, [])

  useEffect(() => {
    loadPending()
    pollRef.current = setInterval(loadPending, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [loadPending])

  // ── Socket: listen for new customer messages in active conversation ──────
  useEffect(() => {
    const convId = activeConv?.id
    if (!convId) return
    const socket = getSocket()
    if (!socket) return

    const handleTechMsg = (data) => {
      if (data.conversationId !== convId) return
      setActiveConv(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id:        Date.now(),
            sender:    'user',
            message:   data.message,
            created_at: new Date().toISOString(),
          },
        ],
      }))
    }

    socket.on('customer_message', handleTechMsg)
    return () => socket.off('customer_message', handleTechMsg)
  }, [activeConv?.id])

  // ── Claim a handoff ──────────────────────────────────────────────────────
  const handleClaim = async (conversationId) => {
    setLoading(true)
    setError(null)
    try {
      await claimChatHandoff(conversationId)
      const history = await getHandoffHistory(conversationId)
      setActiveConv({
        id:          conversationId,
        messages:    history.messages,
        customer:    {
          name:  `${history.conversation.first_name || ''} ${history.conversation.last_name || ''}`.trim() || history.conversation.email || 'Customer',
          email: history.conversation.email,
          role:  history.conversation.customer_role,
        },
        pastTickets: history.pastTickets || [],
      })
      setTicketCreated(null)
      // Remove from pending list
      setPending(prev => prev.filter(p => p.conversation_id !== conversationId))
    } catch (err) {
      setError(err.message || 'Failed to claim conversation')
    } finally {
      setLoading(false)
    }
  }

  // ── Send a reply ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending || !activeConv) return
    setSending(true)
    setInput('')
    // Optimistic UI
    const tempId = Date.now()
    setActiveConv(prev => ({
      ...prev,
      messages: [...prev.messages, { id: tempId, sender: 'tech', message: trimmed, created_at: new Date().toISOString() }],
    }))
    try {
      await sendHandoffReply(activeConv.id, trimmed)
    } catch (err) {
      setError('Reply failed: ' + (err.message || 'Unknown error'))
      // Remove optimistic message on failure
      setActiveConv(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== tempId),
      }))
      setInput(trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Resolve / close chat ──────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!activeConv) return
    try {
      await resolveHandoff(activeConv.id)
      setActiveConv(null)
      setTicketCreated(null)
      loadPending()
    } catch (err) {
      setError(err.message || 'Failed to resolve conversation')
    }
  }

  // ── Create ticket from this chat ──────────────────────────────────────────
  const handleCreateTicket = async () => {
    if (!activeConv) return
    setCreatingTicket(true)
    try {
      const result = await createTicketFromChat(activeConv.id)
      setTicketCreated(result)
    } catch (err) {
      setError(err.message || 'Failed to create ticket')
    } finally {
      setCreatingTicket(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const senderLabel = (sender) => {
    if (sender === 'user')   return 'Customer'
    if (sender === 'tech')   return 'You'
    if (sender === 'bot')    return 'Bot'
    return sender
  }

  const senderColor = (sender) => {
    if (sender === 'user')  return 'bg-blue-900/40 text-blue-200 self-start'
    if (sender === 'tech')  return 'bg-emerald-900/60 text-emerald-100 self-end'
    return 'bg-gray-700/60 text-gray-300 self-start italic'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl flex flex-col overflow-hidden"
         style={{ minHeight: minimized ? 'auto' : 480, maxHeight: 600 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <h3 className="text-sm font-semibold text-white">
            {activeConv ? `Chat with ${activeConv.customer.name}` : 'Customer Chat Handoffs'}
          </h3>
          {pending.length > 0 && !activeConv && (
            <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">
              {pending.length}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {activeConv && (
            <>
              <button
                onClick={handleCreateTicket}
                disabled={creatingTicket || !!ticketCreated}
                className="text-[10px] px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                title="Create support ticket from this chat"
              >
                {creatingTicket ? 'Creating…' : ticketCreated ? `${ticketCreated.ticketNumber}` : 'Create Ticket'}
              </button>
              <button
                onClick={handleResolve}
                className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white transition-colors"
                title="Close this chat"
              >
                Close Chat
              </button>
            </>
          )}
          {activeConv && (
            <button
              onClick={() => { setActiveConv(null); loadPending() }}
              className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              title="Back to pending list"
            >
              ← Back
            </button>
          )}
          <button
            onClick={() => setMinimized(m => !m)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 transition-colors"
          >
            {minimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {error && (
            <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white ml-2">X</button>
            </div>
          )}

          {/* ── No active conversation: show pending list ── */}
          {!activeConv && (
            <div className="flex-1 overflow-y-auto p-4">
              {loading && (
                <div className="text-center text-gray-500 py-8 text-sm animate-pulse">Loading…</div>
              )}
              {!loading && pending.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                  <p className="text-2xl mb-2"></p>
                  <p className="text-sm">No pending handoff requests.</p>
                  <p className="text-xs text-gray-600 mt-1">Checking every {POLL_INTERVAL_MS / 1000}s</p>
                </div>
              )}
              {pending.map(p => (
                <div key={p.conversation_id}
                     className="flex items-start justify-between bg-gray-800 rounded-lg p-3 mb-2 border border-gray-700 hover:border-blue-700 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.message_count} messages · Requested {new Date(p.handoff_requested_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleClaim(p.conversation_id)}
                    disabled={loading}
                    className="ml-3 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Claim
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Active conversation ── */}
          {activeConv && (
            <>
              {/* Customer context bar */}
              <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center gap-4 text-xs flex-shrink-0 flex-wrap">
                <span className="text-gray-400">{activeConv.customer.email || '—'}</span>
                <span className="text-gray-400 capitalize">{activeConv.customer.role || '—'}</span>
                {activeConv.pastTickets.length > 0 && (
                  <span className="text-gray-400">
                    Past tickets: {activeConv.pastTickets.map(t =>
                      <span key={t.ticket_number} className={`ml-1 px-1 rounded font-mono
                        ${t.status === 'closed' ? 'text-gray-500' : 'text-blue-400'}`}>
                        {t.ticket_number}
                      </span>
                    )}
                  </span>
                )}
                {ticketCreated && (
                  <span className="text-emerald-400 font-medium">
                    Ticket {ticketCreated.ticketNumber} created
                  </span>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {activeConv.messages.map((msg) => {
                  const isAttachment = msg.attachment_url
                  const isImage = msg.attachment_type?.startsWith('image/')
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.sender === 'tech' ? 'ml-auto items-end' : 'items-start'}`}>
                      <span className={`text-[10px] mb-0.5 font-medium
                        ${msg.sender === 'tech' ? 'text-emerald-500' : msg.sender === 'bot' ? 'text-gray-500' : 'text-blue-400'}`}>
                        {senderLabel(msg.sender)}
                      </span>
                      <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${senderColor(msg.sender)}`}>
                        {msg.message}
                        {isAttachment && isImage && (
                          <img
                            src={`${API_BASE}${msg.attachment_url}`}
                            alt={msg.attachment_filename || 'attachment'}
                            className="mt-2 max-h-40 rounded border border-gray-600 cursor-pointer"
                            onClick={() => window.open(`${API_BASE}${msg.attachment_url}`, '_blank')}
                          />
                        )}
                        {isAttachment && !isImage && (
                          <a href={`${API_BASE}${msg.attachment_url}`} target="_blank" rel="noopener noreferrer"
                             className="block mt-1 text-blue-400 underline text-xs">
                            {msg.attachment_filename || 'Attachment'}
                          </a>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-600 mt-0.5">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-700 px-3 py-2 flex gap-2 flex-shrink-0">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to customer…"
                  disabled={sending}
                  rows={1}
                  className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-emerald-900 focus:border-emerald-500 focus:outline-none resize-none placeholder-gray-500 disabled:opacity-50"
                  style={{ maxHeight: '80px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50 disabled:bg-gray-700 transition-colors flex-shrink-0"
                >
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
