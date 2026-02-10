-- ============================================================================
-- Update ticket_category ENUM to match AI classifier categories
-- ============================================================================
-- This script updates the ticket_category enum to include all categories
-- that the AI classifier can return: hardware, software, network, login, other

-- Step 1: Add new enum values (must be in separate transactions)
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'hardware';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'software';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'network';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'login';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'other';

-- Step 2: Update categories table with new categories
BEGIN;

INSERT INTO categories (name, display_name, description, color_code, icon, is_active)
VALUES 
    ('hardware', 'Hardware', 'Computer hardware issues (laptops, monitors, printers, etc.)', '#F59E0B', 'computer', true),
    ('software', 'Software', 'Software and application issues (OS, Office, browsers, etc.)', '#3B82F6', 'application', true),
    ('network', 'Network', 'Network connectivity and WiFi issues', '#10B981', 'network', true),
    ('login', 'Login & Access', 'Login, password, and account access issues', '#EF4444', 'lock', true),
    ('other', 'Other', 'General inquiries and other issues', '#6B7280', 'help', true)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color_code = EXCLUDED.color_code,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- Step 3: Keep original categories as well (optional - comment out if you want to remove them)
INSERT INTO categories (name, display_name, description, color_code, icon, is_active)
VALUES 
    ('general', 'General', 'General support requests', '#9CA3AF', 'info', true),
    ('technical', 'Technical', 'Technical support requests', '#3B82F6', 'wrench', true),
    ('billing', 'Billing', 'Billing and payment issues', '#10B981', 'dollar', true),
    ('account', 'Account', 'Account management issues', '#F59E0B', 'user', true),
    ('feature_request', 'Feature Request', 'New feature requests', '#8B5CF6', 'lightbulb', true)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Verify the changes
SELECT name, display_name, description 
FROM categories 
WHERE is_active = true 
ORDER BY name;
