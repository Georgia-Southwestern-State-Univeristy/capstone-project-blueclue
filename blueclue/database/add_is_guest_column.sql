-- ============================================================================
-- Migration: Add is_guest Column to Users Table
-- ============================================================================
-- Purpose: Mark guest users for periodic cleanup
-- Date: 2026-02-13

-- Add is_guest column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;

-- Add created_at column for tracking user creation time (if not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Mark existing guest users (those with empty password_hash and username starting with 'guest_')
UPDATE users 
SET is_guest = true 
WHERE password_hash = '' AND username LIKE 'guest_%';

-- Create index for efficient guest user queries
CREATE INDEX IF NOT EXISTS idx_users_is_guest_created_at 
ON users(is_guest, created_at) 
WHERE is_guest = true;

-- Add comment
COMMENT ON COLUMN users.is_guest IS 'True for guest users created via guest login';

SELECT 'Migration completed: is_guest column added successfully' AS status;
