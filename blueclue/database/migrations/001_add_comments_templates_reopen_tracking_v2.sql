-- ============================================================================
-- Migration: 001 - Add Comments, Templates, and Reopen Tracking (v2)
-- ============================================================================
-- Simplified version that extends enum values without recreation
-- Version: 1.0.0 -> 2.0.0
-- Created: 2026-02-21
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Extend ticket_status enum (ADD VALUE is much simpler)
-- ============================================================================

-- Add new enum values (this is safe and doesn't require type conversion)
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'reopened';

-- ============================================================================
-- STEP 2: Add new columns to tickets table
-- ============================================================================

ALTER TABLE tickets 
    ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reopened_at TIMESTAMP WITH TIME ZONE;

-- Add constraint
DO $$ BEGIN
    ALTER TABLE tickets ADD CONSTRAINT reopen_count_positive CHECK (reopen_count >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create index for reopened tickets
CREATE INDEX IF NOT EXISTS idx_tickets_reopened ON tickets(reopen_count) WHERE reopen_count > 0;

-- ============================================================================
-- STEP 3: Update ticket_assignments table structure
-- ============================================================================

-- Check if the table needs updating
DO $$ 
BEGIN
    -- Check if we need to update the table structure
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_assignments' 
        AND column_name = 'assigned_to'
    ) THEN
        -- Backup existing assignments
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
            
            CONSTRAINT assignment_role CHECK (role IN ('primary', 'assisting')),
            CONSTRAINT assignment_dates_valid CHECK (
                unassigned_at IS NULL OR unassigned_at >= assigned_at
            ),
            CONSTRAINT unique_active_assignment UNIQUE (ticket_id, user_id)
        );

        -- Restore data from backup
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
            
        RAISE NOTICE 'Updated ticket_assignments table structure';
    ELSE
        RAISE NOTICE 'ticket_assignments already has correct structure';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create ticket_comments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_comments (
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
    
    CONSTRAINT user_type_valid CHECK (user_type IN ('client', 'tech', 'management')),
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT internal_comment_rules CHECK (
        (is_internal = false) OR 
        (is_internal = true AND user_type IN ('tech', 'management'))
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user ON ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent ON ticket_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_active ON ticket_comments(ticket_id, created_at DESC) 
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_internal ON ticket_comments(ticket_id, is_internal)
    WHERE deleted_at IS NULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Create ticket_templates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_templates (
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
    
    CONSTRAINT template_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ticket_templates_category ON ticket_templates(category);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_active ON ticket_templates(is_active) 
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ticket_templates_created_by ON ticket_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_name ON ticket_templates(name);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_field_mappings ON ticket_templates USING GIN (field_mappings);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_ticket_templates_updated_at ON ticket_templates;
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
