-- ============================================================================
-- Migration: Consolidate Missing Tables
-- Version: 010
-- Description: Adds tables that were previously in separate files
-- ============================================================================
-- This migration adds tables that should have been in schema.sql but weren't:
-- - refresh_tokens (from auth_setup.sql)
-- - ticket_assignment_requests (from migration 008)
-- - priority_overrides (from migration 002)
-- - notifications (already added in migration 009)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Add request_status enum if it doesn't exist
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: refresh_tokens (from auth_setup.sql)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    
    -- Constraints
    CONSTRAINT refresh_tokens_user_id_idx UNIQUE (user_id, token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id, expires_at) 
    WHERE is_revoked = false AND expires_at > CURRENT_TIMESTAMP;

-- ============================================================================
-- TABLE: ticket_assignment_requests (from migration 008)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_assignment_requests (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT,
    status request_status NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_pending_request UNIQUE (ticket_id, requested_by)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tar_ticket ON ticket_assignment_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tar_requested ON ticket_assignment_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_tar_status ON ticket_assignment_requests(status);
CREATE INDEX IF NOT EXISTS idx_tar_reviewed_by ON ticket_assignment_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_tar_created ON ticket_assignment_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tar_pending ON ticket_assignment_requests(ticket_id, requested_by) 
    WHERE status = 'pending';

-- ============================================================================
-- TABLE: priority_overrides (from migration 002)
-- ============================================================================
CREATE TABLE IF NOT EXISTS priority_overrides (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Priority values
    user_priority ticket_priority NOT NULL,
    ai_recommended_priority ticket_priority NOT NULL,
    final_priority ticket_priority NOT NULL,
    
    -- AI information
    ai_confidence DECIMAL(3, 2),
    confidence_level VARCHAR(20),
    
    -- Override details
    override_reason TEXT,
    significant_difference BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT priority_override_confidence_range CHECK (
        ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)
    ),
    CONSTRAINT confidence_level_valid CHECK (
        confidence_level IS NULL OR confidence_level IN ('high', 'medium', 'low')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_priority_overrides_ticket ON priority_overrides(ticket_id);
CREATE INDEX IF NOT EXISTS idx_priority_overrides_user ON priority_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_priority_overrides_user_priority ON priority_overrides(user_priority);
CREATE INDEX IF NOT EXISTS idx_priority_overrides_ai_priority ON priority_overrides(ai_recommended_priority);
CREATE INDEX IF NOT EXISTS idx_priority_overrides_significant ON priority_overrides(significant_difference) 
    WHERE significant_difference = true;
CREATE INDEX IF NOT EXISTS idx_priority_overrides_created_at ON priority_overrides(created_at DESC);

-- ============================================================================
-- Functions
-- ============================================================================

-- Cleanup function for expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for secure authentication';
COMMENT ON TABLE ticket_assignment_requests IS 'Tracks technician requests to be assigned to tickets';
COMMENT ON TABLE priority_overrides IS 'Analytics table tracking AI priority recommendation overrides';
COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Removes expired and revoked refresh tokens for security and performance';

-- ============================================================================
-- Update schema version
-- ============================================================================
INSERT INTO schema_version (version, description) 
VALUES ('2.2.0', 'Consolidated schema: added refresh_tokens, ticket_assignment_requests, priority_overrides tables')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check for tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
        missing_tables := array_append(missing_tables, 'refresh_tokens');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_assignment_requests') THEN
        missing_tables := array_append(missing_tables, 'ticket_assignment_requests');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'priority_overrides') THEN
        missing_tables := array_append(missing_tables, 'priority_overrides');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        missing_tables := array_append(missing_tables, 'notifications');
    END IF;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Migration 010 FAILED - Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ Migration 010 completed successfully';
        RAISE NOTICE '✅ All consolidated tables created';
        RAISE NOTICE '✅ Schema version: 2.2.0';
    END IF;
END $$;
