-- ============================================================================
-- Migration 005: Add Email Thread Tracking to Tickets
-- ============================================================================
-- Description: Adds email_message_id column to tickets table to support
--              reply-to-update functionality by tracking the original email's
--              Message-ID header.
-- Author: BlueClue Development Team
-- Date: 2026-01-XX
-- Dependencies: 004_add_email_created_flag.sql
-- ============================================================================

BEGIN;

-- Add email_message_id column to track the original email's Message-ID
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(500);

-- Add index for fast thread ID lookups when processing reply emails
CREATE INDEX IF NOT EXISTS idx_tickets_email_message_id ON tickets(email_message_id) 
    WHERE email_message_id IS NOT NULL;

-- Add column documentation
COMMENT ON COLUMN tickets.email_message_id IS E'Stores the Message-ID from the original email that created this ticket. Used to match reply emails back to the correct ticket using In-Reply-To header. Format: <unique-id@server.com>. NULL for tickets not created via email.';

COMMIT;

-- ============================================================================
-- Migration 005 completed: email_message_id field added to tickets table
-- ============================================================================
