-- ============================================================================
-- Migration: Add notifications table
-- Version: 009
-- Description: Creates the notifications table that was missing from schema
-- ============================================================================

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message TEXT NOT NULL,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT notification_message_length CHECK (LENGTH(message) <= 1000)
);

-- Create indexes for notifications (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_id') THEN
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_ticket_id') THEN
        CREATE INDEX idx_notifications_ticket_id ON notifications(ticket_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_type') THEN
        CREATE INDEX idx_notifications_type ON notifications(type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_is_read') THEN
        CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_created_at') THEN
        CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_unread') THEN
        CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
    END IF;
END $$;

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications for ticket assignments, updates, and mentions';

-- Log migration
INSERT INTO schema_version (version, description) 
VALUES ('2.1.1', 'Added notifications table that was missing from initial schema')
ON CONFLICT (version) DO NOTHING;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 009 completed successfully: notifications table created';
END $$;
