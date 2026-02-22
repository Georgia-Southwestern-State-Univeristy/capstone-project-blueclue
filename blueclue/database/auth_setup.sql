-- ============================================================================
-- BlueClue Authentication System - Database Setup
-- ============================================================================
-- Description: Sets up guest sessions table and hardcoded technician accounts  
-- Version: 2.0.0
-- Updated: 2026-02-13
-- Note: username, force_password_change, is_guest columns are in schema.sql
-- ============================================================================

-- ============================================================================
-- HARDCODED TECHNICIAN ACCOUNTS
-- ============================================================================
-- Password: admin123 (bcrypt hash generated with salt rounds = 10)
-- All technicians must change password on first login

-- Insert hardcoded technicians (username: tnewc, cmcgo, jwill)
INSERT INTO users (email, password_hash, first_name, last_name, username, role, force_password_change, is_active)
VALUES 
    ('tnewc@blueclue.com', '$2b$10$lmfkmrGkF2XhKJqnfperu.bBG7CK3HpkXJ/KIullkzkNFGxewRATy', 'Thomas', 'Newcomb', 'tnewc', 'technician', true, true),
    ('cmcgo@blueclue.com', '$2b$10$Gqw9ytr7gzq7oTrfCYDuseBDakP2Ni/Yck2BdmpzEZ6Xn/3n1bDba', 'Clayton', 'McGough', 'cmcgo', 'technician', true, true),
    ('jwill@blueclue.com', '$2b$10$YtimdlARnlSE8MdpEQoZaemIXIWLwQGf5SZOJj7IfZ8wH9h1F8ngu', 'Jacob', 'Williams', 'jwill', 'technician', true, true),
    ('mjohnson@blueclue.com', '$2b$10$lmfkmrGkF2XhKJqnfperu.bBG7CK3HpkXJ/KIullkzkNFGxewRATy', 'Maria', 'Johnson', 'mjohnson', 'senior_technician', true, true),
    ('ebrown@blueclue.com', '$2b$10$lmfkmrGkF2XhKJqnfperu.bBG7CK3HpkXJ/KIullkzkNFGxewRATy', 'Eric', 'Brown', 'ebrown', 'senior_technician', true, true),
    ('jdoe@blueclue.com', '$2b$10$lmfkmrGkF2XhKJqnfperu.bBG7CK3HpkXJ/KIullkzkNFGxewRATy', 'Jane', 'Doe', 'jdoe', 'management', true, true),
    ('ssmith@blueclue.com', '$2b$10$lmfkmrGkF2XhKJqnfperu.bBG7CK3HpkXJ/KIullkzkNFGxewRATy', 'Sarah', 'Smith', 'ssmith', 'management', true, true)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    username = EXCLUDED.username,
    force_password_change = EXCLUDED.force_password_change,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- REFRESH TOKENS TABLE
-- ============================================================================
-- Stores refresh tokens for secure authentication

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    
    -- Indexes
    CONSTRAINT refresh_tokens_user_id_idx UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ============================================================================
-- CLEANUP FUNCTION FOR EXPIRED SESSIONS
-- ============================================================================

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify technician accounts were created
SELECT username, email, role, force_password_change, is_active 
FROM users 
WHERE role = 'technician'
ORDER BY username;

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'refresh_tokens'
ORDER BY table_name;
