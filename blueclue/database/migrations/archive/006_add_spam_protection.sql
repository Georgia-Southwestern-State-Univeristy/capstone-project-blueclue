-- Migration 006: Add Spam Protection & Security Tables
-- Purpose: Support spam filtering, rate limiting, domain blacklisting, and verification challenges
-- Created: Part 5 of Email-to-Ticket Implementation

-- Table: email_spam_logs
-- Purpose: Track all inbound emails for spam analysis and audit trail
CREATE TABLE IF NOT EXISTS email_spam_logs (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    CONSTRAINT valid_spam_score CHECK (spam_score >= 0 AND spam_score <= 100)
);

-- Indexes for email_spam_logs
CREATE INDEX idx_email_spam_logs_sender ON email_spam_logs(sender_email);
CREATE INDEX idx_email_spam_logs_domain ON email_spam_logs(sender_domain);
CREATE INDEX idx_email_spam_logs_created ON email_spam_logs(created_at);
CREATE INDEX idx_email_spam_logs_is_spam ON email_spam_logs(is_spam);
CREATE INDEX idx_email_spam_logs_is_blocked ON email_spam_logs(is_blocked);

COMMENT ON TABLE email_spam_logs IS 'Audit log of all inbound emails with spam analysis results';
COMMENT ON COLUMN email_spam_logs.spam_score IS 'Calculated spam likelihood score (0-100)';
COMMENT ON COLUMN email_spam_logs.content_filters_triggered IS 'Array of spam keywords/patterns detected';

-- Table: email_rate_limits
-- Purpose: Track email sending rates per address (max 10 tickets/day)
CREATE TABLE IF NOT EXISTS email_rate_limits (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    ticket_count_today INTEGER DEFAULT 0,
    last_ticket_at TIMESTAMP,
    reset_at TIMESTAMP, -- When counter resets (midnight)
    is_rate_limited BOOLEAN DEFAULT FALSE,
    rate_limit_expires_at TIMESTAMP,
    total_tickets_all_time INTEGER DEFAULT 0,
    first_ticket_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_rate_limits
CREATE INDEX idx_email_rate_limits_email ON email_rate_limits(email_address);
CREATE INDEX idx_email_rate_limits_is_limited ON email_rate_limits(is_rate_limited);
CREATE INDEX idx_email_rate_limits_reset ON email_rate_limits(reset_at);

COMMENT ON TABLE email_rate_limits IS 'Tracks ticket creation rate per email address';
COMMENT ON COLUMN email_rate_limits.ticket_count_today IS 'Number of tickets created today (resets at midnight)';
COMMENT ON COLUMN email_rate_limits.reset_at IS 'Timestamp when daily counter resets';

-- Table: domain_blacklist
-- Purpose: Block known spam domains
CREATE TABLE IF NOT EXISTS domain_blacklist (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    block_count INTEGER DEFAULT 0, -- How many emails blocked
    last_blocked_at TIMESTAMP
);

-- Indexes for domain_blacklist
CREATE INDEX idx_domain_blacklist_domain ON domain_blacklist(domain);
CREATE INDEX idx_domain_blacklist_active ON domain_blacklist(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE domain_blacklist IS 'List of domains blocked from creating tickets';
COMMENT ON COLUMN domain_blacklist.block_count IS 'Number of emails blocked from this domain';

-- Table: email_verification_challenges
-- Purpose: Store CAPTCHA-like verification challenges for suspicious senders
CREATE TABLE IF NOT EXISTS email_verification_challenges (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL,
    challenge_token VARCHAR(255) NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    original_email_data JSONB, -- Store original email to process after verification
    spam_score INTEGER, -- Score that triggered challenge
    CONSTRAINT valid_challenge_attempts CHECK (attempts <= max_attempts)
);

-- Indexes for email_verification_challenges
CREATE INDEX idx_verification_challenges_email ON email_verification_challenges(email_address);
CREATE INDEX idx_verification_challenges_token ON email_verification_challenges(challenge_token);
CREATE INDEX idx_verification_challenges_expires ON email_verification_challenges(expires_at);
CREATE INDEX idx_verification_challenges_verified ON email_verification_challenges(is_verified);

COMMENT ON TABLE email_verification_challenges IS 'Email verification challenges for suspicious senders';
COMMENT ON COLUMN email_verification_challenges.challenge_token IS 'Unique token sent via email for verification';
COMMENT ON COLUMN email_verification_challenges.original_email_data IS 'Original email content to process after verification';

-- Table: spam_keywords
-- Purpose: Configurable list of spam keywords/patterns
CREATE TABLE IF NOT EXISTS spam_keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) DEFAULT 'exact', -- exact, contains, regex
    weight INTEGER DEFAULT 10, -- Points added to spam score
    category VARCHAR(100), -- e.g., 'pharmacy', 'financial', 'adult'
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hit_count INTEGER DEFAULT 0, -- How many times matched
    last_hit_at TIMESTAMP
);

-- Indexes for spam_keywords
CREATE INDEX idx_spam_keywords_active ON spam_keywords(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_spam_keywords_category ON spam_keywords(category);

COMMENT ON TABLE spam_keywords IS 'Configurable spam keyword patterns with weighted scoring';
COMMENT ON COLUMN spam_keywords.weight IS 'Points added to spam score when matched';

-- Table: security_alerts
-- Purpose: Log suspicious activity for admin review
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL, -- 'rate_limit', 'spam_detected', 'invalid_domain', etc.
    severity VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
    email_address VARCHAR(255),
    domain VARCHAR(255),
    description TEXT NOT NULL,
    metadata JSONB, -- Additional context
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    spam_log_id INTEGER REFERENCES email_spam_logs(id) ON DELETE CASCADE
);

-- Indexes for security_alerts
CREATE INDEX idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_resolved ON security_alerts(is_resolved);
CREATE INDEX idx_security_alerts_created ON security_alerts(created_at);
CREATE INDEX idx_security_alerts_email ON security_alerts(email_address);

COMMENT ON TABLE security_alerts IS 'Security alerts for admin monitoring and incident response';
COMMENT ON COLUMN security_alerts.severity IS 'Alert severity level for prioritization';

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

-- Insert common spam domains to blacklist
INSERT INTO domain_blacklist (domain, reason, is_active) VALUES
    ('example-spam.com', 'Known spam domain', TRUE),
    ('test-spam.org', 'Test spam domain for development', TRUE),
    ('tempmail.com', 'Temporary email service commonly used for spam', TRUE),
    ('guerrillamail.com', 'Temporary email service', TRUE),
    ('10minutemail.com', 'Temporary email service', TRUE)
ON CONFLICT (domain) DO NOTHING;

-- Create function to auto-reset daily rate limits at midnight
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

COMMENT ON FUNCTION reset_daily_rate_limits() IS 'Resets daily ticket counters at midnight';

-- Create function to clean up expired verification challenges
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

COMMENT ON FUNCTION cleanup_expired_challenges() IS 'Removes expired verification challenges';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 006 completed successfully! Spam protection tables created.';
END $$;
