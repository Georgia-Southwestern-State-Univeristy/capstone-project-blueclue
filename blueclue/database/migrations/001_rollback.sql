-- ============================================================================
-- Rollback: 001 - Add Comments, Templates, and Reopen Tracking
-- ============================================================================
-- Description: Rolls back migration 001, removing:
--   - Ticket comments table
--   - Ticket templates table
--   - Multi-technician assignment changes
--   - Reopen tracking fields
--   - Extended ticket status values
-- 
-- Version: 2.0.0 -> 1.0.0
-- Created: 2026-02-21
-- WARNING: This will delete all comments and templates data!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop new tables
-- ============================================================================

DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS ticket_templates CASCADE;

-- ============================================================================
-- STEP 2: Revert ticket_assignments table structure
-- ============================================================================

-- Backup current assignments
CREATE TEMP TABLE ticket_assignments_backup_rollback AS 
SELECT * FROM ticket_assignments WHERE unassigned_at IS NULL;

-- Drop and recreate with old structure
DROP TABLE ticket_assignments CASCADE;

CREATE TABLE ticket_assignments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT assignment_dates_valid CHECK (
        unassigned_at IS NULL OR unassigned_at >= assigned_at
    )
);

-- Restore primary assignments only (ignore assisting role)
INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_at, assigned_by, notes)
SELECT DISTINCT ON (ticket_id)
    ticket_id,
    user_id AS assigned_to,
    assigned_at,
    assigned_by,
    notes
FROM ticket_assignments_backup_rollback
WHERE role = 'primary'
ORDER BY ticket_id, assigned_at;

-- Create indexes
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_assigned_to ON ticket_assignments(assigned_to);
CREATE INDEX idx_ticket_assignments_active ON ticket_assignments(ticket_id, assigned_to) 
    WHERE unassigned_at IS NULL;

-- ============================================================================
-- STEP 3: Remove new columns from tickets table
-- ============================================================================

-- Drop reopen tracking fields
ALTER TABLE tickets 
    DROP COLUMN IF EXISTS reopen_count,
    DROP COLUMN IF EXISTS last_reopened_at;

-- Drop index if it exists
DROP INDEX IF EXISTS idx_tickets_reopened;

-- ============================================================================
-- STEP 4: Revert ticket_status enum
-- ============================================================================

-- Update any cancelled/reopened tickets to appropriate status
UPDATE tickets SET status = 'open' WHERE status IN ('cancelled', 'reopened');

-- Remove default constraint before type conversion
ALTER TABLE tickets 
    ALTER COLUMN status DROP DEFAULT;

-- Create original enum type
CREATE TYPE ticket_status_old AS ENUM (
    'open', 
    'in_progress', 
    'waiting_on_customer', 
    'resolved', 
    'closed'
);

-- Convert tickets table via text intermediate
ALTER TABLE tickets 
    ALTER COLUMN status TYPE text;

ALTER TABLE tickets 
    ALTER COLUMN status TYPE ticket_status_old 
    USING status::ticket_status_old;

-- Restore default value
ALTER TABLE tickets 
    ALTER COLUMN status SET DEFAULT 'open'::ticket_status_old;

-- Drop new enum and rename old one
DROP TYPE ticket_status;
ALTER TYPE ticket_status_old RENAME TO ticket_status;

-- ============================================================================
-- STEP 5: Revert schema version
-- ============================================================================

DELETE FROM schema_version WHERE version = '2.0.0';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Rollback 001 completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Changes reverted:';
    RAISE NOTICE '  ✓ Removed ticket_comments table';
    RAISE NOTICE '  ✓ Removed ticket_templates table';
    RAISE NOTICE '  ✓ Reverted ticket_assignments structure';
    RAISE NOTICE '  ✓ Removed reopen tracking from tickets';
    RAISE NOTICE '  ✓ Reverted ticket_status enum';
    RAISE NOTICE '  ✓ Reverted schema version to 1.0.0';
    RAISE NOTICE '========================================';
    RAISE WARNING 'All comments and templates have been deleted!';
END $$;

COMMIT;
