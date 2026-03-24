-- ============================================================================
-- Migration 041: Add notification_preferences table
-- ============================================================================
-- Stores user notification preferences (browser, email, per-type toggles)
-- Replaces localStorage-only storage with DB persistence

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    browser_notifications BOOLEAN NOT NULL DEFAULT true,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    type_assignment BOOLEAN NOT NULL DEFAULT true,
    type_overdue BOOLEAN NOT NULL DEFAULT true,
    type_update_request BOOLEAN NOT NULL DEFAULT true,
    type_mention BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
    ON notification_preferences(user_id);
