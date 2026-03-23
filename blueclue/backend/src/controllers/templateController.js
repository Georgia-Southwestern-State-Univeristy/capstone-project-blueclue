// src/controllers/templateController.js
import Template from '../models/Template.js';
import { BadRequestError, ForbiddenError, NotFoundError, InternalServerError } from '../middleware/errorHandler.js';

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
    const { category, template_category, include_stats } = req.query;
    const isManagement = req.user && ['management', 'admin'].includes(req.user.role);

    const options = {
        activeOnly: !isManagement,
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
};

/**
 * Get template by ID
 * GET /api/templates/:id
 */
export const getTemplateById = async (req, res) => {
    const { id } = req.params;

    const template = await Template.getById(parseInt(id));
    if (!template) throw new NotFoundError('Template not found');

    const isManagement = req.user && ['management', 'admin'].includes(req.user.role);
    if (!isManagement && !template.is_active) throw new NotFoundError('Template not found');

    res.status(200).json({
        status: 'success',
        data: template
    });
};

/**
 * Create a new template
 * POST /api/templates
 * Management only
 */
export const createTemplate = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can create templates');
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

    if (!name || name.trim().length === 0) throw new BadRequestError('Template name is required');
    if (name.length > 200) throw new BadRequestError('Template name must be less than 200 characters');
    if (!TEMPLATE_CATEGORIES.includes(template_category)) {
        throw new BadRequestError(`Invalid template category. Must be one of: ${TEMPLATE_CATEGORIES.join(', ')}`);
    }
    if (!VALID_TICKET_CATEGORIES.includes(category)) {
        throw new BadRequestError(`Invalid ticket category. Must be one of: ${VALID_TICKET_CATEGORIES.join(', ')}`);
    }
    if (!VALID_PRIORITIES.includes(default_priority)) {
        throw new BadRequestError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    if (!Array.isArray(common_tags)) throw new BadRequestError('common_tags must be an array');
    if (!Array.isArray(custom_placeholders)) throw new BadRequestError('custom_placeholders must be an array');

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
};

/**
 * Update a template
 * PATCH /api/templates/:id
 * Management only
 */
export const updateTemplate = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can update templates');
    }

    const { id } = req.params;
    const updates = req.body;

    const existing = await Template.getById(parseInt(id));
    if (!existing) throw new NotFoundError('Template not found');

    if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
            throw new BadRequestError('Template name cannot be empty');
        }
        if (updates.name.length > 200) {
            throw new BadRequestError('Template name must be less than 200 characters');
        }
        updates.name = updates.name.trim();
    }

    if (updates.template_category && !TEMPLATE_CATEGORIES.includes(updates.template_category)) {
        throw new BadRequestError(`Invalid template category. Must be one of: ${TEMPLATE_CATEGORIES.join(', ')}`);
    }

    if (updates.category && !VALID_TICKET_CATEGORIES.includes(updates.category)) {
        throw new BadRequestError(`Invalid ticket category. Must be one of: ${VALID_TICKET_CATEGORIES.join(', ')}`);
    }

    if (updates.default_priority && !VALID_PRIORITIES.includes(updates.default_priority)) {
        throw new BadRequestError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }

    const template = await Template.update(parseInt(id), updates);

    res.status(200).json({
        status: 'success',
        message: 'Template updated successfully',
        data: template
    });
};

/**
 * Delete a template
 * DELETE /api/templates/:id
 * Management only
 */
export const deleteTemplate = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can delete templates');
    }

    const { id } = req.params;

    const existing = await Template.getById(parseInt(id));
    if (!existing) throw new NotFoundError('Template not found');

    const success = await Template.delete(parseInt(id));

    if (success) {
        res.status(200).json({
            status: 'success',
            message: 'Template deleted successfully'
        });
    } else {
        throw new InternalServerError('Failed to delete template');
    }
};

/**
 * Get template categories with counts
 * GET /api/templates/categories
 */
export const getTemplateCategories = async (req, res) => {
    const categories = await Template.getCategoriesWithCounts();

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
};

/**
 * Get most used templates
 * GET /api/templates/popular
 */
export const getPopularTemplates = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const templates = await Template.getMostUsed(limit);

    res.status(200).json({
        status: 'success',
        count: templates.length,
        data: templates
    });
};

/**
 * Apply template and get processed content
 * POST /api/templates/:id/apply
 */
export const applyTemplate = async (req, res) => {
    const { id } = req.params;
    const { userData = {} } = req.body;

    const template = await Template.getById(parseInt(id));
    if (!template) throw new NotFoundError('Template not found');
    if (!template.is_active) throw new BadRequestError('This template is no longer active');

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
};

/**
 * Record template usage
 * POST /api/templates/:id/usage
 */
export const recordTemplateUsage = async (req, res) => {
    const { id } = req.params;
    const { ticket_id, modifications_made = false } = req.body;

    if (!ticket_id) throw new BadRequestError('ticket_id is required');

    const template = await Template.getById(parseInt(id));
    if (!template) throw new NotFoundError('Template not found');

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
};

/**
 * Get template version history
 * GET /api/templates/:id/versions
 * Management only
 */
export const getTemplateVersions = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can view template versions');
    }

    const { id } = req.params;

    const template = await Template.getById(parseInt(id));
    if (!template) throw new NotFoundError('Template not found');

    const versions = await Template.getVersionHistory(parseInt(id));

    res.status(200).json({
        status: 'success',
        data: {
            current_version: template.version,
            history: versions
        }
    });
};

/**
 * Restore template to a previous version
 * POST /api/templates/:id/restore/:version
 * Management only
 */
export const restoreTemplateVersion = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can restore template versions');
    }

    const { id, version } = req.params;
    const { reason } = req.body;

    const template = await Template.getById(parseInt(id));
    if (!template) throw new NotFoundError('Template not found');

    const restoredTemplate = await Template.restoreVersion(
        parseInt(id), 
        parseInt(version),
        req.user.id
    );

    res.status(200).json({
        status: 'success',
        message: `Template restored to version ${version}`,
        data: restoredTemplate
    });
};

/**
 * Export template as JSON
 * GET /api/templates/:id/export
 * Management only
 */
export const exportTemplate = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can export templates');
    }

    const { id } = req.params;
    const exportData = await Template.exportTemplate(parseInt(id));

    if (!exportData) throw new NotFoundError('Template not found');

    res.status(200).json({
        status: 'success',
        data: exportData
    });
};

/**
 * Import template from JSON
 * POST /api/templates/import
 * Management only
 */
export const importTemplate = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can import templates');
    }

    const templateData = req.body;
    if (!templateData.name) throw new BadRequestError('Template name is required');

    const template = await Template.importTemplate(templateData, req.user.id);

    res.status(201).json({
        status: 'success',
        message: 'Template imported successfully',
        data: template
    });
};

/**
 * Get template analytics
 * GET /api/analytics/template-usage
 * Management only
 */
export const getTemplateAnalytics = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can view template analytics');
    }

    const analytics = await Template.getAnalytics();
    const categories = await Template.getCategoriesWithCounts();

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
};

/**
 * Toggle template active status
 * PATCH /api/templates/:id/toggle
 * Management only
 */
export const toggleTemplateStatus = async (req, res) => {
    if (!req.user || !['management', 'admin'].includes(req.user.role)) {
        throw new ForbiddenError('Only management and admin users can toggle template status');
    }

    const { id } = req.params;

    const existing = await Template.getById(parseInt(id));
    if (!existing) throw new NotFoundError('Template not found');

    const template = await Template.update(parseInt(id), {
        is_active: !existing.is_active
    });

    res.status(200).json({
        status: 'success',
        message: `Template ${template.is_active ? 'activated' : 'deactivated'} successfully`,
        data: template
    });
};
