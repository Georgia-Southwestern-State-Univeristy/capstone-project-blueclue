-- ============================================================================
-- Migration 014: Add Ticket Reopen Tracking
-- ============================================================================
-- Description: Adds previous_assigned_tech field for ticket reopening workflow
-- Version: 2.3.1
-- Created: 2026-02-24
-- Issue: #101 - Ticket Reopening
-- ============================================================================

BEGIN;

-- Add previous_assigned_tech field to track the last technician for reassignment
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS previous_assigned_tech INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create index for previous_assigned_tech lookups
CREATE INDEX IF NOT EXISTS idx_tickets_previous_assigned_tech 
ON tickets(previous_assigned_tech) 
WHERE previous_assigned_tech IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN tickets.previous_assigned_tech IS 'Stores the last assigned technician ID for auto-reassignment on ticket reopen';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 014 completed successfully';
    RAISE NOTICE 'Added previous_assigned_tech field to tickets table';
    RAISE NOTICE 'Ticket reopening workflow ready';
END $$;
