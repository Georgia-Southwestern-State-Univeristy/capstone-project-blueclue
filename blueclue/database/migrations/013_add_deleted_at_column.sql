-- ============================================================================
-- Migration 013: Add deleted_at column for soft-delete support
-- ============================================================================
-- Adds a deleted_at timestamp column to the tickets table so that
-- "deleted" tickets are distinguished from merely closed ones.
-- All existing queries will exclude rows where deleted_at IS NOT NULL.
-- Management/admin can restore tickets by clearing deleted_at.
-- ============================================================================

-- Add deleted_at column (nullable — NULL means not deleted)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_by column to track who deleted the ticket
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index for efficient filtering of non-deleted and deleted tickets
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_not_deleted ON tickets(id) WHERE deleted_at IS NULL;
