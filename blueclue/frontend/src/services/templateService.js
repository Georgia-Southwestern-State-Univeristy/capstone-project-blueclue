// Template Service - API calls for ticket template operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Request timeout in milliseconds (10 seconds)
const REQUEST_TIMEOUT = 10000;

/**
 * Get authentication headers
 */
const getAuthHeaders = () => {
    const token = localStorage.getItem('blueclue_token');
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
};

/**
 * Make a fetch request with timeout and error handling
 */
const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

/**
 * Handle API response and errors
 */
const handleResponse = async (response, errorMessage) => {
    if (!response.ok) {
        let errorData = {};
        try {
            errorData = await response.json();
        } catch {
            // Response wasn't JSON
        }
        
        const message = errorData.message || `${errorMessage}: ${response.status}`;
        console.error(`API Error [${response.status}]:`, message, errorData);
        throw new Error(message);
    }
    
    return response.json();
};

/**
 * Get all templates
 * @param {Object} options - Filter options
 * @param {string} options.category - Filter by ticket category
 * @param {string} options.templateCategory - Filter by template category
 * @param {boolean} options.includeStats - Include usage statistics (management only)
 * @returns {Promise<Array>} Array of templates
 */
export const getAllTemplates = async (options = {}) => {
    try {
        const params = new URLSearchParams();
        if (options.category) params.append('category', options.category);
        if (options.templateCategory) params.append('template_category', options.templateCategory);
        if (options.includeStats) params.append('include_stats', 'true');
        
        const queryString = params.toString();
        const url = `${API_BASE_URL}/templates${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetchWithTimeout(url, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to fetch templates');
        return result.data || [];
    } catch (error) {
        console.error('Get templates error:', error);
        throw new Error('Failed to load templates. Please try again.');
    }
};

/**
 * Get template by ID
 * @param {number} id - Template ID
 * @returns {Promise<Object>} Template object
 */
export const getTemplateById = async (id) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}`, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to fetch template');
        return result.data;
    } catch (error) {
        console.error('Get template error:', error);
        throw new Error('Failed to load template. Please try again.');
    }
};

/**
 * Get template categories with counts
 * @returns {Promise<Array>} Array of categories with counts
 */
export const getTemplateCategories = async () => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/categories`, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to fetch template categories');
        return result.data || [];
    } catch (error) {
        console.error('Get template categories error:', error);
        throw new Error('Failed to load template categories. Please try again.');
    }
};

/**
 * Get most popular templates
 * @param {number} limit - Number of templates to return
 * @returns {Promise<Array>} Array of popular templates
 */
export const getPopularTemplates = async (limit = 10) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/popular?limit=${limit}`, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to fetch popular templates');
        return result.data || [];
    } catch (error) {
        console.error('Get popular templates error:', error);
        throw new Error('Failed to load popular templates. Please try again.');
    }
};

/**
 * Create a new template (management only)
 * @param {Object} templateData - Template data
 * @returns {Promise<Object>} Created template
 */
export const createTemplate = async (templateData) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(templateData),
        });
        
        const result = await handleResponse(response, 'Failed to create template');
        return result.data;
    } catch (error) {
        console.error('Create template error:', error);
        throw error;
    }
};

/**
 * Update a template (management only)
 * @param {number} id - Template ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated template
 */
export const updateTemplate = async (id, updates) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates),
        });
        
        const result = await handleResponse(response, 'Failed to update template');
        return result.data;
    } catch (error) {
        console.error('Update template error:', error);
        throw error;
    }
};

/**
 * Delete a template (management only)
 * @param {number} id - Template ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteTemplate = async (id) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        
        await handleResponse(response, 'Failed to delete template');
        return true;
    } catch (error) {
        console.error('Delete template error:', error);
        throw error;
    }
};

/**
 * Toggle template active status (management only)
 * @param {number} id - Template ID
 * @returns {Promise<Object>} Updated template
 */
export const toggleTemplateStatus = async (id) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}/toggle`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to toggle template status');
        return result.data;
    } catch (error) {
        console.error('Toggle template status error:', error);
        throw error;
    }
};

/**
 * Apply a template and get processed content with placeholders replaced
 * @param {number} id - Template ID
 * @param {Object} userData - User data for placeholder replacement
 * @returns {Promise<Object>} Processed template data
 */
export const applyTemplate = async (id, userData = {}) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}/apply`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userData }),
        });
        
        const result = await handleResponse(response, 'Failed to apply template');
        return result.data;
    } catch (error) {
        console.error('Apply template error:', error);
        throw new Error('Failed to apply template. Please try again.');
    }
};

/**
 * Record template usage when creating a ticket
 * @param {number} templateId - Template ID
 * @param {number} ticketId - Ticket ID
 * @param {boolean} modificationsM made - Whether the user modified the template content
 * @returns {Promise<Object>} Usage record
 */
export const recordTemplateUsage = async (templateId, ticketId, modificationsMade = false) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${templateId}/usage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                ticket_id: ticketId,
                modifications_made: modificationsMade
            }),
        });
        
        const result = await handleResponse(response, 'Failed to record template usage');
        return result.data;
    } catch (error) {
        // Don't throw - usage tracking is non-critical
        console.error('Record template usage error:', error);
        return null;
    }
};

/**
 * Get template version history (management only)
 * @param {number} id - Template ID
 * @returns {Promise<Object>} Version history
 */
export const getTemplateVersions = async (id) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}/versions`, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to fetch template versions');
        return result.data;
    } catch (error) {
        console.error('Get template versions error:', error);
        throw error;
    }
};

/**
 * Export template as JSON (management only)
 * @param {number} id - Template ID
 * @returns {Promise<Object>} Template export data
 */
export const exportTemplate = async (id) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/${id}/export`, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to export template');
        return result.data;
    } catch (error) {
        console.error('Export template error:', error);
        throw error;
    }
};

/**
 * Import template from JSON (management only)
 * @param {Object} templateData - Template data to import
 * @returns {Promise<Object>} Imported template
 */
export const importTemplate = async (templateData) => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/templates/import`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(templateData),
        });
        
        const result = await handleResponse(response, 'Failed to import template');
        return result.data;
    } catch (error) {
        console.error('Import template error:', error);
        throw error;
    }
};

/**
 * Get template usage analytics (management only)
 * @returns {Promise<Object>} Template analytics data
 */
export const getTemplateAnalytics = async () => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/analytics/template-usage`, {
            headers: getAuthHeaders(),
        });
        
        const result = await handleResponse(response, 'Failed to fetch template analytics');
        return result.data;
    } catch (error) {
        console.error('Get template analytics error:', error);
        throw error;
    }
};

/**
 * Template category display names and colors
 */
export const TEMPLATE_CATEGORIES = {
    hardware: { label: 'Hardware', color: '#ef4444', icon: '' },
    software: { label: 'Software', color: '#3b82f6', icon: '' },
    access: { label: 'Access & Permissions', color: '#8b5cf6', icon: '' },
    network: { label: 'Network', color: '#10b981', icon: '' },
    account: { label: 'Account', color: '#f59e0b', icon: '' },
    general: { label: 'General', color: '#6b7280', icon: '' },
    other: { label: 'Other', color: '#71717a', icon: '' }
};

/**
 * Priority display names and colors
 */
export const PRIORITY_OPTIONS = {
    low: { label: 'Low', color: '#3b82f6' },
    medium: { label: 'Medium', color: '#f59e0b' },
    high: { label: 'High', color: '#f97316' },
    critical: { label: 'Critical', color: '#ef4444' }
};

/**
 * Ticket category options
 */
export const TICKET_CATEGORIES = {
    general: 'General',
    technical: 'Technical',
    billing: 'Billing',
    account: 'Account',
    feature_request: 'Feature Request',
    hardware: 'Hardware',
    software: 'Software',
    network: 'Network',
    login: 'Login',
    other: 'Other'
};
