import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getTicketById, updateTicketStatus, updateTicket, deleteTicket, getTechnicians, assignSingleTicket, reassignTicket, cancelTicket, reopenTicket } from '../services/ticketService'
import { getUserRole, getUser, getUserId } from '../services/authService'
import TicketActivityLog from './TicketActivityLog'
import CancelTicketModal from './CancelTicketModal'
import TicketComments from './TicketComments'
import AddCollaboratorModal from './AddCollaboratorModal'
import RingForHelpModal from './RingForHelpModal'
import RequestUpdateModal from './RequestUpdateModal'
import { getCollaborators, addCollaborator, removeCollaborator } from '../services/collaboratorService'
import { getUpdateRequests, handleExtensionRequest } from '../services/updateRequestService'
import { formatDateTime as _fmtDateTime, formatTimeAgo as _fmtTimeAgo } from '../utils/dateFormatter'

/**
 * TicketDetailView
 * Full-screen modal overlay showing expanded ticket details.
 * Responsive layout: sidebar for metadata, main area for content + activity.
 * Supports close (X / Escape / backdrop), minimize (collapse to bottom bar),
 * and inline status updates.
 */
function TicketDetailView({ ticketId, isOpen, onClose, onTicketUpdated, onMinimize }) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
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
  const [editPriorityReason, setEditPriorityReason] = useState('')
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
  // ─── Reopen state ────────────────────────────────────────────
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenLoading, setReopenLoading] = useState(false)
  const [reopenError, setReopenError] = useState(null)

  // ─── Collaboration state ─────────────────────────────────────
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [collaborators, setCollaborators] = useState([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false)

  // ─── Ring for Help state ─────────────────────────────────────
  const [showRingModal, setShowRingModal] = useState(false)

  // ─── Request Update state ────────────────────────────────────
  const [showRequestUpdateModal, setShowRequestUpdateModal] = useState(false)
  const [updateRequests, setUpdateRequests] = useState([])
  const [updateRequestsLoading, setUpdateRequestsLoading] = useState(false)

  // ─── Image Lightbox state ────────────────────────────────────
  const [lightboxImage, setLightboxImage] = useState(null)

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
  // Techs: tickets assigned to them (not closed/cancelled)
  // Management: all tickets
  const canEdit = ticket ? (
    isManagement ||
    (isTech && ticket.assigned_to === currentUserId && !['closed', 'cancelled'].includes(ticket.status)) ||
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
      setActiveTab('details')
      setStatusError(null)
      setStatusSuccess(null)
      setIsEditing(false)
      setShowAssign(false)
      setShowStatusDropdown(false)
      fetchTicket()
      if (canSeeInternals) {
        fetchCollaborators()
      }
      if (isManagement) {
        fetchUpdateRequests()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ticketId])

  // ─── Body scroll lock ────────────────────────────────────────────
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

  // ─── Keyboard: Escape closes ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

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
    setEditPriorityReason('')
    setEditError(null)
    setIsEditing(true)
    setActiveTab('details')
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditError(null)
  }

  // Helper: check if a field changed from its original value
  const isFieldModified = (field) => {
    if (!ticket) return false
    switch (field) {
      case 'subject': return editSubject !== (ticket.subject || '')
      case 'description': return editDescription !== (ticket.description || '')
      case 'category': return editCategory !== (ticket.category || '')
      case 'priority': return editPriority !== (ticket.priority || 'low')
      case 'resolution': return editResolution !== (ticket.resolution || '')
      default: return false
    }
  }

  const saveEdit = async () => {
    if (!ticket || editSaving) return

    // Build payload based on role — only send changed fields
    const payload = {}
    if (isManagement) {
      if (editSubject !== (ticket.subject || '')) payload.subject = editSubject
      if (editDescription !== (ticket.description || '')) payload.description = editDescription
      if (editCategory !== (ticket.category || '')) payload.category = editCategory
      if (editPriority !== (ticket.priority || 'low')) payload.priority = editPriority
      if (editResolution !== (ticket.resolution || '')) payload.resolution = editResolution
    } else if (isTech) {
      if (editDescription !== (ticket.description || '')) payload.description = editDescription
      if (editPriority !== (ticket.priority || 'low')) payload.priority = editPriority
      if (editResolution !== (ticket.resolution || '')) payload.resolution = editResolution
    } else {
      if (editDescription !== (ticket.description || '')) payload.description = editDescription
      if (editCategory !== (ticket.category || '')) payload.category = editCategory
    }

    // Nothing changed
    if (Object.keys(payload).length === 0) {
      setIsEditing(false)
      return
    }

    // Require reason for priority changes
    if (payload.priority && !editPriorityReason.trim()) {
      setEditError('Please provide a reason for the priority change.')
      return
    }

    // Confirmation for major changes (priority, category, subject)
    const majorChanges = ['priority', 'category', 'subject'].filter(f => payload[f])
    if (majorChanges.length > 0) {
      const confirmed = window.confirm(
        `You are changing: ${majorChanges.join(', ')}. Save these changes?`
      )
      if (!confirmed) return
    }

    // Include priority change reason if applicable
    if (payload.priority && editPriorityReason.trim()) {
      payload.priority_change_reason = editPriorityReason.trim()
    }

    setEditSaving(true)
    setEditError(null)

    // Optimistic update — apply immediately, rollback on failure
    const previousTicket = { ...ticket }
    const displayPayload = { ...payload }
    delete displayPayload.priority_change_reason
    setTicket((prev) => ({ ...prev, ...displayPayload }))
    updateCache(ticket.id, displayPayload)

    try {
      await updateTicket(ticket.id, payload)
      setIsEditing(false)
      if (onTicketUpdated) onTicketUpdated(ticket.id, displayPayload)
    } catch (err) {
      // Rollback on failure
      setTicket(previousTicket)
      updateCache(ticket.id, previousTicket)
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

  // ─── Reopen ticket logic ─────────────────────────────────────────
  const canReopenTicket = () => {
    if (!ticket) return false
    
    // Check if ticket is closed or cancelled
    if (!['closed', 'cancelled'].includes(ticket.status)) return false
    
    // Check if user is requester or management
    const userId = getUserId()
    const isRequester = userId && ticket.customer_id === parseInt(userId)
    if (!isRequester && !isManagement) return false
    
    // Check 30-day window
    if (ticket.closed_at) {
      const daysSinceClosure = (Date.now() - new Date(ticket.closed_at).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceClosure > 30) return false
    }
    
    return true
  }

  const handleReopenTicket = async () => {
    if (!reopenReason.trim()) {
      setReopenError('Please provide a reason for reopening')
      return
    }

    setReopenLoading(true)
    setReopenError(null)

    try {
      await reopenTicket(ticketId, reopenReason.trim())
      
      // Close modal
      setShowReopenModal(false)
      setReopenReason('')
      
      // Refresh ticket data
      await fetchTicket(true)
      
      // Notify parent component
      if (onTicketUpdated) {
        onTicketUpdated()
      }
      
      // Show success message
      setStatusSuccess('Ticket reopened successfully')
      setTimeout(() => setStatusSuccess(null), 3000)
      
    } catch (err) {
      setReopenError(err.message || 'Failed to reopen ticket')
    } finally {
      setReopenLoading(false)
    }
  }

  // ─── Fetch collaborators ─────────────────────────────────────────
  const fetchCollaborators = useCallback(async () => {
    if (!ticketId || !canSeeInternals) return
    
    try {
      setCollaboratorsLoading(true)
      const response = await getCollaborators(ticketId)
      setCollaborators(response.data?.collaborators || [])
    } catch (err) {
      console.error('Failed to fetch collaborators:', err)
    } finally {
      setCollaboratorsLoading(false)
    }
  }, [ticketId, canSeeInternals])

  // ─── Fetch update requests ───────────────────────────────────────
  const fetchUpdateRequests = useCallback(async () => {
    if (!ticketId || !isManagement) return
    
    try {
      setUpdateRequestsLoading(true)
      const response = await getUpdateRequests({ role: 'all' })
      // Filter requests for this specific ticket
      const allRequests = response.data?.requests || []
      const ticketRequests = allRequests.filter(req => req.ticket_id === parseInt(ticketId))
      console.log('Fetched update requests for ticket', ticketId, ':', ticketRequests)
      console.log('Extension requests pending:', ticketRequests.filter(req => req.extension_requested && req.extension_approved === null))
      setUpdateRequests(ticketRequests)
    } catch (err) {
      console.error('Failed to fetch update requests:', err)
    } finally {
      setUpdateRequestsLoading(false)
    }
  }, [ticketId, isManagement])

  // ─── Handle extension approval/denial ─────────────────────────────
  const handleExtensionDecision = async (requestId, approved) => {
    try {
      await handleExtensionRequest(requestId, approved)
      await fetchUpdateRequests() // Refresh the list
      await fetchTicket(true) // Refresh ticket data
      setStatusSuccess(`Extension ${approved ? 'approved' : 'denied'} successfully`)
      setTimeout(() => setStatusSuccess(null), 3000)
    } catch (err) {
      setStatusError(err.message || 'Failed to process extension request')
      setTimeout(() => setStatusError(null), 3000)
    }
  }

  // ─── Handle add collaborator ─────────────────────────────────────
  const handleAddCollaborator = async (userId, role, note) => {
    try {
      await addCollaborator(ticketId, userId, role, note)
      await fetchCollaborators()
      await fetchTicket(true) // Refresh ticket data
      setStatusSuccess('Collaborator added successfully')
      setTimeout(() => setStatusSuccess(null), 3000)
    } catch (err) {
      throw err // Let modal handle the error
    }
  }

  // ─── Handle remove collaborator ──────────────────────────────────
  const handleRemoveCollaborator = async (userId, techName) => {
    if (!window.confirm(`Remove ${techName} from this ticket?`)) return
    
    try {
      await removeCollaborator(ticketId, userId)
      await fetchCollaborators()
      await fetchTicket(true)
      setStatusSuccess('Collaborator removed')
      setTimeout(() => setStatusSuccess(null), 3000)
    } catch (err) {
      setStatusError(err.message || 'Failed to remove collaborator')
      setTimeout(() => setStatusError(null), 3000)
    }
  }

  // ─── Check if user can add collaborators ─────────────────────────
  const canAddCollaborators = () => {
    if (!canSeeInternals || !ticket) return false
    const currentUserId = getUserId()
    const isPrimaryTech = ticket.assigned_to === parseInt(currentUserId)
    return isManagement || isPrimaryTech
  }

  // ─── Check if user is working on this ticket (can send ring requests) ─
  const isWorkingOnTicket = () => {
    if (!canSeeInternals || !ticket) return false
    const currentUserId = parseInt(getUserId())
    
    // Check if assigned
    if (ticket.assigned_to === currentUserId) return true
    
    // Check if collaborator
    return collaborators.some(c => c.user_id === currentUserId)
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
      <div class="footer">Printed on ${_fmtDateTime(new Date())} &middot; BlueClue Ticketing System</div>
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
    return _fmtDateTime(dateStr, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return ''
    return _fmtTimeAgo(dateStr)
  }

  const statusColorMap = {
    open: 'bg-yellow-900/60 text-yellow-300 border-yellow-600',
    in_progress: 'bg-blue-900/60 text-blue-300 border-blue-600',
    waiting_on_customer: 'bg-purple-900/60 text-purple-300 border-purple-600',
    resolved: 'bg-green-900/60 text-green-300 border-green-600',
    closed: 'bg-gray-700/60 text-gray-300 border-gray-600',
    cancelled: 'bg-gray-700/60 text-gray-400 border-gray-600',
    reopened: 'bg-orange-900/60 text-orange-300 border-orange-600',
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
    reopened: ['in_progress', 'waiting_on_customer', 'resolved', 'closed'],
  }

  if (!isOpen) return null

  // ─── Full modal overlay ──────────────────────────────────────────
  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch md:items-center md:justify-center overflow-hidden md:p-6"
    >
      <div className="bg-gray-950 w-full max-w-6xl flex flex-col h-full md:h-auto md:max-h-full md:rounded-xl md:border md:border-gray-700 shadow-2xl">
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
              onClick={() => onMinimize?.({ ticketId, ticketNumber: ticket?.ticket_number, subject: ticket?.subject })}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Minimize"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
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

            {/* Reopen Ticket Modal */}
            {showReopenModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setShowReopenModal(false) }}>
                <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <p className="text-white text-base font-semibold">Reopen Ticket</p>
                    <button 
                      onClick={() => {
                        setShowReopenModal(false)
                        setReopenReason('')
                        setReopenError(null)
                      }} 
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                    <div className="flex gap-2">
                      <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-yellow-300 text-sm font-medium">Reopening this ticket</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {ticket.previous_assigned_tech || ticket.assigned_to 
                            ? 'This ticket will be reassigned to the previous technician if available.'
                            : 'This ticket will return to the unassigned queue.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                      Reason for Reopening <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={reopenReason}
                      onChange={(e) => {
                        setReopenReason(e.target.value)
                        setReopenError(null)
                      }}
                      placeholder="Please explain why this ticket needs to be reopened..."
                      rows={4}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                      autoFocus
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      {reopenReason.length}/500 characters
                    </p>
                  </div>

                  {reopenError && (
                    <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-2">
                      <p className="text-red-400 text-xs">{reopenError}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setShowReopenModal(false)
                        setReopenReason('')
                        setReopenError(null)
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm border border-gray-700 transition-colors"
                      disabled={reopenLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReopenTicket}
                      disabled={!reopenReason.trim() || reopenLoading || reopenReason.length > 500}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {reopenLoading && (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      {reopenLoading ? 'Reopening...' : 'Reopen Ticket'}
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

            {/* Reopen Ticket — requester or management, for closed/cancelled tickets < 30 days */}
            {canReopenTicket() && (
              <button
                onClick={() => setShowReopenModal(true)}
                disabled={statusUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-green-900/60 text-gray-300 hover:text-green-300 text-xs font-medium border border-gray-700 hover:border-green-700 transition-colors disabled:opacity-50"
                title="Reopen ticket"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reopen
              </button>
            )}

            {/* Add Technician — primary tech or management */}
            {canSeeInternals && canAddCollaborators() && (
              <button
                onClick={() => setShowCollaboratorModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-purple-900/60 text-gray-300 hover:text-purple-300 text-xs font-medium border border-gray-700 hover:border-purple-700 transition-colors"
                title="Add collaborating technician"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Technician
              </button>
            )}

            {/* Ring for Help — assigned tech or collaborators */}
            {canSeeInternals && isWorkingOnTicket() && (
              <button
                onClick={() => setShowRingModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-900/60 to-red-900/60 hover:from-orange-800/70 hover:to-red-800/70 text-orange-200 hover:text-orange-100 text-xs font-medium border border-orange-700/50 hover:border-orange-600 transition-colors"
                title="Request urgent help from another technician"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Ring for Help
              </button>
            )}

            {/* Request Update — management only */}
            {isManagement && (ticket.assigned_to || collaborators.length > 0) && (
              <button
                onClick={() => setShowRequestUpdateModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/70 text-indigo-200 hover:text-indigo-100 text-xs font-medium border border-indigo-700/50 hover:border-indigo-600 transition-colors"
                title="Request status update from technician"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Request Update
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                        statusColorMap[ticket.status] || 'bg-gray-700 text-gray-300 border-gray-600'
                      }`}
                    >
                      {formatStatus(ticket.status)}
                    </span>

                    {/* Reopen indicator */}
                    {ticket.reopen_count > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-900/30 text-orange-300 border border-orange-700/50 text-xs font-medium" title={`Reopened ${ticket.reopen_count} time${ticket.reopen_count > 1 ? 's' : ''}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reopened {ticket.reopen_count}×
                      </span>
                    )}
                  </div>

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
                      <span className="ml-auto px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded border border-blue-600">
                        Primary
                      </span>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Unassigned</p>
                  )}
                </div>

                {/* Collaborators */}
                {collaborators.length > 0 && (
                  <div className="mt-4">
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                      Collaborators ({collaborators.length})
                    </label>
                    <div className="space-y-2">
                      {collaborators.map((collab) => (
                        <div key={collab.user_id} className="flex items-center gap-2 group">
                          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(collab.first_name || '?').charAt(0)}{(collab.last_name || '?').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {collab.first_name} {collab.last_name}
                            </p>
                            {collab.email && (
                              <p className="text-gray-500 text-xs truncate">{collab.email}</p>
                            )}
                          </div>
                          <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 text-xs rounded border border-purple-600 flex-shrink-0">
                            Assisting
                          </span>
                          {canAddCollaborators() && (
                            <button
                              onClick={() => handleRemoveCollaborator(collab.user_id, `${collab.first_name} ${collab.last_name}`)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                              title="Remove collaborator"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  { id: 'comments', label: 'Comments' },
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
                        <div>
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className={`w-full bg-gray-900 border rounded-lg px-4 py-2.5 text-xl font-bold text-white focus:outline-none focus:ring-1 ${
                              isFieldModified('subject')
                                ? 'border-amber-500/70 focus:border-amber-500 focus:ring-amber-500/30'
                                : 'border-blue-500/50 focus:border-blue-500 focus:ring-blue-500/30'
                            }`}
                            placeholder="Ticket subject"
                          />
                          {isFieldModified('subject') && (
                            <span className="text-amber-400 text-xs mt-1 block">Modified</span>
                          )}
                        </div>
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

                    {/* Extension Requests — management only */}
                    {isManagement && updateRequests.length > 0 && (
                      <div className="space-y-4">
                        {updateRequests
                          .filter(req => req.extension_requested === true && req.extension_approved !== true)
                          .map(request => (
                            <div key={request.id} className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <h4 className="text-amber-400 font-medium">Extension Request Pending</h4>
                                  </div>
                                  <div className="space-y-1 text-sm text-gray-300">
                                    <p>
                                      <span className="text-gray-500">Technician:</span>{' '}
                                      {request.assignee_first_name} {request.assignee_last_name}
                                    </p>
                                    <p>
                                      <span className="text-gray-500">Current Deadline:</span>{' '}
                                      {_fmtDateTime(request.deadline)}
                                    </p>
                                    <p>
                                      <span className="text-gray-500">Requested Deadline:</span>{' '}
                                      <span className="text-amber-400 font-medium">
                                        {_fmtDateTime(request.extension_deadline)}
                                      </span>
                                    </p>
                                    {request.reason && (
                                      <p className="mt-2">
                                        <span className="text-gray-500">Reason:</span>{' '}
                                        <span className="text-gray-200">{request.reason}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleExtensionDecision(request.id, true)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleExtensionDecision(request.id, false)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                                  >
                                    Deny
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                        Description
                        {isEditing && isFieldModified('description') && (
                          <span className="text-amber-400 ml-2 normal-case">Modified</span>
                        )}
                      </label>
                      {isEditing ? (
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={8}
                          className={`w-full bg-gray-900 border rounded-lg px-4 py-3 text-gray-300 text-sm leading-relaxed focus:outline-none focus:ring-1 resize-y ${
                            isFieldModified('description')
                              ? 'border-amber-500/70 focus:border-amber-500 focus:ring-amber-500/30'
                              : 'border-blue-500/50 focus:border-blue-500 focus:ring-blue-500/30'
                          }`}
                          placeholder="Ticket description"
                        />
                      ) : (
                        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 text-sm leading-relaxed break-words">
                          {ticket.description ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-4 mb-2 first:mt-0" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-white mt-3 mb-2 first:mt-0" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-base font-semibold text-gray-200 mt-3 mb-1 first:mt-0" {...props} />,
                                p:  ({node, ...props}) => <p  className="text-gray-300 mb-3 last:mb-0" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1 pl-2" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1 pl-2" {...props} />,
                                li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                                em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                                code: ({node, className, children, ...props}) => {
                                  const isBlock = className?.startsWith('language-')
                                  return isBlock
                                    ? <code className="block text-blue-300 font-mono text-xs overflow-x-auto" {...props}>{children}</code>
                                    : <code className="bg-gray-800 text-blue-300 rounded px-1 py-0.5 font-mono text-xs" {...props}>{children}</code>
                                },
                                pre: ({node, ...props}) => <pre className="bg-gray-800 rounded-lg p-3 overflow-x-auto mb-3 text-blue-300 font-mono text-xs" {...props} />,
                                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-400 my-3" {...props} />,
                                a: ({node, ...props}) => <a className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noopener noreferrer" {...props} />,
                                hr: ({node, ...props}) => <hr className="border-gray-700 my-4" {...props} />,
                                table: ({node, ...props}) => <div className="overflow-x-auto mb-3"><table className="w-full text-sm border-collapse" {...props} /></div>,
                                th: ({node, ...props}) => <th className="border border-gray-700 bg-gray-800 px-3 py-2 text-left text-gray-200 font-semibold" {...props} />,
                                td: ({node, ...props}) => <td className="border border-gray-700 px-3 py-2 text-gray-300" {...props} />,
                              }}
                            >
                              {ticket.description}
                            </ReactMarkdown>
                          ) : (
                            <span className="text-gray-600 italic">No description provided.</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Attachments */}
                    {ticket.attachments && ticket.attachments.length > 0 && (
                      <div>
                        <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                          Attachments ({ticket.attachments.length})
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {ticket.attachments.map((attachment, idx) => (
                            <div key={idx} className="group relative bg-gray-900 rounded-lg border border-gray-800 overflow-hidden hover:border-blue-500/50 transition-colors">
                              <div className="aspect-square relative bg-gray-950 flex items-center justify-center">
                                <img
                                  src={attachment.dataUrl}
                                  alt={attachment.name || `Attachment ${idx + 1}`}
                                  className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setLightboxImage(attachment)}
                                  loading="lazy"
                                />
                              </div>
                              {attachment.name && (
                                <div className="p-2 bg-gray-900/90">
                                  <p className="text-xs text-gray-400 truncate" title={attachment.name}>
                                    {attachment.name}
                                  </p>
                                  {attachment.size && (
                                    <p className="text-xs text-gray-600">
                                      {(attachment.size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline edit fields — role-based */}
                    {isEditing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Category — clients & management */}
                        {(isClient || isManagement) && (
                          <div>
                            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                              Category
                              {isFieldModified('category') && (
                                <span className="text-amber-400 ml-2 normal-case">Modified</span>
                              )}
                            </label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className={`w-full bg-gray-900 border rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-1 capitalize ${
                                isFieldModified('category')
                                  ? 'border-amber-500/70 focus:border-amber-500 focus:ring-amber-500/30'
                                  : 'border-blue-500/50 focus:border-blue-500 focus:ring-blue-500/30'
                              }`}
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
                            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                              Priority
                              {isFieldModified('priority') && (
                                <span className="text-amber-400 ml-2 normal-case">Modified</span>
                              )}
                            </label>
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value)}
                              className={`w-full bg-gray-900 border rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-1 capitalize ${
                                isFieldModified('priority')
                                  ? 'border-amber-500/70 focus:border-amber-500 focus:ring-amber-500/30'
                                  : 'border-blue-500/50 focus:border-blue-500 focus:ring-blue-500/30'
                              }`}
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

                    {/* Priority change reason — shown when priority is modified */}
                    {isEditing && isFieldModified('priority') && (
                      <div>
                        <label className="text-amber-400 text-xs font-medium uppercase tracking-wider mb-2 block">Reason for Priority Change *</label>
                        <input
                          type="text"
                          value={editPriorityReason}
                          onChange={(e) => setEditPriorityReason(e.target.value)}
                          className="w-full bg-gray-900 border border-amber-500/50 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                          placeholder="Why is the priority being changed?"
                        />
                      </div>
                    )}

                    {/* Resolution / Notes — editable for techs & management */}
                    {isEditing && (isTech || isManagement) ? (
                      <div>
                        <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                          Resolution / Notes
                          {isFieldModified('resolution') && (
                            <span className="text-amber-400 ml-2 normal-case">Modified</span>
                          )}
                        </label>
                        <textarea
                          value={editResolution}
                          onChange={(e) => setEditResolution(e.target.value)}
                          rows={4}
                          className={`w-full bg-gray-900 border rounded-lg px-4 py-3 text-gray-300 text-sm leading-relaxed focus:outline-none focus:ring-1 resize-y ${
                            isFieldModified('resolution')
                              ? 'border-amber-500/70 focus:border-amber-500 focus:ring-amber-500/30'
                              : 'border-blue-500/50 focus:border-blue-500 focus:ring-blue-500/30'
                          }`}
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

                    {/* AI Classification Details - management only */}
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

                {activeTab === 'comments' && (
                  <TicketComments ticketId={ticket.id} />
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

        {/* Add Collaborator Modal */}
        {ticket && showCollaboratorModal && (
          <AddCollaboratorModal
            isOpen={showCollaboratorModal}
            onClose={() => setShowCollaboratorModal(false)}
            onAdd={handleAddCollaborator}
            existingCollaborators={collaborators}
          />
        )}

        {/* Ring for Help Modal */}
        {ticket && showRingModal && (
          <RingForHelpModal
            isOpen={showRingModal}
            onClose={() => setShowRingModal(false)}
            ticketId={ticket.id}
            ticketSubject={ticket.subject}
            existingCollaborators={collaborators}
            onRingSent={(data) => {
              // Show success message
              setStatusSuccess(`Ring request sent to ${data.targetTech.first_name} ${data.targetTech.last_name}`)
              setTimeout(() => setStatusSuccess(null), 3000)
              // Refresh ticket data to show updated activity
              fetchTicket(true)
            }}
          />
        )}

        {/* Request Update Modal */}
        {ticket && showRequestUpdateModal && (
          <RequestUpdateModal
            isOpen={showRequestUpdateModal}
            onClose={(data) => {
              setShowRequestUpdateModal(false)
              if (data) {
                setStatusSuccess('Update request sent successfully')
                setTimeout(() => setStatusSuccess(null), 3000)
                fetchTicket(true)
              }
            }}
            ticketId={ticket.id}
            ticketSubject={ticket.subject}
            collaborators={collaborators}
            assignedTo={ticket.assigned_to}
            assignedToName={ticket.assigned_to_name}
          />
        )}
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

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close lightbox"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Image */}
            <img
              src={lightboxImage.dataUrl}
              alt={lightboxImage.name || 'Attachment'}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            
            {/* Image info */}
            {lightboxImage.name && (
              <div className="mt-4 text-center">
                <p className="text-white font-medium">{lightboxImage.name}</p>
                {lightboxImage.size && (
                  <p className="text-gray-400 text-sm mt-1">
                    {(lightboxImage.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

export default TicketDetailView
