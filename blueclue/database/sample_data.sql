-- ============================================================================
-- BlueClue Support Ticket System - Comprehensive Sample Data
-- ============================================================================
-- Description: Rich sample data to populate ALL management dashboard widgets
-- Created: 2026-02-23
-- Purpose: Testing OverdueTickets, Escalations, TodaysActions, TicketCategories,
--          UnassignedVsAssigned, TopRequesters, TechPerformance, and AI Analytics
-- ============================================================================
-- USAGE:
--   1. Make sure schema.sql, auth_setup.sql, and seed.sql have been run first
--   2. Make sure migration 002_add_ai_priority_influence.sql has been applied
--   3. Run this file: psql -U <user> -d <db> -f sample_data.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: Look up user IDs (we reference them by email throughout)
-- ============================================================================

DO $$
DECLARE
    -- Technicians (from auth_setup.sql)
    tech_tnewc_id   INTEGER;
    tech_cmcgo_id   INTEGER;
    tech_jwill_id   INTEGER;
    sr_mjohnson_id  INTEGER;
    sr_ebrown_id    INTEGER;

    -- Management (from auth_setup.sql)
    mgmt_jdoe_id    INTEGER;

    -- Admin (from seed.sql)
    admin_id        INTEGER;

    -- Customers (from seed.sql)
    cust_mike_id    INTEGER;
    cust_emily_id   INTEGER;
    cust_david_id   INTEGER;
    cust_sarah_id   INTEGER;
    
    -- Extra customers we'll create
    cust_alex_id    INTEGER;
    cust_lisa_id    INTEGER;
    cust_james_id   INTEGER;
    cust_nina_id    INTEGER;
    cust_carlos_id  INTEGER;
    cust_priya_id   INTEGER;

    -- Ticket ID counters
    tid INTEGER;
    
BEGIN

-- Look up existing users
SELECT id INTO tech_tnewc_id  FROM users WHERE email = 'tnewc@blueclue.com';
SELECT id INTO tech_cmcgo_id  FROM users WHERE email = 'cmcgo@blueclue.com';
SELECT id INTO tech_jwill_id  FROM users WHERE email = 'jwill@blueclue.com';
SELECT id INTO sr_mjohnson_id FROM users WHERE email = 'mjohnson@blueclue.com';
SELECT id INTO sr_ebrown_id   FROM users WHERE email = 'ebrown@blueclue.com';
SELECT id INTO mgmt_jdoe_id   FROM users WHERE email = 'jdoe@blueclue.com';
SELECT id INTO admin_id       FROM users WHERE email = 'admin@blueclue.com';
SELECT id INTO cust_mike_id   FROM users WHERE email = 'mike.chen@startupxyz.io';
SELECT id INTO cust_emily_id  FROM users WHERE email = 'emily.rodriguez@freelance.net';
SELECT id INTO cust_david_id  FROM users WHERE email = 'david.kim@techcorp.com';
SELECT id INTO cust_sarah_id  FROM users WHERE email = 'sarah.johnson@marketing.io';

-- ============================================================================
-- STEP 1: Create additional customer users for richer data
-- ============================================================================

INSERT INTO users (email, password_hash, first_name, last_name, role, phone, company, is_active, last_login)
VALUES
    ('alex.turner@widgets.co',       '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Alex',   'Turner',   'customer', '+1-555-0201', 'Widgets Co',          true, NOW() - INTERVAL '3 hours'),
    ('lisa.park@devhouse.io',        '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Lisa',   'Park',     'customer', '+1-555-0202', 'DevHouse',            true, NOW() - INTERVAL '1 day'),
    ('james.wright@bigretail.com',   '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'James',  'Wright',   'customer', '+1-555-0203', 'BigRetail Inc',       true, NOW() - INTERVAL '6 hours'),
    ('nina.patel@creativelab.net',   '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Nina',   'Patel',    'customer', '+1-555-0204', 'Creative Lab',        true, NOW() - INTERVAL '2 days'),
    ('carlos.mendez@logisticore.com','$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Carlos', 'Mendez',   'customer', '+1-555-0205', 'LogistiCore',         true, NOW() - INTERVAL '4 hours'),
    ('priya.sharma@edutech.org',     '$2b$10$rX8yQKZ5YxJqN7mP6LQ8.OXvFZH9GqWnR4sT2uVxK3lM5nP7oQ9aG', 'Priya',  'Sharma',   'customer', '+1-555-0206', 'EduTech Foundation',  true, NOW() - INTERVAL '12 hours')
ON CONFLICT (email) DO NOTHING;

SELECT id INTO cust_alex_id   FROM users WHERE email = 'alex.turner@widgets.co';
SELECT id INTO cust_lisa_id   FROM users WHERE email = 'lisa.park@devhouse.io';
SELECT id INTO cust_james_id  FROM users WHERE email = 'james.wright@bigretail.com';
SELECT id INTO cust_nina_id   FROM users WHERE email = 'nina.patel@creativelab.net';
SELECT id INTO cust_carlos_id FROM users WHERE email = 'carlos.mendez@logisticore.com';
SELECT id INTO cust_priya_id  FROM users WHERE email = 'priya.sharma@edutech.org';

-- ============================================================================
-- STEP 2: Insert tickets with realistic data across all categories/priorities
-- ============================================================================
-- We'll create ~45 tickets covering every scenario the widgets need.
-- The SLA trigger will auto-set response_due_at and resolution_due_at based on priority,
-- and the ticket_number trigger will auto-generate TICK-YYYY-NNNNN.
-- We manually override created_at and SLA dates to simulate real timelines.

-- ────────────────────────────────────────────────
-- GROUP A: CRITICAL tickets (overdue, escalation, today's actions)
-- ────────────────────────────────────────────────

-- A1: Critical - overdue 10 days, unassigned → escalation, overdue, unassigned_urgent, top requester
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_mike_id, NULL, 'Production server completely down',
        'Our main production server has been unresponsive since early this morning. All customer-facing services are affected. This is causing significant revenue loss. We need immediate assistance to bring the server back online.',
        'network', 'critical', 'open',
        true, 0.95, 'critical', 'critical',
        'critical', false, 'ai_direct',
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');
-- Override SLA to make it overdue
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '9 days 20 hours',
                   response_due_at = NOW() - INTERVAL '9 days 23 hours'
WHERE subject = 'Production server completely down';

-- A2: Critical - overdue 5 days, assigned to tnewc → escalation, overdue
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_david_id, tech_tnewc_id, 'Database corruption detected',
        'We are seeing data corruption across multiple tables in our production database. Some customer records are showing scrambled data. The integrity of our financial records may be compromised.',
        'software', 'critical', 'in_progress',
        true, 0.92, 'critical', 'critical',
        'critical', false, 'ai_direct',
        NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '4 days 20 hours',
                   response_due_at = NOW() - INTERVAL '4 days 23 hours',
                   first_response_at = NOW() - INTERVAL '4 days 22 hours'
WHERE subject = 'Database corruption detected';

-- A3: Critical - due today, assigned to cmcgo → today's actions (due_today), escalation
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_alex_id, tech_cmcgo_id, 'Complete system authentication failure',
        'Users across the entire organization are unable to log in. The authentication service appears to be returning 500 errors. This is blocking all work company-wide and affecting over 200 employees.',
        'login', 'critical', 'in_progress',
        true, 0.97, 'critical', 'critical',
        'critical', false, 'ai_direct',
        NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '1 hour',
                   response_due_at = NOW() - INTERVAL '2 hours',
                   first_response_at = NOW() - INTERVAL '2 hours 30 minutes'
WHERE subject = 'Complete system authentication failure';

-- A4: Critical - unassigned, new → escalation, unassigned_urgent
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_carlos_id, NULL, 'Ransomware detected on file server',
        'Our security monitoring tool flagged a ransomware infection on the main file server. Files are being encrypted right now. We need to isolate the server and begin remediation ASAP before it spreads to other systems.',
        'network', 'critical', 'open',
        true, 0.98, 'critical', 'critical',
        'critical', false, 'ai_direct',
        NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '3 hours 30 minutes',
                   response_due_at = NOW() + INTERVAL '30 minutes'
WHERE subject = 'Ransomware detected on file server';

-- ────────────────────────────────────────────────
-- GROUP B: HIGH priority tickets (mix of assigned / overdue)
-- ────────────────────────────────────────────────

-- B1: High - overdue 3 days, assigned to jwill → overdue, escalation
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_emily_id, tech_jwill_id, 'Email server not delivering messages',
        'Our email server has stopped delivering messages to external recipients. Internal emails work fine but nothing is going out. We have critical client communications pending.',
        'network', 'high', 'in_progress',
        true, 0.88, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '3 days 16 hours',
                   response_due_at = NOW() - INTERVAL '3 days 22 hours',
                   first_response_at = NOW() - INTERVAL '3 days 21 hours'
WHERE subject = 'Email server not delivering messages';

-- B2: High - overdue 1 day, assigned to mjohnson → overdue
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_sarah_id, sr_mjohnson_id, 'Payroll system calculation errors',
        'The payroll module is miscalculating overtime hours for hourly employees. The pay run is scheduled for tomorrow and we need this fixed before paychecks go out.',
        'software', 'high', 'in_progress',
        true, 0.85, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '1 day 16 hours',
                   response_due_at = NOW() - INTERVAL '1 day 22 hours',
                   first_response_at = NOW() - INTERVAL '1 day 20 hours'
WHERE subject = 'Payroll system calculation errors';

-- B3: High - unassigned → escalation, unassigned_urgent
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_lisa_id, NULL, 'Customer data breach suspected',
        'We found evidence that customer payment information may have been accessed by an unauthorized third party. Our security logs show unusual access patterns over the past 48 hours.',
        'account', 'high', 'open',
        true, 0.91, 'high', 'critical',
        'high', true, 'user_override',
        NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '2 hours',
                   response_due_at = NOW() - INTERVAL '4 hours'
WHERE subject = 'Customer data breach suspected';

-- B4: High - assigned to ebrown, not overdue
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_james_id, sr_ebrown_id, 'Firewall blocking legitimate traffic',
        'Our new firewall rules appear to be blocking legitimate API traffic from partner integrations. Several automated processes have stopped working since the firewall update last night.',
        'network', 'high', 'in_progress',
        true, 0.87, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '3 hours',
                   response_due_at = NOW() - INTERVAL '3 hours',
                   first_response_at = NOW() - INTERVAL '3 hours 30 minutes'
WHERE subject = 'Firewall blocking legitimate traffic';

-- B5: High - assigned to tnewc, not overdue, due today
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_priya_id, tech_tnewc_id, 'Student portal login failures',
        'Students are unable to access the learning portal. The SSO integration with our identity provider seems broken. Over 500 students are affected and midterm exams start tomorrow.',
        'login', 'high', 'open',
        true, 0.83, 'medium', 'high',
        'medium', true, 'user_override',
        NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '4 hours',
                   response_due_at = NOW() - INTERVAL '2 hours',
                   first_response_at = NOW() - INTERVAL '1 hour 30 minutes'
WHERE subject = 'Student portal login failures';

-- B6: High - unassigned
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_nina_id, NULL, 'Main website throwing 502 errors',
        'Our company website has been returning 502 Bad Gateway errors intermittently for the past hour. About 40% of page loads are failing. Our analytics show a significant drop in traffic.',
        'technical', 'high', 'open',
        true, 0.89, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '7 hours',
                   response_due_at = NOW() + INTERVAL '1 hour'
WHERE subject = 'Main website throwing 502 errors';

-- ────────────────────────────────────────────────
-- GROUP C: MEDIUM priority tickets (various statuses, categories)
-- ────────────────────────────────────────────────

-- C1: Medium - hardware, assigned to cmcgo, in_progress
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_mike_id, tech_cmcgo_id, 'Office printer jamming frequently',
        'The HP LaserJet on the 3rd floor has been jamming every few pages. We have already replaced the paper tray and tried different paper but the issue persists. Print jobs are backing up.',
        'hardware', 'medium', 'in_progress',
        true, 0.82, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '1 day',
                   response_due_at = NOW() - INTERVAL '1 day 20 hours',
                   first_response_at = NOW() - INTERVAL '1 day 18 hours'
WHERE subject = 'Office printer jamming frequently';

-- C2: Medium - software, assigned to jwill, waiting_on_customer
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_emily_id, tech_jwill_id, 'Microsoft Office crashing when opening large files',
        'Excel crashes every time I try to open spreadsheets larger than 50MB. I have 16GB of RAM and the latest Office update installed. Error code: 0xc0000005.',
        'software', 'medium', 'waiting_on_customer',
        true, 0.78, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '2 days',
                   response_due_at = NOW() - INTERVAL '2 days 20 hours',
                   first_response_at = NOW() - INTERVAL '2 days 18 hours'
WHERE subject = 'Microsoft Office crashing when opening large files';

-- C3: Medium - billing, unassigned
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_david_id, NULL, 'Double charged for last month subscription',
        'I was charged twice for my February subscription. My credit card statement shows two charges of $49.99 on Feb 1st and Feb 3rd. Please refund the duplicate charge as soon as possible.',
        'billing', 'medium', 'open',
        true, 0.90, 'medium', 'high',
        'medium', true, 'weighted_average',
        NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '4 days',
                   response_due_at = NOW() - INTERVAL '4 days 20 hours'
WHERE subject = 'Double charged for last month subscription';

-- C4: Medium - account, assigned to mjohnson
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_alex_id, sr_mjohnson_id, 'Need to update company billing information',
        'Our company recently merged and we need to update our billing address, company name, and tax ID across all accounts. The old company name is Widgets Co and the new name is WidgetsTech Inc.',
        'account', 'medium', 'in_progress',
        true, 0.75, 'low', 'medium',
        'low', true, 'user_override',
        NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '12 hours',
                   response_due_at = NOW() - INTERVAL '12 hours',
                   first_response_at = NOW() - INTERVAL '10 hours'
WHERE subject = 'Need to update company billing information';

-- C5: Medium - feature_request, assigned to tnewc
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_sarah_id, tech_tnewc_id, 'Add dark mode to the web dashboard',
        'Would love to see a dark mode option in the dashboard. Working late at night with the bright white screen is really hard on the eyes. Many of our team members have requested this.',
        'feature_request', 'medium', 'open',
        true, 0.72, 'low', 'medium',
        'low', true, 'weighted_average',
        NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '4 days',
                   response_due_at = NOW() - INTERVAL '6 days 20 hours',
                   first_response_at = NOW() - INTERVAL '6 days 16 hours'
WHERE subject = 'Add dark mode to the web dashboard';

-- C6: Medium - hardware, assigned to ebrown
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_lisa_id, sr_ebrown_id, 'Laptop battery draining in 2 hours',
        'My Dell Latitude laptop battery is dying within 2 hours of full charge. It used to last 6-8 hours. I have already calibrated the battery and checked power settings. Laptop is 18 months old.',
        'hardware', 'medium', 'in_progress',
        true, 0.80, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '2 days',
                   response_due_at = NOW() - INTERVAL '2 days 20 hours',
                   first_response_at = NOW() - INTERVAL '2 days 19 hours'
WHERE subject = 'Laptop battery draining in 2 hours';

-- C7: Medium - technical, unassigned
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_james_id, NULL, 'API rate limiting too aggressive',
        'Our API integration is hitting rate limits even with very conservative request patterns. We are seeing 429 responses after only 10 requests per minute. The docs say the limit should be 100/min.',
        'technical', 'medium', 'open',
        true, 0.76, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '12 hours',
                   response_due_at = NOW() - INTERVAL '8 hours'
WHERE subject = 'API rate limiting too aggressive';

-- C8: Medium - network, assigned to cmcgo
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_nina_id, tech_cmcgo_id, 'WiFi dropping in conference rooms',
        'The WiFi signal in conference rooms B and C keeps dropping during video calls. Signal strength shows as weak even though the access points were installed last month.',
        'network', 'medium', 'in_progress',
        true, 0.81, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days');
UPDATE tickets SET resolution_due_at = NOW() - INTERVAL '3 days',
                   response_due_at = NOW() - INTERVAL '3 days 20 hours',
                   first_response_at = NOW() - INTERVAL '3 days 18 hours'
WHERE subject = 'WiFi dropping in conference rooms';

-- ────────────────────────────────────────────────
-- GROUP D: LOW priority tickets
-- ────────────────────────────────────────────────

-- D1: Low - general, unassigned
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_carlos_id, NULL, 'How to export reports to PDF',
        'I am trying to export my monthly report to PDF but cannot find the option. Is this feature available in my plan? If yes, could you please walk me through the steps?',
        'general', 'low', 'open',
        true, 0.65, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- D2: Low - billing, assigned to jwill
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_priya_id, tech_jwill_id, 'Request for educational discount',
        'We are a non-profit educational institution. Can you give us details about your educational pricing? We have about 50 faculty accounts and 500 student accounts.',
        'billing', 'low', 'open',
        true, 0.70, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days');

-- D3: Low - feature_request, unassigned
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_mike_id, NULL, 'Add Slack integration for notifications',
        'It would be great to receive ticket notifications directly in our Slack workspace. We use Slack for all team communications and this would streamline our workflow significantly.',
        'feature_request', 'low', 'open',
        true, 0.68, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- D4: Low - other, assigned to tnewc
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_sarah_id, tech_tnewc_id, 'Update documentation for new API endpoints',
        'The API documentation does not include the new batch processing endpoints that were released last week. Could you update the docs with examples and rate limit info?',
        'other', 'low', 'in_progress',
        true, 0.55, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days');

-- D5: Low - login, unassigned
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_alex_id, NULL, 'Set up two-factor authentication',
        'I would like to enable 2FA on my account for extra security. Can you provide instructions on how to set this up? Do you support authenticator apps or just SMS?',
        'login', 'low', 'open',
        true, 0.73, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');

-- ────────────────────────────────────────────────
-- GROUP E: RESOLVED / CLOSED tickets (for tech performance metrics)
-- ────────────────────────────────────────────────

-- E1: Resolved by tnewc - fast resolution (hardware)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_emily_id, tech_tnewc_id, 'Monitor flickering intermittently',
        'My 27-inch Dell monitor has been flickering every few minutes. Tried different cables and ports.',
        'hardware', 'medium', 'resolved',
        true, 0.84, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '7 days', tech_tnewc_id, 'Replaced display cable - intermittent short was causing flicker.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '7 days 20 hours'
WHERE subject = 'Monitor flickering intermittently';

-- E2: Resolved by tnewc - medium resolution (software)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_david_id, tech_tnewc_id, 'Antivirus blocking internal application',
        'Windows Defender is quarantining our custom inventory management EXE. It is a false positive.',
        'software', 'high', 'resolved',
        true, 0.86, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '10 days', tech_tnewc_id, 'Added exclusion rule in Windows Defender for the application directory.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '11 days 20 hours'
WHERE subject = 'Antivirus blocking internal application';

-- E3: Resolved by cmcgo - quick resolution (login)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_sarah_id, tech_cmcgo_id, 'Account locked after too many failed attempts',
        'My account got locked after entering the wrong password. I remember my password now, please unlock my account.',
        'login', 'high', 'resolved',
        true, 0.93, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days 20 hours',
        NOW() - INTERVAL '5 days 20 hours', tech_cmcgo_id, 'Account unlocked and password reset link sent.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '5 days 22 hours'
WHERE subject = 'Account locked after too many failed attempts';

-- E4: Resolved by cmcgo - medium resolution (network)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_mike_id, tech_cmcgo_id, 'VPN disconnects every 30 minutes',
        'The VPN connection drops precisely every 30 minutes and I have to reconnect. This is disrupting my remote work.',
        'network', 'medium', 'resolved',
        true, 0.79, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '12 days', tech_cmcgo_id, 'Updated VPN client to latest version and adjusted MTU settings - session timeout was misconfigured.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '13 days 16 hours'
WHERE subject = 'VPN disconnects every 30 minutes';

-- E5: Resolved by jwill - slow resolution (billing)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_lisa_id, tech_jwill_id, 'Invoice discrepancy for Q4 2025',
        'The Q4 invoice does not match our usage records. We show 1,200 API calls but were billed for 3,500.',
        'billing', 'medium', 'resolved',
        true, 0.77, 'medium', 'high',
        'medium', true, 'weighted_average',
        NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days',
        NOW() - INTERVAL '15 days', tech_jwill_id, 'Billing error confirmed. Credit memo issued for $247.50. Updated usage tracking system.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '19 days'
WHERE subject = 'Invoice discrepancy for Q4 2025';

-- E6: Resolved by jwill - quick resolution (general)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_james_id, tech_jwill_id, 'Need help understanding dashboard metrics',
        'I am new to the platform and confused about what some of the dashboard metrics mean. Can someone walk me through them?',
        'general', 'low', 'resolved',
        true, 0.60, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '8 days', tech_jwill_id, 'Provided detailed walkthrough of all dashboard metrics via screen share.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '8 days 16 hours'
WHERE subject = 'Need help understanding dashboard metrics';

-- E7: Resolved by mjohnson - critical fast (technical)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_carlos_id, sr_mjohnson_id, 'SSL certificate expired on API gateway',
        'Our API gateway SSL certificate expired and all HTTPS connections are failing. Customers are seeing security warnings.',
        'technical', 'critical', 'resolved',
        true, 0.96, 'critical', 'critical',
        'critical', false, 'ai_direct',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days 20 hours',
        NOW() - INTERVAL '3 days 20 hours', sr_mjohnson_id, 'Renewed SSL certificate and installed on API gateway. Set up auto-renewal alerts.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '3 days 23 hours'
WHERE subject = 'SSL certificate expired on API gateway';

-- E8: Resolved by mjohnson (account)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_nina_id, sr_mjohnson_id, 'Merge duplicate accounts',
        'I accidentally created two accounts with different email addresses. Please merge them under nina.patel@creativelab.net.',
        'account', 'low', 'resolved',
        true, 0.71, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '11 days', NOW() - INTERVAL '9 days',
        NOW() - INTERVAL '9 days', sr_mjohnson_id, 'Merged accounts. All data consolidated under primary email address.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '10 days'
WHERE subject = 'Merge duplicate accounts';

-- E9: Resolved by ebrown - fast (hardware)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_priya_id, sr_ebrown_id, 'Keyboard keys sticking on laptop',
        'Several keys on my ThinkPad keyboard are sticking. The space bar and enter key are especially bad.',
        'hardware', 'low', 'resolved',
        true, 0.81, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days', sr_ebrown_id, 'Replaced keyboard assembly. All keys working properly now.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '6 days 18 hours'
WHERE subject = 'Keyboard keys sticking on laptop';

-- E10: Resolved by ebrown (software)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_alex_id, sr_ebrown_id, 'Browser extension causing page crashes',
        'After installing a Chrome extension, every page takes 30 seconds to load and sometimes crashes. Removing the extension did not fix it.',
        'software', 'medium', 'resolved',
        true, 0.83, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '15 days', NOW() - INTERVAL '13 days',
        NOW() - INTERVAL '13 days', sr_ebrown_id, 'Cleared browser cache and reset Chrome profile. Extension had corrupted browser data.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '14 days 16 hours'
WHERE subject = 'Browser extension causing page crashes';

-- E11: Closed by tnewc (network) - older ticket for trend data
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution, closed_at)
VALUES (cust_david_id, tech_tnewc_id, 'DNS resolution failing for internal sites',
        'Internal company websites are not resolving. External sites work fine but anything on our .internal domain fails.',
        'network', 'high', 'closed',
        true, 0.88, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days',
        NOW() - INTERVAL '23 days', tech_tnewc_id, 'Restarted internal DNS server and fixed zone file configuration.',
        NOW() - INTERVAL '22 days');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '24 days 20 hours'
WHERE subject = 'DNS resolution failing for internal sites';

-- E12: Closed by cmcgo (software) - older ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution, closed_at)
VALUES (cust_emily_id, tech_cmcgo_id, 'Windows update stuck at 45 percent',
        'My Windows update has been stuck at 45% for over 3 hours. I cannot cancel it and my laptop is unusable.',
        'software', 'medium', 'closed',
        true, 0.74, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days',
        NOW() - INTERVAL '16 days', tech_cmcgo_id, 'Ran Windows Update troubleshooter and manually cleared the update cache. Update completed successfully.',
        NOW() - INTERVAL '15 days');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '17 days 12 hours'
WHERE subject = 'Windows update stuck at 45 percent';

-- E13: Closed by jwill (login) - older ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution, closed_at)
VALUES (cust_carlos_id, tech_jwill_id, 'Reset password for departed employee',
        'John Smith left the company last week. We need to disable his account and reset his credentials immediately.',
        'login', 'high', 'closed',
        true, 0.91, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '22 days', NOW() - INTERVAL '21 days',
        NOW() - INTERVAL '21 days', tech_jwill_id, 'Account disabled, password reset, and access revoked from all systems. Audit log reviewed.',
        NOW() - INTERVAL '20 days');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '21 days 20 hours'
WHERE subject = 'Reset password for departed employee';

-- E14: Resolved by tnewc (hardware) - another for stats
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_james_id, tech_tnewc_id, 'Docking station not detecting external displays',
        'My USB-C docking station no longer detects my two external monitors. Tried different cables and ports.',
        'hardware', 'medium', 'resolved',
        true, 0.79, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days', tech_tnewc_id, 'Updated docking station firmware and reinstalled display drivers. Both monitors now detected.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '4 days 16 hours'
WHERE subject = 'Docking station not detecting external displays';

-- E15: Resolved by cmcgo (technical) - another for stats
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_nina_id, tech_cmcgo_id, 'CI/CD pipeline failing on deployment step',
        'Our Jenkins pipeline fails during the deployment step with a timeout error. Build and test stages pass fine.',
        'technical', 'high', 'resolved',
        true, 0.85, 'high', 'high',
        'high', false, 'ai_direct',
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '8 days', tech_cmcgo_id, 'Increased deployment timeout and fixed SSH key permissions on production server.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '9 days 18 hours'
WHERE subject = 'CI/CD pipeline failing on deployment step';

-- ────────────────────────────────────────────────
-- GROUP F: Additional tickets for "top requester" variety 
-- (Mike Chen gets extra tickets to be top requester)
-- ────────────────────────────────────────────────

-- F1: Mike - another open ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_mike_id, tech_jwill_id, 'Shared drive not accessible from Mac',
        'Unable to access the company shared drive from my MacBook. Windows users can access it fine. Getting a permission denied error.',
        'network', 'medium', 'in_progress',
        true, 0.76, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '12 hours',
                   response_due_at = NOW() - INTERVAL '12 hours',
                   first_response_at = NOW() - INTERVAL '10 hours'
WHERE subject = 'Shared drive not accessible from Mac';

-- F2: Mike - another resolved ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_mike_id, tech_cmcgo_id, 'Webcam not working on Teams calls',
        'My webcam works in the camera app but shows a black screen in Microsoft Teams. Already reinstalled Teams.',
        'hardware', 'low', 'resolved',
        true, 0.77, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '16 days', NOW() - INTERVAL '14 days',
        NOW() - INTERVAL '14 days', tech_cmcgo_id, 'Reset Teams device permissions and cleared app cache. Webcam now works in calls.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '15 days'
WHERE subject = 'Webcam not working on Teams calls';

-- F3: David - another ticket (top requester variety)
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_david_id, tech_tnewc_id, 'Need access to staging environment',
        'I need developer access to the staging environment for our upcoming product launch testing. My manager (Jane Doe) has approved this.',
        'account', 'low', 'in_progress',
        true, 0.69, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day');

-- F4: Sarah - another resolved ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_sarah_id, sr_ebrown_id, 'Outlook calendar sync broken',
        'My Outlook calendar is not syncing with my mobile phone. I have missed two meetings because of this.',
        'software', 'medium', 'resolved',
        true, 0.80, 'medium', 'high',
        'medium', true, 'user_override',
        NOW() - INTERVAL '13 days', NOW() - INTERVAL '11 days',
        NOW() - INTERVAL '11 days', sr_ebrown_id, 'Removed and re-added Exchange account on mobile device. Sync restored.');
UPDATE tickets SET first_response_at = NOW() - INTERVAL '12 days 16 hours'
WHERE subject = 'Outlook calendar sync broken';

-- F5: Emily - another open ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at)
VALUES (cust_emily_id, NULL, 'Request for additional storage space',
        'I am running out of cloud storage. Currently at 95% capacity and need to upload project files urgently. Can my quota be increased?',
        'account', 'medium', 'open',
        true, 0.74, 'low', 'medium',
        'low', true, 'weighted_average',
        NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '16 hours',
                   response_due_at = NOW() - INTERVAL '4 hours'
WHERE subject = 'Request for additional storage space';

-- F6: Mike - reopened ticket
INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, reopen_count, last_reopened_at)
VALUES (cust_mike_id, tech_cmcgo_id, 'Scanner driver issues after Windows update',
        'The scanner stopped working after the latest Windows update. Driver reinstall does not help. This was supposedly fixed before but the issue came back.',
        'hardware', 'medium', 'reopened',
        true, 0.78, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '19 days', NOW() - INTERVAL '1 day',
        1, NOW() - INTERVAL '1 day');
UPDATE tickets SET resolution_due_at = NOW() + INTERVAL '12 hours',
                   response_due_at = NOW() - INTERVAL '18 days 20 hours',
                   first_response_at = NOW() - INTERVAL '18 days 16 hours'
WHERE subject = 'Scanner driver issues after Windows update';

-- ────────────────────────────────────────────────
-- GROUP G: Additional resolved tickets for richer trend data
-- ────────────────────────────────────────────────

INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_priya_id, tech_jwill_id, 'Cannot connect to campus WiFi',
        'New faculty laptop cannot authenticate to the university WiFi network. Getting certificate error.',
        'network', 'medium', 'resolved',
        true, 0.82, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '17 days', NOW() - INTERVAL '15 days',
        NOW() - INTERVAL '15 days', tech_jwill_id, 'Installed university root CA certificate and configured 802.1X authentication.');

INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_lisa_id, sr_mjohnson_id, 'Permission error accessing project files',
        'I get Access Denied when trying to open our shared project folder. My colleague can access it fine.',
        'login', 'medium', 'resolved',
        true, 0.75, 'medium', 'medium',
        'medium', false, 'ai_direct',
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '4 days', sr_mjohnson_id, 'Added user to the correct Active Directory security group. Access restored.');

INSERT INTO tickets (customer_id, assigned_to, subject, description, category, priority, status,
                     ai_classified, ai_confidence, ai_priority, user_priority,
                     ai_recommended_priority, priority_overridden, priority_calculation_method,
                     created_at, updated_at, resolved_at, resolved_by, resolution)
VALUES (cust_carlos_id, tech_tnewc_id, 'Projector not displaying from laptop',
        'Conference room projector shows No Signal when connected to my laptop. HDMI cable seems fine.',
        'hardware', 'low', 'resolved',
        true, 0.80, 'low', 'low',
        'low', false, 'ai_direct',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days', tech_tnewc_id, 'Updated graphics drivers and switched display output mode. Projector now working.');

-- ============================================================================
-- STEP 3: Insert AI classifications for all AI-classified tickets
-- ============================================================================

INSERT INTO ai_classifications (ticket_id, predicted_category, predicted_priority, confidence, keywords_matched, fallback_used)
SELECT 
    t.id,
    t.category,
    COALESCE(t.ai_priority, t.priority),
    COALESCE(t.ai_confidence, 0.70),
    CASE t.category
        WHEN 'network'          THEN '["server", "network", "connection", "firewall"]'::jsonb
        WHEN 'software'         THEN '["crash", "error", "application", "update"]'::jsonb
        WHEN 'hardware'         THEN '["laptop", "monitor", "printer", "keyboard"]'::jsonb
        WHEN 'login'            THEN '["login", "password", "account", "access"]'::jsonb
        WHEN 'billing'          THEN '["charge", "invoice", "subscription", "payment"]'::jsonb
        WHEN 'account'          THEN '["account", "profile", "merge", "update"]'::jsonb
        WHEN 'technical'        THEN '["API", "pipeline", "deployment", "error"]'::jsonb
        WHEN 'feature_request'  THEN '["feature", "request", "integration", "dark mode"]'::jsonb
        WHEN 'general'          THEN '["help", "question", "export", "report"]'::jsonb
        ELSE '["other", "general"]'::jsonb
    END,
    CASE WHEN COALESCE(t.ai_confidence, 0.70) < 0.60 THEN true ELSE false END
FROM tickets t
WHERE t.ai_classified = true
  AND NOT EXISTS (SELECT 1 FROM ai_classifications ac WHERE ac.ticket_id = t.id);

-- ============================================================================
-- STEP 4: Insert ticket comments for engagement data
-- ============================================================================

-- Comments on open/in_progress tickets
INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, tech_tnewc_id, 'tech', 'Looking into this now. Will update shortly.', false, t.created_at + INTERVAL '2 hours'
FROM tickets t WHERE t.subject = 'Database corruption detected';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, tech_tnewc_id, 'tech', 'Running DBCC checks on the affected tables. Initial assessment: 3 tables have corrupted pages.', true, t.created_at + INTERVAL '4 hours'
FROM tickets t WHERE t.subject = 'Database corruption detected';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, tech_cmcgo_id, 'tech', 'Authentication service restarted. Investigating root cause in the logs.', false, t.created_at + INTERVAL '30 minutes'
FROM tickets t WHERE t.subject = 'Complete system authentication failure';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, sr_mjohnson_id, 'tech', 'Investigating the payroll calculation logic. Found discrepancy in overtime multiplier.', false, t.created_at + INTERVAL '4 hours'
FROM tickets t WHERE t.subject = 'Payroll system calculation errors';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, sr_ebrown_id, 'tech', 'Identified the firewall rule causing the issue. Preparing a fix.', false, t.created_at + INTERVAL '90 minutes'
FROM tickets t WHERE t.subject = 'Firewall blocking legitimate traffic';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, tech_jwill_id, 'tech', 'Waiting for the customer to provide their Microsoft Office version and error logs.', true, t.created_at + INTERVAL '6 hours'
FROM tickets t WHERE t.subject = 'Microsoft Office crashing when opening large files';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, cust_emily_id, 'client', 'I am using Microsoft Office 365 version 2401. Here are the error logs from Event Viewer.', false, t.created_at + INTERVAL '1 day'
FROM tickets t WHERE t.subject = 'Microsoft Office crashing when opening large files';

-- Comments on resolved tickets
INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, tech_tnewc_id, 'tech', 'Replaced the display cable. Please confirm if the flickering has stopped.', false, t.resolved_at - INTERVAL '1 hour'
FROM tickets t WHERE t.subject = 'Monitor flickering intermittently';

INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal, created_at)
SELECT t.id, cust_emily_id, 'client', 'Yes, the flickering has completely stopped. Thank you!', false, t.resolved_at
FROM tickets t WHERE t.subject = 'Monitor flickering intermittently';

-- ============================================================================
-- STEP 5: Insert ticket history entries for change tracking
-- ============================================================================

-- Status changes for in_progress tickets
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at)
SELECT t.id, t.assigned_to, 'status_change', 'status', 'open', 'in_progress', t.created_at + INTERVAL '1 hour'
FROM tickets t WHERE t.status = 'in_progress' AND t.assigned_to IS NOT NULL;

-- Assignment changes for assigned tickets
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at)
SELECT t.id, mgmt_jdoe_id, 'assignment', 'assigned_to', 'unassigned', t.assigned_to::TEXT, t.created_at + INTERVAL '30 minutes'
FROM tickets t WHERE t.assigned_to IS NOT NULL AND t.status != 'closed';

-- Status changes for resolved tickets
INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, created_at)
SELECT t.id, t.resolved_by, 'status_change', 'status', 'in_progress', 'resolved', t.resolved_at
FROM tickets t WHERE t.status IN ('resolved', 'closed') AND t.resolved_at IS NOT NULL;

-- ============================================================================
-- STEP 6: Insert ticket assignments for multi-tech tracking
-- ============================================================================

INSERT INTO ticket_assignments (ticket_id, user_id, role, assigned_at, assigned_by)
SELECT t.id, t.assigned_to, 'primary', t.created_at + INTERVAL '30 minutes', mgmt_jdoe_id
FROM tickets t WHERE t.assigned_to IS NOT NULL;

-- ============================================================================
-- STEP 7: Insert notifications for various events
-- ============================================================================

-- Assignment notifications for technicians
INSERT INTO notifications (user_id, type, message, ticket_id, is_read, created_at)
SELECT t.assigned_to, 'assignment', 'You have been assigned ticket ' || t.ticket_number || ': ' || LEFT(t.subject, 50), t.id, 
       CASE WHEN t.status IN ('resolved', 'closed') THEN true ELSE false END,
       t.created_at + INTERVAL '30 minutes'
FROM tickets t WHERE t.assigned_to IS NOT NULL;

-- Overdue notifications
INSERT INTO notifications (user_id, type, message, ticket_id, is_read, created_at)
SELECT t.assigned_to, 'overdue', 'Ticket ' || t.ticket_number || ' is overdue and requires immediate attention', t.id, false, t.resolution_due_at
FROM tickets t 
WHERE t.assigned_to IS NOT NULL 
  AND t.resolution_due_at < NOW() 
  AND t.status NOT IN ('resolved', 'closed', 'cancelled');

-- Update request notifications for customers with waiting_on_customer tickets
INSERT INTO notifications (user_id, type, message, ticket_id, is_read, created_at)
SELECT t.customer_id, 'update_request', 'Technician has requested additional information for ticket ' || t.ticket_number, t.id, false, t.updated_at
FROM tickets t WHERE t.status = 'waiting_on_customer';

-- ============================================================================
-- STEP 8: Insert priority overrides for AI analytics widgets
-- ============================================================================

INSERT INTO priority_overrides (ticket_id, user_id, user_priority, ai_recommended_priority, final_priority, ai_confidence, confidence_level, override_reason, significant_difference, created_at)
SELECT t.id, t.customer_id, t.user_priority, t.ai_recommended_priority, t.priority,
       t.ai_confidence,
       CASE 
           WHEN t.ai_confidence >= 0.80 THEN 'high'
           WHEN t.ai_confidence >= 0.50 THEN 'medium'
           ELSE 'low'
       END,
       t.priority_override_reason,
       CASE WHEN t.user_priority IS DISTINCT FROM t.ai_recommended_priority THEN true ELSE false END,
       t.created_at
FROM tickets t
WHERE t.priority_overridden = true
  AND t.user_priority IS NOT NULL
  AND t.ai_recommended_priority IS NOT NULL;

-- Also add some overrides where AI was accepted (no override)
INSERT INTO priority_overrides (ticket_id, user_id, user_priority, ai_recommended_priority, final_priority, ai_confidence, confidence_level, significant_difference, created_at)
SELECT t.id, t.customer_id, t.user_priority, t.ai_recommended_priority, t.priority,
       t.ai_confidence,
       CASE 
           WHEN t.ai_confidence >= 0.80 THEN 'high'
           WHEN t.ai_confidence >= 0.50 THEN 'medium'
           ELSE 'low'
       END,
       false,
       t.created_at
FROM tickets t
WHERE t.priority_overridden = false
  AND t.user_priority IS NOT NULL
  AND t.ai_recommended_priority IS NOT NULL
  AND t.user_priority = t.ai_recommended_priority
ORDER BY RANDOM()
LIMIT 10;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

RAISE NOTICE '========================================';
RAISE NOTICE 'Sample Data Load Complete!';
RAISE NOTICE '========================================';

-- Ticket counts by status
RAISE NOTICE 'Tickets by status:';

-- Total counts
RAISE NOTICE 'Checking data...';

END $$;

-- Quick verification queries (run after the DO block)
SELECT 'Total tickets' AS metric, COUNT(*)::TEXT AS value FROM tickets
UNION ALL
SELECT 'Open tickets', COUNT(*)::TEXT FROM tickets WHERE status = 'open'
UNION ALL
SELECT 'In Progress', COUNT(*)::TEXT FROM tickets WHERE status = 'in_progress'
UNION ALL
SELECT 'Resolved', COUNT(*)::TEXT FROM tickets WHERE status = 'resolved'
UNION ALL
SELECT 'Closed', COUNT(*)::TEXT FROM tickets WHERE status = 'closed'
UNION ALL
SELECT 'Reopened', COUNT(*)::TEXT FROM tickets WHERE status = 'reopened'
UNION ALL
SELECT 'Waiting on Customer', COUNT(*)::TEXT FROM tickets WHERE status = 'waiting_on_customer'
UNION ALL
SELECT 'Assigned tickets', COUNT(*)::TEXT FROM tickets WHERE assigned_to IS NOT NULL
UNION ALL
SELECT 'Unassigned tickets', COUNT(*)::TEXT FROM tickets WHERE assigned_to IS NULL
UNION ALL
SELECT 'Overdue tickets', COUNT(*)::TEXT FROM tickets WHERE resolution_due_at < NOW() AND status NOT IN ('resolved', 'closed', 'cancelled')
UNION ALL
SELECT 'Critical/High open', COUNT(*)::TEXT FROM tickets WHERE priority IN ('critical', 'high') AND status NOT IN ('resolved', 'closed', 'cancelled')
UNION ALL
SELECT 'AI classified', COUNT(*)::TEXT FROM tickets WHERE ai_classified = true
UNION ALL
SELECT 'Total comments', COUNT(*)::TEXT FROM ticket_comments
UNION ALL
SELECT 'Total notifications', COUNT(*)::TEXT FROM notifications;

COMMIT;
