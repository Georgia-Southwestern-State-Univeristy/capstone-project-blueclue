// src/controllers/mlAdminController.js
// Controller for the ML Admin interface.
// Proxies calls to the Python ML service and manages DB-side ML records.

import MLFeedback from '../models/MLFeedback.js';
import MLModelVersion from '../models/MLModelVersion.js';
import pool from '../config/database.js';
import { BadRequestError } from '../middleware/errorHandler.js';

const _rawAiUrl      = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const AI_SERVICE_URL  = /^https?:\/\//i.test(_rawAiUrl) ? _rawAiUrl : `http://${_rawAiUrl}`;
const AI_TIMEOUT     = parseInt(process.env.AI_SERVICE_TIMEOUT, 10) || 8000;

// -----------------------------------------------------------------------------
// Internal helper: call Python ML service
// -----------------------------------------------------------------------------

async function callMLService(path, { method = 'GET', body = null } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT);

    try {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(`${AI_SERVICE_URL}${path}`, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `ML service error ${res.status}`);
        return data;
    } finally {
        clearTimeout(timer);
    }
}

// -----------------------------------------------------------------------------
// Monitoring dashboard
// -----------------------------------------------------------------------------

/**
 * GET /api/ml-admin/dashboard
 * Returns everything the ML admin dashboard needs in one call.
 */
export const getDashboard = async (req, res) => {
        const [
            mlMetrics,
            mlHealth,
            overrideStats,
            overrideRates,
            dailyStats,
            dbConfStats,
            dbCatDist,
            dbPriDist,
        ] = await Promise.allSettled([
            callMLService('/metrics/rolling'),
            callMLService('/health'),
            MLFeedback.getStats(),
            MLFeedback.getOverrideRates(),
            pool.query('SELECT * FROM vw_ml_daily_stats LIMIT 30'),
            // All-time confidence stats from DB (not reset on service restart)
            pool.query(`
                SELECT
                    COUNT(*)                                                                        AS total_predictions,
                    COALESCE(ROUND(AVG(confidence)::NUMERIC, 4), 0.0000)                           AS avg_confidence,
                    COUNT(*) FILTER (WHERE confidence < 0.6)                                       AS low_confidence_count,
                    COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE confidence < 0.6)
                        / NULLIF(COUNT(*), 0), 2), 0.00)                                          AS low_confidence_pct,
                    COUNT(*) FILTER (WHERE fallback_used = true)                                   AS fallback_count,
                    COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE fallback_used = true)
                        / NULLIF(COUNT(*), 0), 2), 0.00)                                          AS fallback_rate_pct
                FROM ai_classifications
            `),
            pool.query(`
                SELECT predicted_category AS label, COUNT(*) AS cnt
                FROM   ai_classifications
                GROUP  BY predicted_category
                ORDER  BY cnt DESC
            `),
            pool.query(`
                SELECT predicted_priority AS label, COUNT(*) AS cnt
                FROM   ai_classifications
                GROUP  BY predicted_priority
                ORDER  BY cnt DESC
            `),
        ]);

        // Build DB-backed stats object (all-time, survives service restarts)
        let db_stats = null;
        if (dbConfStats.status === 'fulfilled' && dbConfStats.value.rows[0]) {
            const row = dbConfStats.value.rows[0];
            const catRows = dbCatDist.status === 'fulfilled' ? dbCatDist.value.rows : [];
            const priRows = dbPriDist.status === 'fulfilled' ? dbPriDist.value.rows : [];
            db_stats = {
                total_predictions:    parseInt(row.total_predictions, 10),
                avg_confidence:       parseFloat(row.avg_confidence),
                low_confidence_count: parseInt(row.low_confidence_count, 10),
                low_confidence_pct:   parseFloat(row.low_confidence_pct),
                fallback_count:       parseInt(row.fallback_count, 10),
                fallback_rate_pct:    parseFloat(row.fallback_rate_pct),
                category_distribution: catRows.reduce((acc, r) => { acc[r.label] = parseInt(r.cnt, 10); return acc; }, {}),
                priority_distribution: priRows.reduce((acc, r) => { acc[r.label] = parseInt(r.cnt, 10); return acc; }, {}),
            };
        }

        return res.json({
            success: true,
            data: {
                ml_metrics:    mlMetrics.status === 'fulfilled'   ? mlMetrics.value   : { error: mlMetrics.reason?.message },
                ml_health:     mlHealth.status === 'fulfilled'    ? mlHealth.value    : { error: mlHealth.reason?.message },
                override_stats:overrideStats.status === 'fulfilled'? overrideStats.value : null,
                override_rates:overrideRates.status === 'fulfilled'? overrideRates.value : [],
                daily_stats:   dailyStats.status === 'fulfilled'  ? dailyStats.value.rows : [],
                db_stats,
            },
        });
};

// -----------------------------------------------------------------------------
// Explainability
// -----------------------------------------------------------------------------

/**
 * POST /api/ml-admin/explain
 * Body: { text, subject?, model_type?, prediction?, confidence? }
 */
export const explainPrediction = async (req, res) => {
        const data = await callMLService('/explain', {
            method: 'POST',
            body: req.body,
        });
        return res.json({ success: true, data });
};

// -----------------------------------------------------------------------------
// Feedback collection
// -----------------------------------------------------------------------------

/**
 * POST /api/ml-admin/feedback
 * Records an AI prediction override or acceptance.
 * Body: FeedbackRequest (mirrors the Python schema)
 */
export const submitFeedback = async (req, res) => {
        const {
            ticket_id, classification_id,
            ai_category, ai_priority, ai_confidence,
            user_category, user_priority,
            category_overridden, priority_overridden,
            override_reason,
        } = req.body;

        if (!ticket_id) {
            throw new BadRequestError('ticket_id is required');
        }

        const record = await MLFeedback.create({
            ticket_id,
            classification_id,
            ai_category,
            ai_priority,
            ai_confidence,
            user_category,
            user_priority,
            category_overridden: !!category_overridden,
            priority_overridden: !!priority_overridden,
            override_reason,
            user_id: req.user?.id || null,
        });

        return res.status(201).json({ success: true, data: record });
};

/**
 * GET /api/ml-admin/feedback
 * Returns recent feedback entries.
 * Query: limit, category, overridden_only
 */
export const getFeedback = async (req, res) => {
        const limit    = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const category = req.query.category || null;
        const onlyOverrides = req.query.overridden_only === 'true';

        const [entries, stats, reasons] = await Promise.all([
            MLFeedback.getRecent({ limit, category, overriddenOnly: onlyOverrides }),
            MLFeedback.getStats(),
            MLFeedback.getTopOverrideReasons(10),
        ]);

        return res.json({ success: true, data: { entries, stats, top_reasons: reasons } });
};

/**
 * GET /api/ml-admin/feedback/override-rates
 */
export const getOverrideRates = async (req, res) => {
        const rates = await MLFeedback.getOverrideRates();
        return res.json({ success: true, data: rates });
};

// -----------------------------------------------------------------------------
// Training feedback review  (admin-only workflow)
// -----------------------------------------------------------------------------

/**
 * GET /api/ml-admin/feedback/training-summary
 * Returns per-category override counts, most-corrected categories, pending count.
 */
export const getTrainingSummary = async (req, res) => {
        const summary = await MLFeedback.getTrainingSummary();
        return res.json({ success: true, data: summary });
};

/**
 * GET /api/ml-admin/feedback/pending
 * Returns feedback records awaiting admin review.
 * Query: limit (default 100)
 */
export const getPendingFeedback = async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const rows  = await MLFeedback.getPendingReview({ limit });
        return res.json({ success: true, data: rows, count: rows.length });
};

/**
 * PATCH /api/ml-admin/feedback/:id/approve
 * Marks a feedback record as approved for training.
 * Body: { note? }
 */
export const approveFeedback = async (req, res) => {
        const feedbackId = parseInt(req.params.id, 10);
        if (isNaN(feedbackId)) {
            throw new BadRequestError('Invalid feedback id');
        }
        const record = await MLFeedback.approve(feedbackId, req.user.id, req.body.note || null);
        if (!record) {
            throw new BadRequestError('Feedback record not found');
        }
        return res.json({ success: true, data: record });
};

/**
 * PATCH /api/ml-admin/feedback/:id/reject
 * Marks a feedback record as rejected (excluded from training).
 * Body: { note? }
 */
export const rejectFeedback = async (req, res) => {
        const feedbackId = parseInt(req.params.id, 10);
        if (isNaN(feedbackId)) {
            throw new BadRequestError('Invalid feedback id');
        }
        const record = await MLFeedback.reject(feedbackId, req.user.id, req.body.note || null);
        if (!record) {
            throw new BadRequestError('Feedback record not found');
        }
        return res.json({ success: true, data: record });
};

/**
 * POST /api/ml-admin/feedback/bulk-approve
 * Bulk-approves all pending feedback records.
 */
export const bulkApproveFeedback = async (req, res) => {
        const count = await MLFeedback.bulkApprove(req.user.id);
        return res.json({ success: true, approved_count: count });
};

// -----------------------------------------------------------------------------
// Drift detection
// -----------------------------------------------------------------------------

/**
 * POST /api/ml-admin/drift/run
 * Body: { model_type, window_days }
 */
export const runDriftDetection = async (req, res) => {
        const data = await callMLService('/drift/run', {
            method: 'POST',
            body: { model_type: req.body.model_type || 'category', window_days: req.body.window_days || 30 },
        });

        // Persist to DB
        if (data && !data.error) {
            await pool.query(`
                INSERT INTO ml_drift_reports (
                    model_type, report_date, period_start, period_end,
                    ks_statistic, ks_p_value, chi2_statistic, chi2_p_value,
                    drift_detected, drift_threshold, sample_size,
                    distribution, baseline_dist, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            `, [
                data.model_type,
                data.report_date,
                data.period_start,
                data.period_end,
                data.ks_statistic,
                data.ks_p_value,
                data.chi2_statistic,
                data.chi2_p_value,
                data.drift_detected,
                data.drift_threshold,
                data.sample_size,
                data.distribution ? JSON.stringify(data.distribution) : null,
                data.baseline_dist ? JSON.stringify(data.baseline_dist) : null,
                data.notes,
            ]);
        }

        return res.json({ success: true, data });
};

/**
 * GET /api/ml-admin/drift/reports
 * Query: model_type, limit
 */
export const getDriftReports = async (req, res) => {
        const modelType = req.query.model_type || null;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

        let query = `SELECT * FROM ml_drift_reports WHERE 1=1`;
        const values = [];
        if (modelType) {
            query += ` AND model_type = $${values.length + 1}`;
            values.push(modelType);
        }
        query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
        values.push(limit);

        const result = await pool.query(query, values);
        return res.json({ success: true, data: result.rows });
};

// -----------------------------------------------------------------------------
// Model version management
// -----------------------------------------------------------------------------

/**
 * GET /api/ml-admin/models/versions
 * Query: model_type
 */
export const getModelVersions = async (req, res) => {
        // Try Python registry first (most up-to-date)
        const mlData = await callMLService(
            `/models/versions${req.query.model_type ? '?model_type=' + req.query.model_type : ''}`
        ).catch(() => null);

        // Also return DB versions
        const dbVersions = await MLModelVersion.getAll(req.query.model_type || null);

        return res.json({
            success: true,
            data: {
                registry: mlData || {},
                db_versions: dbVersions,
            },
        });
};

/**
 * POST /api/ml-admin/models/deploy
 * Body: { model_type, version }
 */
export const deployModelVersion = async (req, res) => {
        const { model_type, version } = req.body;
        if (!model_type || !version) {
            throw new BadRequestError('model_type and version are required');
        }

        const data = await callMLService('/models/deploy', {
            method: 'POST',
            body: { model_type, version },
        });

        // Reflect in DB
        await MLModelVersion.setActive(model_type, version).catch(() => null);

        return res.json({ success: true, data });
};

/**
 * POST /api/ml-admin/models/rollback
 * Body: { model_type, target_version? }
 */
export const rollbackModel = async (req, res) => {
        const { model_type, target_version } = req.body;
        if (!model_type) {
            throw new BadRequestError('model_type is required');
        }

        const data = await callMLService('/models/rollback', {
            method: 'POST',
            body: { model_type, target_version: target_version || null },
        });

        if (data.active_version) {
            await MLModelVersion.setActive(model_type, data.active_version).catch(() => null);
        }

        return res.json({ success: true, data });
};

/**
 * GET /api/ml-admin/models/registry/history
 */
export const getRegistryHistory = async (req, res) => {
        const data = await callMLService('/models/registry/history');
        return res.json({ success: true, data });
};

// -----------------------------------------------------------------------------
// Retraining
// -----------------------------------------------------------------------------

/**
 * POST /api/ml-admin/retrain
 * Body: { model_types?, auto_deploy?, improvement_threshold? }
 */
export const triggerRetraining = async (req, res) => {
        const modelTypes   = req.body.model_types || ['category', 'priority', 'time'];
        const triggeredBy  = req.body.triggered_by || 'manual';

        // Insert a tracking row so the Retrain Logs table is populated immediately
        const dbRow = await pool.query(
            `INSERT INTO ml_retraining_runs (triggered_by, model_types, status)
             VALUES ($1, $2, 'running') RETURNING id`,
            [triggeredBy, modelTypes.join(',')]
        );
        const dbRunId = dbRow.rows[0].id;

        const payload = {
            model_types:           modelTypes,
            triggered_by:          triggeredBy,
            auto_deploy:           !!req.body.auto_deploy,
            improvement_threshold: req.body.improvement_threshold ?? 0.02,
            db_run_id:             dbRunId,
        };

        const data = await callMLService('/retrain', { method: 'POST', body: payload });
        return res.json({ success: true, data: { ...data, db_run_id: dbRunId } });
};

/**
 * GET /api/ml-admin/retrain/reports
 * Lists retraining run reports from DB.
 */
export const getRetrainingRuns = async (req, res) => {
        const result = await pool.query(
            `SELECT * FROM ml_retraining_runs ORDER BY started_at DESC LIMIT 50`
        );
        return res.json({ success: true, data: result.rows });
};

// -----------------------------------------------------------------------------
// Model health summary
// -----------------------------------------------------------------------------

/**
 * GET /api/ml-admin/health
 */
export const getMLHealth = async (req, res) => {
        const [health, metrics] = await Promise.all([
            callMLService('/health'),
            callMLService('/metrics/rolling'),
        ]);
        return res.json({ success: true, data: { health, metrics } });
};

/**
 * GET /api/ml-admin/predictions/recent
 * Returns recent AI classifications from DB.
 */
export const getRecentPredictions = async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const result = await pool.query(`
            SELECT
                ac.*,
                t.ticket_number,
                t.subject,
                t.status AS ticket_status,
                fb.category_overridden,
                fb.priority_overridden,
                fb.user_category,
                fb.user_priority,
                fb.override_reason
            FROM ai_classifications ac
            JOIN  tickets t ON t.id = ac.ticket_id
            LEFT JOIN ml_prediction_feedback fb ON fb.ticket_id = ac.ticket_id
            ORDER BY ac.created_at DESC
            LIMIT $1
        `, [limit]);
        return res.json({ success: true, data: result.rows });
};

/**
 * GET /api/ml-admin/predictions/export
 * Export prediction log as JSON for analysis.
 */
export const exportPredictions = async (req, res) => {
        const since = req.query.since
            ? new Date(req.query.since)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const result = await pool.query(`
            SELECT
                ac.id, ac.ticket_id, ac.predicted_category, ac.predicted_priority,
                ac.confidence, ac.low_confidence, ac.fallback_used, ac.model_version,
                ac.created_at,
                t.ticket_number, t.subject,
                fb.category_overridden, fb.priority_overridden, fb.override_reason
            FROM ai_classifications ac
            JOIN tickets t ON t.id = ac.ticket_id
            LEFT JOIN ml_prediction_feedback fb ON fb.ticket_id = ac.ticket_id
            WHERE ac.created_at >= $1
            ORDER BY ac.created_at DESC
        `, [since]);

        res.setHeader('Content-Disposition', 'attachment; filename="predictions_export.json"');
        res.setHeader('Content-Type', 'application/json');
        return res.json(result.rows);
};
