-- Migration: Add email notification preferences to users table
-- Date: 2026-02-22
-- Description: Adds email_notifications column for user notification preferences

BEGIN;

-- Add email_notifications column (default TRUE for backward compatibility)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

-- Update existing users to have email notifications enabled
UPDATE users 
SET email_notifications = true 
WHERE email_notifications IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.email_notifications IS 'Whether user wants to receive email notifications for ticket updates';

COMMIT;

-- Verify the change
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'email_notifications';
