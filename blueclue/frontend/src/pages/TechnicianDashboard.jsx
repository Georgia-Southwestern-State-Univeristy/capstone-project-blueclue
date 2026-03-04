import { useState, useEffect, useMemo } from 'react'
import Alert from '../components/Alert'
import DonutChart from '../components/DonutChart'
import TicketTimeline from '../components/TicketTimeline'
import PieChart from '../components/PieChart'
import AvailableTickets from '../components/AvailableTickets'
import TicketDetailView from '../components/TicketDetailView'
import RingRequestWidget from '../components/RingRequestWidget'
import UpdateRequestAlert from '../components/UpdateRequestAlert'
import UpdateResponseModal from '../components/UpdateResponseModal'
import TechTicketQueueWidget from '../components/TechTicketQueueWidget'
import TechChatPanel from '../components/TechChatPanel'
import DashboardGrid from '../components/DashboardGrid'
import useDashboardLayout from '../hooks/useDashboardLayout'
import { buildGalleryItems, buildWidgetConfig } from '../widgets'
import { getAllTickets, updateTicketStatus, assignTicket } from '../services/ticketService'
import { getTechnicians } from '../services/userService'

// ── Default grid layouts ─────────────────────────────────────────────────────
const LAYOUT_VERSION = 1
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'timeline',         x: 0,  y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'statusDonut',      x: 0,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'priorityPie',      x: 6,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'ticketQueue',      x: 0,  y: 15, w: 12, h: 14, minW: 6,  minH: 8, maxW: 12, maxH: 24 },
    { i: 'availableTickets', x: 0,  y: 29, w: 12, h: 10, minW: 4,  minH: 6, maxW: 12, maxH: 18 },
    { i: 'ringRequests',     x: 0,  y: 39, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
  ],
  md: [
    { i: 'timeline',         x: 0,  y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'statusDonut',      x: 0,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'priorityPie',      x: 6,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'ticketQueue',      x: 0,  y: 15, w: 12, h: 14, minW: 6,  minH: 8, maxW: 12, maxH: 24 },
    { i: 'availableTickets', x: 0,  y: 29, w: 12, h: 10, minW: 4,  minH: 6, maxW: 12, maxH: 18 },
    { i: 'ringRequests',     x: 0,  y: 39, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
  ],
  sm: [
    { i: 'timeline',         x: 0,  y: 0,  w: 6,  h: 8,  minW: 3,  minH: 6, maxW: 6, maxH: 16 },
    { i: 'statusDonut',      x: 0,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 6, maxH: 14 },
    { i: 'priorityPie',      x: 0,  y: 15, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 6, maxH: 14 },
    { i: 'ticketQueue',      x: 0,  y: 22, w: 6,  h: 14, minW: 3,  minH: 8, maxW: 6, maxH: 24 },
    { i: 'availableTickets', x: 0,  y: 36, w: 6,  h: 10, minW: 3,  minH: 6, maxW: 6, maxH: 18 },
    { i: 'ringRequests',     x: 0,  y: 46, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
  ],
}

const TECHNICIAN_WIDGET_KEYS = [
  'timeline', 'statusDonut', 'priorityPie',
  'ticketQueue', 'availableTickets', 'ringRequests',
]

const WIDGET_GALLERY_ITEMS = buildGalleryItems({ keys: TECHNICIAN_WIDGET_KEYS })

/**
 * TechnicianWidgetGrid — drag-and-drop widget grid for the technician dashboard
 */
function TechnicianWidgetGrid({
  tickets, loading, fetchTickets,
  technicians, handleTicketClick,
  handleStatusChange, handleAssignmentChange,
  updatingTicketId, assigningTicketId, ticketErrors,
  includeCancelled, stats, donutSegments, prioritySegments,
}) {
  const {
    layouts, isEditMode, editModeToggledRef, onLayoutChange,
    resetLayout, toggleEditMode, hiddenWidgets, addWidget, removeWidget,
    savedLayouts, saveCustomLayout, loadCustomLayout, deleteCustomLayout, renameCustomLayout,
  } = useDashboardLayout('technician', DEFAULT_LAYOUTS, LAYOUT_VERSION)

  const widgetConfig = useMemo(() => {
    const componentMap = {
      timeline: (
        <TicketTimeline
          tickets={tickets}
          onTicketClick={handleTicketClick}
        />
      ),
      statusDonut: <DonutChart segments={donutSegments} total={stats.total} />,
      priorityPie: <PieChart segments={prioritySegments} title="Priority Breakdown" />,
      ticketQueue: (
        <TechTicketQueueWidget
          tickets={tickets}
          loading={loading}
          technicians={technicians}
          onTicketClick={handleTicketClick}
          onStatusChange={handleStatusChange}
          onAssignmentChange={handleAssignmentChange}
          updatingTicketId={updatingTicketId}
          assigningTicketId={assigningTicketId}
          ticketErrors={ticketErrors}
          includeCancelled={includeCancelled}
        />
      ),
      availableTickets: <AvailableTickets onTicketClick={handleTicketClick} />,
      ringRequests: <RingRequestWidget onViewTicket={handleTicketClick} />,
    }
    return buildWidgetConfig(TECHNICIAN_WIDGET_KEYS, componentMap)
  }, [tickets, loading, fetchTickets, technicians, handleTicketClick,
      handleStatusChange, handleAssignmentChange, updatingTicketId,
      assigningTicketId, ticketErrors, includeCancelled, stats,
      donutSegments, prioritySegments])

  return (
    <DashboardGrid
      layouts={layouts}
      onLayoutChange={onLayoutChange}
      isEditMode={isEditMode}
      editModeToggledRef={editModeToggledRef}
      toggleEditMode={toggleEditMode}
      resetLayout={resetLayout}
      widgetConfig={widgetConfig}
      rowHeight={60}
      galleryItems={WIDGET_GALLERY_ITEMS}
      hiddenWidgets={hiddenWidgets}
      onAddWidget={addWidget}
      onRemoveWidget={removeWidget}
      savedLayouts={savedLayouts}
      onSaveLayout={saveCustomLayout}
      onLoadLayout={loadCustomLayout}
      onDeleteLayout={deleteCustomLayout}
      onRenameLayout={renameCustomLayout}
    />
  )
}

function TechnicianDashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingTicketId, setUpdatingTicketId] = useState(null)
  const [ticketErrors, setTicketErrors] = useState({})
  const [technicians, setTechnicians] = useState([])
  const [assigningTicketId, setAssigningTicketId] = useState(null)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [selectedUpdateRequest, setSelectedUpdateRequest] = useState(null)

  // Fetch tickets and technicians on component mount
  useEffect(() => {
    fetchTickets()
    fetchTechnicians()
  }, [])

  // Check for ticket to auto-open from Ring for Help
  useEffect(() => {
    const openTicketId = sessionStorage.getItem('openTicketId');
    if (openTicketId && tickets.length > 0) {
      sessionStorage.removeItem('openTicketId');
      setSelectedTicketId(parseInt(openTicketId));
      setIsDetailOpen(true);
    }
  }, [tickets]);

  const fetchTickets = async () => {
    // Only show full loading spinner on initial load
    if (tickets.length === 0) setLoading(true)
    setError(null)
    try {
      const response = await getAllTickets()
      setTickets(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load tickets')
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTechnicians = async () => {
    try {
      const techList = await getTechnicians()
      setTechnicians(techList || [])
    } catch (err) {
      console.error('Error fetching technicians:', err)
      // Don't show error to user, just log it
    }
  }

  // Handle assignment change for a ticket
  const handleAssignmentChange = async (ticketId, technicianId) => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return

    setAssigningTicketId(ticketId)

    try {
      const response = await assignTicket(ticketId, technicianId ? parseInt(technicianId) : null)
      // Update just this ticket with the response data
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticketId ? { ...t, ...response.data } : t
        )
      )
    } catch (err) {
      setTicketErrors(prev => ({
        ...prev,
        [ticketId]: err.message || 'Failed to assign ticket'
      }))

      setTimeout(() => {
        setTicketErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[ticketId]
          return newErrors
        })
      }, 5000)
    } finally {
      setAssigningTicketId(null)
    }
  }

  // Handle status change for a ticket
  const handleStatusChange = async (ticketId, newStatus) => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    const previousStatus = ticket.status

    setUpdatingTicketId(ticketId)
    
    // Clear any existing error for this ticket
    setTicketErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[ticketId]
      return newErrors
    })

    try {
      // Call API to update status
      const response = await updateTicketStatus(ticketId, newStatus)
      
      // Update just this ticket with the response data
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticketId ? { ...t, ...response.data } : t
        )
      )
    } catch (err) {
      // Error occurred - show error message
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticketId ? { ...t, status: previousStatus } : t
        )
      )
      
      // Set ticket-specific error
      setTicketErrors(prev => ({
        ...prev,
        [ticketId]: err.message || 'Failed to update status'
      }))
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setTicketErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[ticketId]
          return newErrors
        })
      }, 5000)
    } finally {
      setUpdatingTicketId(null)
    }
  }

  // Open the ticket detail modal
  const handleTicketClick = (ticketId) => {
    setSelectedTicketId(ticketId)
    setIsDetailOpen(true)
  }

  // Calculate ticket statistics
  const activeTickets = includeCancelled ? tickets : tickets.filter(t => t.status !== 'cancelled')
  const cancelledCount = tickets.filter(t => t.status === 'cancelled').length
  const cancellationRate = tickets.length > 0 ? parseFloat(((cancelledCount / tickets.length) * 100).toFixed(1)) : 0

  const stats = {
    open: activeTickets.filter(t => t.status === 'open').length,
    in_progress: activeTickets.filter(t => t.status === 'in_progress').length,
    resolved: activeTickets.filter(t => t.status === 'resolved').length,
    closed: activeTickets.filter(t => t.status === 'closed').length,
    waiting: activeTickets.filter(t => t.status === 'waiting_on_customer').length,
    cancelled: cancelledCount,
    cancellationRate,
    total: activeTickets.length
  }

  // Donut chart segment data
  const donutSegments = [
    { label: 'Open', count: stats.open, color: '#60a5fa' },
    { label: 'In Progress', count: stats.in_progress, color: '#93c5fd' },
    { label: 'Waiting', count: stats.waiting, color: '#a78bfa' },
    { label: 'Resolved', count: stats.resolved, color: '#3b82f6' },
    { label: 'Closed', count: stats.closed, color: '#6b7280' },
    { label: 'Cancelled', count: stats.cancelled, color: '#9ca3af' },
  ]

  // Priority pie chart data
  const prioritySegments = [
    { label: 'Low', count: activeTickets.filter(t => t.priority === 'low').length, color: '#3b82f6' },
    { label: 'Medium', count: activeTickets.filter(t => t.priority === 'medium').length, color: '#eab308' },
    { label: 'High', count: activeTickets.filter(t => t.priority === 'high').length, color: '#f97316' },
    { label: 'Critical', count: activeTickets.filter(t => t.priority === 'critical').length, color: '#ef4444' },
  ]

  return (
    <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Technician Dashboard</h1>
          <p className="text-gray-400">
            View and manage all support tickets across the organization.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-gray-400">Include Cancelled</span>
          <button
            onClick={() => setIncludeCancelled(prev => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              includeCancelled ? 'bg-blue-600' : 'bg-gray-600'
            }`}
            role="switch"
            aria-checked={includeCancelled}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                includeCancelled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {cancelledCount > 0 && (
            <span className="text-xs text-gray-500 ml-1">
              {cancelledCount} cancelled ({cancellationRate}%)
            </span>
          )}
        </label>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <Alert 
            type="error" 
            message={error}
            onClose={() => setError(null)}
          />
        </div>
      )}

      {/* Update Request Alert Banner */}
      <div className="mb-6">
        <UpdateRequestAlert
          onRespond={(request) => setSelectedUpdateRequest(request)}
        />
      </div>

      {/* Widget Grid */}
      <TechnicianWidgetGrid
        tickets={tickets}
        loading={loading}
        fetchTickets={fetchTickets}
        technicians={technicians}
        handleTicketClick={handleTicketClick}
        handleStatusChange={handleStatusChange}
        handleAssignmentChange={handleAssignmentChange}
        updatingTicketId={updatingTicketId}
        assigningTicketId={assigningTicketId}
        ticketErrors={ticketErrors}
        includeCancelled={includeCancelled}
        stats={stats}
        donutSegments={donutSegments}
        prioritySegments={prioritySegments}
      />

      {/* Ticket Detail View Modal */}
      <TicketDetailView
        ticketId={selectedTicketId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTicketUpdated={fetchTickets}
      />

      {/* Update Response Modal */}
      {selectedUpdateRequest && (
        <UpdateResponseModal
          isOpen={!!selectedUpdateRequest}
          onClose={(success) => {
            setSelectedUpdateRequest(null)
            if (success) {
              fetchTickets()
            }
          }}
          updateRequest={selectedUpdateRequest}
        />
      )}

      {/* Live Chat Panel — handles pending handoff requests from customers */}
      <TechChatPanel />
    </div>
  )
}

export default TechnicianDashboard
