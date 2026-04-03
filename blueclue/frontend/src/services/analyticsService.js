// Analytics Service - API calls for analytics dashboard operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get authentication headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

/**
 * Build query string from parameters, filtering out undefined/null values
 */
const buildQueryString = (params) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value);
    }
  });
  return queryParams.toString();
};

/**
 * Handle API response
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// ============================================================================
// Resolution Time Metrics
// ============================================================================

/**
 * Get resolution time metrics
 * @param {Object} params - { startDate, endDate, preset, category, techId }
 */
export const getResolutionTimeMetrics = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/resolution-time?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Ticket Volume Metrics
// ============================================================================

/**
 * Get ticket volume metrics
 * @param {Object} params - { startDate, endDate, preset, category }
 */
export const getTicketVolumeMetrics = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/ticket-volume?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Technician Performance
// ============================================================================

/**
 * Get technician performance metrics
 * @param {Object} params - { startDate, endDate, preset, techId }
 */
export const getTechPerformanceMetrics = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/tech-performance-dashboard?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Category Analysis
// ============================================================================

/**
 * Get category analysis 
 * @param {Object} params - { startDate, endDate, preset }
 */
export const getCategoryAnalysis = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/categories-dashboard?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// SLA Compliance
// ============================================================================

/**
 * Get SLA compliance metrics
 * @param {Object} params - { startDate, endDate, preset, category }
 */
export const getSLAComplianceMetrics = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/sla-compliance?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Additional Metrics
// ============================================================================

/**
 * Get additional metrics (reopen rate, cancellation, etc.)
 * @param {Object} params - { startDate, endDate, preset }
 */
export const getAdditionalMetrics = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/additional-metrics?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Dashboard Summary
// ============================================================================

/**
 * Get complete dashboard summary
 * @param {Object} params - { startDate, endDate, preset }
 */
export const getDashboardSummary = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/dashboard-summary?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Export
// ============================================================================

/**
 * Export analytics data
 * @param {Object} params - { format, type, startDate, endDate, preset }
 */
export const exportAnalytics = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/export?${query}`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Export failed');
  }
  
  // Return blob for download
  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : `analytics-export.${params.format || 'csv'}`;
  
  return { blob, filename };
};

/**
 * Trigger download of exported analytics
 */
export const downloadAnalytics = async (params = {}) => {
  const { blob, filename } = await exportAnalytics(params);
  
  // Create download link
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear analytics cache
 */
export const clearAnalyticsCache = async () => {
  const response = await fetch(`${API_BASE_URL}/analytics/cache/clear`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Drill-Down / Filtered Tickets
// ============================================================================

/**
 * Get tickets matching filter criteria for drill-down
 * @param {Object} params - { startDate, endDate, preset, category, priority, status, techId, slaBreach, page, limit }
 */
export const getTicketsByFilter = async (params = {}) => {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/analytics/tickets-by-filter?${query}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// ============================================================================
// Existing Analytics Endpoints (for compatibility)
// ============================================================================

/**
 * Get assignment stats
 */
export const getAssignmentStats = async () => {
  const response = await fetch(`${API_BASE_URL}/analytics/assignment-stats`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

/**
 * Get category breakdown
 */
export const getCategoryBreakdown = async () => {
  const response = await fetch(`${API_BASE_URL}/analytics/category-breakdown`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

/**
 * Get tech workload
 */
export const getTechWorkload = async () => {
  const response = await fetch(`${API_BASE_URL}/analytics/tech-workload`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

/**
 * Get reopen analytics
 * @param {number} days - Number of days to analyze
 */
export const getReopenAnalytics = async (days = 30) => {
  const response = await fetch(`${API_BASE_URL}/analytics/reopens?days=${days}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

/**
 * Get collaboration analytics
 * @param {number} days - Number of days to analyze
 */
export const getCollaborationAnalytics = async (days = 30) => {
  const response = await fetch(`${API_BASE_URL}/analytics/collaboration?days=${days}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

/**
 * Get all recent ticket activity (all change types) for the activity widget
 * @param {number} limit - Max entries (default 50)
 */
export const getRecentTicketActivity = async (limit = 50) => {
  const response = await fetch(`${API_BASE_URL}/analytics/recent-activity?limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

export default {
  getResolutionTimeMetrics,
  getTicketVolumeMetrics,
  getTechPerformanceMetrics,
  getCategoryAnalysis,
  getSLAComplianceMetrics,
  getAdditionalMetrics,
  getDashboardSummary,
  exportAnalytics,
  downloadAnalytics,
  clearAnalyticsCache,
  getTicketsByFilter,
  getAssignmentStats,
  getCategoryBreakdown,
  getTechWorkload,
  getReopenAnalytics,
  getCollaborationAnalytics,
  getRecentTicketActivity
};
