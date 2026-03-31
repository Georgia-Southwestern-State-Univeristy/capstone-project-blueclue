/**
 * Drift Monitor Job
 * =================
 * Scheduled cron job that:
 *  1. Reads per-model drift settings from ml_drift_settings (DB-configurable)
 *  2. Calls the Python ML service to run drift detection
 *  3. Persists results to ml_drift_reports
 *  4. Creates an ml_drift_alerts record when drift is detected
 *  5. Optionally triggers the retraining pipeline automatically
 *
 * The cron expression for each model type is stored in ml_drift_settings so
 * an admin can change the schedule from the UI without touching code.
 * By default both model types run daily at 02:00 UTC.
 */

import cron from 'node-cron';
import pool from '../config/database.js';

const _rawAiUrl     = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const AI_SERVICE_URL = /^https?:\/\//i.test(_rawAiUrl) ? _rawAiUrl : `http://${_rawAiUrl}`;
const AI_TIMEOUT    = parseInt(process.env.AI_SERVICE_TIMEOUT, 10) || 30_000; // 30 s for drift

// ── Internal helpers ─────────────────────────────────────────────────────────

async function callMLService(path, { method = 'POST', body = null } = {}) {
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
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`ML service ${res.status}: ${text}`);
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/** Compute a human-readable severity from ks/chi2 p-values */
function computeSeverity(report) {
    if (!report.drift_detected) return 'none';
    const p = report.ks_p_value ?? report.chi2_p_value;
    if (p != null && p < 0.001) return 'high';
    if (p != null && p < 0.01)  return 'medium';
    return 'low';
}

/** Load settings row for a model type (with fallback defaults). */
async function loadSettings(modelType) {
    const { rows } = await pool.query(
        `SELECT * FROM ml_drift_settings WHERE model_type = $1`,
        [modelType]
    );
    if (rows.length) return rows[0];
    // Fallback if row missing (shouldn't happen after migration)
    return {
        model_type:            modelType,
        p_value_threshold:     0.05,
        window_days:           30,
        min_sample_size:       30,
        schedule_enabled:      true,
        cron_expression:       '0 2 * * *',
        auto_retrain_enabled:  false,
        auto_deploy_on_retrain: false,
        retrain_threshold:     0.02,
    };
}

/**
 * Run drift for one model type and persist the results.
 * Called by each scheduled task.
 */
async function runDriftForModel(modelType) {
    console.log(`[DriftMonitor] Running drift detection for model: ${modelType}`);

    const settings = await loadSettings(modelType);

    // ── 1. Call Python ML service ──────────────────────────────────────────
    let report;
    try {
        report = await callMLService('/drift/run', {
            body: {
                model_type:   modelType,
                window_days:  settings.window_days,
            },
        });
    } catch (err) {
        console.error(`[DriftMonitor] ML service call failed for ${modelType}:`, err.message);
        return;
    }

    // ── 2. Persist to ml_drift_reports ────────────────────────────────────
    let driftReportId = null;
    try {
        const { rows } = await pool.query(`
            INSERT INTO ml_drift_reports (
                model_type, report_date, period_start, period_end,
                ks_statistic, ks_p_value, chi2_statistic, chi2_p_value,
                drift_detected, drift_threshold, sample_size,
                distribution, baseline_dist, notes, alert_sent
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING id
        `, [
            report.model_type,
            report.report_date,
            report.period_start,
            report.period_end,
            report.ks_statistic,
            report.ks_p_value,
            report.chi2_statistic,
            report.chi2_p_value,
            report.drift_detected,
            settings.p_value_threshold,
            report.sample_size,
            report.distribution    ? JSON.stringify(report.distribution)    : null,
            report.baseline_dist   ? JSON.stringify(report.baseline_dist)   : null,
            report.notes,
            false,  // alert_sent – will update after alert is created
        ]);
        driftReportId = rows[0].id;
        console.log(`[DriftMonitor] Saved drift report id=${driftReportId} drift_detected=${report.drift_detected}`);
    } catch (err) {
        console.error(`[DriftMonitor] Failed to persist drift report for ${modelType}:`, err.message);
        return;
    }

    // ── 3. If no drift, we're done ─────────────────────────────────────────
    if (!report.drift_detected) {
        console.log(`[DriftMonitor] No drift detected for ${modelType} – done.`);
        return;
    }

    // ── 4. Create drift alert ─────────────────────────────────────────────
    const severity = computeSeverity(report);
    const message  = [
        `Drift detected in ${modelType} model (severity: ${severity}).`,
        report.notes,
        settings.auto_retrain_enabled
            ? 'Automated retraining has been triggered.'
            : 'Manual retraining may be required.',
    ].filter(Boolean).join(' ');

    let alertId = null;
    try {
        const { rows } = await pool.query(`
            INSERT INTO ml_drift_alerts (
                drift_report_id, model_type, severity,
                ks_statistic, ks_p_value, chi2_statistic, chi2_p_value,
                sample_size, retrain_triggered, message
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING id
        `, [
            driftReportId,
            modelType,
            severity,
            report.ks_statistic,
            report.ks_p_value,
            report.chi2_statistic,
            report.chi2_p_value,
            report.sample_size,
            settings.auto_retrain_enabled,
            message,
        ]);
        alertId = rows[0].id;

        // Mark the drift report as having triggered an alert
        await pool.query(
            `UPDATE ml_drift_reports SET alert_sent = true WHERE id = $1`,
            [driftReportId]
        );

        console.log(`[DriftMonitor] Created drift alert id=${alertId} severity=${severity} for ${modelType}`);
    } catch (err) {
        console.error(`[DriftMonitor] Failed to create drift alert for ${modelType}:`, err.message);
    }

    // ── 5. Optional auto-retraining ───────────────────────────────────────
    if (!settings.auto_retrain_enabled) return;

    let dbRunId = null;
    try {
        console.log(`[DriftMonitor] Auto-retraining triggered for ${modelType} (alert id=${alertId})`);

        // Insert a tracking row
        const { rows } = await pool.query(`
            INSERT INTO ml_retraining_runs (triggered_by, model_types, status, drift_alert_id)
            VALUES ('drift_alert', $1, 'running', $2)
            RETURNING id
        `, [modelType, alertId]);
        dbRunId = rows[0].id;

        // Link the alert to the retrain run
        if (alertId) {
            await pool.query(
                `UPDATE ml_drift_alerts SET retrain_run_id = $1 WHERE id = $2`,
                [dbRunId, alertId]
            );
        }

        // Fire-and-forget: call the ML service retrain endpoint (it will update
        // ml_retraining_runs via its own DB write when done)
        const retrainPayload = {
            model_types:           [modelType],
            triggered_by:          'drift_alert',
            auto_deploy:           settings.auto_deploy_on_retrain,
            improvement_threshold: settings.retrain_threshold,
            db_run_id:            dbRunId,
        };

        // We don't await here so the cron job doesn't block
        callMLService('/retrain', { body: retrainPayload })
            .then(async (result) => {
                const status = result?.success ? 'success' : 'partial_failure';
                await pool.query(
                    `UPDATE ml_drift_alerts SET retrain_status = $1 WHERE id = $2`,
                    [status, alertId]
                ).catch(() => {});
                console.log(`[DriftMonitor] Auto-retrain completed for ${modelType} run_id=${dbRunId} status=${status}`);
            })
            .catch(async (err) => {
                console.error(`[DriftMonitor] Auto-retrain call failed for ${modelType}:`, err.message);
                await pool.query(
                    `UPDATE ml_drift_alerts SET retrain_status = 'failed' WHERE id = $1`,
                    [alertId]
                ).catch(() => {});
                await pool.query(
                    `UPDATE ml_retraining_runs SET status = 'failed', failure_reason = $1 WHERE id = $2`,
                    [err.message, dbRunId]
                ).catch(() => {});
            });

    } catch (err) {
        console.error(`[DriftMonitor] Auto-retrain setup failed for ${modelType}:`, err.message);
    }
}

// ── Scheduler registry ───────────────────────────────────────────────────────
// Keeps track of scheduled tasks so we can restart them when settings change.
const _tasks = new Map(); // modelType -> node-cron task

/**
 * (Re)schedule a drift job for a model type.
 * Called at startup and whenever settings are updated via the admin UI.
 */
export function scheduleDriftJob(modelType, cronExpression) {
    // Destroy existing task if any
    if (_tasks.has(modelType)) {
        _tasks.get(modelType).destroy();
        _tasks.delete(modelType);
    }

    if (!cron.validate(cronExpression)) {
        console.error(`[DriftMonitor] Invalid cron expression for ${modelType}: "${cronExpression}" – using default`);
        cronExpression = '0 2 * * *';
    }

    const task = cron.schedule(cronExpression, async () => {
        try {
            await runDriftForModel(modelType);
        } catch (err) {
            console.error(`[DriftMonitor] Unhandled error in drift job for ${modelType}:`, err);
        }
    }, { timezone: 'UTC' });

    _tasks.set(modelType, task);
    console.log(`[DriftMonitor] Scheduled ${modelType} drift check: "${cronExpression}" (UTC)`);
    return task;
}

/**
 * Startup: read settings from DB and schedule each model's drift job.
 * Safe to call before the DB is fully warm – we retry once after 10 s.
 */
export async function startDriftMonitorJob() {
    const MODEL_TYPES = ['category', 'priority'];

    async function _setup() {
        for (const modelType of MODEL_TYPES) {
            try {
                const settings = await loadSettings(modelType);
                if (!settings.schedule_enabled) {
                    console.log(`[DriftMonitor] Schedule disabled for ${modelType} – skipping`);
                    continue;
                }
                scheduleDriftJob(modelType, settings.cron_expression);
            } catch (err) {
                console.error(`[DriftMonitor] Setup failed for ${modelType}:`, err.message);
            }
        }
    }

    try {
        await _setup();
    } catch (err) {
        // Retry after 10 s (e.g. DB not ready at cold start)
        console.warn('[DriftMonitor] Initial setup failed – retrying in 10 s:', err.message);
        setTimeout(async () => {
            try { await _setup(); }
            catch (e) { console.error('[DriftMonitor] Retry failed:', e.message); }
        }, 10_000);
    }
}

/**
 * Run drift detection immediately for one or all model types.
 * Useful for manual triggers from the admin panel without going through
 * the HTTP layer.
 */
export async function runDriftNow(modelType = null) {
    const targets = modelType ? [modelType] : ['category', 'priority'];
    for (const mt of targets) {
        await runDriftForModel(mt);
    }
}
