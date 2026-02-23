-- ============================================================================
-- Create Manager Account with Full Permissions
-- ============================================================================
-- This script creates a manager account and grants full access to all categories
-- Run this in psql: psql -U postgres -d blueclue -f create_manager_account.sql
-- ============================================================================

-- Create manager account
-- Email: manager@blueclue.com
-- Password: BlueClue2026!
-- Role: management
INSERT INTO users (email, password_hash, first_name, last_name, username, role, phone, company, is_active, email_verified)
VALUES ('manager@blueclue.com', '$2b$10$1rn7viDfnssV6FeWd1kQgesLtweSjsjGW5O5Ln9cy/aPiWKkaqpQm', 'System', 'Manager', 'manager', 'management', '+1-555-0100', 'BlueClue Support', true, true)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    email_verified = EXCLUDED.email_verified;

-- Grant full permissions to all categories
DO $$
DECLARE
    manager_user_id INTEGER;
    category_record RECORD;
BEGIN
    -- Find the manager user
    SELECT id INTO manager_user_id FROM users WHERE email = 'manager@blueclue.com';
    
    IF manager_user_id IS NULL THEN
        RAISE EXCEPTION 'Manager user not found! Please check that manager@blueclue.com was created.';
    END IF;
    
    RAISE NOTICE 'Found manager user with ID: %', manager_user_id;
    
    -- Grant 'manage' access (highest level) to all active categories
    FOR category_record IN SELECT id, name FROM categories WHERE is_active = true
    LOOP
        -- Insert category access if it doesn't already exist
        INSERT INTO category_access (user_id, category_id, access_level, granted_by, is_active, notes)
        VALUES (manager_user_id, category_record.id, 'manage', manager_user_id, true, 'Auto-granted full permissions')
        ON CONFLICT (user_id, category_id, access_level) 
        DO UPDATE SET 
            is_active = true,
            revoked_at = NULL,
            granted_at = CURRENT_TIMESTAMP;
            
        RAISE NOTICE 'Granted manage access to category: %', category_record.name;
    END LOOP;
    
    RAISE NOTICE 'Manager account created and permissions granted successfully!';
    RAISE NOTICE 'Login with: manager@blueclue.com / BlueClue2026!';
END;
$$;

-- Verify manager account and permissions
SELECT 
    u.id,
    u.email,
    u.username,
    u.role,
    u.first_name || ' ' || u.last_name as full_name,
    u.is_active,
    u.email_verified
FROM users u
WHERE u.email = 'manager@blueclue.com';

-- Show all granted permissions
SELECT 
    c.name as category,
    ca.access_level,
    ca.is_active,
    ca.granted_at
FROM category_access ca
JOIN categories c ON ca.category_id = c.id
WHERE ca.user_id = (SELECT id FROM users WHERE email = 'manager@blueclue.com')
ORDER BY c.name, ca.access_level;
