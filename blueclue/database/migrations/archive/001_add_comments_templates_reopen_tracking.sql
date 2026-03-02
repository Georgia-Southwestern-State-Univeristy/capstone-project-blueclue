-- ============================================================================
-- Migration: 001 - Add Comments, Templates, and Reopen Tracking
-- ============================================================================
-- Description: Extends database schema to support:
--   - Ticket comments with threaded replies
--   - Multi-technician assignment (primary/assisting roles)
--   - Ticket templates for common issues
--   - Enhanced ticket metadata (reopen tracking, cancelled status)
-- 
-- Version: 1.0.0 -> 2.0.0
-- Created: 2026-02-21
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Update ticket_status enum to include 'cancelled' and 'reopened'
-- ============================================================================

-- PostgreSQL doesn't allow direct ALTER TYPE for enums, so we need to:
-- 1. Drop views that depend on the status column
-- 2. Remove default constraint
-- 3. Create new type with additional values
-- 4. Convert columns
-- 5. Drop old type
-- 6. Restore default constraint
-- 7. Recreate views

-- Drop views that depend on tickets.status
DROP VIEW IF EXISTS active_tickets_view;
DROP VIEW IF EXISTS technician_workload_view;
DROP VIEW IF EXISTS category_statistics_view;

-- Create new enum type with extended values
CREATE TYPE ticket_status_new AS ENUM (
    'open', 
    'in_progress', 
    'waiting_on_customer', 
    'resolved', 
    'closed', 
    'cancelled', 
    'reopened'
);

-- Update tickets table to use new enum (remove default first, then convert)
ALTER TABLE tickets 
    ALTER COLUMN status DROP DEFAULT;

-- Convert column type using text as intermediate
ALTER TABLE tickets 
    ALTER COLUMN status TYPE text;

ALTER TABLE tickets 
    ALTER COLUMN status TYPE ticket_status_new 
    USING status::ticket_status_new;

-- Restore default value
ALTER TABLE tickets 
    ALTER COLUMN status SET DEFAULT 'open'::ticket_status_new;

-- Drop old enum and rename new one
DROP TYPE ticket_status;
ALTER TYPE ticket_status_new RENAME TO ticket_status;

-- Recreate views
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
-- STEP 2: Add new columns to tickets table
-- ============================================================================

-- Add reopen tracking fields
ALTER TABLE tickets 
    ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_reopened_at TIMESTAMP WITH TIME ZONE,
    ADD CONSTRAINT reopen_count_positive CHECK (reopen_count >= 0);

-- Create index for reopened tickets
CREATE INDEX idx_tickets_reopened ON tickets(reopen_count) WHERE reopen_count > 0;

-- ============================================================================
-- STEP 3: Update ticket_assignments table structure
-- ============================================================================

-- Backup existing assignments to temporary table
CREATE TEMP TABLE ticket_assignments_backup AS 
SELECT * FROM ticket_assignments;

-- Drop and recreate ticket_assignments with new structure
DROP TABLE ticket_assignments CASCADE;

CREATE TABLE ticket_assignments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'primary',
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT assignment_role CHECK (role IN ('primary', 'assisting')),
    CONSTRAINT assignment_dates_valid CHECK (
        unassigned_at IS NULL OR unassigned_at >= assigned_at
    ),
    CONSTRAINT unique_active_assignment UNIQUE (ticket_id, user_id)
);

-- Restore data from backup (mapping old column names to new)
INSERT INTO ticket_assignments (ticket_id, user_id, role, assigned_at, assigned_by, unassigned_at, notes)
SELECT 
    ticket_id, 
    assigned_to AS user_id,
    'primary' AS role,
    assigned_at,
    assigned_by,
    unassigned_at,
    notes
FROM ticket_assignments_backup;

-- Create indexes
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_user ON ticket_assignments(user_id);
CREATE INDEX idx_ticket_assignments_role ON ticket_assignments(role);
CREATE INDEX idx_ticket_assignments_assigned_by ON ticket_assignments(assigned_by);
CREATE INDEX idx_ticket_assignments_active ON ticket_assignments(ticket_id, user_id) 
    WHERE unassigned_at IS NULL;

-- ============================================================================
-- STEP 4: Create ticket_comments table
-- ============================================================================

CREATE TABLE ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    parent_comment_id INTEGER REFERENCES ticket_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT user_type_valid CHECK (user_type IN ('client', 'tech', 'management')),
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT internal_comment_rules CHECK (
        (is_internal = false) OR 
        (is_internal = true AND user_type IN ('tech', 'management'))
    )
);

-- Create indexes
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_user ON ticket_comments(user_id);
CREATE INDEX idx_ticket_comments_parent ON ticket_comments(parent_comment_id);
CREATE INDEX idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
CREATE INDEX idx_ticket_comments_active ON ticket_comments(ticket_id, created_at DESC) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_ticket_comments_internal ON ticket_comments(ticket_id, is_internal)
    WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Create ticket_templates table
-- ============================================================================

CREATE TABLE ticket_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category ticket_category NOT NULL,
    description TEXT,
    default_priority ticket_priority NOT NULL DEFAULT 'medium',
    field_mappings JSONB,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Constraints
    CONSTRAINT template_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Create indexes
CREATE INDEX idx_ticket_templates_category ON ticket_templates(category);
CREATE INDEX idx_ticket_templates_active ON ticket_templates(is_active) 
    WHERE is_active = true;
CREATE INDEX idx_ticket_templates_created_by ON ticket_templates(created_by);
CREATE INDEX idx_ticket_templates_name ON ticket_templates(name);

-- GIN index for JSON field searching
CREATE INDEX idx_ticket_templates_field_mappings ON ticket_templates USING GIN (field_mappings);

-- Create trigger for updated_at
CREATE TRIGGER update_ticket_templates_updated_at
    BEFORE UPDATE ON ticket_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Update schema version
-- ============================================================================

INSERT INTO schema_version (version, description) 
VALUES ('2.0.0', 'Added ticket_comments, updated ticket_assignments for multi-tech support, added ticket_templates, enhanced tickets table with reopen tracking')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- STEP 7: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE ticket_comments IS 'Stores ticket comments and replies with support for threaded conversations and internal notes';
COMMENT ON TABLE ticket_templates IS 'Predefined templates for common ticket types and categories';
COMMENT ON TABLE ticket_assignments IS 'Many-to-many ticket assignments supporting multiple technicians with primary/assisting roles';

COMMENT ON COLUMN ticket_comments.is_internal IS 'Internal tech-only comments not visible to customers';
COMMENT ON COLUMN ticket_comments.parent_comment_id IS 'Reference to parent comment for threaded replies';
COMMENT ON COLUMN ticket_comments.deleted_at IS 'Soft delete timestamp for comment retention';
COMMENT ON COLUMN ticket_templates.field_mappings IS 'JSON object containing default field values for template';
COMMENT ON COLUMN ticket_assignments.role IS 'Assignment role: primary (main assignee) or assisting (supporting technician)';
COMMENT ON COLUMN tickets.reopen_count IS 'Number of times this ticket has been reopened after closure';
COMMENT ON COLUMN tickets.last_reopened_at IS 'Timestamp of most recent ticket reopen';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 001 completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Changes applied:';
    RAISE NOTICE '  ✓ Extended ticket_status enum (added cancelled, reopened)';
    RAISE NOTICE '  ✓ Added reopen tracking to tickets table';
    RAISE NOTICE '  ✓ Updated ticket_assignments for multi-tech support';
    RAISE NOTICE '  ✓ Created ticket_comments table';
    RAISE NOTICE '  ✓ Created ticket_templates table';
    RAISE NOTICE '  ✓ Updated schema version to 2.0.0';
    RAISE NOTICE '========================================';
END $$;

COMMIT;
