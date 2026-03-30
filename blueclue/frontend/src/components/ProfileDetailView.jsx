import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getUser } from '../services/authService'
import { getMessages, sendMessage, uploadDMImage } from '../services/messageService'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  management: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  senior_technician: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  technician: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  customer: 'bg-green-500/20 text-green-400 border-green-500/30',
  guest: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const formatRole = (role) =>
  role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown'

const formatTime12h = (timeStr) => {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m.padStart(2, '0')} ${ampm}`
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const getInitials = (user) => {
  const f = user.first_name?.[0] || ''
  const l = user.last_name?.[0] || ''
  return (f + l).toUpperCase() || '?'
}

const INITIALS_BG = {
  admin: 'bg-red-600',
  management: 'bg-purple-600',
  senior_technician: 'bg-blue-600',
  technician: 'bg-cyan-600',
  customer: 'bg-green-600',
  guest: 'bg-gray-600',
}

/**
 * ProfileDetailView
 * Full-screen modal overlay showing expanded user profile details + messaging.
 * Pattern matches TicketDetailView: portal, backdrop blur, Escape to close.
 */
export default function ProfileDetailView({ user, isOpen, onClose }) {
  const modalRef = useRef(null)
  const previousOverflow = useRef('')
  const [activeTab, setActiveTab] = useState('profile')

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      setActiveTab('profile')
    } else {
      document.body.style.overflow = previousOverflow.current || 'unset'
    }
    return () => {
      document.body.style.overflow = previousOverflow.current || 'unset'
    }
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) onClose()
  }

  if (!isOpen || !user) return null

  const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.guest
  const initialsBg = INITIALS_BG[user.role] || INITIALS_BG.guest
  const currentUser = getUser()
  const isSelf = currentUser?.id === user.id

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch md:items-center md:justify-center overflow-hidden md:p-6"
    >
      <div className="bg-gray-950 w-full max-w-4xl flex flex-col h-full md:h-[80vh] md:rounded-xl md:border md:border-gray-700 shadow-2xl">
        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-900/80 md:rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">
              ID #{user.id}
            </span>
            <h2 className="text-white font-semibold text-lg truncate">
              {user.first_name} {user.last_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0 ml-3"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-900/40">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Profile
          </button>
          {!isSelf && (
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'messages'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Messages
            </button>
          )}
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        {activeTab === 'profile' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left: Avatar + quick info */}
              <div className="flex flex-col items-center md:items-start gap-4 md:w-56 flex-shrink-0">
                <div className={`w-24 h-24 rounded-full ${initialsBg} flex items-center justify-center text-3xl font-bold text-white shadow-lg`}>
                  {getInitials(user)}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${roleColor}`}>
                  {formatRole(user.role)}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                  <span className={user.is_active ? 'text-green-400' : 'text-gray-500'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Right: Detail fields */}
              <div className="flex-1 space-y-5">
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailField icon={emailIcon} label="Email" value={user.email} />
                    <DetailField icon={phoneIcon} label="Phone" value={user.phone || '—'} />
                    <DetailField icon={userIcon} label="Username" value={user.username} />
                    <DetailField icon={buildingIcon} label="Company" value={user.company || '—'} />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Account Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailField icon={calendarIcon} label="Created" value={formatDate(user.created_at)} />
                    <DetailField icon={clockIcon} label="Last Login" value={formatDate(user.last_login)} />
                    <DetailField icon={globeIcon} label="Timezone" value={user.timezone || `${Intl.DateTimeFormat().resolvedOptions().timeZone} (Browser Default)`} />
                  </div>
                </section>

                {user.dnd_enabled && user.dnd_until && new Date(user.dnd_until) > new Date() && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Do Not Disturb</h3>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
                      <span className="text-yellow-400">{moonIcon}</span>
                      <div>
                        <div className="text-yellow-300 text-sm font-medium">Do Not Disturb is active</div>
                        <div className="text-yellow-400/70 text-xs">Until {formatDate(user.dnd_until)}</div>
                      </div>
                    </div>
                  </section>
                )}

                {user.quiet_hours_enabled && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quiet Hours</h3>
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
                      <span className="text-indigo-400">{moonIcon}</span>
                      <div>
                        <div className="text-indigo-300 text-sm font-medium">Quiet Hours enabled</div>
                        <div className="text-indigo-400/70 text-xs">{formatTime12h(user.quiet_hours_start)} &mdash; {formatTime12h(user.quiet_hours_end)}</div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        ) : (
          <MessagesTab userId={user.id} userName={`${user.first_name} ${user.last_name}`} />
        )}
      </div>
    </div>,
    document.body
  )
}

/* ── Messages Tab ──────────────────────────────────────────────── */
function MessagesTab({ userId, userName }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [pendingImageUrl, setPendingImageUrl] = useState(null)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const currentUser = getUser()

  const loadMessages = useCallback(async () => {
    try {
      setError(null)
      const data = await getMessages(userId)
      // API returns newest first, reverse to show oldest at top
      setMessages(data.reverse())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadMessages()
    // Poll every 5 seconds for new messages
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [loadMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB')
      return
    }
    setUploading(true)
    setError(null)
    // Show local preview
    setImagePreview(URL.createObjectURL(file))
    try {
      const result = await uploadDMImage(file)
      setPendingImageUrl(result.url)
    } catch (err) {
      setError(err.message)
      setImagePreview(null)
      setPendingImageUrl(null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const cancelImage = () => {
    setImagePreview(null)
    setPendingImageUrl(null)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!draft.trim() && !pendingImageUrl) || sending) return
    setSending(true)
    try {
      const sent = await sendMessage(userId, draft.trim() || '', pendingImageUrl)
      setMessages((prev) => [...prev, sent])
      setDraft('')
      setImagePreview(null)
      setPendingImageUrl(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const formatMsgTime = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">Loading messages…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
            <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>No messages yet with {userName}</span>
            <span className="text-gray-600 text-xs">Send a message to start a conversation</span>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUser?.id
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                isMine
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}>
                {msg.image_url && (
                  <img
                    src={`${API_BASE}${msg.image_url}`}
                    alt="Shared image"
                    className="max-h-48 rounded-lg mb-1 cursor-pointer"
                    onClick={() => window.open(`${API_BASE}${msg.image_url}`, '_blank')}
                  />
                )}
                {msg.message && <div className="text-sm whitespace-pre-wrap break-words">{msg.message}</div>}
                <div className={`text-[10px] mt-1 ${isMine ? 'text-blue-200/60' : 'text-gray-500'}`}>
                  {formatMsgTime(msg.created_at)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="flex-shrink-0 border-t border-gray-800 px-3 pt-3 bg-gray-900/60">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="max-h-28 rounded-lg border border-gray-700" />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={cancelImage}
              className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >&times;</button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSend} className="flex-shrink-0 border-t border-gray-800 p-3 md:p-4 flex gap-2 bg-gray-900/60">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-2.5 rounded-lg text-sm transition-colors flex-shrink-0"
          title="Send image"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${userName}…`}
          maxLength={2000}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={(!draft.trim() && !pendingImageUrl) || sending}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          {sending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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

/* ── Reusable field row ────────────────────────────────────────── */
function DetailField({ icon, label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-500">{icon}</span>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-white text-sm break-all">{value}</div>
    </div>
  )
}

/* ── Inline SVG icons ──────────────────────────────────────────── */
const emailIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const phoneIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)

const userIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const buildingIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const calendarIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const clockIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const moonIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
)

const globeIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
