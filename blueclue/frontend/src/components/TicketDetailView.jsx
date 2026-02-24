import { useState, useEffect, useRef, useCallback } from 'react'
import { getTicketById, updateTicketStatus, updateTicket, deleteTicket, getTechnicians, assignSingleTicket, reassignTicket, cancelTicket } from '../services/ticketService'
import { getUserRole, getUser } from '../services/authService'
import TicketActivityLog from './TicketActivityLog'
import CancelTicketModal from './CancelTicketModal'

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

  // ─── Quick-action state ──────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editResolution, setEditResolution] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [showAssign, setShowAssign] = useState(false)
  const [technicians, setTechnicians] = useState([])
  const [selectedTechId, setSelectedTechId] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignError, setAssignError] = useState(null)
  const [techSearch, setTechSearch] = useState('')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  // ─── Cancel ticket state (client-facing) ─────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // ─── Delete ticket state (management) ─────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const modalRef = useRef(null)
  const assignRef = useRef(null)
  const statusDropdownRef = useRef(null)
  const previousOverflow = useRef('')
  const ticketCache = useRef(new Map())  // ticketId -> { data, fetchedAt }

  // ─── Role-based visibility ─────────────────────────────────────
  const userRole = getUserRole()
  const currentUser = getUser()
  const currentUserId = currentUser?.id
  const isTech = userRole === 'technician'
  const isManagement = userRole === 'management'
  const canSeeInternals = isTech || isManagement   // priority, SLA, assignee, reopen
  const canSeeAudit = isManagement                 // AI classification, audit logs
  const canChangeStatus = isTech || isManagement   // only staff can change status
  const isClient = !isTech && !isManagement        // client / customer role

  // ─── Role-based edit permissions ──────────────────────────────────
  // Clients: own tickets that are open/waiting_on_customer
  // Techs: tickets assigned to them
  // Management: all tickets
  const canEdit = ticket ? (
    isManagement ||
    (isTech && ticket.assigned_to === currentUserId) ||
    (isClient && ticket.customer_id === currentUserId && ['open', 'waiting_on_customer'].includes(ticket.status))
  ) : false

  // ─── Fetch ticket data (cache-aware) ─────────────────────────────
  const CACHE_TTL = 60_000 // 60 seconds

  const fetchTicket = useCallback(async (forceRefresh = false) => {
    if (!ticketId) return

    // Serve from cache if fresh
    const cached = ticketCache.current.get(ticketId)
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setTicket(cached.data)
      setLoading(false)
      setError(null)
      return
    }

    // Show cached data immediately while refreshing in background
    if (cached) {
      setTicket(cached.data)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const res = await getTicketById(ticketId)
      const data = res.data || res
      ticketCache.current.set(ticketId, { data, fetchedAt: Date.now() })
      setTicket(data)
    } catch (err) {
      if (!cached) setError(err.message || 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  // Helper to update cache after local mutations
  const updateCache = useCallback((id, updates) => {
    const entry = ticketCache.current.get(id)
    if (entry) {
      entry.data = { ...entry.data, ...updates }
      entry.fetchedAt = Date.now()
    }
  }, [])

  useEffect(() => {
    if (isOpen && ticketId) {
      setMinimized(false)
      setActiveTab('details')
      setStatusError(null)
      setStatusSuccess(null)
      setIsEditing(false)
      setShowAssign(false)
      setShowStatusDropdown(false)
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
    setShowStatusDropdown(false)
    try {
      await updateTicketStatus(ticket.id, newStatus)
      setTicket((prev) => ({ ...prev, status: newStatus }))
      updateCache(ticket.id, { status: newStatus })
      setStatusSuccess(`Status updated to ${formatStatus(newStatus)}`)
      setTimeout(() => setStatusSuccess(null), 3000)
      if (onTicketUpdated) onTicketUpdated(ticket.id, { status: newStatus })
    } catch (err) {
      setStatusError(err.message || 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }

  // ─── Edit handlers ───────────────────────────────────────────────
  const startEditing = () => {
    if (!ticket) return
    setEditSubject(ticket.subject || '')
    setEditDescription(ticket.description || '')
    setEditCategory(ticket.category || '')
    setEditPriority(ticket.priority || 'low')
    setEditResolution(ticket.resolution || '')
    setEditError(null)
    setIsEditing(true)
    setActiveTab('details')
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!ticket || editSaving) return
    setEditSaving(true)
    setEditError(null)
    try {
      // Build payload based on role
      const payload = {}
      if (isManagement) {
        // Management can edit all fields
        payload.subject = editSubject
        payload.description = editDescription
        payload.category = editCategory
        payload.priority = editPriority
        if (editResolution !== (ticket.resolution || '')) payload.resolution = editResolution
      } else if (isTech) {
        // Techs: description, priority, resolution (notes)
        payload.description = editDescription
        payload.priority = editPriority
        if (editResolution !== (ticket.resolution || '')) payload.resolution = editResolution
      } else {
        // Clients: description, category
        payload.description = editDescription
        payload.category = editCategory
      }
      await updateTicket(ticket.id, payload)
      setTicket((prev) => ({ ...prev, ...payload }))
      updateCache(ticket.id, payload)
      setIsEditing(false)
      if (onTicketUpdated) onTicketUpdated(ticket.id, payload)
    } catch (err) {
      setEditError(err.message || 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Delete handler (management only) ────────────────────────────
  const handleDeleteTicket = async () => {
    if (!ticket || deleteLoading) return
    setDeleteLoading(true)
    try {
      await deleteTicket(ticket.id)
      setShowDeleteConfirm(false)
      if (onTicketUpdated) onTicketUpdated(ticket.id, { deleted: true })
      onClose()
    } catch (err) {
      setEditError(err.message || 'Failed to delete ticket')
      setShowDeleteConfirm(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ─── Assign/Reassign handlers ────────────────────────────────────
  const openAssign = async () => {
    setShowAssign(true)
    setAssignError(null)
    setAssignNote('')
    setTechSearch('')
    setSelectedTechId(ticket?.assigned_to ? String(ticket.assigned_to) : '')
    try {
      const res = await getTechnicians()
      setTechnicians(Array.isArray(res) ? res : res.data || [])
    } catch {
      setTechnicians([])
    }
  }

  const handleAssign = async () => {
    if (!selectedTechId || assignLoading) return
    setAssignLoading(true)
    setAssignError(null)
    try {
      const techId = Number(selectedTechId)
      if (ticket.assigned_to) {
        await reassignTicket(ticket.id, techId, assignNote)
      } else {
        await assignSingleTicket(ticket.id, techId, assignNote)
      }
      // Re-fetch to get updated assigned_to_name
      const res = await getTicketById(ticket.id)
      const data = res.data || res
      ticketCache.current.set(ticket.id, { data, fetchedAt: Date.now() })
      setTicket(data)
      setShowAssign(false)
      if (onTicketUpdated) onTicketUpdated(ticket.id, { assigned_to: techId })
    } catch (err) {
      setAssignError(err.message || 'Failed to assign ticket')
    } finally {
      setAssignLoading(false)
    }
  }

  // ─── Cancel ticket handler (client-facing) ──────────────────────
  const handleCancelTicket = async (reason, details) => {
    if (!ticket || cancelSubmitting) return
    setCancelSubmitting(true)
    try {
      await cancelTicket(ticket.id, reason, details)
      setTicket((prev) => ({ ...prev, status: 'cancelled' }))
      updateCache(ticket.id, { status: 'cancelled' })
      setShowCancelModal(false)
      setStatusSuccess('Ticket cancelled successfully')
      setTimeout(() => setStatusSuccess(null), 3000)
      if (onTicketUpdated) onTicketUpdated(ticket.id, { status: 'cancelled' })
    } catch (err) {
      setStatusError(err.message || 'Failed to cancel ticket')
      setShowCancelModal(false)
    } finally {
      setCancelSubmitting(false)
    }
  }

  // ─── Close ticket shortcut ───────────────────────────────────────
  const handleCloseTicket = () => {
    if (ticket?.status === 'resolved') {
      handleStatusChange('closed')
    } else if (ticket?.status !== 'closed') {
      handleStatusChange('closed')
    }
  }

  // ─── Print / Export ──────────────────────────────────────────────
  const handlePrint = () => {
    if (!ticket) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const html = `
      <!DOCTYPE html>
      <html><head><title>${ticket.ticket_number} - ${ticket.subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: 0.25rem; } h2 { font-size: 1rem; color: #666; margin-top: 1.5rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta { display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-radius: 8px; }
        .meta-item label { display: block; font-size: 0.7rem; color: #888; text-transform: uppercase; } .meta-item span { font-size: 0.9rem; font-weight: 500; }
        .description { white-space: pre-wrap; line-height: 1.6; padding: 1rem; border: 1px solid #e0e0e0; border-radius: 8px; }
        .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.75rem; color: #999; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>${ticket.ticket_number} — ${ticket.subject}</h1>
      <div class="meta">
        <div class="meta-item"><label>Status</label><span>${formatStatus(ticket.status)}</span></div>
        <div class="meta-item"><label>Priority</label><span style="text-transform:capitalize">${ticket.priority || '—'}</span></div>
        <div class="meta-item"><label>Category</label><span style="text-transform:capitalize">${ticket.category?.replace(/_/g, ' ') || '—'}</span></div>
        <div class="meta-item"><label>Requester</label><span>${ticket.customer_name || '—'}</span></div>
        <div class="meta-item"><label>Assigned To</label><span>${ticket.assigned_to_name || 'Unassigned'}</span></div>
        <div class="meta-item"><label>Created</label><span>${formatDate(ticket.created_at)}</span></div>
      </div>
      <h2>Description</h2>
      <div class="description">${(ticket.description || 'No description').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      ${ticket.resolution ? `<h2>Resolution</h2><div class="description">${ticket.resolution.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
      <div class="footer">Printed on ${new Date().toLocaleString()} &middot; BlueClue Ticketing System</div>
      </body></html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 250)
  }

  // ─── Click-outside to close popovers ─────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (assignRef.current && !assignRef.current.contains(e.target)) {
        setShowAssign(false)
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setShowStatusDropdown(false)
      }
    }
    if (showAssign || showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAssign, showStatusDropdown])

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
    cancelled: 'bg-gray-800/60 text-gray-300 border-gray-600',
  }

  const priorityConfig = {
    critical: { color: 'text-red-400', bg: 'bg-red-900/40', dot: 'bg-red-500', border: 'border-red-700' },
    high: { color: 'text-orange-400', bg: 'bg-orange-900/40', dot: 'bg-orange-500', border: 'border-orange-700' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-900/40', dot: 'bg-yellow-500', border: 'border-yellow-700' },
    low: { color: 'text-blue-400', bg: 'bg-blue-900/40', dot: 'bg-blue-500', border: 'border-blue-700' },
  }

  const validTransitions = {
    open: ['in_progress', 'waiting_on_customer', 'resolved', 'closed', 'cancelled'],
    in_progress: ['waiting_on_customer', 'resolved', 'open', 'cancelled'],
    waiting_on_customer: ['in_progress', 'resolved', 'open', 'cancelled'],
    resolved: ['closed', 'in_progress', 'open'],
    closed: [],
    cancelled: isManagement ? ['open'] : [],  // Only management/admin can reopen
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

        {/* ── Quick Actions Bar ─────────────────────────────────── */}
        {ticket && !loading && !error && (
          <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b border-gray-800 flex-shrink-0 bg-gray-900/40 overflow-x-auto">
            {/* Edit — role-based: clients (own open/pending), techs (assigned), management (all) */}
            {canEdit && (
              isEditing ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={editSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium border border-gray-700 hover:border-gray-500 transition-colors"
                  title="Edit ticket"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )
            )}

            {/* Assign / Reassign — management only */}
            {isManagement && (
              <div className="relative" ref={assignRef}>
                <button
                  onClick={() => showAssign ? setShowAssign(false) : openAssign()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium border border-gray-700 hover:border-gray-500 transition-colors"
                  title={ticket.assigned_to ? 'Reassign ticket' : 'Assign ticket'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {ticket.assigned_to ? 'Reassign' : 'Assign'}
                </button>
              </div>
            )}

            {/* Assign overlay — rendered as a fixed centered modal */}
            {isManagement && showAssign && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setShowAssign(false) }}>
                <div ref={assignRef} className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <p className="text-white text-base font-semibold">
                      {ticket.assigned_to ? 'Reassign Ticket' : 'Assign Ticket'}
                    </p>
                    <button onClick={() => setShowAssign(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Search bar */}
                  <div>
                    <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Technician</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={techSearch}
                        onChange={(e) => setTechSearch(e.target.value)}
                        placeholder="Search technicians..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Technician list */}
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
                    {technicians
                      .filter((t) => {
                        if (!techSearch.trim()) return true
                        const name = (t.full_name || t.name || '').toLowerCase()
                        return name.includes(techSearch.toLowerCase())
                      })
                      .map((t) => {
                        const isSelected = String(t.id) === selectedTechId
                        const count = Number(t.open_ticket_count || 0)
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTechId(String(t.id))}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-900/40 border-l-2 border-l-blue-500'
                                : 'hover:bg-gray-800/60 border-l-2 border-l-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                              }`}>
                                {(t.full_name || t.name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                  {t.full_name || t.name || `Tech #${t.id}`}
                                </p>
                                {t.email && <p className="text-xs text-gray-500 truncate">{t.email}</p>}
                              </div>
                            </div>
                            <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                              count >= 10 ? 'bg-red-900/50 text-red-400' :
                              count >= 5 ? 'bg-yellow-900/50 text-yellow-400' :
                              'bg-gray-800 text-gray-400'
                            }`}>
                              {count} ticket{count !== 1 ? 's' : ''}
                            </span>
                          </button>
                        )
                      })
                    }
                    {technicians.filter((t) => {
                      if (!techSearch.trim()) return true
                      const name = (t.full_name || t.name || '').toLowerCase()
                      return name.includes(techSearch.toLowerCase())
                    }).length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">No technicians found</p>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Note</label>
                    <input
                      type="text"
                      value={assignNote}
                      onChange={(e) => setAssignNote(e.target.value)}
                      placeholder="Optional note..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {assignError && <p className="text-red-400 text-xs">{assignError}</p>}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowAssign(false)}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm border border-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssign}
                      disabled={!selectedTechId || assignLoading}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {assignLoading ? 'Assigning...' : ticket.assigned_to ? 'Reassign' : 'Assign'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Change Status — tech & management */}
            {canChangeStatus && validTransitions[ticket.status]?.length > 0 && (
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={statusUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium border border-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50"
                title="Change status"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Status
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Status overlay — rendered as fixed centered modal */}
            {canChangeStatus && showStatusDropdown && validTransitions[ticket.status]?.length > 0 && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setShowStatusDropdown(false) }}>
                <div ref={statusDropdownRef} className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white text-base font-semibold">Change Status</p>
                    <button onClick={() => setShowStatusDropdown(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1">
                    {validTransitions[ticket.status].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-3"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          s === 'open' ? 'bg-yellow-500' :
                          s === 'in_progress' ? 'bg-blue-500' :
                          s === 'waiting_on_customer' ? 'bg-purple-500' :
                          s === 'resolved' ? 'bg-green-500' :
                          s === 'closed' ? 'bg-gray-500' : 'bg-gray-500'
                        }`} />
                        {formatStatus(s)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-gray-700 mx-0.5" />

            {/* Close Ticket — tech & management, when ticket isn't already closed */}
            {canChangeStatus && ticket.status !== 'closed' && ticket.status !== 'cancelled' && (
              <button
                onClick={handleCloseTicket}
                disabled={statusUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-300 hover:text-red-300 text-xs font-medium border border-gray-700 hover:border-red-700 transition-colors disabled:opacity-50"
                title="Close ticket"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Close
              </button>
            )}

            {/* Cancel Ticket — clients: open/pending only; techs/management: any active ticket */}
            {((
              isClient && ['open', 'waiting_on_customer'].includes(ticket.status)
            ) || (
              (isTech || isManagement) && ticket.status !== 'closed' && ticket.status !== 'cancelled'
            )) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 text-xs font-medium border border-gray-700 hover:border-gray-500 transition-colors"
                title="Cancel ticket"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Cancel Ticket
              </button>
            )}

            {/* Delete Ticket — management only, with confirmation */}
            {isManagement && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-300 hover:text-red-300 text-xs font-medium border border-gray-700 hover:border-red-700 transition-colors"
                title="Delete ticket"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}

            {/* Print / Export — available to all */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium border border-gray-700 hover:border-gray-500 transition-colors ml-auto"
              title="Print / Export"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>

            {/* Status feedback */}
            {statusSuccess && <span className="text-green-400 text-xs ml-2 animate-pulse">{statusSuccess}</span>}
            {statusError && <span className="text-red-400 text-xs ml-2">{statusError}</span>}
            {editError && <span className="text-red-400 text-xs ml-2">{editError}</span>}
          </div>
        )}

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

                  {/* Quick status actions — tech & management only */}
                  {canChangeStatus && validTransitions[ticket.status]?.length > 0 && (
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

                  {/* Cancel Ticket — clients: open/pending only; techs/management: any active ticket */}
                  {((
                    isClient && ['open', 'waiting_on_customer'].includes(ticket.status)
                  ) || (
                    (isTech || isManagement) && ticket.status !== 'closed' && ticket.status !== 'cancelled'
                  )) && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 text-sm font-medium border border-gray-600/50 hover:border-gray-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Cancel Ticket
                      </button>
                    </div>
                  )}

                  {statusSuccess && (
                    <p className="text-green-400 text-xs mt-2">{statusSuccess}</p>
                  )}
                  {statusError && (
                    <p className="text-red-400 text-xs mt-2">{statusError}</p>
                  )}
                </div>

                {/* Priority — hidden from clients */}
                {canSeeInternals && (
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
                  {/* Show AI vs user priority if different — management only */}
                  {canSeeAudit && (ticket.ai_priority || ticket.user_priority) && (
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
                )}

                {/* Category */}
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Category</label>
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 capitalize">
                    {ticket.category?.replace(/_/g, ' ') || '—'}
                  </span>
                  {canSeeAudit && ticket.ai_classified && (
                    <span className="ml-2 text-xs text-gray-500">
                      AI classified
                      {ticket.ai_confidence != null && (
                        <span className="text-gray-400"> ({Math.round(ticket.ai_confidence * 100)}%)</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Assignee — hidden from clients */}
                {canSeeInternals && (
                <>
                <hr className="border-gray-800" />
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
                </>
                )}

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

                {/* SLA Info — hidden from clients */}
                {canSeeInternals && (ticket.response_due_at || ticket.resolution_due_at) && (
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

                {/* Reopen count — hidden from clients */}
                {canSeeInternals && ticket.reopen_count > 0 && (
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
                      {isEditing && isManagement ? (
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="w-full bg-gray-900 border border-blue-500/50 rounded-lg px-4 py-2.5 text-xl font-bold text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                          placeholder="Ticket subject"
                        />
                      ) : (
                        <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                          {ticket.subject}
                        </h3>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>Submitted by <span className="text-gray-400">{ticket.customer_name || '—'}</span></span>
                        <span>&middot;</span>
                        <span>{formatTimeAgo(ticket.created_at)}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Description</label>
                      {isEditing ? (
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={8}
                          className="w-full bg-gray-900 border border-blue-500/50 rounded-lg px-4 py-3 text-gray-300 text-sm leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-y"
                          placeholder="Ticket description"
                        />
                      ) : (
                        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {ticket.description || <span className="text-gray-600 italic">No description provided.</span>}
                        </div>
                      )}
                    </div>

                    {/* Inline edit fields — role-based */}
                    {isEditing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Category — clients & management */}
                        {(isClient || isManagement) && (
                          <div>
                            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Category</label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="w-full bg-gray-900 border border-blue-500/50 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 capitalize"
                            >
                              {['general', 'technical', 'billing', 'account', 'feature_request', 'hardware', 'software', 'network', 'login', 'other'].map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Priority — techs & management */}
                        {(isTech || isManagement) && (
                          <div>
                            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Priority</label>
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value)}
                              className="w-full bg-gray-900 border border-blue-500/50 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 capitalize"
                            >
                              {['low', 'medium', 'high', 'critical'].map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resolution / Notes — editable for techs & management */}
                    {isEditing && (isTech || isManagement) ? (
                      <div>
                        <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Resolution / Notes</label>
                        <textarea
                          value={editResolution}
                          onChange={(e) => setEditResolution(e.target.value)}
                          rows={4}
                          className="w-full bg-gray-900 border border-blue-500/50 rounded-lg px-4 py-3 text-gray-300 text-sm leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-y"
                          placeholder="Add resolution notes..."
                        />
                      </div>
                    ) : ticket.resolution ? (
                      <div>
                        <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">Resolution</label>
                        <div className="bg-green-900/20 rounded-lg border border-green-800/50 p-4 text-green-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {ticket.resolution}
                        </div>
                      </div>
                    ) : null}

                    {/* AI Classification Details — management only */}
                    {canSeeAudit && ticket.ai_classified && (
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

      {/* Cancel Ticket Modal (rendered outside main content for z-index) */}
      <CancelTicketModal
        isOpen={showCancelModal}
        ticketNumber={ticket?.ticket_number}
        onConfirm={handleCancelTicket}
        onClose={() => setShowCancelModal(false)}
        isSubmitting={cancelSubmitting}
      />

      {/* Delete Ticket Confirmation Modal — management only */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-semibold">Delete Ticket</h4>
                <p className="text-gray-400 text-sm">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-5">
              Are you sure you want to delete ticket <span className="text-white font-medium">{ticket?.ticket_number}</span>? This will permanently remove the ticket and all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium border border-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTicket}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TicketDetailView
