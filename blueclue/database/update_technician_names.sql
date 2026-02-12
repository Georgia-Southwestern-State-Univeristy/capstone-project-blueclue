-- Update Technician Names
-- This script corrects the names of two technicians in the database

BEGIN;

-- Update Connor McGough to Clayton McGough
UPDATE users 
SET first_name = 'Clayton' 
WHERE email = 'cmcgo@blueclue.com' AND first_name = 'Connor' AND last_name = 'McGough';

-- Update John Williams to Jacob Williams  
UPDATE users 
SET first_name = 'Jacob' 
WHERE email = 'jwill@blueclue.com' AND first_name = 'John' AND last_name = 'Williams';

-- Verify the changes
SELECT 'Updated technician names:' as status;
SELECT email, first_name, last_name, role 
FROM users 
WHERE email IN ('cmcgo@blueclue.com', 'jwill@blueclue.com')
ORDER BY email;

COMMIT;
