// src/models/MLFeedback.js
// Handles storage and retrieval of user feedback on AI predictions.

import pool from '../config/database.js';

class MLFeedback {
    /**
     * Record that a user accepted or overrode an AI prediction.
     */
    static async create({
        ticket_id,
        classification_id = null,
        ai_category = null,
        ai_priority = null,
        ai_confidence = null,
        user_category = null,
        user_priority = null,
        category_overridden = false,
        priority_overridden = false,
        override_reason = null,
        user_id = null,
    }) {
        const query = `
            INSERT INTO ml_prediction_feedback (
                ticket_id, classification_id,
                ai_category, ai_priority, ai_confidence,
                user_category, user_priority,
                category_overridden, priority_overridden,
                override_reason, user_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *
        `;
        const values = [
            ticket_id, classification_id,
            ai_category, ai_priority, ai_confidence,
            user_category, user_priority,
            category_overridden, priority_overridden,
            override_reason, user_id,
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /** Return recent feedback entries, optionally filtered by category or userId. */
    static async getRecent({ limit = 100, category = null, overriddenOnly = false } = {}) {
        let query = `
            SELECT
                f.*,
                t.ticket_number,
                t.subject,
                u.first_name || ' ' || u.last_name AS user_name,
                u.email AS user_email
            FROM ml_prediction_feedback f
            LEFT JOIN tickets t ON t.id = f.ticket_id
            LEFT JOIN users   u ON u.id = f.user_id
            WHERE 1=1
        `;
        const values = [];
        let idx = 1;

        if (category) {
            query += ` AND f.ai_category = $${idx++}`;
            values.push(category);
        }
        if (overriddenOnly) {
            query += ` AND (f.category_overridden = true OR f.priority_overridden = true)`;
        }

        query += ` ORDER BY f.created_at DESC LIMIT $${idx}`;
        values.push(limit);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /** Rolling 7-day override rate per category. */
    static async getOverrideRates() {
        const result = await pool.query(`
            SELECT * FROM vw_ml_override_rate_7d
        `);
        return result.rows;
    }

    /** Overall override stats. */
    static async getStats() {
        const result = await pool.query(`
            SELECT
                COUNT(*)                                                              AS total,
                SUM(CASE WHEN category_overridden THEN 1 ELSE 0 END)                 AS category_overrides,
                SUM(CASE WHEN priority_overridden THEN 1 ELSE 0 END)                 AS priority_overrides,
                ROUND(100.0 * SUM(CASE WHEN category_overridden THEN 1 ELSE 0 END)
                      / NULLIF(COUNT(*), 0), 2)                                       AS category_override_pct,
                ROUND(100.0 * SUM(CASE WHEN priority_overridden THEN 1 ELSE 0 END)
                      / NULLIF(COUNT(*), 0), 2)                                       AS priority_override_pct,
                ROUND(AVG(ai_confidence)::NUMERIC, 4)                                AS avg_ai_confidence
            FROM ml_prediction_feedback
        `);
        return result.rows[0];
    }

    /** Top override reasons (most common). */
    static async getTopOverrideReasons(limit = 10) {
        const result = await pool.query(`
            SELECT override_reason, COUNT(*) AS count
            FROM ml_prediction_feedback
            WHERE override_reason IS NOT NULL AND override_reason <> ''
            GROUP BY override_reason
            ORDER BY count DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }
}

export default MLFeedback;
