/**
 * Widget Registry — central manifest for every dashboard widget.
 *
 * Each entry defines:
 *   key           – Unique identifier used in layouts and gallery
 *   name          – Human-readable label
 *   description   – Short description shown in the gallery sidebar
 *   icon          – Emoji or icon string for headers
 *   category      – Grouping: 'analytics' | 'tickets' | 'performance' | 'management'
 *   permissions   – Array of roles that may see this widget
 *   size          – Default & constraint metadata for the grid
 *     defaultW/H  – Default grid units when dropped from gallery
 *     minW/H      – Minimum grid units
 *     maxW/H      – Maximum grid units
 *   component     – Lazy-loadable React component path (used by getWidgetComponent)
 *   previewPattern– Key into WidgetGallery's PREVIEW_PATTERNS
 *
 * Roles: 'admin', 'management', 'senior_technician', 'technician', 'customer', 'guest'
 */

// ── Role constants ──────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin',
  MANAGEMENT: 'management',
  SENIOR_TECHNICIAN: 'senior_technician',
  TECHNICIAN: 'technician',
  CUSTOMER: 'customer',
  GUEST: 'guest',
}

/** Shorthand role groups */
export const ROLE_GROUPS = {
  /** All staff: admin, management, senior_technician, technician */
  STAFF: [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.SENIOR_TECHNICIAN, ROLES.TECHNICIAN],
  /** Management tier only */
  MANAGERS: [ROLES.ADMIN, ROLES.MANAGEMENT],
  /** Technicians (includes senior) */
  TECHS: [ROLES.SENIOR_TECHNICIAN, ROLES.TECHNICIAN],
  /** Everyone */
  ALL: [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.SENIOR_TECHNICIAN, ROLES.TECHNICIAN, ROLES.CUSTOMER, ROLES.GUEST],
}

// ── Widget category constants ────────────────────────────────────────────────
export const CATEGORIES = {
  TICKETS: 'tickets',
  ANALYTICS: 'analytics',
  PERFORMANCE: 'performance',
  MANAGEMENT: 'management',
}

// ── Widget Registry ──────────────────────────────────────────────────────────
const WIDGET_REGISTRY = [
  {
    key: 'timeline',
    name: 'Ticket Timeline',
    description: 'Visual timeline of ticket activity and trends over time',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.ALL,
    size: {
      defaultW: 12, defaultH: 8,
      minW: 6, minH: 6,
      maxW: 12, maxH: 16,
    },
    component: () => import('../components/TicketTimeline'),
    previewPattern: 'stacked-bar',
  },
  {
    key: 'ticketControl',
    name: 'Ticket Control',
    description: 'Full ticket management table with search, filters, and actions',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 12, defaultH: 11,
      minW: 4, minH: 8,
      maxW: 12, maxH: 20,
    },
    component: () => import('../components/TicketControlWidget'),
    previewPattern: 'card-grid',
  },
  {
    key: 'assignedChart',
    name: 'Assigned vs Unassigned',
    description: 'Donut chart showing ticket assignment distribution',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 5,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/UnassignedVsAssignedWidget'),
    previewPattern: 'chart-donut',
  },
  {
    key: 'categoriesChart',
    name: 'Ticket Categories',
    description: 'Category breakdown with drilldown into individual tickets',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 5,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/TicketCategoriesWidget'),
    previewPattern: 'chart-pie',
  },
  {
    key: 'overdue',
    name: 'Overdue Tickets',
    description: 'Tickets that have passed their SLA due date',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/OverdueTicketsWidget'),
    previewPattern: 'list-alert',
  },
  {
    key: 'escalations',
    name: 'Escalations',
    description: 'Critical and high-priority tickets requiring attention',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/EscalationsWidget'),
    previewPattern: 'list-actions',
  },
  {
    key: 'todaysActions',
    name: "Today's Actions",
    description: 'Action items: overdue, urgent unassigned, and due today',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/TodaysActionsWidget'),
    previewPattern: 'list-check',
  },
  {
    key: 'topRequesters',
    name: 'Top Requesters',
    description: 'Most active ticket requesters and their patterns',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/TopRequestersWidget'),
    previewPattern: 'ranked-bars',
  },
  {
    key: 'techPerformance',
    name: 'Tech Performance',
    description: 'Technician resolution times and workload metrics',
    icon: '',
    category: CATEGORIES.PERFORMANCE,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 12, defaultH: 8,
      minW: 5, minH: 5,
      maxW: 12, maxH: 16,
    },
    component: () => import('../components/TechPerformanceWidget'),
    previewPattern: 'data-table',
  },
  {
    key: 'deletedTickets',
    name: 'Deleted Tickets',
    description: 'Recently soft-deleted tickets with restore option',
    icon: '',
    category: CATEGORIES.MANAGEMENT,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/DeletedTicketsWidget'),
    previewPattern: 'list-restore',
  },
  {
    key: 'pendingRequests',
    name: 'Pending Requests',
    description: 'Assignment requests awaiting management approval',
    icon: '',
    category: CATEGORIES.MANAGEMENT,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/PendingRequestsWidget'),
    previewPattern: 'list-pending',
  },
  {
    key: 'responseTime',
    name: 'Response Times',
    description: 'Update request response time analytics and trends',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 12, defaultH: 7,
      minW: 4, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/UpdateRequestResponseTimeAnalytics'),
    previewPattern: 'stat-cards',
  },
  {
    key: 'ringRequests',
    name: 'Ring for Help',
    description: 'Incoming ring-for-help requests from technicians',
    icon: '',
    category: CATEGORIES.MANAGEMENT,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 4,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/RingRequestWidget'),
    previewPattern: 'list-pending',
  },
  {
    key: 'availableTickets',
    name: 'Available Tickets',
    description: 'Unassigned tickets available for self-assignment',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: ROLE_GROUPS.TECHS,
    size: {
      defaultW: 12, defaultH: 10,
      minW: 4, minH: 6,
      maxW: 12, maxH: 18,
    },
    component: () => import('../components/AvailableTickets'),
    previewPattern: 'card-grid',
  },
  {
    key: 'quickActions',
    name: 'Quick Actions',
    description: 'Shortcut panel for common management operations',
    icon: '',
    category: CATEGORIES.MANAGEMENT,
    permissions: ROLE_GROUPS.MANAGERS,
    size: {
      defaultW: 4, defaultH: 6,
      minW: 2, minH: 4,
      maxW: 6, maxH: 12,
    },
    component: () => import('../components/QuickActionsPanel'),
    previewPattern: 'list-actions',
  },
  // ── Technician-specific widgets ──────────────────────────────────────────
  {
    key: 'statusDonut',
    name: 'Status Overview',
    description: 'Donut chart showing ticket status distribution',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 5,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/DonutChart'),
    previewPattern: 'chart-donut',
  },
  {
    key: 'priorityPie',
    name: 'Priority Breakdown',
    description: 'Pie chart showing ticket priority distribution',
    icon: '',
    category: CATEGORIES.ANALYTICS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 7,
      minW: 3, minH: 5,
      maxW: 12, maxH: 14,
    },
    component: () => import('../components/PieChart'),
    previewPattern: 'chart-pie',
  },
  {
    key: 'ticketQueue',
    name: 'Ticket Queue',
    description: 'Ticket queue with search, filters, and management actions',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 12, defaultH: 14,
      minW: 6, minH: 8,
      maxW: 12, maxH: 24,
    },
    component: () => import('../components/TechTicketQueueWidget'),
    previewPattern: 'card-grid',
  },
  {
    key: 'chatPanel',
    name: 'Chat Handoff',
    description: 'Live customer chat handoff requests and active conversations',
    icon: '',
    category: CATEGORIES.MANAGEMENT,
    permissions: ROLE_GROUPS.STAFF,
    size: {
      defaultW: 6, defaultH: 10,
      minW: 4, minH: 8,
      maxW: 12, maxH: 16,
    },
    component: () => import('../components/TechChatPanel'),
    previewPattern: 'list-pending',
  },
  // ── Client-specific widgets ──────────────────────────────────────────────
  {
    key: 'clientTickets',
    name: 'My Tickets',
    description: 'Your submitted tickets with status tracking',
    icon: '',
    category: CATEGORIES.TICKETS,
    permissions: [ROLES.CUSTOMER, ROLES.GUEST],
    size: {
      defaultW: 12, defaultH: 12,
      minW: 6, minH: 6,
      maxW: 12, maxH: 20,
    },
    component: () => import('../components/ClientTicketListWidget'),
    previewPattern: 'data-table',
  },
]

export default WIDGET_REGISTRY
