-- ============================================================================
-- Migration: Add Email Verification Columns
-- Description: Adds email_verified, email_verification_token, and 
--              email_verification_expires columns to users table
-- Part: 3 - Account Email Verification
-- ============================================================================

BEGIN;

-- Add email verification columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;

-- Set existing users as verified (backward compatibility)
UPDATE users 
SET email_verified = true 
WHERE email_verified IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Token sent to user for email verification';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration timestamp for verification token';

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('email_verified', 'email_verification_token', 'email_verification_expires')
ORDER BY ordinal_position;

COMMIT;

-- Migration completed successfully
SELECT 'Email verification columns added successfully' AS status;
