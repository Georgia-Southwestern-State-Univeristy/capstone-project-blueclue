-- ============================================================================
-- BlueClue Support Ticket System - Sample Data (Seed File)
-- ============================================================================
-- Description: Realistic sample data for testing and demonstration purposes
-- Version: 1.0.0
-- Created: 2026-02-02
-- ============================================================================
-- NOTE: This file assumes schema.sql has already been executed
-- ============================================================================

-- Clear existing data (for clean re-seeding)
TRUNCATE TABLE ticket_history, ticket_assignments, tickets, users RESTART IDENTITY CASCADE;

-- ============================================================================
-- SAMPLE USERS
-- ============================================================================
-- Password for all users: "BlueClue2026!" (hashed with bcrypt)
-- Hash generated using bcrypt with cost factor 10

INSERT INTO users (email, password_hash, first_name, last_name, role, phone, company, is_active) VALUES
    -- Customers
    ('sarah.johnson@techcorp.com', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Sarah', 'Johnson', 'customer', '+1-555-0101', 'TechCorp Industries', true),
    ('mike.chen@startupxyz.io', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Michael', 'Chen', 'customer', '+1-555-0102', 'StartupXYZ', true),
    ('emily.rodriguez@freelance.net', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Emily', 'Rodriguez', 'customer', '+1-555-0103', NULL, true),
    
    -- Technicians
    ('david.park@blueclue.com', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'David', 'Park', 'technician', '+1-555-0201', 'BlueClue Support', true),
    ('jessica.martinez@blueclue.com', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Jessica', 'Martinez', 'technician', '+1-555-0202', 'BlueClue Support', true),
    
    -- Admin
    ('admin@blueclue.com', '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Admin', 'User', 'admin', '+1-555-0300', 'BlueClue Support', true);

-- Update last login times to make data realistic
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '2 hours' WHERE email = 'sarah.johnson@techcorp.com';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE email = 'mike.chen@startupxyz.io';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '5 hours' WHERE email = 'emily.rodriguez@freelance.net';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE email = 'david.park@blueclue.com';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE email = 'jessica.martinez@blueclue.com';
UPDATE users SET last_login = CURRENT_TIMESTAMP - INTERVAL '3 hours' WHERE email = 'admin@blueclue.com';

-- ============================================================================
-- SAMPLE TICKETS
-- ============================================================================
-- Creating 5 diverse tickets with AI classification data

-- Ticket 1: Critical Technical Issue (High Priority, Assigned, In Progress)
INSERT INTO tickets (
    customer_id, 
    assigned_to,
    subject, 
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at,
    first_response_at
) VALUES (
    1, -- Sarah Johnson
    4, -- David Park (technician)
    'URGENT: Application crashes on startup after latest update',
    'Our production application started crashing immediately after we deployed the latest update this morning. Multiple users are affected and cannot access the system. Error message shows "Runtime Exception: Null Pointer at line 247". This is blocking all our operations. Need immediate assistance!',
    'technical',
    'high',
    'in_progress',
    true,
    0.95,
    false,
    '{"category": ["crash", "error", "production"], "priority": ["urgent", "immediately", "need"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours 45 minutes'
);

-- Ticket 2: Billing Issue (Medium Priority, Assigned, Open)
INSERT INTO tickets (
    customer_id,
    assigned_to,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at
) VALUES (
    2, -- Mike Chen
    5, -- Jessica Martinez (technician)
    'Double charged for monthly subscription',
    'I noticed that my credit card was charged twice for this month''s subscription. The first charge of $99.99 was on Feb 1st, which is correct. However, there was another identical charge on Feb 2nd. Could you please investigate and process a refund for the duplicate charge? My invoice numbers are INV-2026-0234 and INV-2026-0247.',
    'billing',
    'medium',
    'open',
    true,
    1.0,
    false,
    '{"category": ["charged", "subscription", "refund", "invoice"], "priority": ["charge", "refund"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '5 hours'
);

-- Ticket 3: Account Access Issue (Medium Priority, Assigned, Waiting on Customer)
INSERT INTO tickets (
    customer_id,
    assigned_to,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at,
    first_response_at
) VALUES (
    3, -- Emily Rodriguez
    4, -- David Park (technician)
    'Cannot reset password - link not working',
    'I''ve been trying to reset my password using the "Forgot Password" feature, but the reset link I receive via email doesn''t work. When I click it, I get redirected to the homepage instead of the password reset page. I''ve tried this 3 times already with the same result. I really need to access my account for an important project deadline.',
    'account',
    'medium',
    'waiting_on_customer',
    true,
    0.89,
    false,
    '{"category": ["password", "reset", "access", "account"], "priority": ["need", "problem"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '1 day 2 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour'
);

-- Ticket 4: Feature Request (Low Priority, Unassigned, Open)
INSERT INTO tickets (
    customer_id,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at
) VALUES (
    1, -- Sarah Johnson
    'Suggestion: Add dark mode to the dashboard',
    'I use the application extensively during evening hours and would really appreciate a dark mode option for the dashboard. Many team members have mentioned this would reduce eye strain. It would be great if this could toggle automatically based on system preferences or allow manual switching. Just a suggestion for future consideration!',
    'feature_request',
    'low',
    'open',
    true,
    0.67,
    false,
    '{"category": ["add", "suggestion"], "priority": ["suggestion"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
);

-- Ticket 5: General Inquiry with Fallback (Low Priority, Unassigned, Open)
INSERT INTO tickets (
    customer_id,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at
) VALUES (
    2, -- Mike Chen
    'Question about API rate limits',
    'Hi, I was wondering what the current API rate limits are for the standard plan. Also, what happens if we exceed the limit? Is there a way to temporarily increase the limit for special events?',
    'general',
    'low',
    'open',
    true,
    0.3,
    true,
    '{"category": [], "priority": ["question", "wondering"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '6 hours'
);

-- ============================================================================
-- TICKET ASSIGNMENTS
-- ============================================================================
-- Track assignment history for assigned tickets

-- Ticket 1 assignments
INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_by, assigned_at) VALUES
    (1, 4, 6, CURRENT_TIMESTAMP - INTERVAL '2 hours 50 minutes'); -- Assigned to David Park by Admin

-- Ticket 2 assignments
INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_by, assigned_at) VALUES
    (2, 5, 6, CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes'); -- Assigned to Jessica Martinez by Admin

-- Ticket 3 assignment history (reassigned once)
INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_by, assigned_at, unassigned_at) VALUES
    (3, 5, 6, CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour 30 minutes', CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour'); -- First assigned to Jessica

INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_by, assigned_at) VALUES
    (3, 4, 6, CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour'); -- Reassigned to David

-- ============================================================================
-- TICKET HISTORY
-- ============================================================================
-- Add some realistic change history

-- Ticket 1 history - Status changes
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at) VALUES
    (1, 4, 'status_change', 'status', 'open', 'in_progress', CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes'),
    (1, 4, 'comment', NULL, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes');

UPDATE ticket_history 
SET comment = 'Investigating the null pointer exception. Checking deployment logs and application state.'
WHERE ticket_id = 1 AND change_type = 'comment';

-- Ticket 2 history - Assignment
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at) VALUES
    (2, 5, 'assignment', 'assigned_to', 'unassigned', '5', CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes');

-- Ticket 3 history - Multiple changes
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at) VALUES
    (3, 5, 'assignment', 'assigned_to', 'unassigned', '5', CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour 30 minutes'),
    (3, 5, 'comment', NULL, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour 15 minutes'),
    (3, 6, 'assignment', 'assigned_to', '5', '4', CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour'),
    (3, 4, 'status_change', 'status', 'open', 'waiting_on_customer', CURRENT_TIMESTAMP - INTERVAL '1 day 45 minutes'),
    (3, 4, 'comment', NULL, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '1 day 45 minutes');

-- Add comments to history records
UPDATE ticket_history 
SET comment = 'Sent password reset link manually. Please check your spam folder if not received.'
WHERE ticket_id = 3 AND change_type = 'comment' AND created_at = CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour 15 minutes';

UPDATE ticket_history 
SET comment = 'Awaiting customer confirmation that manual reset link works. Sent follow-up email.'
WHERE ticket_id = 3 AND change_type = 'comment' AND created_at = CURRENT_TIMESTAMP - INTERVAL '1 day 45 minutes';

-- ============================================================================
-- ADDITIONAL REALISTIC TICKETS FOR BETTER DEMO
-- ============================================================================
-- Add 5 more tickets to have a total of 10 for better demonstration

-- Ticket 6: Resolved Technical Issue
INSERT INTO tickets (
    customer_id,
    assigned_to,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    resolution,
    resolved_at,
    resolved_by,
    created_at,
    first_response_at
) VALUES (
    3, -- Emily Rodriguez
    5, -- Jessica Martinez
    'Slow page loading on reports dashboard',
    'The reports dashboard has been extremely slow to load over the past few days. It takes 30-45 seconds to display data that used to appear in 2-3 seconds. This is affecting our ability to generate client reports on time.',
    'technical',
    'medium',
    'resolved',
    true,
    0.82,
    false,
    '{"category": ["slow", "performance", "issue"], "priority": ["issue", "problem"]}'::jsonb,
    'Issue was caused by inefficient database query after recent schema update. Optimized the query by adding proper indexes on the reports table. Page now loads in under 2 seconds. Monitored performance for 24 hours - all metrics normal.',
    CURRENT_TIMESTAMP - INTERVAL '12 hours',
    5,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day 20 hours'
);

-- Ticket 7: Open Account Issue  
INSERT INTO tickets (
    customer_id,
    assigned_to,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at
) VALUES (
    1, -- Sarah Johnson
    4, -- David Park
    'Unable to update profile information',
    'When I try to update my company information in my profile settings, I get an error message saying "Failed to save changes". All other fields update fine, just the company and phone number fields are not working.',
    'account',
    'low',
    'open',
    true,
    0.77,
    false,
    '{"category": ["profile", "settings", "not working"], "priority": ["question"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '8 hours'
);

-- Ticket 8: Closed Feature Request
INSERT INTO tickets (
    customer_id,
    assigned_to,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    resolution,
    resolved_at,
    resolved_by,
    closed_at,
    created_at,
    first_response_at
) VALUES (
    2, -- Mike Chen
    4, -- David Park
    'Request: Export tickets to CSV',
    'Would be very helpful to have an option to export all tickets to CSV format for reporting purposes. We need to analyze ticket trends in Excel and currently have to manually copy data.',
    'feature_request',
    'low',
    'closed',
    true,
    0.71,
    false,
    '{"category": ["request", "would like"], "priority": ["request"]}'::jsonb,
    'Great suggestion! This feature was actually already planned for our Q1 2026 release. CSV export functionality will be available in the next major update (v2.1) scheduled for February 15, 2026. The feature will allow exporting tickets with filters applied.',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    4,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
);

-- Ticket 9: High Priority Billing (Open)
INSERT INTO tickets (
    customer_id,
    assigned_to,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at,
    first_response_at
) VALUES (
    3, -- Emily Rodriguez
    5, -- Jessica Martinez
    'Payment failed but account shows as suspended',
    'My payment failed due to an expired credit card, which I understand. However, I updated my payment method immediately and the payment went through successfully (confirmation #PMT-2026-4521), but my account still shows as suspended. I need urgent access to retrieve my data for a client presentation tomorrow.',
    'billing',
    'high',
    'in_progress',
    true,
    0.93,
    false,
    '{"category": ["payment", "account", "credit card"], "priority": ["urgent", "need"]}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours 45 minutes'
);

-- Ticket 10: General with Low Confidence
INSERT INTO tickets (
    customer_id,
    subject,
    description,
    category,
    priority,
    status,
    ai_classified,
    ai_confidence,
    ai_fallback_used,
    ai_keywords_matched,
    created_at
) VALUES (
    1, -- Sarah Johnson
    'Integration documentation',
    'Looking for docs on webhooks',
    'general',
    'low',
    'open',
    true,
    0.3,
    true,
    '{"category": [], "priority": []}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '10 hours'
);

-- Add assignments for new tickets
INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_by, assigned_at, unassigned_at) VALUES
    (6, 5, 6, CURRENT_TIMESTAMP - INTERVAL '1 day 22 hours', CURRENT_TIMESTAMP - INTERVAL '12 hours');

INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_by, assigned_at) VALUES
    (7, 4, 6, CURRENT_TIMESTAMP - INTERVAL '7 hours'),
    (8, 4, 6, CURRENT_TIMESTAMP - INTERVAL '5 days'),
    (9, 5, 6, CURRENT_TIMESTAMP - INTERVAL '3 hours 50 minutes');

-- Add history for resolved/closed tickets
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at, comment) VALUES
    (6, 5, 'status_change', 'status', 'open', 'in_progress', CURRENT_TIMESTAMP - INTERVAL '1 day 18 hours', 'Investigating query performance issue'),
    (6, 5, 'status_change', 'status', 'in_progress', 'resolved', CURRENT_TIMESTAMP - INTERVAL '12 hours', 'Fixed and verified'),
    (8, 4, 'status_change', 'status', 'open', 'resolved', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Feature already planned for next release'),
    (8, 4, 'status_change', 'status', 'resolved', 'closed', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Customer acknowledged'),
    (9, 5, 'status_change', 'status', 'open', 'in_progress', CURRENT_TIMESTAMP - INTERVAL '3 hours 40 minutes', 'Manually reactivating account and verifying payment');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- These queries can be used to verify the seed data was inserted correctly

-- Check user count by role
-- SELECT role, COUNT(*) FROM users GROUP BY role;

-- Check ticket count by status
-- SELECT status, COUNT(*) FROM tickets GROUP BY status;

-- Check ticket count by priority
-- SELECT priority, COUNT(*) FROM tickets GROUP BY priority;

-- Check ticket count by category
-- SELECT category, COUNT(*) FROM tickets GROUP BY category;

-- Check AI classification stats
-- SELECT 
--     ai_classified,
--     ai_fallback_used,
--     COUNT(*) as count,
--     AVG(ai_confidence) as avg_confidence
-- FROM tickets
-- GROUP BY ai_classified, ai_fallback_used;

-- View active tickets summary
-- SELECT * FROM active_tickets_view ORDER BY created_at DESC;

-- View technician workload
-- SELECT * FROM technician_workload_view;

-- View category statistics
-- SELECT * FROM category_statistics_view;

-- ============================================================================
-- DATA SUMMARY
-- ============================================================================
-- Users: 6 total (3 customers, 2 technicians, 1 admin)
-- Tickets: 10 total
--   - Status: 5 open, 2 in_progress, 1 waiting_on_customer, 1 resolved, 1 closed
--   - Priority: 5 low, 3 medium, 2 high, 0 critical
--   - Categories: 2 general, 3 technical, 2 billing, 2 account, 2 feature_request
--   - AI Classification: 10 classified (2 with fallback, 8 confident)
-- Assignments: 10 assignment records (1 reassignment case)
-- History: 15+ history records tracking changes
-- ============================================================================

-- Completion message
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'BlueClue Database Seed Completed Successfully!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Users Created: 6 (3 customers, 2 technicians, 1 admin)';
    RAISE NOTICE 'Tickets Created: 10 (diverse statuses, priorities, and categories)';
    RAISE NOTICE 'Default Password: BlueClue2026!';
    RAISE NOTICE ' ';
    RAISE NOTICE 'Sample User Logins:';
    RAISE NOTICE '  Customer: sarah.johnson@techcorp.com';
    RAISE NOTICE '  Customer: mike.chen@startupxyz.io';
    RAISE NOTICE '  Customer: emily.rodriguez@freelance.net';
    RAISE NOTICE '  Technician: david.park@blueclue.com';
    RAISE NOTICE '  Technician: jessica.martinez@blueclue.com';
    RAISE NOTICE '  Admin: admin@blueclue.com';
    RAISE NOTICE '============================================================================';
END $$;
