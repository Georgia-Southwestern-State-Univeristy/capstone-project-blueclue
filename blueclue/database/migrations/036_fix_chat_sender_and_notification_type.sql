-- Migration 036: Fix chat_messages sender constraint and notification_type enum
-- ============================================================================
-- 
-- Fix 1: Allow 'tech' as a valid sender in chat_messages
--   The handoff reply feature inserts sender='tech' but the original CHECK
--   constraint only permits 'user' and 'bot'.
--
-- Fix 2: Add 'update_request_reminder' to the notification_type enum
--   The update request reminder cron job uses this type but it was never
--   added to the enum.

-- -----------------------------------------------------------------------
-- Fix 1: Expand chat_messages sender check to include 'tech'
-- -----------------------------------------------------------------------
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_check;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_sender_check
    CHECK (sender IN ('user', 'bot', 'tech'));

-- -----------------------------------------------------------------------
-- Fix 2: Add 'update_request_reminder' to notification_type enum
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'update_request_reminder'
      AND enumtypid = 'notification_type'::regtype
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'update_request_reminder';
  END IF;
END$$;
