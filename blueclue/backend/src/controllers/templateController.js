// src/controllers/templateController.js
import Template from '../models/Template.js';

// Template categories enum (must match database)
const TEMPLATE_CATEGORIES = ['hardware', 'software', 'access', 'network', 'account', 'general', 'other'];

// Valid priorities
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Valid ticket categories
const VALID_TICKET_CATEGORIES = ['general', 'technical', 'billing', 'account', 'feature_request', 'hardware', 'software', 'network', 'login', 'other'];

/**
 * Get all templates
 * GET /api/templates
 * Public for active templates, management sees all
 */
export const getAllTemplates = async (req, res) => {
    try {
        const { category, template_category, include_stats } = req.query;
        const isManagement = req.user && ['management', 'admin'].includes(req.user.role);
        
        const options = {
            activeOnly: !isManagement, // Only active templates for non-management
            templateCategory: template_category || null,
            category: category || null,
            includeUsageStats: include_stats === 'true' && isManagement
        };
        
        const templates = await Template.getAll(options);
        
        res.status(200).json({
            status: 'success',
            count: templates.length,
            data: templates
        });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve templates',
            error: error.message
        });
    }
};

/**
 * Get template by ID
 * GET /api/templates/:id
 */
export const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const template = await Template.getById(parseInt(id));
        
        if (!template) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        // Non-management users can only see active templates
        const isManagement = req.user && ['management', 'admin'].includes(req.user.role);
        if (!isManagement && !template.is_active) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: template
        });
    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve template',
            error: error.message
        });
    }
};

/**
 * Create a new template
 * POST /api/templates
 * Management only
 */
export const createTemplate = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can create templates'
            });
        }
        
        const {
            name,
            template_category = 'general',
            category = 'general',
            description,
            instructions,
            default_priority = 'medium',
            pre_filled_subject,
            pre_filled_description,
            common_tags = [],
            field_requirements = {},
            field_mappings,
            custom_placeholders = [],
            is_active = true,
            sort_order = 0
        } = req.body;
        
        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Template name is required'
            });
        }
        
        if (name.length > 200) {
            return res.status(400).json({
                status: 'error',
                message: 'Template name must be less than 200 characters'
            });
        }
        
        if (!TEMPLATE_CATEGORIES.includes(template_category)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid template category. Must be one of: ${TEMPLATE_CATEGORIES.join(', ')}`
            });
        }
        
        if (!VALID_TICKET_CATEGORIES.includes(category)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid ticket category. Must be one of: ${VALID_TICKET_CATEGORIES.join(', ')}`
            });
        }
        
        if (!VALID_PRIORITIES.includes(default_priority)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`
            });
        }
        
        // Validate common_tags is an array
        if (!Array.isArray(common_tags)) {
            return res.status(400).json({
                status: 'error',
                message: 'common_tags must be an array'
            });
        }
        
        // Validate custom_placeholders is an array
        if (!Array.isArray(custom_placeholders)) {
            return res.status(400).json({
                status: 'error',
                message: 'custom_placeholders must be an array'
            });
        }
        
        const template = await Template.create({
            name: name.trim(),
            template_category,
            category,
            description,
            instructions,
            default_priority,
            pre_filled_subject,
            pre_filled_description,
            common_tags,
            field_requirements,
            field_mappings,
            custom_placeholders,
            created_by: req.user.id,
            is_active,
            sort_order
        });
        
        res.status(201).json({
            status: 'success',
            message: 'Template created successfully',
            data: template
        });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create template',
            error: error.message
        });
    }
};

/**
 * Update a template
 * PATCH /api/templates/:id
 * Management only
 */
export const updateTemplate = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can update templates'
            });
        }
        
        const { id } = req.params;
        const updates = req.body;
        
        // Check if template exists
        const existing = await Template.getById(parseInt(id));
        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        // Validate fields if provided
        if (updates.name !== undefined) {
            if (!updates.name || updates.name.trim().length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Template name cannot be empty'
                });
            }
            if (updates.name.length > 200) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Template name must be less than 200 characters'
                });
            }
            updates.name = updates.name.trim();
        }
        
        if (updates.template_category && !TEMPLATE_CATEGORIES.includes(updates.template_category)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid template category. Must be one of: ${TEMPLATE_CATEGORIES.join(', ')}`
            });
        }
        
        if (updates.category && !VALID_TICKET_CATEGORIES.includes(updates.category)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid ticket category. Must be one of: ${VALID_TICKET_CATEGORIES.join(', ')}`
            });
        }
        
        if (updates.default_priority && !VALID_PRIORITIES.includes(updates.default_priority)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`
            });
        }
        
        const template = await Template.update(parseInt(id), updates);
        
        res.status(200).json({
            status: 'success',
            message: 'Template updated successfully',
            data: template
        });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update template',
            error: error.message
        });
    }
};

/**
 * Delete a template
 * DELETE /api/templates/:id
 * Management only
 */
export const deleteTemplate = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can delete templates'
            });
        }
        
        const { id } = req.params;
        
        // Check if template exists
        const existing = await Template.getById(parseInt(id));
        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        const success = await Template.delete(parseInt(id));
        
        if (success) {
            res.status(200).json({
                status: 'success',
                message: 'Template deleted successfully'
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete template'
            });
        }
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete template',
            error: error.message
        });
    }
};

/**
 * Get template categories with counts
 * GET /api/templates/categories
 */
export const getTemplateCategories = async (req, res) => {
    try {
        const categories = await Template.getCategoriesWithCounts();
        
        // Add all categories even if they have no templates
        const allCategories = TEMPLATE_CATEGORIES.map(cat => {
            const existing = categories.find(c => c.template_category === cat);
            return existing || {
                template_category: cat,
                total_count: 0,
                active_count: 0,
                total_usage: 0
            };
        });
        
        res.status(200).json({
            status: 'success',
            data: allCategories
        });
    } catch (error) {
        console.error('Get template categories error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve template categories',
            error: error.message
        });
    }
};

/**
 * Get most used templates
 * GET /api/templates/popular
 */
export const getPopularTemplates = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const templates = await Template.getMostUsed(limit);
        
        res.status(200).json({
            status: 'success',
            count: templates.length,
            data: templates
        });
    } catch (error) {
        console.error('Get popular templates error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve popular templates',
            error: error.message
        });
    }
};

/**
 * Apply template and get processed content
 * POST /api/templates/:id/apply
 */
export const applyTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { userData = {} } = req.body;
        
        const template = await Template.getById(parseInt(id));
        
        if (!template) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        if (!template.is_active) {
            return res.status(400).json({
                status: 'error',
                message: 'This template is no longer active'
            });
        }
        
        // Add current user data if authenticated
        const fullUserData = {
            ...userData,
            ...(req.user ? {
                name: `${req.user.first_name} ${req.user.last_name}`,
                first_name: req.user.first_name,
                last_name: req.user.last_name,
                email: req.user.email,
                phone: req.user.phone
            } : {})
        };
        
        // Process placeholders
        const processedSubject = Template.replacePlaceholders(template.pre_filled_subject, fullUserData);
        const processedDescription = Template.replacePlaceholders(template.pre_filled_description, fullUserData);
        
        res.status(200).json({
            status: 'success',
            data: {
                template_id: template.id,
                template_name: template.name,
                template_version: template.version,
                subject: processedSubject,
                description: processedDescription,
                priority: template.default_priority,
                category: template.category,
                common_tags: template.common_tags,
                field_requirements: template.field_requirements,
                instructions: template.instructions
            }
        });
    } catch (error) {
        console.error('Apply template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to apply template',
            error: error.message
        });
    }
};

/**
 * Record template usage
 * POST /api/templates/:id/usage
 */
export const recordTemplateUsage = async (req, res) => {
    try {
        const { id } = req.params;
        const { ticket_id, modifications_made = false } = req.body;
        
        if (!ticket_id) {
            return res.status(400).json({
                status: 'error',
                message: 'ticket_id is required'
            });
        }
        
        const template = await Template.getById(parseInt(id));
        if (!template) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        const usage = await Template.recordUsage({
            ticket_id,
            template_id: parseInt(id),
            template_version: template.version,
            applied_by: req.user.id,
            modifications_made
        });
        
        res.status(201).json({
            status: 'success',
            message: 'Template usage recorded',
            data: usage
        });
    } catch (error) {
        console.error('Record template usage error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to record template usage',
            error: error.message
        });
    }
};

/**
 * Get template version history
 * GET /api/templates/:id/versions
 * Management only
 */
export const getTemplateVersions = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can view template versions'
            });
        }
        
        const { id } = req.params;
        
        const template = await Template.getById(parseInt(id));
        if (!template) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        const versions = await Template.getVersionHistory(parseInt(id));
        
        res.status(200).json({
            status: 'success',
            data: {
                current_version: template.version,
                history: versions
            }
        });
    } catch (error) {
        console.error('Get template versions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve template versions',
            error: error.message
        });
    }
};

/**
 * Export template as JSON
 * GET /api/templates/:id/export
 * Management only
 */
export const exportTemplate = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can export templates'
            });
        }
        
        const { id } = req.params;
        const exportData = await Template.exportTemplate(parseInt(id));
        
        if (!exportData) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: exportData
        });
    } catch (error) {
        console.error('Export template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to export template',
            error: error.message
        });
    }
};

/**
 * Import template from JSON
 * POST /api/templates/import
 * Management only
 */
export const importTemplate = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can import templates'
            });
        }
        
        const templateData = req.body;
        
        // Validate required fields
        if (!templateData.name) {
            return res.status(400).json({
                status: 'error',
                message: 'Template name is required'
            });
        }
        
        const template = await Template.importTemplate(templateData, req.user.id);
        
        res.status(201).json({
            status: 'success',
            message: 'Template imported successfully',
            data: template
        });
    } catch (error) {
        console.error('Import template error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to import template',
            error: error.message
        });
    }
};

/**
 * Get template analytics
 * GET /api/analytics/template-usage
 * Management only
 */
export const getTemplateAnalytics = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can view template analytics'
            });
        }
        
        const analytics = await Template.getAnalytics();
        const categories = await Template.getCategoriesWithCounts();
        
        // Calculate summary statistics
        const totalTemplates = analytics.length;
        const activeTemplates = analytics.filter(t => t.is_active).length;
        const totalUsage = analytics.reduce((sum, t) => sum + parseInt(t.usage_count || 0), 0);
        const avgResolutionTime = analytics.length > 0
            ? analytics.reduce((sum, t) => sum + parseFloat(t.avg_resolution_hours || 0), 0) / analytics.length
            : 0;
        
        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    total_templates: totalTemplates,
                    active_templates: activeTemplates,
                    inactive_templates: totalTemplates - activeTemplates,
                    total_usage: totalUsage,
                    avg_resolution_hours: avgResolutionTime.toFixed(2)
                },
                by_category: categories,
                templates: analytics
            }
        });
    } catch (error) {
        console.error('Get template analytics error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve template analytics',
            error: error.message
        });
    }
};

/**
 * Toggle template active status
 * PATCH /api/templates/:id/toggle
 * Management only
 */
export const toggleTemplateStatus = async (req, res) => {
    try {
        // Check authorization
        if (!req.user || !['management', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only management and admin users can toggle template status'
            });
        }
        
        const { id } = req.params;
        
        const existing = await Template.getById(parseInt(id));
        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }
        
        const template = await Template.update(parseInt(id), {
            is_active: !existing.is_active
        });
        
        res.status(200).json({
            status: 'success',
            message: `Template ${template.is_active ? 'activated' : 'deactivated'} successfully`,
            data: template
        });
    } catch (error) {
        console.error('Toggle template status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to toggle template status',
            error: error.message
        });
    }
};
