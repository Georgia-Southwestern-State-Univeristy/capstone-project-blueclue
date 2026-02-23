-- ============================================================================
-- BlueClue Support Ticket System - Sample Data (Seed File)
-- ============================================================================
-- Description: Minimal sample data for development and testing
-- Version: 2.0.0
-- Updated: 2026-02-21
-- Note: Tickets are NOT pre-created - create them via the app to test AI classifier
-- Note: Technicians are created in auth_setup.sql - do NOT truncate users table
-- ============================================================================

-- Clear existing ticket data only (preserve users created in auth_setup.sql)
TRUNCATE TABLE ticket_comments, ticket_templates, ticket_history, ticket_assignments, ai_classifications, tickets RESTART IDENTITY CASCADE;

-- ============================================================================
-- SAMPLE CUSTOMER USERS
-- ============================================================================
-- Password for all users: "BlueClue2026!" (hashed with bcrypt)

INSERT INTO users (email, password_hash, first_name, last_name, role, phone, company, is_active) VALUES
    -- Customers
    ('mike.chen@startupxyz.io', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Michael', 'Chen', 'customer', '+1-555-0102', 'StartupXYZ', true),
    ('emily.rodriguez@freelance.net', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Emily', 'Rodriguez', 'customer', '+1-555-0103', 'Freelance Consulting', true),
    ('david.kim@techcorp.com', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'David', 'Kim', 'customer', '+1-555-0104', 'TechCorp LLC', true),
    ('sarah.johnson@marketing.io', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Sarah', 'Johnson', 'customer', '+1-555-0105', 'Marketing Pro', true);

-- Update last login times to make data realistic
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '2 days' WHERE email = 'mike.chen@startupxyz.io';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE email = 'emily.rodriguez@freelance.net';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '5 hours' WHERE email = 'david.kim@techcorp.com';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE email = 'sarah.johnson@marketing.io';

-- ============================================================================
-- ADMIN USER
-- ============================================================================
-- Admin account for system administration

INSERT INTO users (email, password_hash, first_name, last_name, username, role, phone, company, is_active)
VALUES ('admin@blueclue.com', '$2b$10$5z/sNzB2ijopeHYQMrBDfegPTuvlV1Xt8iF9moVQjSaOFxgGYBWim', 'Admin', 'User', 'admin', 'admin', '+1-555-0300', 'BlueClue Support', true);

UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE email = 'admin@blueclue.com';

-- ============================================================================
-- SAMPLE TICKET TEMPLATES
-- ============================================================================
-- Common ticket templates for quick ticket creation

-- Get admin user ID for created_by reference
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@blueclue.com';
    
    -- Hardware templates
    INSERT INTO ticket_templates (name, category, description, default_priority, field_mappings, created_by, is_active) VALUES
    (
        'Laptop Not Turning On',
        'hardware',
        'Standard template for laptop power issues',
        'high',
        '{"subject": "Laptop won''t power on", "common_solutions": ["Check power adapter", "Try different outlet", "Remove battery and AC, hold power 30s"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Printer Offline',
        'hardware',
        'Template for printer connectivity issues',
        'medium',
        '{"subject": "Printer showing as offline", "common_checks": ["Verify power and connections", "Check printer queue", "Restart print spooler"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Monitor Display Issues',
        'hardware',
        'Template for monitor/display problems',
        'medium',
        '{"subject": "Monitor not displaying properly", "troubleshooting": ["Check cable connections", "Test different input", "Verify resolution settings"]}'::jsonb,
        admin_user_id,
        true
    );
    
    -- Software templates
    INSERT INTO ticket_templates (name, category, description, default_priority, field_mappings, created_by, is_active) VALUES
    (
        'Application Crash',
        'software',
        'Template for application crashes and freezes',
        'high',
        '{"subject": "Application crashing frequently", "required_info": ["Which application?", "Error message", "When does it crash?", "Recent changes?"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Software Installation Request',
        'software',
        'Template for software installation requests',
        'low',
        '{"subject": "Software installation request", "required_info": ["Software name", "Version needed", "Business justification", "License available?"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Performance Issues',
        'software',
        'Template for slow computer performance',
        'medium',
        '{"subject": "Computer running very slow", "diagnostics": ["Check disk space", "Review startup programs", "Scan for malware", "Check CPU/RAM usage"]}'::jsonb,
        admin_user_id,
        true
    );
    
    -- Network templates
    INSERT INTO ticket_templates (name, category, description, default_priority, field_mappings, created_by, is_active) VALUES
    (
        'No Internet Connection',
        'network',
        'Template for internet connectivity issues',
        'high',
        '{"subject": "No internet connection", "troubleshooting": ["Verify WiFi connected", "Check other devices", "Restart router", "Run network diagnostics"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'WiFi Connection Drops',
        'network',
        'Template for intermittent WiFi issues',
        'medium',
        '{"subject": "WiFi keeps disconnecting", "diagnostics": ["Check signal strength", "Update WiFi drivers", "Try 5GHz vs 2.4GHz", "Test wired connection"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'VPN Connection Problems',
        'network',
        'Template for VPN connectivity issues',
        'high',
        '{"subject": "Cannot connect to VPN", "required_info": ["VPN client used", "Error message", "Home or office?", "Internet working?"]}'::jsonb,
        admin_user_id,
        true
    );
    
    -- Login/Access templates
    INSERT INTO ticket_templates (name, category, description, default_priority, field_mappings, created_by, is_active) VALUES
    (
        'Password Reset Request',
        'login',
        'Template for password reset requests',
        'high',
        '{"subject": "Password reset request", "required_info": ["Account/email", "Security verification method", "Last successful login"], "sla_note": "Must verify identity"}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Account Locked',
        'login',
        'Template for locked account issues',
        'high',
        '{"subject": "Account is locked", "steps": ["Verify identity", "Check failed login attempts", "Reset password if needed", "Review security policies"]}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Access Request',
        'login',
        'Template for requesting access to systems/resources',
        'medium',
        '{"subject": "Access request", "required_info": ["System/resource name", "Access level needed", "Business justification", "Manager approval"]}'::jsonb,
        admin_user_id,
        true
    );
    
    -- General templates
    INSERT INTO ticket_templates (name, category, description, default_priority, field_mappings, created_by, is_active) VALUES
    (
        'General Inquiry',
        'general',
        'Template for general questions and inquiries',
        'low',
        '{"subject": "General inquiry", "note": "Please provide as much detail as possible about your question"}'::jsonb,
        admin_user_id,
        true
    ),
    (
        'Feature Request',
        'feature_request',
        'Template for requesting new features',
        'low',
        '{"subject": "Feature request", "required_info": ["Describe the feature", "Why is it needed?", "Expected benefit", "Alternative solutions tried"]}'::jsonb,
        admin_user_id,
        true
    );
END $$;

-- ============================================================================
-- SAMPLE COMMENTS NOTE
-- ============================================================================
-- Sample comments will be created automatically when tickets are created through
-- the application. The ticket_comments table supports:
--   - Regular comments visible to all
--   - Internal comments (tech-only)
--   - Threaded replies (parent_comment_id)
--   - Soft deletes (deleted_at)

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Seed data loaded successfully' AS status;
SELECT '========================================' AS separator;
SELECT 'Sample Users Created:' AS info;
SELECT email, first_name, last_name, role FROM users ORDER BY role, email;
SELECT '========================================' AS separator;
SELECT 'Ticket Templates Created:' AS info;
SELECT name, category, default_priority, is_active FROM ticket_templates ORDER BY category, name;
SELECT '========================================' AS separator;
SELECT 'Login Credentials:' AS info;
SELECT 'Customer/Admin: BlueClue2026!' AS password_info;
SELECT 'Technicians: admin123 (must change on first login)' AS tech_password_info;
SELECT '========================================' AS separator;
SELECT 'IMPORTANT: No tickets created - submit new tickets via the app to test AI classification!' AS note;
SELECT 'Ticket templates are available for quick ticket creation.' AS template_note;
