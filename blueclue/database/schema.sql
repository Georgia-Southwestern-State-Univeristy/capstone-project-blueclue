-- ============================================================================
-- BlueClue Support Ticket System - PostgreSQL Database Schema
-- ============================================================================
-- Description: Complete database schema for the BlueClue ticket management system
-- Version: 2.3.0
-- Created: 2026-02-02
-- ============================================================================

-- Drop existing tables if they exist (for clean reinstalls)
DROP TABLE IF EXISTS priority_overrides CASCADE;
DROP TABLE IF EXISTS ticket_assignment_requests CASCADE;
DROP TABLE IF EXISTS role_category_defaults CASCADE;
DROP TABLE IF EXISTS category_access CASCADE;
DROP TABLE IF EXISTS user_privileges CASCADE;
DROP TABLE IF EXISTS privilege_types CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ai_classifications CASCADE;
DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS ticket_history CASCADE;
DROP TABLE IF EXISTS ticket_assignments CASCADE;
DROP TABLE IF EXISTS ticket_templates CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS ticket_statuses CASCADE;
DROP TABLE IF EXISTS ticket_priorities CASCADE;


-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Create custom types for better data integrity
CREATE TYPE user_role AS ENUM ('customer', 'technician', 'senior_technician', 'management', 'admin');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'cancelled', 'reopened');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE ticket_category AS ENUM ('general', 'technical', 'billing', 'account', 'feature_request', 'hardware', 'software', 'network', 'login', 'other');
CREATE TYPE access_level AS ENUM ('view', 'edit', 'assign');
CREATE TYPE notification_type AS ENUM ('assignment', 'overdue', 'update_request', 'mention', 'ticket_cancelled');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'denied');

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Stores all system users (customers, technicians, admins)

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    role user_role NOT NULL DEFAULT 'customer',
    phone VARCHAR(20),
    company VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    force_password_change BOOLEAN NOT NULL DEFAULT false,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    email_created BOOLEAN NOT NULL DEFAULT false, -- Track accounts created from email submission
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT phone_format CHECK (phone IS NULL OR phone ~* '^\+?[0-9\s\-\(\)]+$')
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_force_password_change ON users(force_password_change) WHERE force_password_change = true;
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE email_verified = false;
CREATE INDEX idx_users_email_created ON users(email_created) WHERE email_created = true;
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;

-- ============================================================================
-- TABLE: categories
-- ============================================================================
-- Predefined ticket categories (synchronized with AI classifier)

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name ticket_category NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7), -- Hex color for UI (e.g., #FF5733)
    icon VARCHAR(50), -- Icon identifier for UI
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT color_code_format CHECK (color_code IS NULL OR color_code ~* '^#[0-9A-Fa-f]{6}$')
);

-- Index for active categories
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = true;

-- ============================================================================
-- TABLE: tickets
-- ============================================================================
-- Main tickets table storing all support requests

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE, -- e.g., TICK-2026-00001
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Ticket content
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Classification (from AI or manual)
    category ticket_category NOT NULL DEFAULT 'general',
    priority ticket_priority NOT NULL DEFAULT 'low', -- Final/active priority
    user_priority ticket_priority, -- Priority selected by user
    ai_priority ticket_priority, -- Priority predicted by AI based on content
    status ticket_status NOT NULL DEFAULT 'open',
    
    -- AI classification metadata
    ai_classified BOOLEAN NOT NULL DEFAULT false,
    ai_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    ai_fallback_used BOOLEAN DEFAULT false,
    ai_keywords_matched JSONB, -- Store matched keywords as JSON
    
    -- Resolution tracking
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- SLA tracking
    response_due_at TIMESTAMP WITH TIME ZONE,
    resolution_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Reopen tracking
    reopen_count INTEGER NOT NULL DEFAULT 0,
    last_reopened_at TIMESTAMP WITH TIME ZONE,
    
    -- Email thread tracking
    email_message_id VARCHAR(500), -- Original email Message-ID for reply tracking
    
    -- AI priority influence fields
    ai_recommended_priority ticket_priority, -- Original AI recommendation
    priority_overridden BOOLEAN DEFAULT false, -- True if user explicitly overrode AI
    priority_override_reason TEXT, -- User-provided reason for override
    priority_calculation_method VARCHAR(50), -- Method used (ai_direct, weighted_average, user_override)
    
    -- Soft-delete support
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL = not deleted
    deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Who deleted the ticket
    
    -- Constraints
    CONSTRAINT ai_confidence_range CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
    CONSTRAINT resolved_fields_consistency CHECK (
        (status IN ('resolved', 'closed') AND resolved_at IS NOT NULL) OR
        (status NOT IN ('resolved', 'closed') AND resolved_at IS NULL)
    ),
    CONSTRAINT reopen_count_positive CHECK (reopen_count >= 0)
    -- Note: assigned_to role validation will be enforced via foreign key and application logic
);

-- Indexes for tickets table
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_user_priority ON tickets(user_priority) WHERE user_priority IS NOT NULL;
CREATE INDEX idx_tickets_ai_priority ON tickets(ai_priority) WHERE ai_priority IS NOT NULL;
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_email_message_id ON tickets(email_message_id) WHERE email_message_id IS NOT NULL;
CREATE INDEX idx_tickets_ai_recommended_priority ON tickets(ai_recommended_priority) WHERE ai_recommended_priority IS NOT NULL;
CREATE INDEX idx_tickets_priority_overridden ON tickets(priority_overridden) WHERE priority_overridden = true;
CREATE INDEX idx_tickets_ai_classified ON tickets(ai_classified);
CREATE INDEX idx_tickets_open_assigned ON tickets(assigned_to, status) 
    WHERE status IN ('open', 'in_progress');

-- Soft-delete indexes
CREATE INDEX idx_tickets_deleted_at ON tickets(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_tickets_not_deleted ON tickets(id) WHERE deleted_at IS NULL;

-- GIN index for JSON keyword matching
CREATE INDEX idx_tickets_ai_keywords ON tickets USING GIN (ai_keywords_matched);

-- ============================================================================
-- TABLE: ticket_assignments
-- ============================================================================
-- Many-to-many relationship for multi-technician ticket assignments
-- Supports primary and assisting technician roles

CREATE TABLE ticket_assignments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'primary',
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT assignment_role CHECK (role IN ('primary', 'assisting')),
    CONSTRAINT assignment_dates_valid CHECK (
        unassigned_at IS NULL OR unassigned_at >= assigned_at
    ),
    CONSTRAINT unique_active_assignment UNIQUE (ticket_id, user_id)
);

-- Indexes for ticket_assignments
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_user ON ticket_assignments(user_id);
CREATE INDEX idx_ticket_assignments_role ON ticket_assignments(role);
CREATE INDEX idx_ticket_assignments_assigned_by ON ticket_assignments(assigned_by);
CREATE INDEX idx_ticket_assignments_active ON ticket_assignments(ticket_id, user_id) 
    WHERE unassigned_at IS NULL;

-- ============================================================================
-- TABLE: ticket_comments
-- ============================================================================
-- Stores comments/replies on tickets with support for threaded conversations

CREATE TABLE ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    parent_comment_id INTEGER REFERENCES ticket_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT user_type_valid CHECK (user_type IN ('client', 'tech', 'management')),
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT internal_comment_rules CHECK (
        (is_internal = false) OR 
        (is_internal = true AND user_type IN ('tech', 'management'))
    )
);

-- Indexes for ticket_comments
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_user ON ticket_comments(user_id);
CREATE INDEX idx_ticket_comments_parent ON ticket_comments(parent_comment_id);
CREATE INDEX idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
CREATE INDEX idx_ticket_comments_active ON ticket_comments(ticket_id, created_at DESC) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_ticket_comments_internal ON ticket_comments(ticket_id, is_internal)
    WHERE deleted_at IS NULL;

-- Trigger for ticket_comments updated_at
CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: ticket_templates
-- ============================================================================
-- Predefined ticket templates for common issues and categories

CREATE TABLE ticket_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category ticket_category NOT NULL,
    description TEXT,
    default_priority ticket_priority NOT NULL DEFAULT 'medium',
    field_mappings JSONB,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Constraints
    CONSTRAINT template_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Indexes for ticket_templates
CREATE INDEX idx_ticket_templates_category ON ticket_templates(category);
CREATE INDEX idx_ticket_templates_active ON ticket_templates(is_active) 
    WHERE is_active = true;
CREATE INDEX idx_ticket_templates_created_by ON ticket_templates(created_by);
CREATE INDEX idx_ticket_templates_name ON ticket_templates(name);

-- GIN index for JSON field searching
CREATE INDEX idx_ticket_templates_field_mappings ON ticket_templates USING GIN (field_mappings);

-- Trigger for ticket_templates updated_at
CREATE TRIGGER update_ticket_templates_updated_at
    BEFORE UPDATE ON ticket_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: ticket_history
-- ============================================================================
-- Audit trail for all ticket changes

CREATE TABLE ticket_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL, -- e.g., 'status_change', 'priority_change', 'assignment', 'comment'
    field_name VARCHAR(100), -- Name of the changed field
    old_value TEXT, -- Previous value (as text)
    new_value TEXT, -- New value (as text)
    comment TEXT, -- Optional comment about the change
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Store full change details as JSON for complex changes
    change_details JSONB
);

-- Indexes for ticket_history
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_ticket_history_created_at ON ticket_history(created_at DESC);
CREATE INDEX idx_ticket_history_change_type ON ticket_history(change_type);
CREATE INDEX idx_ticket_history_changed_by ON ticket_history(changed_by);

-- ============================================================================
-- TABLE: ai_classifications
-- ============================================================================
-- Stores AI classification results for tickets

CREATE TABLE ai_classifications (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    predicted_category ticket_category NOT NULL,
    predicted_priority ticket_priority NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL,
    keywords_matched JSONB,
    fallback_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT ai_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT one_classification_per_ticket UNIQUE (ticket_id)
);

-- Indexes for ai_classifications
CREATE INDEX idx_ai_classifications_ticket ON ai_classifications(ticket_id);
CREATE INDEX idx_ai_classifications_category ON ai_classifications(predicted_category);
CREATE INDEX idx_ai_classifications_priority ON ai_classifications(predicted_priority);
CREATE INDEX idx_ai_classifications_confidence ON ai_classifications(confidence);
CREATE INDEX idx_ai_classifications_fallback ON ai_classifications(fallback_used);

-- GIN index for JSON keyword searching
CREATE INDEX idx_ai_classifications_keywords ON ai_classifications USING GIN (keywords_matched);

-- ============================================================================
-- TABLE: notifications
-- ============================================================================
-- User notifications for ticket assignments, updates, and mentions

CREATE TABLE notifications (
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

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================================
-- TABLE: refresh_tokens
-- ============================================================================
-- Stores JWT refresh tokens for secure authentication

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    
    -- Constraints
    CONSTRAINT refresh_tokens_user_id_idx UNIQUE (user_id, token)
);

-- Indexes for refresh_tokens
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id, expires_at) 
    WHERE is_revoked = false AND expires_at > CURRENT_TIMESTAMP;

-- ============================================================================
-- TABLE: ticket_assignment_requests
-- ============================================================================
-- Tracks technician requests to be assigned to tickets

CREATE TABLE ticket_assignment_requests (
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

-- Indexes for ticket_assignment_requests
CREATE INDEX idx_tar_ticket ON ticket_assignment_requests(ticket_id);
CREATE INDEX idx_tar_requested ON ticket_assignment_requests(requested_by);
CREATE INDEX idx_tar_status ON ticket_assignment_requests(status);
CREATE INDEX idx_tar_reviewed_by ON ticket_assignment_requests(reviewed_by);
CREATE INDEX idx_tar_created ON ticket_assignment_requests(created_at DESC);
CREATE INDEX idx_tar_pending ON ticket_assignment_requests(ticket_id, requested_by) 
    WHERE status = 'pending';

-- ============================================================================
-- TABLE: priority_overrides
-- ============================================================================
-- Tracks AI priority recommendation overrides for analytics

CREATE TABLE priority_overrides (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Priority values
    user_priority ticket_priority NOT NULL,
    ai_recommended_priority ticket_priority NOT NULL,
    final_priority ticket_priority NOT NULL,
    
    -- AI information
    ai_confidence DECIMAL(3, 2),
    confidence_level VARCHAR(20), -- 'high', 'medium', 'low'
    
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

-- Indexes for priority_overrides
CREATE INDEX idx_priority_overrides_ticket ON priority_overrides(ticket_id);
CREATE INDEX idx_priority_overrides_user ON priority_overrides(user_id);
CREATE INDEX idx_priority_overrides_user_priority ON priority_overrides(user_priority);
CREATE INDEX idx_priority_overrides_ai_priority ON priority_overrides(ai_recommended_priority);
CREATE INDEX idx_priority_overrides_significant ON priority_overrides(significant_difference) 
    WHERE significant_difference = true;
CREATE INDEX idx_priority_overrides_created_at ON priority_overrides(created_at DESC);

-- Comments for priority_overrides table
COMMENT ON TABLE priority_overrides IS 'Tracks AI priority recommendations and user overrides for analytics';
COMMENT ON COLUMN priority_overrides.user_priority IS 'Priority selected by the user';
COMMENT ON COLUMN priority_overrides.ai_recommended_priority IS 'Priority recommended by AI';
COMMENT ON COLUMN priority_overrides.final_priority IS 'Final calculated priority after weighted calculation';
COMMENT ON COLUMN priority_overrides.significant_difference IS 'True if diff between user and AI priorities is >= 2 levels';

-- ============================================================================
-- TABLE: ai_configuration
-- ============================================================================
-- Stores AI system configuration and admin settings

CREATE TABLE ai_configuration (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ai_configuration
CREATE INDEX idx_ai_configuration_key ON ai_configuration(config_key);

-- Insert default AI priority configuration
INSERT INTO ai_configuration (config_key, config_value, description) VALUES 
    ('priority_weights', 
     '{"aiWeight": 0.7, "userWeight": 0.3, "highConfidenceThreshold": 0.8, "mediumConfidenceThreshold": 0.5, "enableAIPriority": true, "showWarningOnOverride": true}'::jsonb,
     'Configuration for AI-influenced priority calculation algorithm'),
    ('ai_analytics', 
     '{"trackOverrides": true, "trackAccuracy": true, "minimumSampleSize": 50}'::jsonb,
     'Configuration for AI analytics and tracking')
ON CONFLICT (config_key) DO NOTHING;

-- Comments for ai_configuration table
COMMENT ON TABLE ai_configuration IS 'Stores AI system configuration and admin-configurable settings';
COMMENT ON COLUMN ai_configuration.config_value IS 'JSON configuration data';

-- ============================================================================
-- TABLE: email_spam_logs
-- ============================================================================
-- Tracks all inbound emails for spam analysis and audit trail

CREATE TABLE email_spam_logs (
    id SERIAL PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    sender_domain VARCHAR(255),
    subject TEXT,
    body_preview TEXT, -- First 500 chars for analysis
    spam_score INTEGER DEFAULT 0, -- 0-100, higher = more likely spam
    is_spam BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason VARCHAR(255), -- Why it was blocked
    spf_result VARCHAR(50), -- pass, fail, softfail, neutral, none
    dkim_result VARCHAR(50), -- pass, fail, none
    content_filters_triggered TEXT[], -- Array of triggered filters
    ip_address INET,
    user_agent TEXT,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    processing_error TEXT, -- Error message if parsing/processing failed
    processing_status VARCHAR(20) DEFAULT 'success', -- success, failed, retried
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    raw_email_data JSONB, -- Store full email for retry
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_spam_score CHECK (spam_score >= 0 AND spam_score <= 100)
);

-- Indexes for email_spam_logs
CREATE INDEX idx_email_spam_logs_sender ON email_spam_logs(sender_email);
CREATE INDEX idx_email_spam_logs_domain ON email_spam_logs(sender_domain);
CREATE INDEX idx_email_spam_logs_created ON email_spam_logs(created_at);
CREATE INDEX idx_email_spam_logs_is_spam ON email_spam_logs(is_spam);
CREATE INDEX idx_email_spam_logs_is_blocked ON email_spam_logs(is_blocked);
CREATE INDEX idx_email_spam_logs_status ON email_spam_logs(processing_status);
CREATE INDEX idx_email_spam_logs_ticket ON email_spam_logs(ticket_id);

-- Comments for email_spam_logs table
COMMENT ON TABLE email_spam_logs IS 'Audit log of all inbound emails with spam analysis results';
COMMENT ON COLUMN email_spam_logs.spam_score IS 'Calculated spam likelihood score (0-100)';
COMMENT ON COLUMN email_spam_logs.content_filters_triggered IS 'Array of spam keywords/patterns detected';
COMMENT ON COLUMN email_spam_logs.processing_error IS 'Error message if parsing/processing failed';
COMMENT ON COLUMN email_spam_logs.processing_status IS 'Processing outcome: success, failed, retried';
COMMENT ON COLUMN email_spam_logs.raw_email_data IS 'Full original email data for manual retry';

-- ============================================================================
-- TABLE: email_rate_limits
-- ============================================================================
-- Tracks email sending rates per address (max 10 tickets/day by default)

CREATE TABLE email_rate_limits (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    ticket_count_today INTEGER DEFAULT 0,
    last_ticket_at TIMESTAMP WITH TIME ZONE,
    reset_at TIMESTAMP WITH TIME ZONE, -- When counter resets (midnight)
    is_rate_limited BOOLEAN DEFAULT FALSE,
    rate_limit_expires_at TIMESTAMP WITH TIME ZONE,
    total_tickets_all_time INTEGER DEFAULT 0,
    first_ticket_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_rate_limits
CREATE INDEX idx_email_rate_limits_email ON email_rate_limits(email_address);
CREATE INDEX idx_email_rate_limits_is_limited ON email_rate_limits(is_rate_limited);
CREATE INDEX idx_email_rate_limits_reset ON email_rate_limits(reset_at);

-- Comments for email_rate_limits table
COMMENT ON TABLE email_rate_limits IS 'Tracks ticket creation rate per email address';
COMMENT ON COLUMN email_rate_limits.ticket_count_today IS 'Number of tickets created today (resets at midnight)';
COMMENT ON COLUMN email_rate_limits.reset_at IS 'Timestamp when daily counter resets';

-- ============================================================================
-- TABLE: domain_blacklist
-- ============================================================================
-- Blocks known spam domains

CREATE TABLE domain_blacklist (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    block_count INTEGER DEFAULT 0, -- How many emails blocked
    last_blocked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for domain_blacklist
CREATE INDEX idx_domain_blacklist_domain ON domain_blacklist(domain);
CREATE INDEX idx_domain_blacklist_active ON domain_blacklist(is_active) WHERE is_active = TRUE;

-- Comments for domain_blacklist table
COMMENT ON TABLE domain_blacklist IS 'List of domains blocked from creating tickets';
COMMENT ON COLUMN domain_blacklist.block_count IS 'Number of emails blocked from this domain';

-- Insert common spam domains to blacklist
INSERT INTO domain_blacklist (domain, reason, is_active) VALUES
    ('example-spam.com', 'Known spam domain', TRUE),
    ('test-spam.org', 'Test spam domain for development', TRUE),
    ('tempmail.com', 'Temporary email service commonly used for spam', TRUE),
    ('guerrillamail.com', 'Temporary email service', TRUE),
    ('10minutemail.com', 'Temporary email service', TRUE)
ON CONFLICT (domain) DO NOTHING;

-- ============================================================================
-- TABLE: domain_allowlist
-- ============================================================================
-- Trusted domains that bypass spam checks (optional whitelist)

CREATE TABLE domain_allowlist (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT,
    added_by VARCHAR(255), -- Admin username/email
    is_active BOOLEAN DEFAULT TRUE,
    allow_count INTEGER DEFAULT 0, -- How many emails passed from this domain
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for domain_allowlist
CREATE INDEX idx_domain_allowlist_domain ON domain_allowlist(domain);
CREATE INDEX idx_domain_allowlist_active ON domain_allowlist(is_active);
CREATE INDEX idx_domain_allowlist_created ON domain_allowlist(created_at DESC);

-- Comments for domain_allowlist table
COMMENT ON TABLE domain_allowlist IS 'Trusted domains that bypass spam filters';
COMMENT ON COLUMN domain_allowlist.allow_count IS 'Number of emails processed from this domain';

-- Pre-populate some trusted domains
INSERT INTO domain_allowlist (domain, reason, added_by, is_active) VALUES
    ('example.com', 'Testing domain - trusted for development', 'system', TRUE),
    ('yourdomain.com', 'Company domain - always trusted', 'system', TRUE)
ON CONFLICT (domain) DO NOTHING;

-- ============================================================================
-- TABLE: email_verification_challenges
-- ============================================================================
-- Stores verification challenges for suspicious senders

CREATE TABLE email_verification_challenges (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL,
    challenge_token VARCHAR(255) NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    original_email_data JSONB, -- Store original email to process after verification
    spam_score INTEGER, -- Score that triggered challenge
    
    -- Constraints
    CONSTRAINT valid_challenge_attempts CHECK (attempts <= max_attempts)
);

-- Indexes for email_verification_challenges
CREATE INDEX idx_verification_challenges_email ON email_verification_challenges(email_address);
CREATE INDEX idx_verification_challenges_token ON email_verification_challenges(challenge_token);
CREATE INDEX idx_verification_challenges_expires ON email_verification_challenges(expires_at);
CREATE INDEX idx_verification_challenges_verified ON email_verification_challenges(is_verified);

-- Comments for email_verification_challenges table
COMMENT ON TABLE email_verification_challenges IS 'Email verification challenges for suspicious senders';
COMMENT ON COLUMN email_verification_challenges.challenge_token IS 'Unique token sent via email for verification';
COMMENT ON COLUMN email_verification_challenges.original_email_data IS 'Original email content to process after verification';

-- ============================================================================
-- TABLE: spam_keywords
-- ============================================================================
-- Configurable list of spam keywords/patterns

CREATE TABLE spam_keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) DEFAULT 'exact', -- exact, contains, regex
    weight INTEGER DEFAULT 10, -- Points added to spam score
    category VARCHAR(100), -- e.g., 'pharmacy', 'financial', 'adult'
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    hit_count INTEGER DEFAULT 0, -- How many times matched
    last_hit_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for spam_keywords
CREATE INDEX idx_spam_keywords_active ON spam_keywords(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_spam_keywords_category ON spam_keywords(category);

-- Comments for spam_keywords table
COMMENT ON TABLE spam_keywords IS 'Configurable spam keyword patterns with weighted scoring';
COMMENT ON COLUMN spam_keywords.weight IS 'Points added to spam score when matched';

-- Insert default spam keywords
INSERT INTO spam_keywords (keyword, pattern_type, weight, category) VALUES
    -- Pharmacy spam
    ('viagra', 'contains', 15, 'pharmacy'),
    ('cialis', 'contains', 15, 'pharmacy'),
    ('pharmacy', 'contains', 10, 'pharmacy'),
    ('prescription', 'contains', 8, 'pharmacy'),
    -- Financial spam
    ('nigerian prince', 'contains', 25, 'financial'),
    ('lottery winner', 'contains', 25, 'financial'),
    ('million dollars', 'contains', 15, 'financial'),
    ('wire transfer', 'contains', 12, 'financial'),
    ('bank account', 'contains', 10, 'financial'),
    ('paypal', 'contains', 8, 'financial'),
    -- Generic spam
    ('click here now', 'contains', 15, 'generic'),
    ('act now', 'contains', 12, 'generic'),
    ('limited time', 'contains', 10, 'generic'),
    ('free money', 'contains', 20, 'generic'),
    ('congratulations', 'contains', 8, 'generic'),
    ('you have won', 'contains', 15, 'generic'),
    -- Adult content
    ('xxx', 'contains', 20, 'adult'),
    ('adult content', 'contains', 20, 'adult'),
    -- Phishing indicators
    ('verify your account', 'contains', 15, 'phishing'),
    ('confirm your identity', 'contains', 15, 'phishing'),
    ('suspended account', 'contains', 15, 'phishing'),
    ('unusual activity', 'contains', 12, 'phishing')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABLE: security_alerts
-- ============================================================================
-- Logs suspicious activity for admin review

CREATE TABLE security_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL, -- 'rate_limit', 'spam_detected', 'invalid_domain', etc.
    severity VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
    email_address VARCHAR(255),
    domain VARCHAR(255),
    description TEXT NOT NULL,
    metadata JSONB, -- Additional context
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    spam_log_id INTEGER REFERENCES email_spam_logs(id) ON DELETE CASCADE
);

-- Indexes for security_alerts
CREATE INDEX idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_resolved ON security_alerts(is_resolved);
CREATE INDEX idx_security_alerts_created ON security_alerts(created_at);
CREATE INDEX idx_security_alerts_email ON security_alerts(email_address);

-- Comments for security_alerts table
COMMENT ON TABLE security_alerts IS 'Security alerts for admin monitoring and incident response';
COMMENT ON COLUMN security_alerts.severity IS 'Alert severity level for prioritization';

-- ============================================================================
-- TABLE: system_settings
-- ============================================================================
-- Stores global configuration (test mode, thresholds, etc.)

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Can non-admins read this?
    updated_by VARCHAR(255), -- Admin who last updated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for system_settings
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX idx_system_settings_public ON system_settings(is_public);

-- Comments for system_settings table
COMMENT ON TABLE system_settings IS 'Global system configuration settings';
COMMENT ON COLUMN system_settings.is_public IS 'Whether non-admin users can read this setting';

-- Pre-populate default settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
    ('email_test_mode', 'false', 'boolean', 'When true, only accept emails from allowlisted domains', FALSE),
    ('spam_score_threshold', '50', 'number', 'Spam score threshold for blocking (0-100)', FALSE),
    ('verification_threshold', '30', 'number', 'Spam score threshold for verification challenge', FALSE),
    ('rate_limit_max_per_day', '10', 'number', 'Maximum tickets per email address per day', FALSE),
    ('admin_notification_email', '', 'string', 'Email address for security alerts', FALSE),
    ('enable_spam_protection', 'true', 'boolean', 'Master switch for spam protection features', FALSE)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for tickets table
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    sequence_part VARCHAR(5);
BEGIN
    year_part := TO_CHAR(CURRENT_TIMESTAMP, 'YYYY');
    sequence_part := LPAD(NEW.id::TEXT, 5, '0');
    NEW.ticket_number := 'TICK-' || year_part || '-' || sequence_part;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();

-- Function to log ticket changes to history
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'status_change', 'status', OLD.status::TEXT, NEW.status::TEXT);
    END IF;
    
    -- Log priority changes
    IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'priority_change', 'priority', OLD.priority::TEXT, NEW.priority::TEXT);
    END IF;
    
    -- Log category changes
    IF (TG_OP = 'UPDATE' AND OLD.category IS DISTINCT FROM NEW.category) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'category_change', 'category', OLD.category::TEXT, NEW.category::TEXT);
    END IF;
    
    -- Assignment changes are logged by the application layer (ticketController.js)
    -- with richer metadata (names, bulk vs single, notes). Do NOT log here to avoid duplicates.
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log changes
CREATE TRIGGER log_ticket_changes_trigger
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_changes();

-- Function to calculate SLA due dates based on priority
CREATE OR REPLACE FUNCTION set_ticket_sla_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Set response and resolution due dates based on priority
    CASE NEW.priority
        WHEN 'critical' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '1 hour';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '4 hours';
        WHEN 'high' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '2 hours';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '8 hours';
        WHEN 'medium' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '4 hours';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '24 hours';
        WHEN 'low' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '8 hours';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '72 hours';
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set SLA dates on ticket creation
CREATE TRIGGER set_ticket_sla_dates_trigger
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_sla_dates();

-- ============================================================================
-- AUDIT TRAIL FUNCTIONS AND TRIGGERS
-- ============================================================================
-- Automatically log all privilege and category access changes

-- Function to audit user_privileges changes
CREATE OR REPLACE FUNCTION audit_user_privileges_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, new_values)
        VALUES ('user_privileges', NEW.id, 'INSERT', NEW.user_id, NEW.granted_by, 
                row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, old_values, new_values)
        VALUES ('user_privileges', NEW.id, 'UPDATE', NEW.user_id, NEW.granted_by,
                row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, old_values)
        VALUES ('user_privileges', OLD.id, 'DELETE', OLD.user_id, NULL,
                row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to audit category_access changes
CREATE OR REPLACE FUNCTION audit_category_access_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, new_values)
        VALUES ('category_access', NEW.id, 'INSERT', NEW.user_id, NEW.granted_by,
                row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, old_values, new_values)
        VALUES ('category_access', NEW.id, 'UPDATE', NEW.user_id, NEW.granted_by,
                row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, old_values)
        VALUES ('category_access', OLD.id, 'DELETE', OLD.user_id, NULL,
                row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to audit role_category_defaults changes
CREATE OR REPLACE FUNCTION audit_role_defaults_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, new_values)
        VALUES ('role_category_defaults', NEW.id, 'INSERT', NULL, NEW.created_by,
                row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, old_values, new_values)
        VALUES ('role_category_defaults', NEW.id, 'UPDATE', NULL, NEW.created_by,
                row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO privilege_audit_log (table_name, record_id, action, user_id, changed_by, old_values)
        VALUES ('role_category_defaults', OLD.id, 'DELETE', NULL, OLD.created_by,
                row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_privileges audit
CREATE TRIGGER audit_user_privileges_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_privileges
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_privileges_changes();

-- Trigger for category_access audit
CREATE TRIGGER audit_category_access_trigger
    AFTER INSERT OR UPDATE OR DELETE ON category_access
    FOR EACH ROW
    EXECUTE FUNCTION audit_category_access_changes();

-- Trigger for role_category_defaults audit
CREATE TRIGGER audit_role_defaults_trigger
    AFTER INSERT OR UPDATE OR DELETE ON role_category_defaults
    FOR EACH ROW
    EXECUTE FUNCTION audit_role_defaults_changes();

-- ============================================================================
-- DEFAULT DATA - CATEGORIES
-- ============================================================================
-- Insert default categories that match the AI classifier

INSERT INTO categories (name, display_name, description, color_code, icon) VALUES
    -- Original categories
    ('general', 'General', 'General inquiries and uncategorized tickets', '#6B7280', 'help-circle'),
    ('technical', 'Technical', 'Technical issues, bugs, errors, and system problems', '#EF4444', 'alert-triangle'),
    ('billing', 'Billing', 'Payment, invoicing, subscriptions, and refund requests', '#10B981', 'dollar-sign'),
    ('account', 'Account', 'Login, password, access, and profile management', '#3B82F6', 'user'),
    ('feature_request', 'Feature Request', 'New feature suggestions and enhancements', '#8B5CF6', 'lightbulb'),
    -- AI Classifier categories
    ('hardware', 'Hardware', 'Computer hardware issues (laptops, monitors, printers, etc.)', '#F59E0B', 'computer'),
    ('software', 'Software', 'Software and application issues (OS, Office, browsers, etc.)', '#3B82F6', 'application'),
    ('network', 'Network', 'Network connectivity and WiFi issues', '#10B981', 'network'),
    ('login', 'Login & Access', 'Login, password, and account access issues', '#EF4444', 'lock'),
    ('other', 'Other', 'General inquiries and other issues', '#9CA3AF', 'help');

-- ============================================================================
-- TABLE: privilege_types
-- ============================================================================
-- Defines valid privilege types for the RBAC system

CREATE TABLE privilege_types (
    id SERIAL PRIMARY KEY,
    privilege_code VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    default_value TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT privilege_code_uppercase CHECK (privilege_code = UPPER(privilege_code)),
    CONSTRAINT privilege_code_not_empty CHECK (LENGTH(privilege_code) > 0)
);

-- Index for privilege_types table
CREATE INDEX idx_privilege_types_code ON privilege_types(privilege_code);
CREATE INDEX idx_privilege_types_active ON privilege_types(is_active) WHERE is_active = true;

-- Insert default privilege types
INSERT INTO privilege_types (privilege_code, display_name, description, default_value) VALUES
    ('CAN_ASSIGN_TICKETS', 'Can Assign Tickets', 'Allows user to assign tickets to other technicians', 'false'),
    ('CAN_MANAGE_CATEGORIES', 'Can Manage Categories', 'Allows user to modify ticket categories and category settings', 'false'),
    ('CAN_VIEW_ALL_TICKETS', 'Can View All Tickets', 'Override category restrictions to view all tickets in the system', 'false'),
    ('CAN_DELETE_TICKETS', 'Can Delete Tickets', 'Allows user to delete any ticket regardless of assignment', 'false'),
    ('CAN_EDIT_ANY_TICKET', 'Can Edit Any Ticket', 'Allows user to edit any ticket regardless of assignment or category access', 'false');

-- ============================================================================
-- TABLE: user_privileges
-- ============================================================================
-- Stores granular privileges for users (especially technicians)

CREATE TABLE user_privileges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    privilege_type VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    granted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT privilege_type_not_empty CHECK (LENGTH(privilege_type) > 0),
    CONSTRAINT value_not_empty CHECK (LENGTH(value) > 0)
);

-- Indexes for user_privileges table
CREATE INDEX idx_user_privileges_user ON user_privileges(user_id);
CREATE INDEX idx_user_privileges_type ON user_privileges(privilege_type);
CREATE INDEX idx_user_privileges_active ON user_privileges(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_privileges_granted_by ON user_privileges(granted_by);
CREATE INDEX idx_user_privileges_granted_at ON user_privileges(granted_at DESC);

-- ============================================================================
-- TABLE: category_access
-- ============================================================================
-- Stores category-based access control for technicians

CREATE TABLE category_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    access_level access_level NOT NULL,
    granted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT unique_user_category_access UNIQUE (user_id, category_id, access_level)
);

-- Indexes for category_access table
CREATE INDEX idx_category_access_user ON category_access(user_id);
CREATE INDEX idx_category_access_category ON category_access(category_id);
CREATE INDEX idx_category_access_level ON category_access(access_level);
CREATE INDEX idx_category_access_active ON category_access(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_category_access_granted_by ON category_access(granted_by);
CREATE INDEX idx_category_access_user_category ON category_access(user_id, category_id, access_level) WHERE is_active = true;

-- ============================================================================
-- TABLE: role_category_defaults
-- ============================================================================
-- Defines default category access for roles (can be overridden by user_privileges)

CREATE TABLE role_category_defaults (
    id SERIAL PRIMARY KEY,
    role user_role NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    access_level access_level NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT unique_role_category_access UNIQUE (role, category_id, access_level)
);

-- Indexes for role_category_defaults table
CREATE INDEX idx_role_category_defaults_role ON role_category_defaults(role);
CREATE INDEX idx_role_category_defaults_category ON role_category_defaults(category_id);
CREATE INDEX idx_role_category_defaults_active ON role_category_defaults(role, is_active) WHERE is_active = true;
CREATE INDEX idx_role_category_defaults_role_category ON role_category_defaults(role, category_id) WHERE is_active = true;

-- ============================================================================
-- TABLE: privilege_audit_log
-- ============================================================================
-- Complete audit trail for all privilege and category access changes

CREATE TABLE privilege_audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL, -- 'user_privileges', 'category_access', 'role_category_defaults'
    record_id INTEGER NOT NULL, -- ID of the record being changed
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    user_id INTEGER, -- User whose privileges are being changed
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Who made the change
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB, -- Previous values (for UPDATE/DELETE)
    new_values JSONB, -- New values (for INSERT/UPDATE)
    notes TEXT,
    
    -- Constraints
    CONSTRAINT valid_table_name CHECK (table_name IN ('user_privileges', 'category_access', 'role_category_defaults')),
    CONSTRAINT valid_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Indexes for privilege_audit_log table
CREATE INDEX idx_privilege_audit_table ON privilege_audit_log(table_name);
CREATE INDEX idx_privilege_audit_record ON privilege_audit_log(record_id);
CREATE INDEX idx_privilege_audit_user ON privilege_audit_log(user_id);
CREATE INDEX idx_privilege_audit_changed_by ON privilege_audit_log(changed_by);
CREATE INDEX idx_privilege_audit_changed_at ON privilege_audit_log(changed_at DESC);
CREATE INDEX idx_privilege_audit_table_record ON privilege_audit_log(table_name, record_id);

-- Insert default role-based category access
-- Admins: Full access to all categories
INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'admin', c.id, 'assign', 'Full admin access to all categories'
FROM categories c;

-- Technicians: Edit access to technical, hardware, software, network categories by default
INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'technician', c.id, 'edit', 'Default technician access to technical categories'
FROM categories c
WHERE c.name IN ('technical', 'hardware', 'software', 'network');

-- Technicians: View access to all other categories
INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'technician', c.id, 'view', 'Default technician view access'
FROM categories c
WHERE c.name NOT IN ('technical', 'hardware', 'software', 'network');

-- Senior Technicians: Assign access to critical categories, edit access to technical categories
INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'senior_technician', c.id, 'assign', 'Senior tech assign access to critical categories'
FROM categories c
WHERE c.name IN ('network', 'login');

INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'senior_technician', c.id, 'edit', 'Senior tech edit access to general categories'
FROM categories c
WHERE c.name IN ('general', 'technical', 'hardware', 'software');

INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'senior_technician', c.id, 'view', 'Senior tech view access to remaining categories'
FROM categories c
WHERE c.name NOT IN ('network', 'login', 'general', 'technical', 'hardware', 'software');

-- Management: Full assign access to all categories
INSERT INTO role_category_defaults (role, category_id, access_level, notes)
SELECT 'management', c.id, 'assign', 'Management full assign access to all categories'
FROM categories c;

-- Customers: View access to their own tickets (enforced at application level)
-- No default category restrictions for customers as they only see their own tickets

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active tickets with user details
CREATE VIEW active_tickets_view AS
SELECT 
    t.id,
    t.ticket_number,
    t.subject,
    t.status,
    t.priority,
    t.category,
    t.created_at,
    t.ai_confidence,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.email AS customer_email,
    COALESCE(a.first_name || ' ' || a.last_name, 'Unassigned') AS assigned_to_name,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at))/3600 AS age_hours,
    CASE 
        WHEN t.resolution_due_at < CURRENT_TIMESTAMP THEN true 
        ELSE false 
    END AS is_overdue
FROM tickets t
JOIN users c ON t.customer_id = c.id
LEFT JOIN users a ON t.assigned_to = a.id
WHERE t.status NOT IN ('closed');

-- View: Technician workload
CREATE VIEW technician_workload_view AS
SELECT 
    u.id AS technician_id,
    u.first_name || ' ' || u.last_name AS technician_name,
    COUNT(CASE WHEN t.status = 'open' THEN 1 END) AS open_tickets,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) AS in_progress_tickets,
    COUNT(CASE WHEN t.status = 'waiting_on_customer' THEN 1 END) AS waiting_tickets,
    COUNT(*) AS total_assigned
FROM users u
LEFT JOIN tickets t ON u.id = t.assigned_to AND t.status NOT IN ('closed', 'resolved')
WHERE u.role IN ('technician', 'admin')
GROUP BY u.id, u.first_name, u.last_name;

-- View: Category statistics
CREATE VIEW category_statistics_view AS
SELECT 
    c.name AS category,
    c.display_name,
    COUNT(t.id) AS total_tickets,
    COUNT(CASE WHEN t.status = 'open' THEN 1 END) AS open_tickets,
    COUNT(CASE WHEN t.ai_classified = true THEN 1 END) AS ai_classified_tickets,
    AVG(t.ai_confidence) FILTER (WHERE t.ai_classified = true) AS avg_ai_confidence,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_resolution_hours
FROM categories c
LEFT JOIN tickets t ON c.name = t.category
GROUP BY c.name, c.display_name;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Stores all system users including customers, technicians, and administrators';
COMMENT ON TABLE categories IS 'Predefined ticket categories synchronized with AI classifier';
COMMENT ON TABLE tickets IS 'Main table for support tickets with AI classification metadata';
COMMENT ON TABLE ticket_assignments IS 'Assignment history tracking for tickets';
COMMENT ON TABLE ticket_history IS 'Audit trail for all ticket changes and updates';
COMMENT ON TABLE notifications IS 'User notifications for ticket assignments, updates, and mentions';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for secure authentication';
COMMENT ON TABLE ticket_assignment_requests IS 'Tracks technician requests to be assigned to tickets';
COMMENT ON TABLE priority_overrides IS 'Analytics table tracking AI priority recommendation overrides';

COMMENT ON COLUMN tickets.ai_confidence IS 'AI classification confidence score (0.00 to 1.00)';
COMMENT ON COLUMN tickets.ai_fallback_used IS 'Indicates if AI classifier used fallback behavior';
COMMENT ON COLUMN tickets.ai_keywords_matched IS 'JSON object containing matched keywords from AI classification';
COMMENT ON COLUMN ticket_assignment_requests.status IS 'pending = awaiting review, approved = assigned, denied = rejected';
COMMENT ON COLUMN priority_overrides.significant_difference IS 'True when override differs significantly from AI recommendation';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================
-- Note: Adjust these based on your application user setup

-- Example: Grant appropriate permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO blueclue_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO blueclue_app;

-- ============================================================================
-- TABLE: email_logs
-- ============================================================================
-- Comprehensive logging for all email send attempts

CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email_type VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    message_id TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    
    CONSTRAINT valid_email_type CHECK (email_type IN (
        'verification',
        'welcome',
        'ticket-created',
        'ticket-status-changed',
        'ticket-assigned',
        'password-reset',
        'ring_response',
        'unknown'
    ))
);

-- Indexes for email_logs table
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_user_id ON email_logs(recipient_user_id);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);

-- Comments for email_logs table
COMMENT ON TABLE email_logs IS 'Logs all email send attempts with delivery status and error tracking';
COMMENT ON COLUMN email_logs.recipient_email IS 'Email address of recipient';
COMMENT ON COLUMN email_logs.recipient_user_id IS 'Foreign key to users table if recipient is a system user';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email sent (verification, ticket-created, etc.)';
COMMENT ON COLUMN email_logs.status IS 'Delivery status: success, failed, or pending';
COMMENT ON COLUMN email_logs.message_id IS 'SMTP message ID for successful sends';
COMMENT ON COLUMN email_logs.error_message IS 'Error details if send failed';
COMMENT ON COLUMN email_logs.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN email_logs.sent_at IS 'Timestamp when email was successfully sent';
COMMENT ON COLUMN email_logs.metadata IS 'Additional context (ticket_id, tokens, etc.) stored as JSON';

-- Automatic cleanup function for old successful email logs
CREATE OR REPLACE FUNCTION cleanup_old_email_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete successful email logs older than 90 days
    DELETE FROM email_logs
    WHERE status = 'success'
    AND created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_email_logs() IS 'Removes successful email logs older than 90 days to manage database size';

-- Cleanup function for expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired or revoked refresh tokens
    DELETE FROM refresh_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Removes expired and revoked refresh tokens for security and performance';

-- Function to auto-reset daily rate limits at midnight
CREATE OR REPLACE FUNCTION reset_daily_rate_limits()
RETURNS void AS $$
BEGIN
    UPDATE email_rate_limits
    SET ticket_count_today = 0,
        reset_at = CURRENT_DATE + INTERVAL '1 day',
        updated_at = CURRENT_TIMESTAMP
    WHERE reset_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_daily_rate_limits() IS 'Resets daily ticket counters at midnight for rate limiting';

-- Function to clean up expired verification challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_challenges
    WHERE expires_at < CURRENT_TIMESTAMP
    AND is_verified = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_challenges() IS 'Removes expired verification challenges to maintain database cleanliness';

-- Function to update allowlist hit count
CREATE OR REPLACE FUNCTION increment_allowlist_hit_count(p_domain VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE domain_allowlist
    SET allow_count = allow_count + 1,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE domain = p_domain AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_allowlist_hit_count IS 'Increment the usage counter for an allowlisted domain';

-- Function to get system setting value
CREATE OR REPLACE FUNCTION get_system_setting(p_key VARCHAR)
RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT setting_value INTO v_value
    FROM system_settings
    WHERE setting_key = p_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_system_setting IS 'Retrieve a system setting value by key';

-- Trigger to update updated_at on ai_configuration
CREATE OR REPLACE FUNCTION update_ai_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_configuration_timestamp
    BEFORE UPDATE ON ai_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_configuration_updated_at();

-- ============================================================================
-- VIEWS FOR ANALYTICS AND REPORTING
-- ============================================================================

-- View: Priority analytics for AI system monitoring
CREATE OR REPLACE VIEW v_priority_analytics AS
SELECT 
    po.confidence_level,
    po.significant_difference,
    COUNT(*) as override_count,
    AVG(po.ai_confidence) as avg_confidence,
    COUNT(CASE WHEN po.final_priority = po.ai_recommended_priority THEN 1 END) as ai_accepted,
    COUNT(CASE WHEN po.final_priority = po.user_priority THEN 1 END) as user_accepted,
    ARRAY_AGG(DISTINCT u.username) as users_who_overrode
FROM priority_overrides po
JOIN users u ON po.user_id = u.id
GROUP BY po.confidence_level, po.significant_difference;

COMMENT ON VIEW v_priority_analytics IS 'AI priority override analytics showing confidence levels and user acceptance rates';

-- View: AI accuracy tracking for resolved tickets
CREATE OR REPLACE VIEW v_ai_priority_accuracy AS
SELECT 
    t.category,
    t.ai_recommended_priority,
    t.priority as final_priority,
    COUNT(*) as ticket_count,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) as avg_resolution_hours,
    AVG(t.ai_confidence) as avg_confidence,
    COUNT(CASE WHEN t.priority_overridden THEN 1 END) as overridden_count,
    ROUND(
        COUNT(CASE WHEN t.priority_overridden THEN 1 END)::NUMERIC / 
        COUNT(*)::NUMERIC * 100, 
        2
    ) as override_rate_percentage
FROM tickets t
WHERE t.ai_classified = true
  AND t.status IN ('resolved', 'closed')
GROUP BY t.category, t.ai_recommended_priority, t.priority
ORDER BY t.category, ticket_count DESC;

COMMENT ON VIEW v_ai_priority_accuracy IS 'AI accuracy tracking showing resolution times and override rates per category';

-- View: Admin email dashboard summary
CREATE OR REPLACE VIEW admin_email_dashboard AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE is_blocked = TRUE) as blocked_count,
    COUNT(*) FILTER (WHERE is_spam = TRUE) as spam_count,
    COUNT(*) FILTER (WHERE ticket_id IS NOT NULL) as tickets_created,
    COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_parses,
    AVG(spam_score) as avg_spam_score,
    COUNT(DISTINCT sender_email) as unique_senders
FROM email_spam_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;

COMMENT ON VIEW admin_email_dashboard IS 'Daily summary statistics for admin email management dashboard';

-- ============================================================================ -- SCHEMA VERSION INFO
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('2.3.0', 'Fully consolidated schema: added AI configuration, spam protection tables, email tracking, and all remaining migrations (002, 004, 005, 006, 007)')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
