-- Migration 043: Add timezone preference to users table
-- Allows users to select their preferred timezone for displaying dates/times

ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT NULL;

-- NULL means "use browser default timezone"
COMMENT ON COLUMN users.timezone IS 'IANA timezone identifier (e.g. America/New_York). NULL = browser default.';
