-- Migration 017: Ticket Update Requests
-- Enables management to formally request status updates from technicians
-- with tracking, deadlines, and follow-up mechanisms

-- Add notification types for update requests
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'update_request' 
                   AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'update_request';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'update_fulfilled' 
                   AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'update_fulfilled';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'update_overdue' 
                   AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'update_overdue';
    END IF;
END $$;

-- Create ticket_update_requests table
CREATE TABLE IF NOT EXISTS ticket_update_requests (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    assigned_to INTEGER NOT NULL REFERENCES users(id),
    message TEXT,
    deadline TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'overdue', 'cancelled')),
    fulfilled_at TIMESTAMP,
    fulfilled_by INTEGER REFERENCES users(id),
    response_text TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    needs_more_time BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocker_description TEXT,
    estimated_completion TIMESTAMP,
    extension_requested BOOLEAN DEFAULT FALSE,
    extension_approved BOOLEAN DEFAULT FALSE,
    extension_deadline TIMESTAMP,
    reminded_at TIMESTAMP,
    response_time_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_update_requests_ticket ON ticket_update_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_update_requests_assigned_to ON ticket_update_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_update_requests_status ON ticket_update_requests(status);
CREATE INDEX IF NOT EXISTS idx_update_requests_deadline ON ticket_update_requests(deadline);
CREATE INDEX IF NOT EXISTS idx_update_requests_requested_by ON ticket_update_requests(requested_by);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_update_requests_assigned_status 
ON ticket_update_requests(assigned_to, status, deadline);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_update_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_update_requests_timestamp
    BEFORE UPDATE ON ticket_update_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_update_requests_timestamp();

-- Create view for overdue requests
CREATE OR REPLACE VIEW overdue_update_requests AS
SELECT 
    ur.*,
    t.subject as ticket_subject,
    t.status as ticket_status,
    requester.first_name as requester_first_name,
    requester.last_name as requester_last_name,
    requester.email as requester_email,
    assignee.first_name as assignee_first_name,
    assignee.last_name as assignee_last_name,
    assignee.email as assignee_email,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ur.deadline))/3600 as hours_overdue
FROM ticket_update_requests ur
JOIN tickets t ON ur.ticket_id = t.id
JOIN users requester ON ur.requested_by = requester.id
JOIN users assignee ON ur.assigned_to = assignee.id
WHERE ur.status = 'pending' 
  AND ur.deadline < CURRENT_TIMESTAMP;

-- Create view for pending requests with time remaining
CREATE OR REPLACE VIEW pending_update_requests AS
SELECT 
    ur.*,
    t.subject as ticket_subject,
    t.status as ticket_status,
    t.priority as ticket_priority,
    requester.first_name as requester_first_name,
    requester.last_name as requester_last_name,
    requester.email as requester_email,
    assignee.first_name as assignee_first_name,
    assignee.last_name as assignee_last_name,
    assignee.email as assignee_email,
    EXTRACT(EPOCH FROM (ur.deadline - CURRENT_TIMESTAMP))/3600 as hours_remaining,
    CASE 
        WHEN ur.deadline < CURRENT_TIMESTAMP THEN 'overdue'
        WHEN ur.deadline < CURRENT_TIMESTAMP + INTERVAL '1 hour' THEN 'urgent'
        ELSE 'normal'
    END as urgency
FROM ticket_update_requests ur
JOIN tickets t ON ur.ticket_id = t.id
JOIN users requester ON ur.requested_by = requester.id
JOIN users assignee ON ur.assigned_to = assignee.id
WHERE ur.status = 'pending';

-- Add comments
COMMENT ON TABLE ticket_update_requests IS 'Tracks formal status update requests from management to technicians';
COMMENT ON COLUMN ticket_update_requests.status IS 'pending: awaiting response, fulfilled: tech responded, overdue: deadline passed, cancelled: request cancelled';
COMMENT ON COLUMN ticket_update_requests.extension_requested IS 'Tech requested more time';
COMMENT ON COLUMN ticket_update_requests.reminded_at IS 'Timestamp of last reminder notification';
