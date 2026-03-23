import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import TicketSubmissionModal from '../components/TicketSubmissionModal'
import TicketDetailView from '../components/TicketDetailView'
import ClientTicketListWidget from '../components/ClientTicketListWidget'
import CreateTicketWidget from '../components/CreateTicketWidget'
import WelcomeBanner from '../components/WelcomeBanner'
import DashboardGrid from '../components/DashboardGrid'
import useDashboardLayout from '../hooks/useDashboardLayout'
import { useAvailableWidgets } from '../hooks/useAvailableWidgets'
import { buildGalleryItems, buildWidgetConfig } from '../widgets'
import { createTicket, getAllTickets } from '../services/ticketService'
import { getCurrentUser } from '../services/authService'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import { useToast } from '../hooks/useToast'

// ── Default grid layouts ─────────────────────────────────────────────────────
const LAYOUT_VERSION = 3
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'createTicket',   x: 0, y: 0,  w: 12, h: 10, minW: 6,  minH: 6, maxW: 12, maxH: 18 },
    { i: 'clientTickets',  x: 0, y: 10, w: 12, h: 12, minW: 6,  minH: 6, maxW: 12, maxH: 20 },
  ],
  md: [
    { i: 'createTicket',   x: 0, y: 0,  w: 12, h: 10, minW: 6,  minH: 6, maxW: 12, maxH: 18 },
    { i: 'clientTickets',  x: 0, y: 10, w: 12, h: 12, minW: 6,  minH: 6, maxW: 12, maxH: 20 },
  ],
  sm: [
    { i: 'createTicket',   x: 0, y: 0,  w: 6, h: 10, minW: 3, minH: 6, maxW: 6, maxH: 18 },
    { i: 'clientTickets',  x: 0, y: 10, w: 6, h: 12, minW: 3, minH: 6, maxW: 6, maxH: 20 },
  ],
}

const CLIENT_WIDGET_KEYS = ['createTicket', 'clientTickets']

/**
 * ClientWidgetGrid — drag-and-drop widget grid for the client dashboard
 */
function ClientWidgetGrid({
  tickets, isLoading,
  fetchTickets,
  handleTicketClick, handleSubmitClick, onSubmitTicket,
}) {
  // Fetch widgets available to the current user based on their role
  const { widgets: availableWidgets } = useAvailableWidgets(CLIENT_WIDGET_KEYS);
  
  // Build gallery items from available widgets
  const galleryItems = useMemo(() => {
    const availableKeys = availableWidgets.map(w => w.key);
    return buildGalleryItems({ keys: availableKeys });
  }, [availableWidgets]);

  const {
    layouts, isEditMode, editModeToggledRef, onLayoutChange,
    resetLayout, toggleEditMode, hiddenWidgets, addWidget, removeWidget,
    savedLayouts, saveCustomLayout, loadCustomLayout, deleteCustomLayout, renameCustomLayout,
  } = useDashboardLayout('client', DEFAULT_LAYOUTS, LAYOUT_VERSION)

  const widgetConfig = useMemo(() => {
    const componentMap = {
      createTicket: (
        <CreateTicketWidget onSubmit={onSubmitTicket} />
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
  }, [tickets, isLoading, handleTicketClick, handleSubmitClick, onSubmitTicket])

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
      galleryItems={galleryItems}
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
  const [isLoading, setIsLoading] = useState(true)
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

  // Real-time auto-refresh: stable ref so the socket never reconnects on re-render
  const _ticketFetchRef = useRef(null)
  _ticketFetchRef.current = fetchTickets
  const handleTicketChange = useCallback(() => {
    _ticketFetchRef.current?.()
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

  // Quick stats for visual hierarchy
  const openCount = tickets.filter(t => t.status?.toLowerCase() === 'open').length
  const inProgressCount = tickets.filter(t => t.status?.toLowerCase().replace(/_/g, ' ') === 'in progress').length

  // Scroll to the Create Ticket widget
  const createWidgetRef = useRef(null)
  const scrollToCreate = useCallback(() => {
    createWidgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Client Dashboard</h1>
          <p className="text-gray-400">
            Submit support tickets and track their status
          </p>
        </div>

        {/* At-a-glance stats — only shown when user has tickets */}
        {!isLoading && tickets.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="font-medium">{openCount}</span>
              <span className="text-gray-500">Open</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="font-medium">{inProgressCount}</span>
              <span className="text-gray-500">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <span className="font-medium">{tickets.length}</span>
              <span className="text-gray-500">Total</span>
            </div>
          </div>
        )}
      </div>

      {/* Guided onboarding banner */}
      <WelcomeBanner
        ticketCount={tickets.length}
        onScrollToCreate={scrollToCreate}
      />

      {/* Anchor for scroll-to-create */}
      <div ref={createWidgetRef} />

      {/* Widget Grid */}
      <ClientWidgetGrid
        tickets={tickets}
        isLoading={isLoading}
        fetchTickets={fetchTickets}
        handleTicketClick={handleTicketClick}
        handleSubmitClick={() => setIsModalOpen(true)}
        onSubmitTicket={handleSubmit}
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
        onTicketUpdated={() => { fetchTickets() }}
      />
    </div>
  )
}

export default ClientDashboard
