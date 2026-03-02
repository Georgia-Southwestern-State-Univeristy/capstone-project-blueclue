-- Migration 008: Add Ticket Assignment Requests
-- Purpose: Allow technicians to request assignment to unassigned tickets,
--          subject to management/admin approval.
-- Branch: Enable-Technician-Ticket-Requests (Issue #96)

-- ============================================================================
-- TYPE: request_status
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: ticket_assignment_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_assignment_requests (
    id            SERIAL PRIMARY KEY,
    ticket_id     INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    requested_by  INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    note          TEXT,
    status        request_status NOT NULL DEFAULT 'pending',
    reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A technician can only have one pending request per ticket
    CONSTRAINT unique_pending_request UNIQUE (ticket_id, requested_by)
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_tar_ticket      ON ticket_assignment_requests(ticket_id);
CREATE INDEX idx_tar_requested   ON ticket_assignment_requests(requested_by);
CREATE INDEX idx_tar_status      ON ticket_assignment_requests(status);
CREATE INDEX idx_tar_reviewed_by ON ticket_assignment_requests(reviewed_by);
CREATE INDEX idx_tar_created     ON ticket_assignment_requests(created_at DESC);
CREATE INDEX idx_tar_pending     ON ticket_assignment_requests(ticket_id, requested_by)
    WHERE status = 'pending';

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE  ticket_assignment_requests                IS 'Tracks technician requests to be assigned to a ticket';
COMMENT ON COLUMN ticket_assignment_requests.ticket_id      IS 'The ticket being requested';
COMMENT ON COLUMN ticket_assignment_requests.requested_by   IS 'The technician who made the request';
COMMENT ON COLUMN ticket_assignment_requests.note           IS 'Optional note from the technician';
COMMENT ON COLUMN ticket_assignment_requests.status         IS 'pending = awaiting review, approved = assigned, denied = rejected';
COMMENT ON COLUMN ticket_assignment_requests.reviewed_by    IS 'The manager/admin who reviewed the request';
COMMENT ON COLUMN ticket_assignment_requests.reviewed_at    IS 'When the request was reviewed';

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_assignment_requests') THEN
        RAISE NOTICE 'Migration 008 applied -- ticket_assignment_requests table created.';
    ELSE
        RAISE EXCEPTION 'Migration 008 FAILED -- table not found.';
    END IF;
END $$;
