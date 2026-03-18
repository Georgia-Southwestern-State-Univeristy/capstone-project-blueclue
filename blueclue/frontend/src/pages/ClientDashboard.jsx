import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import TicketSubmissionModal from '../components/TicketSubmissionModal'
import TicketDetailView from '../components/TicketDetailView'
import TicketTimeline from '../components/TicketTimeline'
import ClientTicketListWidget from '../components/ClientTicketListWidget'
import DashboardGrid from '../components/DashboardGrid'
import useDashboardLayout from '../hooks/useDashboardLayout'
import { buildGalleryItems, buildWidgetConfig } from '../widgets'
import { createTicket, getAllTickets, getAllTicketsForTimeline } from '../services/ticketService'
import { getCurrentUser } from '../services/authService'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import { useToast } from '../hooks/useToast'

// ── Default grid layouts ─────────────────────────────────────────────────────
const LAYOUT_VERSION = 1
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'timeline',      x: 0, y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'clientTickets',  x: 0, y: 8,  w: 12, h: 12, minW: 6,  minH: 6, maxW: 12, maxH: 20 },
  ],
  md: [
    { i: 'timeline',      x: 0, y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'clientTickets',  x: 0, y: 8,  w: 12, h: 12, minW: 6,  minH: 6, maxW: 12, maxH: 20 },
  ],
  sm: [
    { i: 'timeline',      x: 0, y: 0,  w: 6, h: 8,  minW: 3, minH: 6, maxW: 6, maxH: 16 },
    { i: 'clientTickets',  x: 0, y: 8,  w: 6, h: 12, minW: 3, minH: 6, maxW: 6, maxH: 20 },
  ],
}

const CLIENT_WIDGET_KEYS = ['timeline', 'clientTickets']
const WIDGET_GALLERY_ITEMS = buildGalleryItems({ keys: CLIENT_WIDGET_KEYS })

/**
 * ClientWidgetGrid — drag-and-drop widget grid for the client dashboard
 */
function ClientWidgetGrid({
  tickets, timelineTickets, isLoading, isTimelineLoading,
  fetchTickets, fetchTimelineTickets,
  handleTicketClick, handleSubmitClick,
}) {
  const {
    layouts, isEditMode, editModeToggledRef, onLayoutChange,
    resetLayout, toggleEditMode, hiddenWidgets, addWidget, removeWidget,
    savedLayouts, saveCustomLayout, loadCustomLayout, deleteCustomLayout, renameCustomLayout,
  } = useDashboardLayout('client', DEFAULT_LAYOUTS, LAYOUT_VERSION)

  const widgetConfig = useMemo(() => {
    const componentMap = {
      timeline: (
        <TicketTimeline
          tickets={timelineTickets}
          onRefresh={fetchTimelineTickets}
          isRefreshing={isTimelineLoading}
          onTicketClick={handleTicketClick}
        />
      ),
      clientTickets: (
        <ClientTicketListWidget
          tickets={tickets}
          isLoading={isLoading}
          onTicketClick={handleTicketClick}
          onSubmitClick={handleSubmitClick}
        />
      ),
    }
    return buildWidgetConfig(CLIENT_WIDGET_KEYS, componentMap)
  }, [tickets, timelineTickets, isLoading, isTimelineLoading,
      fetchTickets, fetchTimelineTickets, handleTicketClick, handleSubmitClick])

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

function ClientDashboard() {
  // State management
  const toast = useToast()
  const [tickets, setTickets] = useState([])
  const [timelineTickets, setTimelineTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTimelineLoading, setIsTimelineLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Fetch tickets on component mount
  useEffect(() => {
    // Get current user info
    const user = getCurrentUser()
    setCurrentUser(user)

    fetchTickets()
    fetchTimelineTickets()
  }, [])

  // Fetch all tickets from API
  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const data = await getAllTickets()
      // Tickets are now filtered by the backend based on user role
      const userTickets = Array.isArray(data) ? data : (data.data || data.tickets || [])
      setTickets(userTickets)
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
      toast.error('Failed to load tickets. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch all tickets for timeline (no filtering)
  const fetchTimelineTickets = async () => {
    try {
      setIsTimelineLoading(true)
      const data = await getAllTicketsForTimeline()
      const allTickets = Array.isArray(data) ? data : (data.data || data.tickets || [])
      setTimelineTickets(allTickets)
    } catch (error) {
      console.error('Failed to fetch timeline tickets:', error)
      // Don't show error alert for timeline - just use empty array
      setTimelineTickets([])
    } finally {
      setIsTimelineLoading(false)
    }
  }

  // Real-time auto-refresh: stable refs so the socket never reconnects on re-render
  const _ticketFetchRef = useRef(null)
  const _timelineFetchRef = useRef(null)
  _ticketFetchRef.current = fetchTickets
  _timelineFetchRef.current = fetchTimelineTickets
  const handleTicketChange = useCallback(() => {
    _ticketFetchRef.current?.()
    _timelineFetchRef.current?.()
  }, [])
  useNotificationSocket(null, null, handleTicketChange)

  // Handle form submission
  const handleSubmit = async (formData) => {
    try {
      const response = await createTicket(formData)
      const ticketId = response.ticket?.id || response.ticket?.ticket_id || response.data?.id || response.data?.ticket_id
      toast.success(ticketId
        ? `Ticket #${ticketId} created successfully!`
        : 'Ticket submitted successfully!')

      // Close modal
      setIsModalOpen(false)

      // Refresh ticket list
      await fetchTickets()
      await fetchTimelineTickets()
    } catch (error) {
      console.error('Failed to create ticket:', error)
      toast.error(error.message || 'Failed to submit ticket. Please try again.')
      throw error
    }
  }

  // Open the ticket detail modal
  const handleTicketClick = (ticketId) => {
    setSelectedTicketId(ticketId)
    setIsDetailOpen(true)
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-2">Client Dashboard</h1>
      <p className="text-gray-400 mb-6">
        Submit support tickets and track their status
      </p>

      {/* Widget Grid */}
      <ClientWidgetGrid
        tickets={tickets}
        timelineTickets={timelineTickets}
        isLoading={isLoading}
        isTimelineLoading={isTimelineLoading}
        fetchTickets={fetchTickets}
        fetchTimelineTickets={fetchTimelineTickets}
        handleTicketClick={handleTicketClick}
        handleSubmitClick={() => setIsModalOpen(true)}
      />

      {/* Ticket Submission Modal */}
      <TicketSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {/* Ticket Detail View Modal */}
      <TicketDetailView
        ticketId={selectedTicketId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTicketUpdated={() => { fetchTickets(); fetchTimelineTickets() }}
      />
    </div>
  )
}

export default ClientDashboard
