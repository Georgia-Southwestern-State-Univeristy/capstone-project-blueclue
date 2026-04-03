// src/models/Template.js
import pool from '../config/database.js';

class Template {
    /**
     * Create a new ticket template
     * @param {Object} templateData - Template data
     * @returns {Promise<Object>} Created template
     */
    static async create({
        name,
        template_category = 'general',
        category = 'general',
        description = null,
        instructions = null,
        default_priority = 'medium',
        pre_filled_subject = null,
        pre_filled_description = null,
        common_tags = [],
        field_requirements = {},
        field_mappings = null,
        custom_placeholders = [],
        created_by,
        is_active = true,
        sort_order = 0
    }) {
        const query = `
            INSERT INTO ticket_templates (
                name, template_category, category, description, instructions,
                default_priority, pre_filled_subject, pre_filled_description,
                common_tags, field_requirements, field_mappings, custom_placeholders,
                created_by, is_active, sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;
        
        const values = [
            name,
            template_category,
            category,
            description,
            instructions,
            default_priority,
            pre_filled_subject,
            pre_filled_description,
            JSON.stringify(common_tags),
            JSON.stringify(field_requirements),
            field_mappings ? JSON.stringify(field_mappings) : null,
            JSON.stringify(custom_placeholders),
            created_by,
            is_active,
            sort_order
        ];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get all templates with optional filtering
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} Array of templates
     */
    static async getAll({ 
        activeOnly = false, 
        templateCategory = null,
        category = null,
        includeUsageStats = false 
    } = {}) {
        let query;
        const params = [];
        let paramCounter = 1;
        
        if (includeUsageStats) {
            query = `
                SELECT 
                    t.*,
                    u.first_name || ' ' || u.last_name as created_by_name,
                    COALESCE(
                        (SELECT COUNT(*) FROM ticket_template_usage ttu WHERE ttu.template_id = t.id),
                        0
                    ) as total_uses,
                    COALESCE(
                        (SELECT AVG(EXTRACT(EPOCH FROM (tk.resolved_at - tk.created_at)) / 3600)
                         FROM ticket_template_usage ttu
                         JOIN tickets tk ON ttu.ticket_id = tk.id
                         WHERE ttu.template_id = t.id 
                         AND tk.status IN ('resolved', 'closed')
                         AND tk.resolved_at IS NOT NULL),
                        0
                    ) as avg_resolution_hours
                FROM ticket_templates t
                LEFT JOIN users u ON t.created_by = u.id
                WHERE 1=1
            `;
        } else {
            query = `
                SELECT 
                    t.*,
                    u.first_name || ' ' || u.last_name as created_by_name
                FROM ticket_templates t
                LEFT JOIN users u ON t.created_by = u.id
                WHERE 1=1
            `;
        }
        
        if (activeOnly) {
            query += ` AND t.is_active = true`;
        }
        
        if (templateCategory) {
            query += ` AND t.template_category = $${paramCounter}`;
            params.push(templateCategory);
            paramCounter++;
        }
        
        if (category) {
            query += ` AND t.category = $${paramCounter}`;
            params.push(category);
            paramCounter++;
        }
        
        query += ` ORDER BY t.sort_order ASC, t.usage_count DESC, t.name ASC`;
        
        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Get template by ID
     * @param {number} id - Template ID
     * @returns {Promise<Object|null>} Template or null
     */
    static async getById(id) {
        const query = `
            SELECT 
                t.*,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM ticket_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = $1
        `;
        
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Update a template
     * @param {number} id - Template ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object|null>} Updated template or null
     */
    static async update(id, updates) {
        const allowedFields = [
            'name', 'template_category', 'category', 'description', 'instructions',
            'default_priority', 'pre_filled_subject', 'pre_filled_description',
            'common_tags', 'field_requirements', 'field_mappings', 'custom_placeholders',
            'is_active', 'sort_order'
        ];
        
        const setClauses = [];
        const values = [];
        let paramCounter = 1;
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = $${paramCounter}`);
                // JSON fields need to be stringified
                if (['common_tags', 'field_requirements', 'field_mappings', 'custom_placeholders'].includes(key)) {
                    values.push(value ? JSON.stringify(value) : null);
                } else {
                    values.push(value);
                }
                paramCounter++;
            }
        }
        
        if (setClauses.length === 0) {
            return this.getById(id);
        }
        
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `
            UPDATE ticket_templates 
            SET ${setClauses.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        return result.rows[0] || null;
    }

    /**
     * Delete a template (soft delete by deactivating)
     * @param {number} id - Template ID
     * @returns {Promise<boolean>} Success status
     */
    static async delete(id) {
        const query = `
            DELETE FROM ticket_templates WHERE id = $1 RETURNING id
        `;
        
        const result = await pool.query(query, [id]);
        return result.rows.length > 0;
    }

    /**
     * Record template usage when a ticket is created with a template
     * @param {Object} usageData - Usage tracking data
     * @returns {Promise<Object>} Usage record
     */
    static async recordUsage({ ticket_id, template_id, template_version, applied_by, modifications_made = false }) {
        const query = `
            INSERT INTO ticket_template_usage (
                ticket_id, template_id, template_version, applied_by, modifications_made
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (ticket_id) DO UPDATE
            SET template_id = $2, template_version = $3, applied_by = $4, 
                modifications_made = $5, applied_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            ticket_id, template_id, template_version, applied_by, modifications_made
        ]);
        return result.rows[0];
    }

    /**
     * Get template version history
     * @param {number} templateId - Template ID
     * @returns {Promise<Array>} Version history
     */
    static async getVersionHistory(templateId) {
        const query = `
            SELECT 
                tv.*,
                u.first_name || ' ' || u.last_name as changed_by_name
            FROM template_versions tv
            LEFT JOIN users u ON tv.changed_by = u.id
            WHERE tv.template_id = $1
            ORDER BY tv.version DESC
        `;
        
        const result = await pool.query(query, [templateId]);
        return result.rows;
    }

    /**
     * Restore a template to a specific version
     * @param {number} templateId - Template ID
     * @param {number} version - Version number to restore
     * @param {number} restoredBy - User ID performing the restore
     * @returns {Promise<Object>} Restored template
     */
    static async restoreVersion(templateId, version, restoredBy) {
        // Get the specific version data
        const versionQuery = `
            SELECT * FROM template_versions
            WHERE template_id = $1 AND version = $2
        `;
        const versionResult = await pool.query(versionQuery, [templateId, version]);
        
        if (versionResult.rows.length === 0) {
            throw new Error(`Version ${version} not found for template ${templateId}`);
        }
        
        const versionData = versionResult.rows[0];
        
        // Update the template with the version data
        // This will automatically create a new version via the trigger
        const updateQuery = `
            UPDATE ticket_templates
            SET 
                name = $1,
                template_category = $2,
                category = $3,
                description = $4,
                instructions = $5,
                default_priority = $6,
                pre_filled_subject = $7,
                pre_filled_description = $8,
                common_tags = $9,
                field_requirements = $10,
                field_mappings = $11,
                custom_placeholders = $12,
                updated_at = NOW()
            WHERE id = $13
            RETURNING *
        `;
        
        const values = [
            versionData.name,
            versionData.template_category,
            versionData.category,
            versionData.description,
            versionData.instructions,
            versionData.default_priority,
            versionData.pre_filled_subject,
            versionData.pre_filled_description,
            JSON.stringify(versionData.common_tags),
            JSON.stringify(versionData.field_requirements),
            JSON.stringify(versionData.field_mappings),
            JSON.stringify(versionData.custom_placeholders),
            templateId
        ];
        
        const result = await pool.query(updateQuery, values);
        return result.rows[0];
    }

    /**
     * Get template analytics
     * @returns {Promise<Array>} Analytics data
     */
    static async getAnalytics() {
        const query = `
            SELECT 
                t.id,
                t.name,
                t.template_category,
                t.category,
                t.is_active,
                t.usage_count,
                t.last_used_at,
                t.created_at,
                COALESCE(
                    (SELECT AVG(EXTRACT(EPOCH FROM (tk.resolved_at - tk.created_at)) / 3600)
                     FROM ticket_template_usage ttu
                     JOIN tickets tk ON ttu.ticket_id = tk.id
                     WHERE ttu.template_id = t.id 
                     AND tk.status IN ('resolved', 'closed')
                     AND tk.resolved_at IS NOT NULL),
                    0
                ) as avg_resolution_hours,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM ticket_template_usage ttu
                     JOIN tickets tk ON ttu.ticket_id = tk.id
                     WHERE ttu.template_id = t.id 
                     AND tk.status IN ('resolved', 'closed')),
                    0
                ) as resolved_tickets,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM ticket_template_usage ttu
                     JOIN tickets tk ON ttu.ticket_id = tk.id
                     WHERE ttu.template_id = t.id 
                     AND tk.status NOT IN ('resolved', 'closed', 'cancelled')),
                    0
                ) as open_tickets,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM ticket_templates t
            LEFT JOIN users u ON t.created_by = u.id
            ORDER BY t.usage_count DESC, t.name ASC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get most used templates
     * @param {number} limit - Number of templates to return
     * @returns {Promise<Array>} Most used templates
     */
    static async getMostUsed(limit = 10) {
        const query = `
            SELECT 
                t.*,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM ticket_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.is_active = true
            ORDER BY t.usage_count DESC, t.last_used_at DESC NULLS LAST
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get template usage by ticket ID
     * @param {number} ticketId - Ticket ID
     * @returns {Promise<Object|null>} Template usage record with template details
     */
    static async getUsageByTicketId(ticketId) {
        const query = `
            SELECT 
                ttu.*,
                t.name as template_name,
                t.template_category,
                t.category as template_ticket_category
            FROM ticket_template_usage ttu
            JOIN ticket_templates t ON ttu.template_id = t.id
            WHERE ttu.ticket_id = $1
        `;
        
        const result = await pool.query(query, [ticketId]);
        return result.rows[0] || null;
    }

    /**
     * Export template as JSON
     * @param {number} id - Template ID
     * @returns {Promise<Object|null>} Template data for export
     */
    static async exportTemplate(id) {
        const template = await this.getById(id);
        if (!template) return null;
        
        // Remove internal fields for export
        const { 
            id: _id, 
            created_by, 
            created_at, 
            updated_at, 
            usage_count, 
            last_used_at,
            created_by_name,
            ...exportData 
        } = template;
        
        return {
            ...exportData,
            exported_at: new Date().toISOString(),
            export_version: '1.0'
        };
    }

    /**
     * Import template from JSON
     * @param {Object} templateData - Template data from export
     * @param {number} userId - User performing import
     * @returns {Promise<Object>} Imported template
     */
    static async importTemplate(templateData, userId) {
        // Remove export metadata
        const { exported_at, export_version, ...importData } = templateData;
        
        return this.create({
            ...importData,
            created_by: userId,
            usage_count: 0,
            version: 1
        });
    }

    /**
     * Get template categories with counts
     * @returns {Promise<Array>} Categories with template counts
     */
    static async getCategoriesWithCounts() {
        const query = `
            SELECT 
                template_category,
                COUNT(*) as total_count,
                COUNT(*) FILTER (WHERE is_active = true) as active_count,
                SUM(usage_count) as total_usage
            FROM ticket_templates
            GROUP BY template_category
            ORDER BY total_usage DESC NULLS LAST, template_category ASC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Replace placeholders in template content
     * @param {string} content - Content with placeholders
     * @param {Object} userData - User data for replacement
     * @returns {string} Content with placeholders replaced
     */
    static replacePlaceholders(content, userData = {}) {
        if (!content) return content;
        
        const now = new Date();
        const defaultReplacements = {
            '{{user_name}}': userData.name || userData.first_name && userData.last_name 
                ? `${userData.first_name} ${userData.last_name}` 
                : '[Your Name]',
            '{{user_email}}': userData.email || '[Your Email]',
            '{{user_phone}}': userData.phone || '[Your Phone]',
            '{{date}}': now.toLocaleDateString(),
            '{{time}}': now.toLocaleTimeString(),
            '{{datetime}}': now.toLocaleString(),
        };
        
        let result = content;
        
        // Replace default placeholders
        for (const [placeholder, value] of Object.entries(defaultReplacements)) {
            result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        
        // Replace custom placeholders from userData
        if (userData.custom) {
            for (const [key, value] of Object.entries(userData.custom)) {
                const placeholder = `{{${key}}}`;
                result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            }
        }
        
        return result;
    }
}

export default Template;
