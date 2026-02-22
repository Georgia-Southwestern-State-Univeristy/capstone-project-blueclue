// src/models/AIConfiguration.js
import pool from '../config/database.js';

class AIConfiguration {
    /**
     * Get configuration by key
     * @param {string} key - Configuration key
     * @returns {Promise<Object|null>} Configuration object
     */
    static async getByKey(key) {
        const query = `
            SELECT * FROM ai_configuration
            WHERE config_key = $1
        `;
        
        const result = await pool.query(query, [key]);
        return result.rows[0] || null;
    }

    /**
     * Get all configurations
     * @returns {Promise<Array>} All configuration objects
     */
    static async getAll() {
        const query = `
            SELECT ac.*, u.username as updated_by_username
            FROM ai_configuration ac
            LEFT JOIN users u ON ac.updated_by = u.id
            ORDER BY ac.config_key
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Update configuration
     * @param {string} key - Configuration key
     * @param {Object} value - Configuration value (will be converted to JSONB)
     * @param {number} userId - ID of user making the update
     * @returns {Promise<Object>} Updated configuration
     */
    static async update(key, value, userId) {
        const query = `
            UPDATE ai_configuration
            SET config_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
            WHERE config_key = $3
            RETURNING *
        `;
        
        const result = await pool.query(query, [JSON.stringify(value), userId, key]);
        
        if (result.rows.length === 0) {
            throw new Error(`Configuration key '${key}' not found`);
        }
        
        return result.rows[0];
    }

    /**
     * Create new configuration
     * @param {Object} data - { config_key, config_value, description, updated_by }
     * @returns {Promise<Object>} Created configuration
     */
    static async create(data) {
        const { config_key, config_value, description, updated_by } = data;

        const query = `
            INSERT INTO ai_configuration (config_key, config_value, description, updated_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const values = [
            config_key,
            JSON.stringify(config_value),
            description || null,
            updated_by || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete configuration
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>} True if deleted
     */
    static async delete(key) {
        const query = `DELETE FROM ai_configuration WHERE config_key = $1`;
        const result = await pool.query(query, [key]);
        return result.rowCount > 0;
    }

    /**
     * Get priority weights configuration
     * @returns {Promise<Object>} Priority weights config
     */
    static async getPriorityWeights() {
        const config = await this.getByKey('priority_weights');
        return config ? config.config_value : null;
    }

    /**
     * Update priority weights
     * @param {Object} weights - New weight configuration
     * @param {number} userId - ID of user making the update
     * @returns {Promise<Object>} Updated configuration
     */
    static async updatePriorityWeights(weights, userId) {
        return await this.update('priority_weights', weights, userId);
    }

    /**
     * Get AI analytics configuration
     * @returns {Promise<Object>} Analytics config
     */
    static async getAnalyticsConfig() {
        const config = await this.getByKey('ai_analytics');
        return config ? config.config_value : null;
    }

    /**
     * Get configuration audit trail
     * @param {string} key - Configuration key
     * @param {number} limit - Number of records to return
     * @returns {Promise<Array>} Configuration history
     */
    static async getHistory(key, limit = 50) {
        // Note: This would require a separate audit table in a production system
        // For now, we just return the current configuration
        const config = await this.getByKey(key);
        return config ? [config] : [];
    }
}

export default AIConfiguration;
