-- Update admin password hash only
-- Password: BlueClue2026!

UPDATE users 
SET password_hash = '$2b$10$5z/sNzB2ijopeHYQMrBDfegPTuvlV1Xt8iF9moVQjSaOFxgGYBWim' 
WHERE email = 'admin@blueclue.com';

SELECT 'Admin password updated successfully' AS status;
SELECT id, email, role, is_active FROM users WHERE email = 'admin@blueclue.com';
