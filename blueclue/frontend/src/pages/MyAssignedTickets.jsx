import { useState, useEffect, useMemo } from 'react'
import Alert from '../components/Alert'
import DonutChart from '../components/DonutChart'
import TicketTimeline from '../components/TicketTimeline'
import PieChart from '../components/PieChart'
import TicketDetailView from '../components/TicketDetailView'
import UpdateRequestAlert from '../components/UpdateRequestAlert'
import UpdateResponseModal from '../components/UpdateResponseModal'
import TechTicketQueueWidget from '../components/TechTicketQueueWidget'
import DashboardGrid from '../components/DashboardGrid'
import useDashboardLayout from '../hooks/useDashboardLayout'
import { buildGalleryItems, buildWidgetConfig } from '../widgets'
import { getMyAssignedTickets, updateTicketStatus } from '../services/ticketService'

// ── Default grid layouts ─────────────────────────────────────────────────────
const LAYOUT_VERSION = 1
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'timeline',    x: 0,  y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'statusDonut', x: 0,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'priorityPie', x: 6,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'ticketQueue', x: 0,  y: 15, w: 12, h: 14, minW: 6,  minH: 8, maxW: 12, maxH: 24 },
  ],
  md: [
    { i: 'timeline',    x: 0,  y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'statusDonut', x: 0,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'priorityPie', x: 6,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'ticketQueue', x: 0,  y: 15, w: 12, h: 14, minW: 6,  minH: 8, maxW: 12, maxH: 24 },
  ],
  sm: [
    { i: 'timeline',    x: 0,  y: 0,  w: 6,  h: 8,  minW: 3,  minH: 6, maxW: 6, maxH: 16 },
    { i: 'statusDonut', x: 0,  y: 8,  w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 6, maxH: 14 },
    { i: 'priorityPie', x: 0,  y: 15, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 6, maxH: 14 },
    { i: 'ticketQueue', x: 0,  y: 22, w: 6,  h: 14, minW: 3,  minH: 8, maxW: 6, maxH: 24 },
  ],
}

const MY_ASSIGNED_WIDGET_KEYS = ['timeline', 'statusDonut', 'priorityPie', 'ticketQueue']
const WIDGET_GALLERY_ITEMS = buildGalleryItems({ keys: MY_ASSIGNED_WIDGET_KEYS })

/**
 * MyAssignedWidgetGrid — drag-and-drop widget grid for the "My Assigned Tickets" dashboard
 */
function MyAssignedWidgetGrid({
  tickets, loading, fetchTickets, handleTicketClick,
  handleStatusChange, updatingTicketId, ticketErrors,
  stats, donutSegments, prioritySegments,
}) {
  const {
    layouts, isEditMode, editModeToggledRef, onLayoutChange,
    resetLayout, toggleEditMode, hiddenWidgets, addWidget, removeWidget,
    savedLayouts, saveCustomLayout, loadCustomLayout, deleteCustomLayout, renameCustomLayout,
  } = useDashboardLayout('my-assigned', DEFAULT_LAYOUTS, LAYOUT_VERSION)

  const widgetConfig = useMemo(() => {
    const componentMap = {
      timeline: (
        <TicketTimeline
          tickets={tickets}
          onRefresh={fetchTickets}
          isRefreshing={loading}
          onTicketClick={handleTicketClick}
        />
      ),
      statusDonut: <DonutChart segments={donutSegments} total={stats.total} />,
      priorityPie: <PieChart segments={prioritySegments} title="Priority Breakdown" />,
      ticketQueue: (
        <TechTicketQueueWidget
          tickets={tickets}
          loading={loading}
          onRefresh={fetchTickets}
          onTicketClick={handleTicketClick}
          onStatusChange={handleStatusChange}
          updatingTicketId={updatingTicketId}
          ticketErrors={ticketErrors}
        />
      ),
    }
    return buildWidgetConfig(MY_ASSIGNED_WIDGET_KEYS, componentMap)
  }, [tickets, loading, fetchTickets, handleTicketClick,
      handleStatusChange, updatingTicketId, ticketErrors,
      stats, donutSegments, prioritySegments])

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

function MyAssignedTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingTicketId, setUpdatingTicketId] = useState(null)
  const [ticketErrors, setTicketErrors] = useState({})
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedUpdateRequest, setSelectedUpdateRequest] = useState(null)

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
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
    setLoading(true)
    setError(null)
    try {
      const response = await getMyAssignedTickets()
      setTickets(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load assigned tickets')
      console.error('Error fetching assigned tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle status change for a ticket
  const handleStatusChange = async (ticketId, newStatus) => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    const previousStatus = ticket.status
    setUpdatingTicketId(ticketId)

    setTicketErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[ticketId]
      return newErrors
    })

    try {
      const response = await updateTicketStatus(ticketId, newStatus)
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticketId ? { ...t, ...response.data } : t
        )
      )
    } catch (err) {
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticketId ? { ...t, status: previousStatus } : t
        )
      )
      setTicketErrors(prev => ({
        ...prev,
        [ticketId]: err.message || 'Failed to update status'
      }))
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
  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    waiting: tickets.filter(t => t.status === 'waiting_on_customer').length,
    cancelled: tickets.filter(t => t.status === 'cancelled').length,
    total: tickets.length,
  }

  const donutSegments = [
    { label: 'Open', count: stats.open, color: '#60a5fa' },
    { label: 'In Progress', count: stats.in_progress, color: '#93c5fd' },
    { label: 'Waiting', count: stats.waiting, color: '#a78bfa' },
    { label: 'Resolved', count: stats.resolved, color: '#3b82f6' },
    { label: 'Closed', count: stats.closed, color: '#6b7280' },
    { label: 'Cancelled', count: stats.cancelled, color: '#9ca3af' },
  ]

  const prioritySegments = [
    { label: 'Low', count: tickets.filter(t => t.priority === 'low').length, color: '#3b82f6' },
    { label: 'Medium', count: tickets.filter(t => t.priority === 'medium').length, color: '#eab308' },
    { label: 'High', count: tickets.filter(t => t.priority === 'high').length, color: '#f97316' },
    { label: 'Critical', count: tickets.filter(t => t.priority === 'critical').length, color: '#ef4444' },
  ]

  return (
    <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">My Assigned Tickets</h1>
        <p className="text-gray-400">
          View and manage tickets assigned to you.
        </p>
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
      <MyAssignedWidgetGrid
        tickets={tickets}
        loading={loading}
        fetchTickets={fetchTickets}
        handleTicketClick={handleTicketClick}
        handleStatusChange={handleStatusChange}
        updatingTicketId={updatingTicketId}
        ticketErrors={ticketErrors}
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
    </div>
  )
}

export default MyAssignedTickets
