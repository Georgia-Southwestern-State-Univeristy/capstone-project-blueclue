-- Migration 051: Add category override tracking
-- Allows technicians to override AI-suggested categories.
-- Records are kept for future model retraining.

-- 1. Add override flag columns to tickets table
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS category_override        BOOLEAN   NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category_overridden_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS category_overridden_by   INTEGER   REFERENCES users(id) ON DELETE SET NULL;

-- 2. Create category_overrides table for full audit trail
CREATE TABLE IF NOT EXISTS category_overrides (
    id                  SERIAL          PRIMARY KEY,
    ticket_id           INTEGER         NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    overridden_by       INTEGER         REFERENCES users(id) ON DELETE SET NULL,
    original_category   VARCHAR(100)    NOT NULL,
    new_category        VARCHAR(100)    NOT NULL,
    ai_confidence       NUMERIC(5,4),             -- confidence at time of override
    override_reason     TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 3. Index for reporting / retraining queries
CREATE INDEX IF NOT EXISTS idx_category_overrides_ticket_id  ON category_overrides(ticket_id);
CREATE INDEX IF NOT EXISTS idx_category_overrides_created_at ON category_overrides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_category_overrides_low_conf
    ON category_overrides(ai_confidence)
    WHERE ai_confidence IS NOT NULL AND ai_confidence < 0.70;
