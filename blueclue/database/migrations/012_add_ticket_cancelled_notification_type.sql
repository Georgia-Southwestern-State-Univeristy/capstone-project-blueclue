-- ============================================================================
-- Migration 012: Add ticket_cancelled to notification_type enum
-- ============================================================================
-- Description: Adds 'ticket_cancelled' value to the notification_type enum
--              to support cancellation notifications for techs and management
-- Author: BlueClue Development Team
-- Date: February 24, 2026
-- Dependencies: Requires notification_type enum to exist
-- ============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_cancelled';

-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
-- so this migration must be run outside of BEGIN/COMMIT.
