-- ============================================================================
-- Migration: 044_add_email_queue
-- Description: Add email_queue table for async email processing with retry
-- ============================================================================
-- This migration implements a queue-based email system to:
--   - Decouple email sending from API response time
--   - Enable reliable retry with exponential backoff
--   - Track email delivery status and failures
--   - Prevent duplicate sends (idempotency)

-- ============================================================================
-- TABLE: email_queue
-- ============================================================================
-- Queue for async email processing with retry logic

CREATE TABLE IF NOT EXISTS email_queue (
    id SERIAL PRIMARY KEY,
    
    -- Recipient information
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Email content
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT NOT NULL,
    template_name VARCHAR(100), -- Template used (welcome, ticket-created, etc.)
    
    -- Email metadata
    email_type VARCHAR(50) NOT NULL, -- verification, welcome, ticket-created, etc.
    metadata JSONB DEFAULT '{}', -- Additional context (ticket_id, etc.)
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, dead_letter
    attempts INTEGER DEFAULT 0,
    last_attempted_at TIMESTAMP WITH TIME ZONE,
    
    -- Retry tracking
    next_retry_at TIMESTAMP WITH TIME ZONE, -- When to retry next (for exponential backoff)
    backoff_delay INTEGER DEFAULT 1000, -- Milliseconds until next retry (1s, 3s, 9s)
    
    -- Result tracking
    message_id VARCHAR(255), -- SMTP message ID on success
    error_message TEXT, -- Last error message
    error_stack TEXT, -- Full error context for debugging
    completed_at TIMESTAMP WITH TIME ZONE, -- When email was successfully sent
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Idempotency
    idempotency_key VARCHAR(255), -- Unique key to prevent duplicate queue entries
    
    -- Constraints
    CONSTRAINT check_status CHECK (status IN ('pending', 'processing', 'completed', 'dead_letter')),
    CONSTRAINT check_attempts CHECK (attempts >= 0 AND attempts <= 10),
    CONSTRAINT check_has_content CHECK (body_html IS NOT NULL OR body_text IS NOT NULL)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for processing queue (find pending/failed emails ready for retry)
CREATE INDEX idx_email_queue_processing ON email_queue(status, next_retry_at) 
    WHERE status IN ('pending', 'processing') AND attempts < 3;

-- Index for status filtering
CREATE INDEX idx_email_queue_status ON email_queue(status);

-- Index for recipient lookups
CREATE INDEX idx_email_queue_recipient ON email_queue(recipient_email);
CREATE INDEX idx_email_queue_user ON email_queue(recipient_user_id) 
    WHERE recipient_user_id IS NOT NULL;

-- Index for idempotency checks
CREATE UNIQUE INDEX idx_email_queue_idempotency ON email_queue(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- Index for created_at (for cleanup/archival)
CREATE INDEX idx_email_queue_created_at ON email_queue(created_at);

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_email_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_queue_updated_at
    BEFORE UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_email_queue_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_queue IS 'Queue for async email processing with exponential backoff retry';
COMMENT ON COLUMN email_queue.status IS 'pending: not sent yet | processing: currently sending | completed: sent successfully | dead_letter: max retries exceeded';
COMMENT ON COLUMN email_queue.attempts IS 'Number of send attempts (max 3 before dead_letter)';
COMMENT ON COLUMN email_queue.next_retry_at IS 'Timestamp when this email should be retried (CURRENT_TIMESTAMP + backoff_delay)';
COMMENT ON COLUMN email_queue.backoff_delay IS 'Milliseconds to wait before next retry - exponential: 1000ms, 3000ms, 9000ms';
COMMENT ON COLUMN email_queue.idempotency_key IS 'Unique key (e.g., "ticket-created-123-user-456") to prevent duplicate queue entries';
COMMENT ON COLUMN email_queue.metadata IS 'JSONB context: {ticket_id, original_ticket_id, verificationToken, etc.}';
COMMENT ON COLUMN email_queue.error_stack IS 'Full error context for manual investigation after max retries';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- No seed data needed for email_queue (populated dynamically)

-- ============================================================================
-- MIGRATION SUCCESS
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE 'Migration 044: email_queue table created successfully';
    RAISE NOTICE '  - Async email processing with retry enabled';
    RAISE NOTICE '  - Exponential backoff: 1s → 3s → 9s';
    RAISE NOTICE '  - Max retries: 3 attempts before dead_letter';
    RAISE NOTICE '  - Idempotency support to prevent duplicates';
END $$;
