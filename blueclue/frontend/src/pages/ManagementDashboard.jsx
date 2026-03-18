import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'
import BaseWidget from '../components/BaseWidget'
import DashboardGrid from '../components/DashboardGrid'
import useDashboardLayout from '../hooks/useDashboardLayout'
import UnassignedVsAssignedWidget from '../components/UnassignedVsAssignedWidget'
import TicketCategoriesWidget from '../components/TicketCategoriesWidget'
import OverdueTicketsWidget from '../components/OverdueTicketsWidget'
import EscalationsWidget from '../components/EscalationsWidget'
import TodaysActionsWidget from '../components/TodaysActionsWidget'
import TopRequestersWidget from '../components/TopRequestersWidget'
import TechPerformanceWidget from '../components/TechPerformanceWidget'
import TicketControlWidget from '../components/TicketControlWidget'
import TicketTimeline from '../components/TicketTimeline'
import PendingRequestsWidget from '../components/PendingRequestsWidget'
import DeletedTicketsWidget from '../components/DeletedTicketsWidget'
import QuickActionsPanel from '../components/QuickActionsPanel'
import TicketDetailView from '../components/TicketDetailView'
import UpdateRequestResponseTimeAnalytics from '../components/UpdateRequestResponseTimeAnalytics'
import AuditHealthWidget from '../components/AuditHealthWidget'
import CreateTicketWidget from '../components/CreateTicketWidget'
import { getAllTickets, createTicket } from '../services/ticketService'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import { buildGalleryItems, buildWidgetConfig } from '../widgets'

// Default grid layouts for management dashboard widgets
// 12-column grid, rowHeight=60px.  Height in px ≈ h×60 + (h-1)×16
// Each item: { i: key, x, y, w, h, minW, minH }
const LAYOUT_VERSION = 5 // bump to force stale localStorage reset
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'timeline',       x: 0,  y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'ticketControl',  x: 0,  y: 8,  w: 12, h: 11, minW: 4,  minH: 8, maxW: 12, maxH: 20 },
    { i: 'assignedChart',  x: 0,  y: 19, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'categoriesChart',x: 6,  y: 19, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'overdue',        x: 0,  y: 26, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'escalations',    x: 6,  y: 26, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'todaysActions',  x: 0,  y: 33, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'topRequesters',  x: 6,  y: 33, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'techPerformance',x: 0,  y: 40, w: 12, h: 8,  minW: 5,  minH: 5, maxW: 12, maxH: 16 },
    { i: 'deletedTickets', x: 0,  y: 48, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'pendingRequests',x: 6,  y: 48, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'responseTime',   x: 0,  y: 55, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'auditHealth',    x: 0,  y: 62, w: 12, h: 10, minW: 4,  minH: 6, maxW: 12, maxH: 16 },
  ],
  md: [
    { i: 'timeline',       x: 0,  y: 0,  w: 12, h: 8,  minW: 6,  minH: 6, maxW: 12, maxH: 16 },
    { i: 'ticketControl',  x: 0,  y: 8,  w: 12, h: 11, minW: 4,  minH: 8, maxW: 12, maxH: 20 },
    { i: 'assignedChart',  x: 0,  y: 19, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'categoriesChart',x: 6,  y: 19, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 12, maxH: 14 },
    { i: 'overdue',        x: 0,  y: 26, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'escalations',    x: 0,  y: 33, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'todaysActions',  x: 0,  y: 40, w: 12, h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'topRequesters',  x: 0,  y: 47, w: 12, h: 7,  minW: 3,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'techPerformance',x: 0,  y: 54, w: 12, h: 8,  minW: 5,  minH: 5, maxW: 12, maxH: 16 },
    { i: 'deletedTickets', x: 0,  y: 62, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'pendingRequests',x: 0,  y: 69, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'responseTime',   x: 0,  y: 76, w: 12, h: 7,  minW: 4,  minH: 4, maxW: 12, maxH: 14 },
    { i: 'auditHealth',    x: 0,  y: 83, w: 12, h: 10, minW: 4,  minH: 6, maxW: 12, maxH: 16 },
  ],
  sm: [
    { i: 'timeline',       x: 0,  y: 0,  w: 6,  h: 8,  minW: 3,  minH: 6, maxW: 6, maxH: 16 },
    { i: 'ticketControl',  x: 0,  y: 8,  w: 6,  h: 12, minW: 3,  minH: 8, maxW: 6, maxH: 20 },
    { i: 'assignedChart',  x: 0,  y: 20, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 6, maxH: 14 },
    { i: 'categoriesChart',x: 0,  y: 27, w: 6,  h: 7,  minW: 3,  minH: 5, maxW: 6, maxH: 14 },
    { i: 'overdue',        x: 0,  y: 34, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'escalations',    x: 0,  y: 41, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'todaysActions',  x: 0,  y: 48, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'topRequesters',  x: 0,  y: 55, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'techPerformance',x: 0,  y: 62, w: 6,  h: 8,  minW: 3,  minH: 5, maxW: 6, maxH: 16 },
    { i: 'deletedTickets', x: 0,  y: 70, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'pendingRequests',x: 0,  y: 77, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'responseTime',   x: 0,  y: 84, w: 6,  h: 7,  minW: 3,  minH: 4, maxW: 6, maxH: 14 },
    { i: 'auditHealth',    x: 0,  y: 91, w: 6,  h: 10, minW: 4,  minH: 6, maxW: 6, maxH: 16 },
  ],
}

// Widget keys used on the management dashboard (order matches DEFAULT_LAYOUTS)
const MANAGEMENT_WIDGET_KEYS = [
  'timeline', 'ticketControl', 'assignedChart', 'categoriesChart',
  'overdue', 'escalations', 'todaysActions', 'topRequesters',
  'techPerformance', 'deletedTickets', 'pendingRequests', 'responseTime',
  'auditHealth', 'createTicket',
]

// Widget metadata for the gallery sidebar — derived from the widget registry
const WIDGET_GALLERY_ITEMS = buildGalleryItems({ keys: MANAGEMENT_WIDGET_KEYS })

/**
 * ManagementWidgetGrid
 * Renders all dashboard widgets inside a drag-and-drop grid.
 */
function ManagementWidgetGrid({
  tickets, filteredTickets, fetchTickets,
  assignmentFilter, setAssignmentFilter,
  widgetFilters, handleWidgetFilterChange,
  categoryFilter, setCategoryFilter,
  handleTicketClick, pendingRequestsRef,
  onSubmitTicket,
}) {
  const {
    layouts,
    isEditMode,
    editModeToggledRef,
    onLayoutChange,
    resetLayout,
    toggleEditMode,
    hiddenWidgets,
    addWidget,
    removeWidget,
    savedLayouts,
    saveCustomLayout,
    loadCustomLayout,
    deleteCustomLayout,
    renameCustomLayout,
  } = useDashboardLayout('management', DEFAULT_LAYOUTS, LAYOUT_VERSION)

  // Widget definitions — build from registry + a component map with live props
  const widgetConfig = useMemo(() => {
    const componentMap = {
      timeline: (
        <TicketTimeline tickets={tickets} onTicketClick={handleTicketClick} />
      ),
      ticketControl: <TicketControlWidget tickets={tickets} onTicketUpdated={fetchTickets} />,
      assignedChart: (
        <UnassignedVsAssignedWidget
          tickets={tickets}
          activeFilter={assignmentFilter}
          onFilter={setAssignmentFilter}
          widgetFilters={widgetFilters}
          onWidgetFilterChange={handleWidgetFilterChange}
        />
      ),
      categoriesChart: (
        <TicketCategoriesWidget
          tickets={tickets}
          activeCategory={categoryFilter}
          onCategorySelect={setCategoryFilter}
          onTicketClick={(ticket) => handleTicketClick(ticket.id || ticket.ticket_id)}
        />
      ),
      overdue: <OverdueTicketsWidget onTicketClick={(ticket) => handleTicketClick(ticket.id)} />,
      escalations: <EscalationsWidget onView={(ticket) => handleTicketClick(ticket.id)} />,
      todaysActions: <TodaysActionsWidget onAction={(item) => handleTicketClick(item.id || item.ticket_id)} />,
      topRequesters: <TopRequestersWidget />,
      techPerformance: <TechPerformanceWidget />,
      deletedTickets: <DeletedTicketsWidget onTicketClick={(ticket) => handleTicketClick(ticket.id)} />,
      pendingRequests: <PendingRequestsWidget ref={pendingRequestsRef} onTicketClick={(ticketId) => handleTicketClick(ticketId)} />,
      responseTime: (
        <BaseWidget title="Update Request Response Times" icon="">
          <UpdateRequestResponseTimeAnalytics />
        </BaseWidget>
      ),
      auditHealth: <AuditHealthWidget />,
      createTicket: <CreateTicketWidget onSubmit={onSubmitTicket} />,
    }
    return buildWidgetConfig(MANAGEMENT_WIDGET_KEYS, componentMap)
  }, [tickets, fetchTickets, assignmentFilter, setAssignmentFilter,
      widgetFilters, handleWidgetFilterChange, categoryFilter, setCategoryFilter,
      handleTicketClick, pendingRequestsRef, onSubmitTicket])

  return (
    <>
      {/* Filtered ticket list — shown when a donut segment is clicked */}
      {assignmentFilter && (
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className={assignmentFilter === 'assigned' ? 'text-green-400' : 'text-orange-400'}>●</span>
              {assignmentFilter === 'assigned' ? 'Assigned' : 'Unassigned'} Tickets
              <span className="text-sm font-normal text-gray-400">({filteredTickets.length})</span>
            </h3>
            <button
              onClick={() => setAssignmentFilter(null)}
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filter
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredTickets.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">No tickets match this filter.</p>
            ) : (
              filteredTickets.slice(0, 25).map((t) => {
                const priorityColors = {
                  critical: 'text-red-400',
                  high: 'text-orange-400',
                  medium: 'text-yellow-400',
                  low: 'text-blue-400',
                }
                return (
                  <div
                    key={t.id || t.ticket_id}
                    className="flex items-center justify-between p-2.5 bg-gray-700/50 rounded border border-gray-600 text-sm hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => handleTicketClick(t.id || t.ticket_id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-gray-500 font-mono text-xs flex-shrink-0">
                        {t.ticket_number || `#${t.id || t.ticket_id}`}
                      </span>
                      <span className="text-white truncate">{t.subject || t.title}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className={`text-xs capitalize ${priorityColors[t.priority] || 'text-gray-400'}`}>
                        {t.priority}
                      </span>
                      {t.assigned_to_name && t.assigned_to_name !== 'null' ? (
                        <span className="text-green-400 text-xs">{t.assigned_to_name}</span>
                      ) : (
                        <span className="text-orange-400 text-xs">Unassigned</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {filteredTickets.length > 25 && (
              <p className="text-gray-500 text-xs text-center pt-1">
                Showing 25 of {filteredTickets.length} tickets
              </p>
            )}
          </div>
        </div>
      )}

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
    </>
  )
}

/**
 * Management Dashboard
 * Main management interface for viewing and managing tickets, technicians, and analytics
 */
function ManagementDashboard() {
  // State management
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState([])
  const pendingRequestsRef = useRef(null)

  // Real-time: refresh pending requests when a new notification arrives
  const handleNewNotification = useCallback((notification) => {
    // If the notification is assignment-related, auto-refresh the widget
    if (notification?.type === 'assignment' || notification?.message?.includes('requested assignment')) {
      pendingRequestsRef.current?.refresh()
    }
  }, [])

  // Stable ref so the socket callback never triggers a reconnect on re-render
  const _ticketFetchRef = useRef(null)
  const handleTicketChange = useCallback(() => { _ticketFetchRef.current?.() }, [])
  useNotificationSocket(handleNewNotification, null, handleTicketChange)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const handleTicketClick = (ticketId) => {
    setSelectedTicketId(ticketId)
    setIsDetailOpen(true)
  }

  // Handle ticket creation from the CreateTicketWidget
  const handleSubmitTicket = async (formData) => {
    try {
      const response = await createTicket(formData)
      const ticketId = response.ticket?.id || response.ticket?.ticket_id || response.data?.id || response.data?.ticket_id
      toast.success(ticketId
        ? `Ticket #${ticketId} created successfully!`
        : 'Ticket submitted successfully!')
      await fetchTickets()
    } catch (error) {
      console.error('Failed to create ticket:', error)
      toast.error(error.message || 'Failed to submit ticket. Please try again.')
      throw error
    }
  }

  const [assignmentFilter, setAssignmentFilter] = useState(null) // 'assigned' | 'unassigned' | null
  const [widgetFilters, setWidgetFilters] = useState({ priority: null, category: null, status: null })
  const [categoryFilter, setCategoryFilter] = useState(null) // selected category key or null
  const [includeCancelled, setIncludeCancelled] = useState(false)

  const handleWidgetFilterChange = useCallback((key, value) => {
    setWidgetFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Summary statistics
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    assignedTickets: 0,
    unassignedTickets: 0,
    overdueTickets: 0,
    cancelledTickets: 0,
    cancellationRate: 0
  })

  const fetchTickets = useCallback(async () => {
    // Only show full loading spinner on initial load
    if (tickets.length === 0) setLoading(true)
    try {
      const response = await getAllTickets()
      setTickets(response.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load tickets')
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [tickets.length, toast])
  // Keep ref pointing at latest fetchTickets so socket callback is always current
  _ticketFetchRef.current = fetchTickets

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Check for ticket to auto-open from Ring for Help
  useEffect(() => {
    const openTicketId = sessionStorage.getItem('openTicketId');
    if (openTicketId && tickets.length > 0) {
      sessionStorage.removeItem('openTicketId');
      setSelectedTicketId(parseInt(openTicketId));
      setIsDetailOpen(true);
    }
  }, [tickets]);

  const calculateStats = useCallback(() => {
    const now = new Date()
    const cancelledTickets = tickets.filter(t => t.status === 'cancelled').length
    // When toggle is off, exclude cancelled from all counts
    const activeTickets = includeCancelled ? tickets : tickets.filter(t => t.status !== 'cancelled')
    
    const openTickets = activeTickets.filter(t => t.status === 'open').length
    const assignedTickets = activeTickets.filter(t => t.assigned_to_name && t.assigned_to_name !== 'null').length
    const unassignedTickets = activeTickets.length - assignedTickets
    
    const overdueTickets = activeTickets.filter(t => {
      if (!t.due_date) return false
      const dueDate = new Date(t.due_date)
      return dueDate < now && t.status !== 'resolved' && t.status !== 'closed'
    }).length

    const cancellationRate = tickets.length > 0
      ? parseFloat(((cancelledTickets / tickets.length) * 100).toFixed(1))
      : 0

    setStats({
      totalTickets: activeTickets.length,
      openTickets,
      assignedTickets,
      unassignedTickets,
      overdueTickets,
      cancelledTickets,
      cancellationRate
    })
  }, [tickets, includeCancelled])

  // Recalculate stats when tickets or includeCancelled change
  useEffect(() => {
    if (tickets.length > 0) {
      calculateStats()
    }
  }, [tickets, calculateStats, includeCancelled])

  // Filtered tickets based on widget filters (dropdowns + donut segment click)
  const filteredTickets = useMemo(() => {
    let result = includeCancelled ? tickets : tickets.filter(t => t.status !== 'cancelled')
    // Apply widget dropdown filters first
    if (widgetFilters.priority) {
      result = result.filter(t => t.priority === widgetFilters.priority)
    }
    if (widgetFilters.category) {
      result = result.filter(t => t.category === widgetFilters.category)
    }
    if (widgetFilters.status) {
      result = result.filter(t => t.status === widgetFilters.status)
    }
    // Then apply assignment segment filter
    if (!assignmentFilter) return result
    if (assignmentFilter === 'assigned') {
      return result.filter(t => t.assigned_to_name && t.assigned_to_name !== 'null')
    }
    return result.filter(t => !t.assigned_to_name || t.assigned_to_name === 'null')
  }, [tickets, assignmentFilter, widgetFilters, includeCancelled])

  // Render summary stat card
  const StatCard = ({ title, value, subtitle, bgColor = 'bg-gray-800' }) => (
    <div className={`${bgColor} rounded-lg p-4 border border-gray-700 shadow-sm`}>
      <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-2">{subtitle}</p>}
    </div>
  )

  // Render loading state
  if (loading && tickets.length === 0) {
    return (
      <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Management Dashboard</h1>
        <p className="text-gray-400">
          Monitor and manage all support tickets, technician assignments, and system analytics.
        </p>
      </div>

      {/* Include Cancelled Toggle + Summary Statistics Grid */}
      <div className="flex items-center justify-end mb-3">
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
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard 
          title="Total Tickets" 
          value={stats.totalTickets}
          bgColor="bg-blue-900 bg-opacity-30 border-blue-700"
        />
        <StatCard 
          title="Open Tickets" 
          value={stats.openTickets}
          bgColor="bg-yellow-900 bg-opacity-30 border-yellow-700"
        />
        <StatCard 
          title="Assigned" 
          value={stats.assignedTickets}
          bgColor="bg-green-900 bg-opacity-30 border-green-700"
        />
        <StatCard 
          title="Unassigned" 
          value={stats.unassignedTickets}
          bgColor="bg-orange-900 bg-opacity-30 border-orange-700"
        />
        <StatCard 
          title="Overdue" 
          value={stats.overdueTickets}
          bgColor="bg-red-900 bg-opacity-30 border-red-700"
        />
        <StatCard 
          title="Cancelled" 
          value={stats.cancelledTickets}
          subtitle={`${stats.cancellationRate}% rate`}
          bgColor="bg-gray-800 bg-opacity-50 border-gray-600"
        />
      </div>

      {/* Main Content - Charts and Widgets */}
      {/* Quick Actions - Floating right-side panel */}
      <QuickActionsPanel />

      {/* Draggable Widget Grid */}
      <ManagementWidgetGrid
        tickets={tickets}
        filteredTickets={filteredTickets}
        fetchTickets={fetchTickets}
        assignmentFilter={assignmentFilter}
        setAssignmentFilter={setAssignmentFilter}
        widgetFilters={widgetFilters}
        handleWidgetFilterChange={handleWidgetFilterChange}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        handleTicketClick={handleTicketClick}
        pendingRequestsRef={pendingRequestsRef}
        onSubmitTicket={handleSubmitTicket}
      />

      {/* Ticket Detail View Modal */}
      <TicketDetailView
        ticketId={selectedTicketId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTicketUpdated={fetchTickets}
      />
    </div>
  )
}

export default ManagementDashboard
