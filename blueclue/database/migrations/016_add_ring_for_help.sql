-- Migration 016: Add Ring for Help Feature
-- Description: Adds urgent help request mechanism for technicians

-- Add new notification types for ring requests
DO $$ 
BEGIN
    -- Add 'ring_request' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ring_request' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'ring_request';
    END IF;
    
    -- Add 'ring_response' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ring_response' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'ring_response';
    END IF;
END $$;

-- Create ring_requests table
CREATE TABLE IF NOT EXISTS ring_requests (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    requesting_tech_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_tech_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    urgency_level VARCHAR(10) NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high')),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'timeout')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    response_time_seconds INTEGER,
    CONSTRAINT no_self_ring CHECK (requesting_tech_id != target_tech_id)
);

-- Create indexes for performance
CREATE INDEX idx_ring_requests_ticket ON ring_requests(ticket_id);
CREATE INDEX idx_ring_requests_requester ON ring_requests(requesting_tech_id);
CREATE INDEX idx_ring_requests_target ON ring_requests(target_tech_id);
CREATE INDEX idx_ring_requests_status ON ring_requests(status);
CREATE INDEX idx_ring_requests_created ON ring_requests(created_at);

-- Create ring_request_rate_limit table for rate limiting
CREATE TABLE IF NOT EXISTS ring_request_rate_limit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_request_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create index for rate limit lookups
CREATE INDEX idx_ring_rate_limit_user ON ring_request_rate_limit(user_id);

-- Add DND (Do Not Disturb) status to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_until TIMESTAMP WITH TIME ZONE;

-- Add sound notification preference
ALTER TABLE users ADD COLUMN IF NOT EXISTS ring_sound_enabled BOOLEAN DEFAULT TRUE;

-- Add comment to track schema version
COMMENT ON TABLE ring_requests IS 'Stores urgent help requests from technicians - Migration 016';
COMMENT ON TABLE ring_request_rate_limit IS 'Tracks rate limiting for ring requests - Migration 016';
