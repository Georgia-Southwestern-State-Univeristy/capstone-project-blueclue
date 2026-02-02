-- ============================================================================
-- BlueClue Support Ticket System - PostgreSQL Database Schema
-- ============================================================================
-- Description: Complete database schema for the BlueClue ticket management system
-- Version: 1.0.0
-- Created: 2026-02-02
-- ============================================================================

-- Drop existing tables if they exist (for clean reinstalls)
DROP TABLE IF EXISTS ticket_history CASCADE;
DROP TABLE IF EXISTS ticket_assignments CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS ticket_statuses CASCADE;
DROP TABLE IF EXISTS ticket_priorities CASCADE;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Create custom types for better data integrity
CREATE TYPE user_role AS ENUM ('customer', 'technician', 'admin');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE ticket_category AS ENUM ('general', 'technical', 'billing', 'account', 'feature_request');

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Stores all system users (customers, technicians, admins)

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    phone VARCHAR(20),
    company VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT phone_format CHECK (phone IS NULL OR phone ~* '^\+?[0-9\s\-\(\)]+$')
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- TABLE: categories
-- ============================================================================
-- Predefined ticket categories (synchronized with AI classifier)

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name ticket_category NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7), -- Hex color for UI (e.g., #FF5733)
    icon VARCHAR(50), -- Icon identifier for UI
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT color_code_format CHECK (color_code IS NULL OR color_code ~* '^#[0-9A-Fa-f]{6}$')
);

-- Index for active categories
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = true;

-- ============================================================================
-- TABLE: tickets
-- ============================================================================
-- Main tickets table storing all support requests

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE, -- e.g., TICK-2026-00001
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Ticket content
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Classification (from AI or manual)
    category ticket_category NOT NULL DEFAULT 'general',
    priority ticket_priority NOT NULL DEFAULT 'low',
    status ticket_status NOT NULL DEFAULT 'open',
    
    -- AI classification metadata
    ai_classified BOOLEAN NOT NULL DEFAULT false,
    ai_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    ai_fallback_used BOOLEAN DEFAULT false,
    ai_keywords_matched JSONB, -- Store matched keywords as JSON
    
    -- Resolution tracking
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- SLA tracking
    response_due_at TIMESTAMP WITH TIME ZONE,
    resolution_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT ai_confidence_range CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
    CONSTRAINT resolved_fields_consistency CHECK (
        (status IN ('resolved', 'closed') AND resolved_at IS NOT NULL) OR
        (status NOT IN ('resolved', 'closed') AND resolved_at IS NULL)
    )
    -- Note: assigned_to role validation will be enforced via foreign key and application logic
);

-- Indexes for tickets table
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_ai_classified ON tickets(ai_classified);
CREATE INDEX idx_tickets_open_assigned ON tickets(assigned_to, status) 
    WHERE status IN ('open', 'in_progress');

-- GIN index for JSON keyword matching
CREATE INDEX idx_tickets_ai_keywords ON tickets USING GIN (ai_keywords_matched);

-- ============================================================================
-- TABLE: ticket_assignments
-- ============================================================================
-- Track assignment history and reassignments

CREATE TABLE ticket_assignments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT assignment_dates_valid CHECK (
        unassigned_at IS NULL OR unassigned_at >= assigned_at
    )
);

-- Indexes for ticket_assignments
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_assigned_to ON ticket_assignments(assigned_to);
CREATE INDEX idx_ticket_assignments_active ON ticket_assignments(ticket_id, assigned_to) 
    WHERE unassigned_at IS NULL;

-- ============================================================================
-- TABLE: ticket_history
-- ============================================================================
-- Audit trail for all ticket changes

CREATE TABLE ticket_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL, -- e.g., 'status_change', 'priority_change', 'assignment', 'comment'
    field_name VARCHAR(100), -- Name of the changed field
    old_value TEXT, -- Previous value (as text)
    new_value TEXT, -- New value (as text)
    comment TEXT, -- Optional comment about the change
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Store full change details as JSON for complex changes
    change_details JSONB
);

-- Indexes for ticket_history
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_ticket_history_created_at ON ticket_history(created_at DESC);
CREATE INDEX idx_ticket_history_change_type ON ticket_history(change_type);
CREATE INDEX idx_ticket_history_changed_by ON ticket_history(changed_by);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for tickets table
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    sequence_part VARCHAR(5);
BEGIN
    year_part := TO_CHAR(CURRENT_TIMESTAMP, 'YYYY');
    sequence_part := LPAD(NEW.id::TEXT, 5, '0');
    NEW.ticket_number := 'TICK-' || year_part || '-' || sequence_part;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();

-- Function to log ticket changes to history
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'status_change', 'status', OLD.status::TEXT, NEW.status::TEXT);
    END IF;
    
    -- Log priority changes
    IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'priority_change', 'priority', OLD.priority::TEXT, NEW.priority::TEXT);
    END IF;
    
    -- Log category changes
    IF (TG_OP = 'UPDATE' AND OLD.category IS DISTINCT FROM NEW.category) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'category_change', 'category', OLD.category::TEXT, NEW.category::TEXT);
    END IF;
    
    -- Log assignment changes
    IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.assigned_to, 'assignment', 'assigned_to', 
                COALESCE(OLD.assigned_to::TEXT, 'unassigned'), 
                COALESCE(NEW.assigned_to::TEXT, 'unassigned'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log changes
CREATE TRIGGER log_ticket_changes_trigger
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_changes();

-- Function to calculate SLA due dates based on priority
CREATE OR REPLACE FUNCTION set_ticket_sla_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Set response and resolution due dates based on priority
    CASE NEW.priority
        WHEN 'critical' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '1 hour';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '4 hours';
        WHEN 'high' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '2 hours';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '8 hours';
        WHEN 'medium' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '4 hours';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '24 hours';
        WHEN 'low' THEN
            NEW.response_due_at := NEW.created_at + INTERVAL '8 hours';
            NEW.resolution_due_at := NEW.created_at + INTERVAL '72 hours';
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set SLA dates on ticket creation
CREATE TRIGGER set_ticket_sla_dates_trigger
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_sla_dates();

-- ============================================================================
-- DEFAULT DATA - CATEGORIES
-- ============================================================================
-- Insert default categories that match the AI classifier

INSERT INTO categories (name, display_name, description, color_code, icon) VALUES
    ('general', 'General', 'General inquiries and uncategorized tickets', '#6B7280', 'help-circle'),
    ('technical', 'Technical', 'Technical issues, bugs, errors, and system problems', '#EF4444', 'alert-triangle'),
    ('billing', 'Billing', 'Payment, invoicing, subscriptions, and refund requests', '#10B981', 'dollar-sign'),
    ('account', 'Account', 'Login, password, access, and profile management', '#3B82F6', 'user'),
    ('feature_request', 'Feature Request', 'New feature suggestions and enhancements', '#8B5CF6', 'lightbulb');

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active tickets with user details
CREATE VIEW active_tickets_view AS
SELECT 
    t.id,
    t.ticket_number,
    t.subject,
    t.status,
    t.priority,
    t.category,
    t.created_at,
    t.ai_confidence,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.email AS customer_email,
    COALESCE(a.first_name || ' ' || a.last_name, 'Unassigned') AS assigned_to_name,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at))/3600 AS age_hours,
    CASE 
        WHEN t.resolution_due_at < CURRENT_TIMESTAMP THEN true 
        ELSE false 
    END AS is_overdue
FROM tickets t
JOIN users c ON t.customer_id = c.id
LEFT JOIN users a ON t.assigned_to = a.id
WHERE t.status NOT IN ('closed');

-- View: Technician workload
CREATE VIEW technician_workload_view AS
SELECT 
    u.id AS technician_id,
    u.first_name || ' ' || u.last_name AS technician_name,
    COUNT(CASE WHEN t.status = 'open' THEN 1 END) AS open_tickets,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) AS in_progress_tickets,
    COUNT(CASE WHEN t.status = 'waiting_on_customer' THEN 1 END) AS waiting_tickets,
    COUNT(*) AS total_assigned
FROM users u
LEFT JOIN tickets t ON u.id = t.assigned_to AND t.status NOT IN ('closed', 'resolved')
WHERE u.role IN ('technician', 'admin')
GROUP BY u.id, u.first_name, u.last_name;

-- View: Category statistics
CREATE VIEW category_statistics_view AS
SELECT 
    c.name AS category,
    c.display_name,
    COUNT(t.id) AS total_tickets,
    COUNT(CASE WHEN t.status = 'open' THEN 1 END) AS open_tickets,
    COUNT(CASE WHEN t.ai_classified = true THEN 1 END) AS ai_classified_tickets,
    AVG(t.ai_confidence) FILTER (WHERE t.ai_classified = true) AS avg_ai_confidence,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_resolution_hours
FROM categories c
LEFT JOIN tickets t ON c.name = t.category
GROUP BY c.name, c.display_name;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Stores all system users including customers, technicians, and administrators';
COMMENT ON TABLE categories IS 'Predefined ticket categories synchronized with AI classifier';
COMMENT ON TABLE tickets IS 'Main table for support tickets with AI classification metadata';
COMMENT ON TABLE ticket_assignments IS 'Assignment history tracking for tickets';
COMMENT ON TABLE ticket_history IS 'Audit trail for all ticket changes and updates';

COMMENT ON COLUMN tickets.ai_confidence IS 'AI classification confidence score (0.00 to 1.00)';
COMMENT ON COLUMN tickets.ai_fallback_used IS 'Indicates if AI classifier used fallback behavior';
COMMENT ON COLUMN tickets.ai_keywords_matched IS 'JSON object containing matched keywords from AI classification';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================
-- Note: Adjust these based on your application user setup

-- Example: Grant appropriate permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO blueclue_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO blueclue_app;

-- ============================================================================
-- SCHEMA VERSION INFO
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial BlueClue database schema with AI classification support');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
