-- ============================================================================
-- Migration 011: Complete Feature Consolidation (v2.2.x → v2.3.0)
-- ============================================================================
-- Description: Adds all remaining features from migrations 002, 004, 005, 006, 007
--              This migration brings existing databases up to schema.sql v2.3.0
-- Author: BlueClue Development Team
-- Date: February 24, 2026
-- Dependencies: Requires v2.2.0 or higher (run 010 first if needed)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add Missing Columns (from migrations 002, 004, 005)
-- ============================================================================

-- From migration 004: Email created flag
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_created BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_email_created 
ON users(email_created) WHERE email_created = true;

COMMENT ON COLUMN users.email_created IS 'True if account was created automatically from email submission';

-- From migration 005: Email thread tracking
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_tickets_email_message_id 
ON tickets(email_message_id) WHERE email_message_id IS NOT NULL;

COMMENT ON COLUMN tickets.email_message_id IS 'Message-ID from original email for reply tracking';

-- From migration 002: AI priority influence fields
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS ai_recommended_priority ticket_priority,
ADD COLUMN IF NOT EXISTS priority_overridden BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority_override_reason TEXT,
ADD COLUMN IF NOT EXISTS priority_calculation_method VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_tickets_ai_recommended_priority 
ON tickets(ai_recommended_priority) WHERE ai_recommended_priority IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_priority_overridden 
ON tickets(priority_overridden) WHERE priority_overridden = true;

COMMENT ON COLUMN tickets.ai_recommended_priority IS 'Original AI recommendation before any user override';
COMMENT ON COLUMN tickets.priority_overridden IS 'True if user explicitly overrode AI recommendation';
COMMENT ON COLUMN tickets.priority_override_reason IS 'User-provided reason for overriding AI';
COMMENT ON COLUMN tickets.priority_calculation_method IS 'Method used (ai_direct, weighted_average, user_override)';

-- ============================================================================
-- STEP 2: Create AI Configuration Table (from migration 002)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_configuration (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_configuration_key ON ai_configuration(config_key);

-- Insert default AI configuration
INSERT INTO ai_configuration (config_key, config_value, description) VALUES 
    ('priority_weights', 
     '{"aiWeight": 0.7, "userWeight": 0.3, "highConfidenceThreshold": 0.8, "mediumConfidenceThreshold": 0.5, "enableAIPriority": true, "showWarningOnOverride": true}'::jsonb,
     'Configuration for AI-influenced priority calculation algorithm'),
    ('ai_analytics', 
     '{"trackOverrides": true, "trackAccuracy": true, "minimumSampleSize": 50}'::jsonb,
     'Configuration for AI analytics and tracking')
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON TABLE ai_configuration IS 'AI system configuration and admin-configurable settings';

-- ============================================================================
-- STEP 3: Create Spam Protection Tables (from migration 006)
-- ============================================================================

-- Email spam logs
CREATE TABLE IF NOT EXISTS email_spam_logs (
    id SERIAL PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    sender_domain VARCHAR(255),
    subject TEXT,
    body_preview TEXT,
    spam_score INTEGER DEFAULT 0,
    is_spam BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason VARCHAR(255),
    spf_result VARCHAR(50),
    dkim_result VARCHAR(50),
    content_filters_triggered TEXT[],
    ip_address INET,
    user_agent TEXT,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    processing_error TEXT,
    processing_status VARCHAR(20) DEFAULT 'success',
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    raw_email_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_spam_score CHECK (spam_score >= 0 AND spam_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_email_spam_logs_sender ON email_spam_logs(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_domain ON email_spam_logs(sender_domain);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_created ON email_spam_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_is_spam ON email_spam_logs(is_spam);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_is_blocked ON email_spam_logs(is_blocked);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_status ON email_spam_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_ticket ON email_spam_logs(ticket_id);

-- Email rate limits
CREATE TABLE IF NOT EXISTS email_rate_limits (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    ticket_count_today INTEGER DEFAULT 0,
    last_ticket_at TIMESTAMP WITH TIME ZONE,
    reset_at TIMESTAMP WITH TIME ZONE,
    is_rate_limited BOOLEAN DEFAULT FALSE,
    rate_limit_expires_at TIMESTAMP WITH TIME ZONE,
    total_tickets_all_time INTEGER DEFAULT 0,
    first_ticket_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_rate_limits_email ON email_rate_limits(email_address);
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_is_limited ON email_rate_limits(is_rate_limited);
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_reset ON email_rate_limits(reset_at);

-- Domain blacklist
CREATE TABLE IF NOT EXISTS domain_blacklist (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    block_count INTEGER DEFAULT 0,
    last_blocked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_domain_blacklist_domain ON domain_blacklist(domain);
CREATE INDEX IF NOT EXISTS idx_domain_blacklist_active ON domain_blacklist(is_active) WHERE is_active = TRUE;

-- Insert default blacklist entries
INSERT INTO domain_blacklist (domain, reason, is_active) VALUES
    ('example-spam.com', 'Known spam domain', TRUE),
    ('test-spam.org', 'Test spam domain for development', TRUE),
    ('tempmail.com', 'Temporary email service', TRUE),
    ('guerrillamail.com', 'Temporary email service', TRUE),
    ('10minutemail.com', 'Temporary email service', TRUE)
ON CONFLICT (domain) DO NOTHING;

-- Email verification challenges
CREATE TABLE IF NOT EXISTS email_verification_challenges (
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
    original_email_data JSONB,
    spam_score INTEGER,
    CONSTRAINT valid_challenge_attempts CHECK (attempts <= max_attempts)
);

CREATE INDEX IF NOT EXISTS idx_verification_challenges_email ON email_verification_challenges(email_address);
CREATE INDEX IF NOT EXISTS idx_verification_challenges_token ON email_verification_challenges(challenge_token);
CREATE INDEX IF NOT EXISTS idx_verification_challenges_expires ON email_verification_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_challenges_verified ON email_verification_challenges(is_verified);

-- Spam keywords
CREATE TABLE IF NOT EXISTS spam_keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) DEFAULT 'exact',
    weight INTEGER DEFAULT 10,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_spam_keywords_active ON spam_keywords(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_spam_keywords_category ON spam_keywords(category);

-- Insert default spam keywords
INSERT INTO spam_keywords (keyword, pattern_type, weight, category) VALUES
    ('viagra', 'contains', 15, 'pharmacy'),
    ('cialis', 'contains', 15, 'pharmacy'),
    ('pharmacy', 'contains', 10, 'pharmacy'),
    ('prescription', 'contains', 8, 'pharmacy'),
    ('nigerian prince', 'contains', 25, 'financial'),
    ('lottery winner', 'contains', 25, 'financial'),
    ('million dollars', 'contains', 15, 'financial'),
    ('wire transfer', 'contains', 12, 'financial'),
    ('bank account', 'contains', 10, 'financial'),
    ('paypal', 'contains', 8, 'financial'),
    ('click here now', 'contains', 15, 'generic'),
    ('act now', 'contains', 12, 'generic'),
    ('limited time', 'contains', 10, 'generic'),
    ('free money', 'contains', 20, 'generic'),
    ('congratulations', 'contains', 8, 'generic'),
    ('you have won', 'contains', 15, 'generic'),
    ('xxx', 'contains', 20, 'adult'),
    ('adult content', 'contains', 20, 'adult'),
    ('verify your account', 'contains', 15, 'phishing'),
    ('confirm your identity', 'contains', 15, 'phishing'),
    ('suspended account', 'contains', 15, 'phishing'),
    ('unusual activity', 'contains', 12, 'phishing')
ON CONFLICT DO NOTHING;

-- Security alerts
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'medium',
    email_address VARCHAR(255),
    domain VARCHAR(255),
    description TEXT NOT NULL,
    metadata JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    spam_log_id INTEGER REFERENCES email_spam_logs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_email ON security_alerts(email_address);

-- ============================================================================
-- STEP 4: Create Admin Management Tables (from migration 007)
-- ============================================================================

-- Domain allowlist
CREATE TABLE IF NOT EXISTS domain_allowlist (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT,
    added_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    allow_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domain_allowlist_domain ON domain_allowlist(domain);
CREATE INDEX IF NOT EXISTS idx_domain_allowlist_active ON domain_allowlist(is_active);
CREATE INDEX IF NOT EXISTS idx_domain_allowlist_created ON domain_allowlist(created_at DESC);

INSERT INTO domain_allowlist (domain, reason, added_by, is_active) VALUES
    ('example.com', 'Testing domain - trusted for development', 'system', TRUE),
    ('yourdomain.com', 'Company domain - always trusted', 'system', TRUE)
ON CONFLICT (domain) DO NOTHING;

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public);

INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
    ('email_test_mode', 'false', 'boolean', 'When true, only accept emails from allowlisted domains', FALSE),
    ('spam_score_threshold', '50', 'number', 'Spam score threshold for blocking (0-100)', FALSE),
    ('verification_threshold', '30', 'number', 'Spam score threshold for verification challenge', FALSE),
    ('rate_limit_max_per_day', '10', 'number', 'Maximum tickets per email address per day', FALSE),
    ('admin_notification_email', '', 'string', 'Email address for security alerts', FALSE),
    ('enable_spam_protection', 'true', 'boolean', 'Master switch for spam protection features', FALSE)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- STEP 5: Create Functions (from migrations 002, 006, 007)
-- ============================================================================

-- AI configuration update trigger
CREATE OR REPLACE FUNCTION update_ai_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_configuration_timestamp ON ai_configuration;
CREATE TRIGGER trigger_update_ai_configuration_timestamp
    BEFORE UPDATE ON ai_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_configuration_updated_at();

-- Daily rate limit reset
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

-- Cleanup expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_challenges
    WHERE expires_at < CURRENT_TIMESTAMP AND is_verified = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Increment allowlist hit count
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

-- Get system setting
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

-- ============================================================================
-- STEP 6: Create Views (from migrations 002, 007)
-- ============================================================================

-- Priority analytics view
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

-- AI accuracy tracking view
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

-- Admin email dashboard view
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

-- ============================================================================
-- STEP 7: Update Schema Version
-- ============================================================================

INSERT INTO schema_version (version, description) 
VALUES ('2.3.0', 'Fully consolidated schema: AI configuration, spam protection, email tracking')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Migration 011 Complete
-- ============================================================================

SELECT 
    '✅ Migration 011 completed successfully!' as status,
    'Database upgraded to v2.3.0 with all features consolidated' as message;

SELECT version, applied_at, description 
FROM schema_version 
ORDER BY applied_at DESC 
LIMIT 1;
