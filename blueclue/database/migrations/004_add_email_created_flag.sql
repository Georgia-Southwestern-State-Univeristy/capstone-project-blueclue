-- ============================================================================
-- Migration: Add email_created flag to users table
-- ============================================================================
-- Description: Adds flag to track accounts created via email submission
-- Version: 004
-- Date: 2026-02-22
-- ============================================================================

-- Add email_created column to track accounts created from email submission
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_created BOOLEAN NOT NULL DEFAULT false;

-- Add index for querying email-created accounts
CREATE INDEX IF NOT EXISTS idx_users_email_created 
ON users(email_created) 
WHERE email_created = true;

-- Add comment for documentation
COMMENT ON COLUMN users.email_created IS 'True if account was created automatically from email submission';

-- Show migration result
SELECT 'Migration 004 completed: email_created field added to users table' AS result;
