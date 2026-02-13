-- ============================================================================
-- BlueClue Support Ticket System - Sample Data (Seed File)
-- ============================================================================
-- Description: Minimal sample data for development and testing
-- Version: 2.0.0
-- Updated: 2026-02-13
-- Note: Tickets are NOT pre-created - create them via the app to test AI classifier
-- Note: Technicians are created in auth_setup.sql - do NOT truncate users table
-- ============================================================================

-- Clear existing ticket data only (preserve users created in auth_setup.sql)
TRUNCATE TABLE ticket_history, ticket_assignments, ai_classifications, tickets RESTART IDENTITY CASCADE;

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
VALUES ('admin@blueclue.com', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Admin', 'User', 'admin', 'admin', '+1-555-0300', 'BlueClue Support', true);

UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE email = 'admin@blueclue.com';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Seed data loaded successfully' AS status;
SELECT '========================================' AS separator;
SELECT 'Sample Users Created:' AS info;
SELECT email, first_name, last_name, role FROM users ORDER BY role, email;
SELECT '========================================' AS separator;
SELECT 'Login Credentials:' AS info;
SELECT 'Customer/Admin: BlueClue2026!' AS password_info;
SELECT 'Technicians: admin123 (must change on first login)' AS tech_password_info;
SELECT '========================================' AS separator;
SELECT 'IMPORTANT: No tickets created - submit new tickets via the app to test AI classification!' AS note;
