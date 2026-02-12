-- ============================================================================
-- BlueClue Authentication System - Database Setup
-- ============================================================================
-- Description: Sets up authentication tables and hardcoded technician accounts
-- Version: 1.0.0
-- Created: 2026-02-10
-- ============================================================================

-- Add force_password_change column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT false;

-- Add index for password change tracking
CREATE INDEX IF NOT EXISTS idx_users_force_password_change 
ON users(force_password_change) WHERE force_password_change = true;

-- ============================================================================
-- HARDCODED TECHNICIAN ACCOUNTS
-- ============================================================================
-- Password: admin123 (bcrypt hash generated with salt rounds = 10)
-- All technicians must change password on first login

-- Note: The password hash below is for 'admin123'
-- Generated using: bcrypt.hashSync('admin123', 10)

-- Insert hardcoded technicians (username: tnewc, cmcgo, jwill)
INSERT INTO users (email, password_hash, first_name, last_name, role, force_password_change, is_active)
VALUES 
    ('tnewc@blueclue.com', '$2b$10$lmfkmrGkF2XhKJqnfperu.bBG7CK3HpkXJ/KIullkzkNFGxewRATy', 'Thomas', 'Newcomb', 'technician', true, true),
    ('cmcgo@blueclue.com', '$2b$10$Gqw9ytr7gzq7oTrfCYDuseBDakP2Ni/Yck2BdmpzEZ6Xn/3n1bDba', 'Clayton', 'McGough', 'technician', true, true),
    ('jwill@blueclue.com', '$2b$10$YtimdlARnlSE8MdpEQoZaemIXIWLwQGf5SZOJj7IfZ8wH9h1F8ngu', 'Jacob', 'Williams', 'technician', true, true)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    force_password_change = EXCLUDED.force_password_change,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Add username field to users table for technician login
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update technician usernames
UPDATE users SET username = 'tnewc' WHERE email = 'tnewc@blueclue.com';
UPDATE users SET username = 'cmcgo' WHERE email = 'cmcgo@blueclue.com';
UPDATE users SET username = 'jwill' WHERE email = 'jwill@blueclue.com';

-- ============================================================================
-- GUEST SESSIONS TABLE
-- ============================================================================
-- Stores temporary guest sessions (no password, email + name only)

CREATE TABLE IF NOT EXISTS guest_sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Constraints
    CONSTRAINT guest_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for guest sessions
CREATE INDEX IF NOT EXISTS idx_guest_sessions_token ON guest_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_email ON guest_sessions(email);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at ON guest_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_active ON guest_sessions(is_active) WHERE is_active = true;

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

-- Function to clean up expired guest sessions
CREATE OR REPLACE FUNCTION cleanup_expired_guest_sessions()
RETURNS void AS $$
BEGIN
    UPDATE guest_sessions 
    SET is_active = false 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true;
END;
$$ LANGUAGE plpgsql;

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
  AND table_name IN ('guest_sessions', 'refresh_tokens')
ORDER BY table_name;
