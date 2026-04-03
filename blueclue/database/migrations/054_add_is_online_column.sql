-- Migration: Add is_online column to users table
-- Tracks whether a user is currently logged in (Online/Offline status)

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- Set all users to offline initially
UPDATE users SET is_online = false;
