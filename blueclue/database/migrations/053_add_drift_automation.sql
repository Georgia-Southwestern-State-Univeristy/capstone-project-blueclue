-- ============================================================================
-- Migration 053: Drift Automation – Settings, Alerts, and Scheduled History
-- ============================================================================
-- Adds tables and columns to support:
--   * Configurable drift-detection thresholds (no code change required)
--   * Admin-panel alerts when drift is detected by the scheduled job
--   * Linkage between drift alerts and auto-triggered retraining runs
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: ml_drift_settings
-- ============================================================================
-- One row per model type.  All thresholds and automation knobs live here so
-- they can be changed via the admin UI without touching code.

CREATE TABLE IF NOT EXISTS ml_drift_settings (
    id                      SERIAL PRIMARY KEY,
    model_type              VARCHAR(50) NOT NULL UNIQUE,   -- 'category' | 'priority'

    -- Detection thresholds
    p_value_threshold       DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    window_days             INTEGER      NOT NULL DEFAULT 30,
    min_sample_size         INTEGER      NOT NULL DEFAULT 30,

    -- Scheduling
    schedule_enabled        BOOLEAN      NOT NULL DEFAULT true,
    cron_expression         VARCHAR(100) NOT NULL DEFAULT '0 2 * * *', -- 02:00 UTC daily

    -- Auto-retraining when drift is detected
    auto_retrain_enabled    BOOLEAN      NOT NULL DEFAULT false,
    auto_deploy_on_retrain  BOOLEAN      NOT NULL DEFAULT false,
    retrain_threshold       DECIMAL(5,4) NOT NULL DEFAULT 0.02,  -- accuracy improvement required

    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Seed default rows for the two classifiers
INSERT INTO ml_drift_settings (model_type) VALUES ('category')
    ON CONFLICT (model_type) DO NOTHING;
INSERT INTO ml_drift_settings (model_type) VALUES ('priority')
    ON CONFLICT (model_type) DO NOTHING;

-- ============================================================================
-- TABLE: ml_drift_alerts
-- ============================================================================
-- One row per drift-detected event.  Powers the admin-panel alert panel.

CREATE TABLE IF NOT EXISTS ml_drift_alerts (
    id                  SERIAL PRIMARY KEY,
    drift_report_id     INTEGER REFERENCES ml_drift_reports(id) ON DELETE SET NULL,
    model_type          VARCHAR(50) NOT NULL,
    severity            VARCHAR(20) NOT NULL DEFAULT 'low',  -- low | medium | high
    ks_statistic        DECIMAL(6,4),
    ks_p_value          DECIMAL(6,4),
    chi2_statistic      DECIMAL(8,4),
    chi2_p_value        DECIMAL(6,4),
    sample_size         INTEGER,

    -- Resolution tracking
    acknowledged        BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at     TIMESTAMP WITH TIME ZONE,
    acknowledged_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Optional auto-retraining linkage
    retrain_triggered   BOOLEAN NOT NULL DEFAULT false,
    retrain_run_id      INTEGER REFERENCES ml_retraining_runs(id) ON DELETE SET NULL,
    retrain_status      VARCHAR(20),        -- NULL until retraining completes

    message             TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drift_alerts_model      ON ml_drift_alerts(model_type);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_ack        ON ml_drift_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_created_at ON ml_drift_alerts(created_at DESC);

-- ============================================================================
-- Extend ml_retraining_runs with drift_alert linkage
-- ============================================================================
ALTER TABLE ml_retraining_runs
    ADD COLUMN IF NOT EXISTS drift_alert_id INTEGER REFERENCES ml_drift_alerts(id) ON DELETE SET NULL;

COMMIT;
