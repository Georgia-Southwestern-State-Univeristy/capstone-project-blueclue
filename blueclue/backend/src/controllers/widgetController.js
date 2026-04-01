// src/controllers/widgetController.js
import { BadRequestError, ForbiddenError } from '../middleware/errorHandler.js';

// ── Widget Registry (Server-side copy) ──────────────────────────────────────
// This mirrors the frontend widgetRegistry.js but enforced server-side
// Keep this in sync with frontend/src/widgets/widgetRegistry.js

const ROLES = {
  ADMIN: 'admin',
  MANAGEMENT: 'management',
  SENIOR_TECHNICIAN: 'senior_technician',
  TECHNICIAN: 'technician',
  CUSTOMER: 'customer',
  GUEST: 'guest',
};

const ROLE_GROUPS = {
  STAFF: [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.SENIOR_TECHNICIAN, ROLES.TECHNICIAN],
  MANAGERS: [ROLES.ADMIN, ROLES.MANAGEMENT],
  TECHS: [ROLES.SENIOR_TECHNICIAN, ROLES.TECHNICIAN],
  ALL: [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.SENIOR_TECHNICIAN, ROLES.TECHNICIAN, ROLES.CUSTOMER, ROLES.GUEST],
};

const CATEGORIES = {
  TICKETS: 'tickets',
  ANALYTICS: 'analytics',
  PERFORMANCE: 'performance',
  MANAGEMENT: 'management',
};

// Widget permission mapping: key -> allowed roles
const WIDGET_PERMISSIONS = {
  // All users
  createTicket: ROLE_GROUPS.ALL,
  
  // Customer/Guest only
  clientTickets: [ROLES.CUSTOMER, ROLES.GUEST],
  ticketUpdates: [ROLES.CUSTOMER],
  
  // All staff
  timeline: ROLE_GROUPS.STAFF,
  
  ticketControl: ROLE_GROUPS.STAFF,
  categoriesChart: ROLE_GROUPS.STAFF,
  overdue: ROLE_GROUPS.STAFF,
  escalations: ROLE_GROUPS.STAFF,
  todaysActions: ROLE_GROUPS.STAFF,
  ringRequests: ROLE_GROUPS.STAFF,
  statusDonut: ROLE_GROUPS.STAFF,
  priorityPie: ROLE_GROUPS.STAFF,
  ticketQueue: ROLE_GROUPS.STAFF,
  chatPanel: ROLE_GROUPS.STAFF,
  techPerformance: ROLE_GROUPS.STAFF,
  
  // Technicians only
  availableTickets: ROLE_GROUPS.TECHS,
  myAssignedTickets: ROLE_GROUPS.TECHS,
  
  // Management only
  assignedChart: ROLE_GROUPS.MANAGERS,
  topRequesters: ROLE_GROUPS.MANAGERS,
  deletedTickets: ROLE_GROUPS.MANAGERS,
  pendingRequests: ROLE_GROUPS.MANAGERS,
  responseTime: ROLE_GROUPS.MANAGERS,
  quickActions: ROLE_GROUPS.MANAGERS,
  auditHealth: ROLE_GROUPS.MANAGERS,
  ticketTrend: ROLE_GROUPS.STAFF,
  ticketStatus: ROLE_GROUPS.STAFF,
  techResponseTime: ROLE_GROUPS.MANAGERS,
  knowledgeBase: ROLE_GROUPS.ALL,
  chatBot: ROLE_GROUPS.ALL,
  recentActivity: ROLE_GROUPS.MANAGERS,
};

// Widget metadata for the gallery
const WIDGET_METADATA = {
  timeline: { name: 'Ticket Timeline', description: 'Visual timeline of ticket activity and trends over time', category: CATEGORIES.ANALYTICS },
  ticketControl: { name: 'Ticket Control', description: 'Full ticket management table with search, filters, and actions', category: CATEGORIES.TICKETS },
  assignedChart: { name: 'Assigned vs Unassigned', description: 'Donut chart showing ticket assignment distribution', category: CATEGORIES.ANALYTICS },
  categoriesChart: { name: 'Ticket Categories', description: 'Category breakdown with drilldown into individual tickets', category: CATEGORIES.ANALYTICS },
  overdue: { name: 'Overdue Tickets', description: 'Tickets that have passed their SLA due date', category: CATEGORIES.TICKETS },
  escalations: { name: 'Escalations', description: 'Critical and high-priority tickets requiring attention', category: CATEGORIES.TICKETS },
  todaysActions: { name: "Today's Actions", description: 'Action items: overdue, urgent unassigned, and due today', category: CATEGORIES.TICKETS },
  topRequesters: { name: 'Top Requesters', description: 'Most active ticket requesters and their patterns', category: CATEGORIES.ANALYTICS },
  techPerformance: { name: 'Tech Performance', description: 'Technician resolution times and workload metrics (technicians see only their own)', category: CATEGORIES.PERFORMANCE },
  deletedTickets: { name: 'Deleted Tickets', description: 'Recently soft-deleted tickets with restore option', category: CATEGORIES.MANAGEMENT },
  pendingRequests: { name: 'Pending Requests', description: 'Assignment requests awaiting management approval', category: CATEGORIES.MANAGEMENT },
  responseTime: { name: 'Response Times', description: 'Update request response time analytics and trends', category: CATEGORIES.ANALYTICS },
  ringRequests: { name: 'Ring for Help', description: 'Incoming ring-for-help requests from technicians', category: CATEGORIES.MANAGEMENT },
  availableTickets: { name: 'Available Tickets', description: 'Unassigned tickets available for self-assignment', category: CATEGORIES.TICKETS },
  myAssignedTickets: { name: 'My Assigned Tickets', description: 'Tickets currently assigned to you', category: CATEGORIES.TICKETS },
  quickActions: { name: 'Quick Actions', description: 'Shortcut panel for common management operations', category: CATEGORIES.MANAGEMENT },
  statusDonut: { name: 'Status Overview', description: 'Donut chart showing ticket status distribution', category: CATEGORIES.ANALYTICS },
  priorityPie: { name: 'Priority Breakdown', description: 'Pie chart showing ticket priority distribution', category: CATEGORIES.ANALYTICS },
  ticketQueue: { name: 'Ticket Queue', description: 'Ticket queue with search, filters, and management actions', category: CATEGORIES.TICKETS },
  chatPanel: { name: 'Chat Handoff', description: 'Live customer chat handoff requests and active conversations', category: CATEGORIES.MANAGEMENT },
  createTicket: { name: 'Create a Ticket', description: 'Submit a new support ticket directly from the dashboard', category: CATEGORIES.TICKETS },
  clientTickets: { name: 'My Tickets', description: 'Your submitted tickets with status tracking', category: CATEGORIES.TICKETS },
  ticketUpdates: { name: 'Ticket Update Log', description: 'Chronological log of all updates to your tickets', category: CATEGORIES.TICKETS },
  auditHealth: { name: 'Audit Health', description: 'Real-time audit logging system health status and monitoring', category: CATEGORIES.MANAGEMENT },
  ticketTrend: { name: 'Ticket Trend', description: 'Opened vs resolved tickets over time', category: CATEGORIES.ANALYTICS },
  ticketStatus: { name: 'Ticket Status', description: 'Open ticket count with status breakdown', category: CATEGORIES.ANALYTICS },
  techResponseTime: { name: 'Tech Response Times', description: 'Average first-response time per technician with search', category: CATEGORIES.PERFORMANCE },
  knowledgeBase: { name: 'Knowledge Base', description: 'Quick access to search and browse support articles', category: CATEGORIES.TICKETS },
  chatBot: { name: 'Chat Assistant', description: 'Inline AI chat assistant for quick support conversations', category: CATEGORIES.TICKETS },
  recentActivity: { name: 'Recent Activity', description: 'Live feed of all ticket activity with ticket IDs and change details', category: CATEGORIES.MANAGEMENT },
};

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Check if a user role has permission to access a widget
 * @param {string} widgetKey - Widget identifier
 * @param {string} userRole - User role
 * @returns {boolean}
 */
function canAccessWidget(widgetKey, userRole) {
  const allowedRoles = WIDGET_PERMISSIONS[widgetKey];
  if (!allowedRoles) {
    // Unknown widget - deny access
    return false;
  }
  return allowedRoles.includes(userRole);
}

/**
 * Get all widgets accessible to a user role
 * @param {string} userRole - User role
 * @param {string} [category] - Optional category filter
 * @returns {Array} Widget definitions
 */
function getWidgetsForRole(userRole, category = null) {
  const widgets = [];
  
  for (const [key, allowedRoles] of Object.entries(WIDGET_PERMISSIONS)) {
    if (allowedRoles.includes(userRole)) {
      const metadata = WIDGET_METADATA[key];
      if (!metadata) continue;
      
      // Apply category filter if provided
      if (category && metadata.category !== category) {
        continue;
      }
      
      widgets.push({
        key,
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
      });
    }
  }
  
  return widgets;
}

/**
 * Validate that all widgets in a layout are accessible to a user role
 * @param {object} layoutData - Dashboard layout object with breakpoints  
 * @param {string} userRole - User role
 * @returns {object} { valid: boolean, deniedWidgets: string[] }
 */
export function validateLayoutWidgets(layoutData, userRole) {
  // Extract all widget keys from all breakpoints
  const widgetKeys = new Set();
  
  for (const breakpoint of ['lg', 'md', 'sm', 'xs', 'xxs']) {
    const breakpointLayout = layoutData[breakpoint];
    if (Array.isArray(breakpointLayout)) {
      breakpointLayout.forEach(item => {
        if (item.i) {
          widgetKeys.add(item.i);
        }
      });
    }
  }
  
  // Validate each widget
  const deniedWidgets = [];
  for (const key of widgetKeys) {
    if (!canAccessWidget(key, userRole)) {
      deniedWidgets.push(key);
    }
  }
  
  return {
    valid: deniedWidgets.length === 0,
    deniedWidgets,
  };
}

// ── Route Handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/widgets/available
 * Returns widgets that the authenticated user can access
 * @query {string} category - Optional category filter
 */
export const getAvailableWidgets = async (req, res) => {
  const userRole = req.user.role;
  const { category } = req.query;
  
  const widgets = getWidgetsForRole(userRole, category);
  
  res.json({
    status: 'success',
    count: widgets.length,
    data: widgets,
    userRole,
  });
};

/**
 * POST /api/widgets/validate
 * Validates if the user can access specific widgets
 * @body {string[]} widgetKeys - Array of widget keys to validate
 */
export const validateWidgets = async (req, res) => {
  const userRole = req.user.role;
  const { widgetKeys } = req.body;
  
  if (!Array.isArray(widgetKeys)) {
    throw new BadRequestError('widgetKeys must be an array');
  }
  
  const validations = widgetKeys.map(key => ({
    key,
    allowed: canAccessWidget(key, userRole),
  }));
  
  const deniedWidgets = validations.filter(v => !v.allowed);
  
  if (deniedWidgets.length > 0) {
    throw new ForbiddenError(
      `Access denied to widgets: ${deniedWidgets.map(w => w.key).join(', ')}`
    );
  }
  
  res.json({
    status: 'success',
    message: 'All widgets validated successfully',
    validations,
  });
};

/**
 * POST /api/widgets/validate-layout
 * Validates a complete dashboard layout before saving
 * @body {object} layoutData - Dashboard layout object with breakpoints
 */
export const validateLayout = async (req, res) => {
  const userRole = req.user.role;
  const { layoutData } = req.body;
  
  if (!layoutData || typeof layoutData !== 'object') {
    throw new BadRequestError('layoutData is required and must be an object');
  }
  
  // Extract all widget keys from all breakpoints
  const widgetKeys = new Set();
  
  for (const breakpoint of ['lg', 'md', 'sm', 'xs', 'xxs']) {
    const breakpointLayout = layoutData[breakpoint];
    if (Array.isArray(breakpointLayout)) {
      breakpointLayout.forEach(item => {
        if (item.i) {
          widgetKeys.add(item.i);
        }
      });
    }
  }
  
  // Validate each widget
  const deniedWidgets = [];
  for (const key of widgetKeys) {
    if (!canAccessWidget(key, userRole)) {
      deniedWidgets.push(key);
    }
  }
  
  if (deniedWidgets.length > 0) {
    throw new ForbiddenError(
      `Your role (${userRole}) does not have access to these widgets: ${deniedWidgets.join(', ')}`
    );
  }
  
  res.json({
    status: 'success',
    message: 'Layout validated successfully',
    widgetCount: widgetKeys.size,
  });
};
