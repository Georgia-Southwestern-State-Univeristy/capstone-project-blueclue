-- Migration 031: Add chat_handoff to notification_type enum
-- ==========================================================
-- Date: 2026-03-04
-- Description: Adds 'chat_handoff' value to the notification_type enum
--              so the chat handoff feature can insert technician notifications.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'chat_handoff'
          AND enumtypid = 'notification_type'::regtype
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'chat_handoff';
    END IF;
END$$;
