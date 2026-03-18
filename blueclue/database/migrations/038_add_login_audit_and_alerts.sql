-- Migration 038: Add Login Audit and Alert System
-- Purpose: Track login attempts and provide configurable alerts for suspicious activity
-- Created: 2026-03-18

BEGIN;

-- ============================================================================
-- TABLE: login_attempts
-- ============================================================================
-- Comprehensive audit trail for all authentication attempts

CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255),
    email VARCHAR(255),
    attempt_type VARCHAR(20) NOT NULL CHECK (attempt_type IN ('username', 'email', 'password_reset', 'token_refresh')),
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100), -- 'invalid_credentials', 'account_disabled', 'account_not_found', etc.
    ip_address VARCHAR(45), -- Supports IPv4 and IPv6
    user_agent TEXT,
    country VARCHAR(100), -- Optional: if you add GeoIP lookup later
    city VARCHAR(100),
    is_new_ip BOOLEAN DEFAULT FALSE, -- Flag if this is a new IP for this user
    session_id VARCHAR(255), -- Track which session was created (for successful logins)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for login_attempts
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX idx_login_attempts_username ON login_attempts(username);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_success ON login_attempts(success);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created ON login_attempts(created_at DESC);
CREATE INDEX idx_login_attempts_user_created ON login_attempts(user_id, created_at DESC);

COMMENT ON TABLE login_attempts IS 'Audit log of all authentication attempts for security monitoring';
COMMENT ON COLUMN login_attempts.is_new_ip IS 'TRUE if this IP has never been used by this user before';
COMMENT ON COLUMN login_attempts.failure_reason IS 'Categorized reason for failed login attempts';

-- ============================================================================
-- TABLE: alert_rules
-- ============================================================================
-- Configurable rules for detecting suspicious activity

CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL, -- 'failed_login', 'new_ip_admin', 'bulk_delete', 'rapid_actions', etc.
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Rule parameters (stored as JSONB for flexibility)
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Example parameters:
    -- Failed login: {"threshold": 5, "window_minutes": 10}
    -- New IP admin: {"roles": ["admin", "management"]}
    -- Bulk delete: {"threshold": 10, "window_minutes": 5, "tables": ["tickets", "users"]}
    
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for alert_rules
CREATE INDEX idx_alert_rules_enabled ON alert_rules(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type);

COMMENT ON TABLE alert_rules IS 'Configurable rules for automated security alert detection';
COMMENT ON COLUMN alert_rules.parameters IS 'JSON configuration for rule thresholds and conditions';

-- ============================================================================
-- TABLE: audit_log_health
-- ============================================================================
-- Track the health/status of audit logging systems

CREATE TABLE IF NOT EXISTS audit_log_health (
    id SERIAL PRIMARY KEY,
    log_type VARCHAR(50) NOT NULL, -- 'login_attempts', 'privilege_audit', 'ticket_history', etc.
    last_entry_at TIMESTAMP WITH TIME ZONE,
    entry_count_24h INTEGER DEFAULT 0,
    is_healthy BOOLEAN DEFAULT TRUE,
    last_check_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Single row per log type
CREATE UNIQUE INDEX idx_audit_log_health_type ON audit_log_health(log_type);

COMMENT ON TABLE audit_log_health IS 'Health monitoring for audit logging systems';
COMMENT ON COLUMN audit_log_health.is_healthy IS 'FALSE if no entries in expected timeframe';

-- ============================================================================
-- TABLE ENHANCEMENT: security_alerts
-- ============================================================================
-- Add columns to existing security_alerts table if they don't exist

DO $$ 
BEGIN
    -- Add rule_id column to link alerts to their triggering rule
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_alerts' AND column_name = 'rule_id'
    ) THEN
        ALTER TABLE security_alerts ADD COLUMN rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL;
        CREATE INDEX idx_security_alerts_rule ON security_alerts(rule_id);
    END IF;

    -- Add affected_user_id for login-related alerts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_alerts' AND column_name = 'affected_user_id'
    ) THEN
        ALTER TABLE security_alerts ADD COLUMN affected_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        CREATE INDEX idx_security_alerts_affected_user ON security_alerts(affected_user_id);
    END IF;
END $$;

-- ============================================================================
-- SEED DEFAULT ALERT RULES
-- ============================================================================

INSERT INTO alert_rules (rule_name, rule_type, severity, parameters, description) VALUES
    ('repeated_failed_logins', 'failed_login', 'high', 
     '{"threshold": 5, "window_minutes": 10}'::jsonb,
     'Alert when a user has 5 or more failed login attempts within 10 minutes'),
    
    ('admin_new_ip', 'new_ip_admin', 'high',
     '{"roles": ["admin", "management"]}'::jsonb,
     'Alert when an admin or management user logs in from a new IP address'),
    
    ('bulk_ticket_deletion', 'bulk_delete', 'critical',
     '{"threshold": 10, "window_minutes": 5, "table": "tickets"}'::jsonb,
     'Alert when 10 or more tickets are deleted within 5 minutes'),
    
    ('bulk_user_deletion', 'bulk_delete', 'critical',
     '{"threshold": 5, "window_minutes": 5, "table": "users"}'::jsonb,
     'Alert when 5 or more users are deleted within 5 minutes'),
     
    ('excessive_failed_logins_single_ip', 'failed_login_ip', 'medium',
     '{"threshold": 10, "window_minutes": 10}'::jsonb,
     'Alert when a single IP address has 10+ failed login attempts across any accounts within 10 minutes'),
     
    ('account_lockout_pattern', 'failed_login', 'high',
     '{"threshold": 3, "window_minutes": 5}'::jsonb,
     'Alert when ANY account has 3+ failed logins in 5 minutes (potential brute force)')
ON CONFLICT (rule_name) DO NOTHING;

-- ============================================================================
-- FUNCTION: Update alert_rules updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_alert_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_alert_rules_updated_at();

-- ============================================================================
-- FUNCTION: Track new IP addresses for users
-- ============================================================================

CREATE OR REPLACE FUNCTION check_new_ip_for_user()
RETURNS TRIGGER AS $$
DECLARE
    ip_exists BOOLEAN;
BEGIN
    -- Only check for successful logins with a user_id
    IF NEW.success = TRUE AND NEW.user_id IS NOT NULL AND NEW.ip_address IS NOT NULL THEN
        -- Check if this user has logged in from this IP before
        SELECT EXISTS (
            SELECT 1 FROM login_attempts
            WHERE user_id = NEW.user_id 
            AND ip_address = NEW.ip_address
            AND success = TRUE
            AND id != NEW.id
        ) INTO ip_exists;
        
        NEW.is_new_ip := NOT ip_exists;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_new_ip_trigger
    BEFORE INSERT ON login_attempts
    FOR EACH ROW
    EXECUTE FUNCTION check_new_ip_for_user();

-- ============================================================================
-- FUNCTION: Update audit log health status
-- ============================================================================

CREATE OR REPLACE FUNCTION update_audit_log_health()
RETURNS void AS $$
BEGIN
    -- Update login_attempts health
    INSERT INTO audit_log_health (log_type, last_entry_at, entry_count_24h, is_healthy, last_check_at)
    SELECT 
        'login_attempts',
        MAX(created_at),
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
        MAX(created_at) > NOW() - INTERVAL '1 hour', -- Healthy if entry within last hour
        NOW()
    FROM login_attempts
    ON CONFLICT (log_type) 
    DO UPDATE SET
        last_entry_at = EXCLUDED.last_entry_at,
        entry_count_24h = EXCLUDED.entry_count_24h,
        is_healthy = EXCLUDED.is_healthy,
        last_check_at = EXCLUDED.last_check_at;

    -- Update privilege_audit health
    INSERT INTO audit_log_health (log_type, last_entry_at, entry_count_24h, is_healthy, last_check_at)
    SELECT 
        'privilege_audit',
        MAX(changed_at),
        COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '24 hours'),
        MAX(changed_at) > NOW() - INTERVAL '24 hours', -- Healthy if entry within last day
        NOW()
    FROM privilege_audit_log
    ON CONFLICT (log_type) 
    DO UPDATE SET
        last_entry_at = EXCLUDED.last_entry_at,
        entry_count_24h = EXCLUDED.entry_count_24h,
        is_healthy = EXCLUDED.is_healthy,
        last_check_at = EXCLUDED.last_check_at;

    -- Update ticket_history health
    INSERT INTO audit_log_health (log_type, last_entry_at, entry_count_24h, is_healthy, last_check_at)
    SELECT 
        'ticket_history',
        MAX(created_at),
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
        MAX(created_at) > NOW() - INTERVAL '1 hour', -- Healthy if entry within last hour
        NOW()
    FROM ticket_history
    ON CONFLICT (log_type) 
    DO UPDATE SET
        last_entry_at = EXCLUDED.last_entry_at,
        entry_count_24h = EXCLUDED.entry_count_24h,
        is_healthy = EXCLUDED.is_healthy,
        last_check_at = EXCLUDED.last_check_at;
END;
$$ LANGUAGE plpgsql;

-- Initialize health tracking
SELECT update_audit_log_health();

COMMIT;

-- Migration complete
SELECT 'Migration 038 completed successfully!' as status;
