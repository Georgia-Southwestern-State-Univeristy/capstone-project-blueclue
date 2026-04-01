import { useState, useEffect, useRef, useCallback } from 'react'
import { getTicketChat, getTicketChatMessages, sendTicketChatMessage, acceptTicketChat, declineTicketChat, closeTicketChat } from '../services/ticketService'
import { getUserId } from '../services/authService'
import { getSocket } from '../services/socketService'
import RelativeTime from './RelativeTime'

export default function TicketChatTab({ ticketId, chat: initialChat, onChatUpdate }) {
  const [chat, setChat] = useState(initialChat)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)
  const currentUserId = getUserId()
  const isClient = chat?.client_id === currentUserId
  const isTech = chat?.tech_id === currentUserId

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = useCallback(async () => {
    if (!chat || chat.status !== 'accepted') return
    try {
      const res = await getTicketChatMessages(ticketId, chat.id)
      setMessages(res.data || [])
    } catch (err) {
      // Silently fail on poll
    }
  }, [ticketId, chat?.id, chat?.status])

  // Fetch messages on mount, then listen via WebSocket (fallback poll every 30s)
  useEffect(() => {
    if (chat?.status !== 'accepted') return
    fetchMessages()

    const socket = getSocket()
    const handleIncoming = (data) => {
      if (data.chatId === chat.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    }

    if (socket) {
      socket.on('ticket_chat_message', handleIncoming)
    }

    // Fallback poll in case socket is disconnected
    pollRef.current = setInterval(() => {
      const s = getSocket()
      if (!s || !s.connected) fetchMessages()
    }, 30000)

    return () => {
      if (socket) socket.off('ticket_chat_message', handleIncoming)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [chat?.status, chat?.id, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => { scrollToBottom() }, [messages])

  // Re-fetch chat status if pending (poll for acceptance)
  useEffect(() => {
    if (!chat || chat.status !== 'pending') return
    const poll = setInterval(async () => {
      try {
        const res = await getTicketChat(ticketId)
        if (res.data && res.data.status !== 'pending') {
          setChat(res.data)
          onChatUpdate?.(res.data)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(poll)
  }, [chat?.status, ticketId, onChatUpdate])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await sendTicketChatMessage(ticketId, chat.id, newMessage.trim())
      setNewMessage('')
      // Append the message from the HTTP response immediately
      if (res.data) {
        setMessages(prev => prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleAccept = async () => {
    setActionLoading(true)
    try {
      const res = await acceptTicketChat(ticketId, chat.id)
      setChat(res.data)
      onChatUpdate?.(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDecline = async () => {
    setActionLoading(true)
    try {
      const res = await declineTicketChat(ticketId, chat.id)
      setChat(res.data)
      onChatUpdate?.(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async () => {
    setActionLoading(true)
    try {
      const res = await closeTicketChat(ticketId, chat.id)
      setChat(res.data)
      onChatUpdate?.(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (!chat) return null

  // ── Pending state (waiting for tech response) ──
  if (chat.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-yellow-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Chat Request Pending</h3>
        <p className="text-gray-400 text-sm mb-4">
          {isClient
            ? 'Waiting for the technician to accept your chat request...'
            : 'A client has requested to chat with you about this ticket.'}
        </p>
        {isTech && (
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {actionLoading ? 'Accepting...' : 'Accept Chat'}
            </button>
            <button
              onClick={handleDecline}
              disabled={actionLoading}
              className="px-5 py-2 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Decline
            </button>
          </div>
        )}
        {isClient && (
          <div className="animate-pulse flex items-center gap-2 text-yellow-400/70 text-xs mt-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400/70 animate-bounce" />
            Checking...
          </div>
        )}
      </div>
    )
  }

  // ── Declined state ──
  if (chat.status === 'declined') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Chat Declined</h3>
        <p className="text-gray-400 text-sm">The technician declined the chat request. You can use the comments section to communicate.</p>
      </div>
    )
  }

  // ── Closed state ──
  if (chat.status === 'closed') {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gray-800/50 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <span className="text-gray-400 text-xs">Chat ended</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} isOwn={msg.sender_id === currentUserId} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    )
  }

  // ── Active chat ──
  return (
    <div className="flex flex-col h-full max-w-3xl">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-300 text-sm font-medium">
            Chat with {isClient ? chat.tech_name : chat.client_name}
          </span>
        </div>
        <button
          onClick={handleClose}
          disabled={actionLoading}
          className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white border border-gray-600 transition-colors"
        >
          End Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} isOwn={msg.sender_id === currentUserId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {error && <p className="text-red-400 text-xs px-4">{error}</p>}
      <form onSubmit={handleSend} className="border-t border-gray-700 p-3 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          maxLength={5000}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ msg, isOwn }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-4 py-2 ${
        isOwn
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-200 border border-gray-700'
      }`}>
        {!isOwn && (
          <p className="text-xs font-medium text-gray-400 mb-0.5">{msg.sender_name}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200/60' : 'text-gray-500'}`}>
          <RelativeTime timestamp={msg.created_at} />
        </p>
      </div>
    </div>
  )
}
