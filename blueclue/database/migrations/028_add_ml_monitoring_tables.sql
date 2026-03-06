-- ============================================================================
-- Migration 028: ML Monitoring, Feedback, Model Versioning & Drift Detection
-- ============================================================================
-- Adds tables and columns to support:
--   * User feedback / AI prediction overrides
--   * Model version registry (keep last N versions, rollback support)
--   * Drift detection reports
--   * A/B test assignments
--   * Extended ai_classifications with explanation + version metadata
-- ============================================================================

BEGIN;

-- ============================================================================
-- Extend ai_classifications with richer ML metadata
-- ============================================================================
ALTER TABLE ai_classifications
    ADD COLUMN IF NOT EXISTS category_confidence   DECIMAL(5,4),
    ADD COLUMN IF NOT EXISTS priority_confidence   DECIMAL(5,4),
    ADD COLUMN IF NOT EXISTS model_version         VARCHAR(50),
    ADD COLUMN IF NOT EXISTS explanation           JSONB,        -- SHAP / LIME output
    ADD COLUMN IF NOT EXISTS low_confidence        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ab_variant            VARCHAR(20);  -- 'control' | 'challenger'

-- ============================================================================
-- TABLE: ml_prediction_feedback
-- ============================================================================
-- Stores every user override of an AI prediction (or explicit confirmation).
-- Used to calculate override rate and feed the continuous-learning pipeline.

CREATE TABLE IF NOT EXISTS ml_prediction_feedback (
    id                  SERIAL PRIMARY KEY,
    ticket_id           INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    classification_id   INTEGER REFERENCES ai_classifications(id) ON DELETE SET NULL,

    -- What the model said
    ai_category         VARCHAR(100),
    ai_priority         VARCHAR(50),
    ai_confidence       DECIMAL(5,4),

    -- What the user chose (NULL means they accepted the AI suggestion)
    user_category       VARCHAR(100),
    user_priority       VARCHAR(50),

    -- Did the user override the AI?
    category_overridden  BOOLEAN NOT NULL DEFAULT false,
    priority_overridden  BOOLEAN NOT NULL DEFAULT false,

    -- Optional free-text reason
    override_reason     TEXT,

    -- Who made the change
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_feedback_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ml_feedback_ticket         ON ml_prediction_feedback(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_user           ON ml_prediction_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_created_at     ON ml_prediction_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_cat_override   ON ml_prediction_feedback(category_overridden);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_pri_override   ON ml_prediction_feedback(priority_overridden);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_ai_category    ON ml_prediction_feedback(ai_category);

-- ============================================================================
-- TABLE: ml_model_versions
-- ============================================================================
-- Registry of every trained model artefact.  Supports rollback (set is_active
-- to false on the current version and true on a previous one).

CREATE TABLE IF NOT EXISTS ml_model_versions (
    id              SERIAL PRIMARY KEY,
    model_type      VARCHAR(50) NOT NULL,           -- 'category' | 'priority' | 'time'
    version         VARCHAR(50) NOT NULL,
    file_path       TEXT NOT NULL,                  -- absolute path to .pkl on disk
    extractor_path  TEXT,                           -- path to feature-extractor .pkl
    accuracy        DECIMAL(5,4),
    f1_macro        DECIMAL(5,4),
    mae_hours       DECIMAL(8,2),                   -- for time model
    r2_score        DECIMAL(5,4),                   -- for time model
    training_rows   INTEGER,
    holdout_rows    INTEGER,
    metadata        JSONB,                          -- full model card JSON
    is_active       BOOLEAN NOT NULL DEFAULT false,
    is_deployed     BOOLEAN NOT NULL DEFAULT false,
    deployed_at     TIMESTAMP WITH TIME ZONE,
    rolled_back_at  TIMESTAMP WITH TIME ZONE,
    trained_by      VARCHAR(100) DEFAULT 'pipeline',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_model_version UNIQUE (model_type, version)
);

CREATE INDEX IF NOT EXISTS idx_ml_versions_type       ON ml_model_versions(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_versions_active     ON ml_model_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_ml_versions_created_at ON ml_model_versions(created_at DESC);

-- ============================================================================
-- TABLE: ml_drift_reports
-- ============================================================================
-- Periodic (monthly) drift detection results comparing live prediction
-- distribution to training-time distribution.

CREATE TABLE IF NOT EXISTS ml_drift_reports (
    id              SERIAL PRIMARY KEY,
    model_type      VARCHAR(50) NOT NULL,
    report_date     DATE NOT NULL,
    period_start    TIMESTAMP WITH TIME ZONE,
    period_end      TIMESTAMP WITH TIME ZONE,
    ks_statistic    DECIMAL(6,4),       -- Kolmogorov–Smirnov statistic
    ks_p_value      DECIMAL(6,4),
    chi2_statistic  DECIMAL(8,4),       -- Chi-squared statistic
    chi2_p_value    DECIMAL(6,4),
    drift_detected  BOOLEAN NOT NULL DEFAULT false,
    drift_threshold DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    sample_size     INTEGER,
    distribution    JSONB,              -- { label: count } for live window
    baseline_dist   JSONB,              -- { label: count } from training data
    alert_sent      BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drift_reports_model  ON ml_drift_reports(model_type);
CREATE INDEX IF NOT EXISTS idx_drift_reports_date   ON ml_drift_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_drift_reports_alert  ON ml_drift_reports(drift_detected, alert_sent);

-- ============================================================================
-- TABLE: ml_ab_tests
-- ============================================================================
-- Tracks A/B test experiments between a control model and a challenger model.

CREATE TABLE IF NOT EXISTS ml_ab_tests (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    model_type          VARCHAR(50) NOT NULL,
    control_version     VARCHAR(50) NOT NULL,
    challenger_version  VARCHAR(50) NOT NULL,
    traffic_split       DECIMAL(4,2) NOT NULL DEFAULT 0.20,  -- fraction to challenger
    status              VARCHAR(20) NOT NULL DEFAULT 'running', -- running|completed|aborted
    started_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at            TIMESTAMP WITH TIME ZONE,
    winner              VARCHAR(20),       -- 'control' | 'challenger'
    control_accuracy    DECIMAL(5,4),
    challenger_accuracy DECIMAL(5,4),
    control_requests    INTEGER DEFAULT 0,
    challenger_requests INTEGER DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ml_ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_type   ON ml_ab_tests(model_type);

-- ============================================================================
-- TABLE: ml_retraining_runs
-- ============================================================================
-- Audit log of every retraining pipeline execution.

CREATE TABLE IF NOT EXISTS ml_retraining_runs (
    id              SERIAL PRIMARY KEY,
    triggered_by    VARCHAR(100) NOT NULL DEFAULT 'schedule',  -- 'schedule'|'manual'|'drift_alert'
    model_types     VARCHAR(200),        -- comma-separated list of models retrained
    status          VARCHAR(20) NOT NULL DEFAULT 'running',    -- running|success|failed
    new_versions    JSONB,               -- { category: 'v3', priority: 'v3', time: 'v3' }
    accuracy_before JSONB,               -- { category: 0.87, ... }
    accuracy_after  JSONB,               -- { category: 0.89, ... }
    auto_deployed   BOOLEAN DEFAULT false,
    failure_reason  TEXT,
    duration_seconds INTEGER,
    training_rows   INTEGER,
    started_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retraining_runs_status     ON ml_retraining_runs(status);
CREATE INDEX IF NOT EXISTS idx_retraining_runs_started_at ON ml_retraining_runs(started_at DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Rolling 7-day override rate per category
CREATE OR REPLACE VIEW vw_ml_override_rate_7d AS
SELECT
    ai_category,
    COUNT(*)                                                       AS total_predictions,
    SUM(CASE WHEN category_overridden THEN 1 ELSE 0 END)          AS category_overrides,
    SUM(CASE WHEN priority_overridden THEN 1 ELSE 0 END)          AS priority_overrides,
    ROUND(
        100.0 * SUM(CASE WHEN category_overridden THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 2
    )                                                              AS category_override_pct,
    ROUND(
        100.0 * SUM(CASE WHEN priority_overridden THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 2
    )                                                              AS priority_override_pct
FROM ml_prediction_feedback
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY ai_category
ORDER BY category_override_pct DESC;

-- Daily prediction volume + average confidence
CREATE OR REPLACE VIEW vw_ml_daily_stats AS
SELECT
    DATE(created_at)              AS day,
    COUNT(*)                      AS predictions,
    ROUND(AVG(confidence)::NUMERIC, 4)          AS avg_confidence,
    SUM(CASE WHEN low_confidence THEN 1 ELSE 0 END) AS low_confidence_count,
    SUM(CASE WHEN fallback_used  THEN 1 ELSE 0 END) AS fallback_count
FROM ai_classifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

COMMIT;
