// src/models/MLModelVersion.js
// Reads model version records from the DB (populated by the Python registry).

import pool from '../config/database.js';

class MLModelVersion {
    /** Return all model versions, newest first. */
    static async getAll(modelType = null) {
        let query = `
            SELECT * FROM ml_model_versions
            WHERE 1=1
        `;
        const values = [];
        if (modelType) {
            query += ` AND model_type = $1`;
            values.push(modelType);
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, values);
        return result.rows;
    }

    /** Return the currently deployed (active) version for a model type. */
    static async getActive(modelType) {
        const result = await pool.query(
            `SELECT * FROM ml_model_versions
             WHERE model_type = $1 AND is_active = true
             ORDER BY deployed_at DESC
             LIMIT 1`,
            [modelType]
        );
        return result.rows[0] || null;
    }

    /** Upsert a version record (called when the Python pipeline registers a model). */
    static async upsert({
        model_type, version, file_path, extractor_path = null,
        accuracy = null, f1_macro = null, mae_hours = null, r2_score = null,
        training_rows = null, holdout_rows = null, metadata = null,
        is_active = false, trained_by = 'pipeline',
    }) {
        const query = `
            INSERT INTO ml_model_versions (
                model_type, version, file_path, extractor_path,
                accuracy, f1_macro, mae_hours, r2_score,
                training_rows, holdout_rows, metadata,
                is_active, trained_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (model_type, version) DO UPDATE SET
                file_path      = EXCLUDED.file_path,
                extractor_path = EXCLUDED.extractor_path,
                accuracy       = EXCLUDED.accuracy,
                f1_macro       = EXCLUDED.f1_macro,
                mae_hours      = EXCLUDED.mae_hours,
                r2_score       = EXCLUDED.r2_score,
                training_rows  = EXCLUDED.training_rows,
                holdout_rows   = EXCLUDED.holdout_rows,
                metadata       = EXCLUDED.metadata,
                trained_by     = EXCLUDED.trained_by
            RETURNING *
        `;
        const result = await pool.query(query, [
            model_type, version, file_path, extractor_path,
            accuracy, f1_macro, mae_hours, r2_score,
            training_rows, holdout_rows,
            metadata ? JSON.stringify(metadata) : null,
            is_active, trained_by,
        ]);
        return result.rows[0];
    }

    /** Mark a version as active/deployed. */
    static async setActive(modelType, version) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Deactivate the current active version
            await client.query(
                `UPDATE ml_model_versions SET is_active = false WHERE model_type = $1`,
                [modelType]
            );
            // Activate the target version
            const result = await client.query(
                `UPDATE ml_model_versions
                 SET is_active = true, is_deployed = true, deployed_at = NOW()
                 WHERE model_type = $1 AND version = $2
                 RETURNING *`,
                [modelType, version]
            );
            await client.query('COMMIT');
            return result.rows[0] || null;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /** Log a rollback event. */
    static async logRollback(modelType, version) {
        await pool.query(
            `UPDATE ml_model_versions
             SET rolled_back_at = NOW()
             WHERE model_type = $1 AND version = $2`,
            [modelType, version]
        );
    }
}

export default MLModelVersion;
