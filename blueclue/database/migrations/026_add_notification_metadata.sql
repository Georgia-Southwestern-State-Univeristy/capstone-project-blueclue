-- Migration: Add metadata column to notifications table for storing additional context
-- Version: 2.4.0
-- Date: 2026-03-02
-- Description: Adds JSONB metadata column to store additional notification context like ring_request_id, urgency_level, etc.

-- Add metadata column to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN (metadata);

-- Add comments
COMMENT ON COLUMN notifications.metadata IS 'Additional notification context stored as JSON (e.g., ring_request_id, urgency_level, user_message)';
