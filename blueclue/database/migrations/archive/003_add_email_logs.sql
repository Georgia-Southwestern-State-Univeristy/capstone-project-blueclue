-- ============================================================================
-- Migration: Add Email Logging System
-- Description: Creates email_logs table for tracking all email send attempts
--              with delivery status, error tracking, and performance metrics
-- Part: 5 - Email Monitoring & Management
-- ============================================================================

BEGIN;

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email_type VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    message_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create indexes for common queries
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_user_id ON email_logs(recipient_user_id);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE email_logs IS 'Tracks all email send attempts with delivery status and error information';
COMMENT ON COLUMN email_logs.recipient_email IS 'Email address of the recipient';
COMMENT ON COLUMN email_logs.recipient_user_id IS 'Foreign key to users table if recipient is a registered user';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email: verification, welcome, ticket-created, ticket-status-changed, ticket-assigned, password-reset';
COMMENT ON COLUMN email_logs.subject IS 'Email subject line';
COMMENT ON COLUMN email_logs.status IS 'Delivery status: success, failed, pending';
COMMENT ON COLUMN email_logs.message_id IS 'SMTP message ID returned by email service';
COMMENT ON COLUMN email_logs.error_message IS 'Error message if delivery failed';
COMMENT ON COLUMN email_logs.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN email_logs.sent_at IS 'Timestamp when email was successfully sent';
COMMENT ON COLUMN email_logs.metadata IS 'Additional metadata in JSON format (ticket_id, template variables, etc.)';

-- Create a function to clean up old logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_email_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_logs 
    WHERE sent_at < NOW() - INTERVAL '90 days'
    AND status = 'success';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_email_logs() IS 'Deletes successful email logs older than 90 days to prevent table bloat';

-- Verify the changes
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'email_logs'
ORDER BY ordinal_position;

COMMIT;

-- Migration completed successfully
SELECT 'Email logging system created successfully' AS status;
