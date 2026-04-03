-- ============================================================================
-- Migration 047: Add quiet hours columns to notification_preferences
-- ============================================================================
-- Persists quiet hours / do-not-disturb schedule settings that were previously
-- only stored in localStorage.

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS quiet_hours_start TIME NOT NULL DEFAULT '22:00',
    ADD COLUMN IF NOT EXISTS quiet_hours_end TIME NOT NULL DEFAULT '07:00';
