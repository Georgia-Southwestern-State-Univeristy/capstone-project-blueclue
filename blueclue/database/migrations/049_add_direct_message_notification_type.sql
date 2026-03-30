-- Migration 049: Add direct_message to notification_type enum
-- ===========================================================
-- Date: 2026-03-25
-- Description: Adds 'direct_message' value to the notification_type enum
--              so direct messages can trigger push notifications.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'direct_message'
          AND enumtypid = 'notification_type'::regtype
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'direct_message';
    END IF;
END$$;
