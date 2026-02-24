-- Migration 015: Add ticket collaborators for multi-technician collaboration
-- Enables primary assigned technicians to add additional technicians to tickets

BEGIN;

-- Create enum for collaborator roles
CREATE TYPE collaborator_role AS ENUM ('primary', 'assisting');

-- Create ticket_collaborators table
CREATE TABLE IF NOT EXISTS ticket_collaborators (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role collaborator_role NOT NULL DEFAULT 'assisting',
    added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique user per ticket
    CONSTRAINT unique_ticket_user UNIQUE (ticket_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_ticket_collaborators_ticket_id ON ticket_collaborators(ticket_id);
CREATE INDEX idx_ticket_collaborators_user_id ON ticket_collaborators(user_id);
CREATE INDEX idx_ticket_collaborators_role ON ticket_collaborators(role);
CREATE INDEX idx_ticket_collaborators_added_by ON ticket_collaborators(added_by);

-- Add comment
COMMENT ON TABLE ticket_collaborators IS 'Tracks multiple technicians assigned to tickets for collaborative problem-solving';
COMMENT ON COLUMN ticket_collaborators.role IS 'Either primary (main assignee) or assisting (helper)';
COMMENT ON COLUMN ticket_collaborators.note IS 'Optional note explaining why collaboration is needed';

-- Function to enforce max 5 technicians per ticket
CREATE OR REPLACE FUNCTION check_max_collaborators()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM ticket_collaborators WHERE ticket_id = NEW.ticket_id) >= 5 THEN
        RAISE EXCEPTION 'Maximum 5 technicians allowed per ticket';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce max collaborators
CREATE TRIGGER enforce_max_collaborators
    BEFORE INSERT ON ticket_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION check_max_collaborators();

-- Function to ensure only one primary tech per ticket
CREATE OR REPLACE FUNCTION check_single_primary()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'primary' THEN
        IF EXISTS (
            SELECT 1 FROM ticket_collaborators 
            WHERE ticket_id = NEW.ticket_id 
            AND role = 'primary' 
            AND id != COALESCE(NEW.id, 0)
        ) THEN
            RAISE EXCEPTION 'Only one primary technician allowed per ticket';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single primary
CREATE TRIGGER enforce_single_primary
    BEFORE INSERT OR UPDATE ON ticket_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION check_single_primary();

COMMIT;

-- Notifications for migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 015 completed successfully';
    RAISE NOTICE 'Added ticket_collaborators table with role support';
    RAISE NOTICE 'Multi-technician collaboration feature ready';
END $$;
