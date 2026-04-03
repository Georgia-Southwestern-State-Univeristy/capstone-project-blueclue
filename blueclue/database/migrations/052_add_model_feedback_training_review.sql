-- Migration 052: Model Feedback Training Review
-- ============================================================================
-- Adds a training_status column to ml_prediction_feedback so that every
-- technician override can be reviewed by an admin before it enters the
-- retraining dataset.  This prevents accidental or adversarial data
-- from poisoning the model.
--
-- States:
--   pending  → newly captured, awaiting admin review (default)
--   approved → reviewed and accepted; safe to include in training exports
--   rejected → reviewed and discarded; excluded from training exports
-- ============================================================================

BEGIN;

-- 1. Add training review columns to ml_prediction_feedback
ALTER TABLE ml_prediction_feedback
    ADD COLUMN IF NOT EXISTS training_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (training_status IN ('pending', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_note      TEXT;

-- Index to make pending-review queries fast
CREATE INDEX IF NOT EXISTS idx_ml_feedback_training_status
    ON ml_prediction_feedback(training_status);

CREATE INDEX IF NOT EXISTS idx_ml_feedback_training_status_override
    ON ml_prediction_feedback(training_status)
    WHERE category_overridden = true OR priority_overridden = true;

-- 2. Backfill: approve all existing override records so prior data is not lost
--    (they pre-date the review workflow so we treat them as implicitly reviewed)
UPDATE ml_prediction_feedback
SET training_status = 'approved',
    review_note  = 'Bulk-approved during migration 052; pre-dates review workflow'
WHERE category_overridden = true OR priority_overridden = true;

-- 3. View: per-category override counts (used by admin dashboard summary)
CREATE OR REPLACE VIEW vw_model_feedback_summary AS
SELECT
    COALESCE(ai_category, '(unknown)')                               AS ai_category,
    COUNT(*)                                                          AS total_feedback,
    SUM(CASE WHEN category_overridden THEN 1 ELSE 0 END)             AS category_overrides,
    SUM(CASE WHEN priority_overridden THEN 1 ELSE 0 END)             AS priority_overrides,
    SUM(CASE WHEN category_overridden
              OR priority_overridden THEN 1 ELSE 0 END)              AS total_overrides,
    ROUND(
        100.0 * SUM(CASE WHEN category_overridden THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 2
    )                                                                 AS category_override_pct,
    COALESCE(ROUND(AVG(ai_confidence)::NUMERIC, 4), 0)               AS avg_confidence,
    SUM(CASE WHEN training_status = 'pending' THEN 1 ELSE 0 END)     AS pending_review,
    SUM(CASE WHEN training_status = 'approved' THEN 1 ELSE 0 END)    AS approved_for_training,
    SUM(CASE WHEN training_status = 'rejected' THEN 1 ELSE 0 END)    AS rejected_from_training
FROM ml_prediction_feedback
WHERE category_overridden = true OR priority_overridden = true
GROUP BY COALESCE(ai_category, '(unknown)')
ORDER BY total_overrides DESC;

-- 4. View: most-corrected categories (top categories where AI is overridden)
CREATE OR REPLACE VIEW vw_most_corrected_categories AS
SELECT
    original_cat,
    corrected_to,
    COUNT(*)            AS correction_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
FROM (
    SELECT
        ai_category   AS original_cat,
        user_category AS corrected_to
    FROM ml_prediction_feedback
    WHERE category_overridden = true
      AND user_category IS NOT NULL
) sub
GROUP BY original_cat, corrected_to
ORDER BY correction_count DESC;

COMMIT;
