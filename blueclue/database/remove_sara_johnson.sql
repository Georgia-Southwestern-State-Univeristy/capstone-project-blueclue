-- Remove Sara Johnson and fix existing tickets
-- This script updates tickets that were incorrectly assigned to Sara Johnson
-- and then removes her user record

BEGIN;

-- Step 1: Create a system/unknown user to reassign old tickets to
-- Only create if it doesn't already exist
INSERT INTO users (email, password_hash, first_name, last_name, role, phone, company, is_active)
VALUES (
    'system@blueclue.internal',
    '$2b$10$PLACEHOLDER_PASSWORD_HASH',
    'System',
    'Unknown',
    'customer',
    NULL,
    'BlueClue System',
    false
)
ON CONFLICT (email) DO NOTHING;

-- Get the system user ID
DO $$
DECLARE
    system_user_id INTEGER;
    sara_johnson_id INTEGER := 1;
BEGIN
    SELECT id INTO system_user_id FROM users WHERE email = 'system@blueclue.internal';
    
    -- Step 2: Reassign Sara Johnson's tickets to system/unknown user
    UPDATE tickets 
    SET customer_id = system_user_id
    WHERE customer_id = sara_johnson_id;
    
    RAISE NOTICE 'Updated % tickets from Sara Johnson to System/Unknown user', 
        (SELECT COUNT(*) FROM tickets WHERE customer_id = system_user_id);
    
    -- Step 3: Delete Sara Johnson's user record
    DELETE FROM users WHERE id = sara_johnson_id;
    
    RAISE NOTICE 'Sara Johnson user record deleted';
END $$;

-- Verify the changes
SELECT 'Remaining users:' as status;
SELECT id, email, first_name, last_name, role FROM users ORDER BY id;

SELECT 'Ticket distribution:' as status;
SELECT u.email, u.first_name, u.last_name, COUNT(t.id) as ticket_count
FROM users u
LEFT JOIN tickets t ON t.customer_id = u.id
GROUP BY u.id, u.email, u.first_name, u.last_name
ORDER BY u.id;

COMMIT;
