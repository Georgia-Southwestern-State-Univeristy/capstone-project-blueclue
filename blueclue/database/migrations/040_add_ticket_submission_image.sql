-- ============================================================================
-- Migration 040: Add ticketSubmissionImage column to tickets
-- ============================================================================
-- Description: Adds a JSONB column to store submission image references
-- Date: 2026-03-23
-- Safe to run multiple times: Yes (uses IF NOT EXISTS check)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets'
          AND column_name = 'ticketSubmissionImage'
    ) THEN
        ALTER TABLE tickets
        ADD COLUMN "ticketSubmissionImage" JSONB DEFAULT '[]'::jsonb;

        RAISE NOTICE 'Added ticketSubmissionImage column to tickets';
    ELSE
        RAISE NOTICE 'Column ticketSubmissionImage already exists, skipping';
    END IF;
END $$;

COMMENT ON COLUMN tickets."ticketSubmissionImage" IS 'JSONB array of image references attached during ticket submission';
