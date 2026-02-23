-- Migration 007: Add Admin Management Features
-- Purpose: Support email allowlist, system settings, and enhanced inbound email tracking
-- Created: Part 6 of Email-to-Ticket Implementation

-- Table: domain_allowlist
-- Purpose: Track trusted domains that bypass spam checks (optional whitelist)
CREATE TABLE IF NOT EXISTS domain_allowlist (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT,
    added_by VARCHAR(255), -- Admin username/email
    is_active BOOLEAN DEFAULT TRUE,
    allow_count INTEGER DEFAULT 0, -- How many emails passed from this domain
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for domain_allowlist
CREATE INDEX idx_domain_allowlist_domain ON domain_allowlist(domain);
CREATE INDEX idx_domain_allowlist_active ON domain_allowlist(is_active);
CREATE INDEX idx_domain_allowlist_created ON domain_allowlist(created_at DESC);

COMMENT ON TABLE domain_allowlist IS 'Trusted domains that bypass spam filters';
COMMENT ON COLUMN domain_allowlist.allow_count IS 'Number of emails processed from this domain';

-- Table: system_settings
-- Purpose: Store global configuration (test mode, thresholds, etc.)
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Can non-admins read this?
    updated_by VARCHAR(255), -- Admin who last updated
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for system_settings
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX idx_system_settings_public ON system_settings(is_public);

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

-- Add error tracking columns to email_spam_logs (if not exists)
-- This helps with failed parse tracking for admin dashboard
DO $$ 
BEGIN
    -- Add processing_error column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_spam_logs' AND column_name = 'processing_error'
    ) THEN
        ALTER TABLE email_spam_logs 
        ADD COLUMN processing_error TEXT,
        ADD COLUMN processing_status VARCHAR(20) DEFAULT 'success', -- success, failed, retried
        ADD COLUMN retry_count INTEGER DEFAULT 0,
        ADD COLUMN last_retry_at TIMESTAMP,
        ADD COLUMN raw_email_data JSONB; -- Store full email for retry
        
        COMMENT ON COLUMN email_spam_logs.processing_error IS 'Error message if parsing/processing failed';
        COMMENT ON COLUMN email_spam_logs.processing_status IS 'Processing outcome: success, failed, retried';
        COMMENT ON COLUMN email_spam_logs.raw_email_data IS 'Full original email data for manual retry';
    END IF;
END $$;

-- Create index on processing_status for admin queries
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_status ON email_spam_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_email_spam_logs_ticket ON email_spam_logs(ticket_id);

-- Pre-populate some trusted domains (example - customize as needed)
INSERT INTO domain_allowlist (domain, reason, added_by, is_active) VALUES
('example.com', 'Testing domain - trusted for development', 'system', TRUE),
('yourdomain.com', 'Company domain - always trusted', 'system', TRUE)
ON CONFLICT (domain) DO NOTHING;

-- Function: Update allowlist hit count
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

-- Function: Get system setting value
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

-- View: Admin dashboard summary
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

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT ON email_spam_logs TO admin_role;
-- GRANT ALL ON domain_allowlist TO admin_role;
-- GRANT ALL ON system_settings TO admin_role;

COMMIT;

-- Migration complete
SELECT 'Migration 007 completed successfully!' as status;
