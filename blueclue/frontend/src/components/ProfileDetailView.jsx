import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
 * Full-screen modal overlay showing expanded user profile details.
 * Pattern matches TicketDetailView: portal, backdrop blur, Escape to close.
 */
export default function ProfileDetailView({ user, isOpen, onClose }) {
  const modalRef = useRef(null)
  const previousOverflow = useRef('')

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
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

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch md:items-center md:justify-center overflow-hidden md:p-6"
    >
      <div className="bg-gray-950 w-full max-w-3xl flex flex-col h-full md:h-auto md:max-h-full md:rounded-xl md:border md:border-gray-700 shadow-2xl">
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

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Avatar + quick info */}
            <div className="flex flex-col items-center md:items-start gap-4 md:w-56 flex-shrink-0">
              {/* Avatar */}
              <div className={`w-24 h-24 rounded-full ${initialsBg} flex items-center justify-center text-3xl font-bold text-white shadow-lg`}>
                {getInitials(user)}
              </div>

              {/* Role badge */}
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${roleColor}`}>
                {formatRole(user.role)}
              </span>

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                <span className={user.is_active ? 'text-green-400' : 'text-gray-500'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Right: Detail fields */}
            <div className="flex-1 space-y-5">
              {/* Contact Information */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailField icon={emailIcon} label="Email" value={user.email} />
                  <DetailField icon={phoneIcon} label="Phone" value={user.phone || '—'} />
                  <DetailField icon={userIcon} label="Username" value={user.username} />
                  <DetailField icon={buildingIcon} label="Company" value={user.company || '—'} />
                </div>
              </section>

              {/* Account Details */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Account Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailField icon={calendarIcon} label="Created" value={formatDate(user.created_at)} />
                  <DetailField icon={clockIcon} label="Last Login" value={formatDate(user.last_login)} />
                  <DetailField icon={globeIcon} label="Timezone" value={user.timezone || `${Intl.DateTimeFormat().resolvedOptions().timeZone} (Browser Default)`} />
                </div>
              </section>

              {/* Do Not Disturb */}
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

              {/* Quiet Hours */}
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
      </div>
    </div>,
    document.body
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
