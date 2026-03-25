-- ============================================================================
-- Migration 042: Add additional notification type toggle columns
-- ============================================================================
-- Extends notification_preferences with columns for all 11 notification types
-- (the original migration 041 only included 4 types)

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS type_ticket_cancelled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS type_ring_request BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS type_ring_response BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS type_update_fulfilled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS type_update_overdue BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS type_chat_handoff BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS type_update_request_reminder BOOLEAN NOT NULL DEFAULT true;
