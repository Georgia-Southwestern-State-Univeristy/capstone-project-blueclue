-- ============================================================================
-- Migration: Add comment notification type
-- Version: 013
-- Description: Adds 'comment' to the notification_type enum for comment notifications
-- ============================================================================

-- Add 'comment' to notification_type enum if it doesn't exist
DO $$
BEGIN
    -- Check if the 'comment' value already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'comment' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
    ) THEN
        -- Add the new enum value
        ALTER TYPE notification_type ADD VALUE 'comment';
        RAISE NOTICE 'Added "comment" to notification_type enum';
    ELSE
        RAISE NOTICE '"comment" already exists in notification_type enum';
    END IF;
END $$;

-- Log migration
INSERT INTO schema_version (version, description) 
VALUES ('2.3.1', 'Added comment notification type to enum')
ON CONFLICT (version) DO NOTHING;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 013 completed successfully: comment notification type added';
END $$;
