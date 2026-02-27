-- ============================================================================
-- Migration: 019_add_ticket_templates.sql
-- Description: Enhanced ticket templates system with categories, versioning,
--              placeholders, usage tracking, and export/import support
-- Version: 1.0.0
-- Created: 2026-02-27
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Template categories for organizing templates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_category') THEN
        CREATE TYPE template_category AS ENUM (
            'hardware',
            'software', 
            'access',
            'network',
            'account',
            'general',
            'other'
        );
    END IF;
END$$;

-- ============================================================================
-- TABLE: ticket_templates (Enhanced)
-- ============================================================================

-- First, check if the existing ticket_templates table needs to be altered
-- or if we can modify it safely

-- Add new columns to existing ticket_templates table if they don't exist
DO $$
BEGIN
    -- Add template_category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'template_category') THEN
        ALTER TABLE ticket_templates ADD COLUMN template_category template_category NOT NULL DEFAULT 'general';
    END IF;
    
    -- Add instructions column (when to use this template)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'instructions') THEN
        ALTER TABLE ticket_templates ADD COLUMN instructions TEXT;
    END IF;
    
    -- Add pre_filled_description column with placeholder support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'pre_filled_description') THEN
        ALTER TABLE ticket_templates ADD COLUMN pre_filled_description TEXT;
    END IF;
    
    -- Add pre_filled_subject column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'pre_filled_subject') THEN
        ALTER TABLE ticket_templates ADD COLUMN pre_filled_subject VARCHAR(500);
    END IF;
    
    -- Add common_tags column (JSON array of tags)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'common_tags') THEN
        ALTER TABLE ticket_templates ADD COLUMN common_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add field_requirements column (which fields are required/optional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'field_requirements') THEN
        ALTER TABLE ticket_templates ADD COLUMN field_requirements JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add custom_placeholders column (user-defined placeholders)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'custom_placeholders') THEN
        ALTER TABLE ticket_templates ADD COLUMN custom_placeholders JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add version column for template versioning
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'version') THEN
        ALTER TABLE ticket_templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    END IF;
    
    -- Add sort_order column for custom ordering
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'sort_order') THEN
        ALTER TABLE ticket_templates ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Add usage_count column for tracking popularity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'usage_count') THEN
        ALTER TABLE ticket_templates ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Add last_used_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_templates' AND column_name = 'last_used_at') THEN
        ALTER TABLE ticket_templates ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;
    END IF;
END$$;

-- ============================================================================
-- TABLE: template_versions (For auditing template changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_versions (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES ticket_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    template_category template_category NOT NULL,
    description TEXT,
    instructions TEXT,
    default_priority ticket_priority NOT NULL,
    category ticket_category NOT NULL,
    pre_filled_subject VARCHAR(500),
    pre_filled_description TEXT,
    common_tags JSONB DEFAULT '[]'::jsonb,
    field_requirements JSONB DEFAULT '{}'::jsonb,
    field_mappings JSONB,
    custom_placeholders JSONB DEFAULT '[]'::jsonb,
    changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT,
    
    -- Constraints
    CONSTRAINT unique_template_version UNIQUE (template_id, version)
);

-- Indexes for template_versions
CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_changed_by ON template_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_template_versions_changed_at ON template_versions(changed_at DESC);

-- ============================================================================
-- TABLE: ticket_template_usage (Track which templates are used on tickets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_template_usage (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES ticket_templates(id) ON DELETE SET NULL,
    template_version INTEGER NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    modifications_made BOOLEAN DEFAULT false,
    
    -- Constraints: One template per ticket (can be updated)
    CONSTRAINT unique_ticket_template UNIQUE (ticket_id)
);

-- Indexes for ticket_template_usage
CREATE INDEX IF NOT EXISTS idx_ticket_template_usage_ticket ON ticket_template_usage(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_template_usage_template ON ticket_template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_ticket_template_usage_applied_by ON ticket_template_usage(applied_by);
CREATE INDEX IF NOT EXISTS idx_ticket_template_usage_applied_at ON ticket_template_usage(applied_at DESC);

-- ============================================================================
-- Additional indexes for ticket_templates
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ticket_templates_template_category ON ticket_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_sort_order ON ticket_templates(sort_order);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_usage_count ON ticket_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_last_used ON ticket_templates(last_used_at DESC) WHERE last_used_at IS NOT NULL;

-- ============================================================================
-- FUNCTION: Update template usage count
-- ============================================================================

CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment usage count and update last_used_at
    UPDATE ticket_templates 
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.template_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating template usage count
DROP TRIGGER IF EXISTS trigger_update_template_usage ON ticket_template_usage;
CREATE TRIGGER trigger_update_template_usage
    AFTER INSERT ON ticket_template_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_template_usage_count();

-- ============================================================================
-- FUNCTION: Create template version on update
-- ============================================================================

CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if meaningful fields changed (not just usage_count)
    IF OLD.name != NEW.name OR 
       OLD.template_category != NEW.template_category OR
       OLD.description IS DISTINCT FROM NEW.description OR
       OLD.instructions IS DISTINCT FROM NEW.instructions OR
       OLD.default_priority != NEW.default_priority OR
       OLD.category != NEW.category OR
       OLD.pre_filled_subject IS DISTINCT FROM NEW.pre_filled_subject OR
       OLD.pre_filled_description IS DISTINCT FROM NEW.pre_filled_description OR
       OLD.common_tags::text IS DISTINCT FROM NEW.common_tags::text OR
       OLD.field_requirements::text IS DISTINCT FROM NEW.field_requirements::text OR
       OLD.field_mappings::text IS DISTINCT FROM NEW.field_mappings::text OR
       OLD.custom_placeholders::text IS DISTINCT FROM NEW.custom_placeholders::text THEN
        
        -- Increment version
        NEW.version := OLD.version + 1;
        
        -- Insert version record
        INSERT INTO template_versions (
            template_id, version, name, template_category, description, instructions,
            default_priority, category, pre_filled_subject, pre_filled_description,
            common_tags, field_requirements, field_mappings, custom_placeholders,
            changed_by, change_reason
        ) VALUES (
            OLD.id, OLD.version, OLD.name, OLD.template_category, OLD.description, 
            OLD.instructions, OLD.default_priority, OLD.category, OLD.pre_filled_subject, 
            OLD.pre_filled_description, OLD.common_tags, OLD.field_requirements, 
            OLD.field_mappings, OLD.custom_placeholders,
            COALESCE(NEW.created_by, OLD.created_by), 'Template updated'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for template versioning
DROP TRIGGER IF EXISTS trigger_template_version ON ticket_templates;
CREATE TRIGGER trigger_template_version
    BEFORE UPDATE ON ticket_templates
    FOR EACH ROW
    EXECUTE FUNCTION create_template_version();

-- ============================================================================
-- VIEW: Template analytics summary
-- ============================================================================

CREATE OR REPLACE VIEW v_template_analytics AS
SELECT 
    t.id,
    t.name,
    t.template_category,
    t.category,
    t.is_active,
    t.usage_count,
    t.last_used_at,
    t.created_at,
    COALESCE(
        (SELECT AVG(EXTRACT(EPOCH FROM (tk.resolved_at - tk.created_at)) / 3600)
         FROM ticket_template_usage ttu
         JOIN tickets tk ON ttu.ticket_id = tk.id
         WHERE ttu.template_id = t.id 
         AND tk.status IN ('resolved', 'closed')
         AND tk.resolved_at IS NOT NULL),
        0
    ) as avg_resolution_hours,
    COALESCE(
        (SELECT COUNT(*)
         FROM ticket_template_usage ttu
         JOIN tickets tk ON ttu.ticket_id = tk.id
         WHERE ttu.template_id = t.id 
         AND tk.status IN ('resolved', 'closed')),
        0
    ) as resolved_tickets,
    COALESCE(
        (SELECT COUNT(*)
         FROM ticket_template_usage ttu
         JOIN tickets tk ON ttu.ticket_id = tk.id
         WHERE ttu.template_id = t.id 
         AND tk.status NOT IN ('resolved', 'closed', 'cancelled')),
        0
    ) as open_tickets,
    u.first_name || ' ' || u.last_name as created_by_name
FROM ticket_templates t
LEFT JOIN users u ON t.created_by = u.id;

-- ============================================================================
-- DEFAULT TEMPLATES SEED DATA
-- ============================================================================

-- Insert default templates (only if they don't already exist)
INSERT INTO ticket_templates (
    name, template_category, category, description, instructions, 
    default_priority, pre_filled_subject, pre_filled_description,
    common_tags, field_requirements, custom_placeholders, created_by, is_active
)
SELECT * FROM (VALUES
    (
        'Password Reset Request',
        'access'::template_category,
        'login'::ticket_category,
        'Template for requesting password resets',
        'Use this template when a user needs their password reset. Ensure you verify user identity before processing.',
        'medium'::ticket_priority,
        'Password Reset Request for {{user_name}}',
        E'**User Information:**\n- Name: {{user_name}}\n- Email: {{user_email}}\n- Employee ID: [Enter Employee ID]\n\n**Request Details:**\n- Reason for reset: [Account locked / Forgot password / Security concern]\n- System/Application: [Specify the system]\n\n**Verification:**\n- Identity verified by: [Your name]\n- Verification method: [Phone / In-person / Email confirmation]',
        '["password", "reset", "access", "login"]'::jsonb,
        '{"employee_id": "required", "verification_method": "required"}'::jsonb,
        '[{"name": "employee_id", "description": "Employee ID number"}, {"name": "verification_method", "description": "How identity was verified"}]'::jsonb,
        1,
        true
    ),
    (
        'Software Installation Request',
        'software'::template_category,
        'software'::ticket_category,
        'Template for requesting software installation',
        'Use this template when a user needs new software installed. Include business justification and any required license information.',
        'low'::ticket_priority,
        'Software Installation Request: [Software Name]',
        E'**Requested Software:**\n- Software Name: [Enter software name]\n- Version (if specific): [Enter version or "Latest"]\n- Vendor/Publisher: [Enter vendor name]\n\n**User Information:**\n- Requesting User: {{user_name}}\n- Department: [Enter department]\n- Computer Name: [Enter computer name]\n\n**Business Justification:**\n[Explain why this software is needed for work]\n\n**License Information:**\n- Already purchased: [Yes/No]\n- License key (if available): [Enter or N/A]\n\n**Installation Deadline:**\n[Enter date needed by or "As soon as possible"]',
        '["software", "installation", "request", "application"]'::jsonb,
        '{"software_name": "required", "business_justification": "required"}'::jsonb,
        '[{"name": "software_name", "description": "Name of the software to install"}, {"name": "computer_name", "description": "Target computer hostname"}]'::jsonb,
        1,
        true
    ),
    (
        'Hardware Not Working',
        'hardware'::template_category,
        'hardware'::ticket_category,
        'Template for reporting hardware issues',
        'Use this template when hardware is malfunctioning. Provide as much detail as possible about the issue and any troubleshooting already attempted.',
        'high'::ticket_priority,
        'Hardware Issue: [Device Type] - [Brief Description]',
        E'**Affected Hardware:**\n- Device Type: [Computer / Monitor / Printer / Keyboard / Mouse / Other]\n- Make/Model: [Enter if known]\n- Asset Tag/Serial Number: [Enter if available]\n- Location: [Building/Room/Desk]\n\n**Issue Description:**\n- What is happening: [Describe the problem]\n- When did it start: [Date/Time]\n- Is the issue constant or intermittent: [Constant/Intermittent]\n- Any error messages: [Enter messages or "None"]\n\n**Impact:**\n- Number of users affected: [1 / Multiple]\n- Can you work without this device: [Yes/No - with workaround / No - work stopped]\n\n**Troubleshooting Already Attempted:**\n- [List what you have already tried, e.g., "Restarted computer", "Checked cables"]\n\n**Contact Information:**\n- Best contact number: {{user_phone}}\n- Preferred contact time: [Morning/Afternoon/Any time]',
        '["hardware", "malfunction", "broken", "not working", "device"]'::jsonb,
        '{"device_type": "required", "issue_description": "required", "location": "required"}'::jsonb,
        '[{"name": "device_type", "description": "Type of hardware device"}, {"name": "asset_tag", "description": "Asset tag or serial number"}]'::jsonb,
        1,
        true
    ),
    (
        'Internet Connection Issue',
        'network'::template_category,
        'network'::ticket_category,
        'Template for reporting internet/network connectivity problems',
        'Use this template when experiencing network or internet connectivity issues. Check if others nearby are affected.',
        'high'::ticket_priority,
        'Network Issue: {{user_name}} - [Location]',
        E'**Connection Issue Details:**\n- Type of issue: [No internet / Slow connection / Intermittent drops / Cannot access specific site]\n- Started: [Date and approximate time]\n- Connection type: [Wired / Wireless / Both]\n\n**Affected User(s):**\n- Your name: {{user_name}}\n- Location: [Building/Floor/Room]\n- Computer name: [Enter if known]\n- Are others nearby affected: [Yes / No / Unknown]\n\n**Symptoms:**\n- Can you access internal sites (intranet): [Yes / No]\n- Can you access external sites: [Yes / No]\n- Can you ping the gateway: [Yes / No / Don''t know how]\n- WiFi signal strength (if wireless): [Strong / Weak / None]\n\n**Troubleshooting Attempted:**\n- [ ] Restarted computer\n- [ ] Disconnected/reconnected network cable or WiFi\n- [ ] Checked that network cable is securely connected\n- [ ] Tried a different network port (if wired)\n\n**Urgency:**\n- [Explain how this is impacting your work]',
        '["network", "internet", "wifi", "connection", "connectivity"]'::jsonb,
        '{"issue_type": "required", "location": "required"}'::jsonb,
        '[{"name": "issue_type", "description": "Type of network issue"}, {"name": "computer_name", "description": "Computer hostname"}]'::jsonb,
        1,
        true
    ),
    (
        'Printer Problems',
        'hardware'::template_category,
        'hardware'::ticket_category,
        'Template for reporting printer issues',
        'Use this template for printer-related problems. Include the printer name/location and describe what happens when you try to print.',
        'medium'::ticket_priority,
        'Printer Issue: [Printer Name/Location]',
        E'**Printer Information:**\n- Printer Name: [Enter printer name from print dialog]\n- Location: [Building/Floor/Room]\n- Printer Model (if known): [Enter or "Unknown"]\n\n**Issue Description:**\n- Problem type: [Won''t print / Paper jam / Poor print quality / Offline / Other]\n- Error messages: [Enter any error codes or messages]\n- Does the issue affect all users or just you: [All users / Just me / Unknown]\n\n**What You Were Trying to Print:**\n- Document type: [Word / PDF / Email / Web page / Other]\n- Application used: [Enter application name]\n- Print size: [Letter / Legal / Other]\n\n**Troubleshooting Attempted:**\n- [ ] Checked printer is turned on\n- [ ] Checked for paper jams\n- [ ] Checked paper tray has paper\n- [ ] Restarted print job\n- [ ] Tried printing a test page\n\n**Urgency:**\n- When do you need this resolved: [Immediately / Today / This week / No rush]',
        '["printer", "printing", "print", "paper jam", "offline"]'::jsonb,
        '{"printer_name": "required", "problem_type": "required"}'::jsonb,
        '[{"name": "printer_name", "description": "Name of the printer"}, {"name": "problem_type", "description": "Type of printer problem"}]'::jsonb,
        1,
        true
    ),
    (
        'New User Account Request',
        'account'::template_category,
        'account'::ticket_category,
        'Template for requesting new user accounts',
        'Use this template when a new employee needs system access. Requires manager approval and HR confirmation of start date.',
        'medium'::ticket_priority,
        'New User Account Request: [New Employee Name]',
        E'**New Employee Information:**\n- Full Name: [First and Last name]\n- Start Date: [MM/DD/YYYY]\n- Job Title: [Enter job title]\n- Department: [Enter department]\n- Manager Name: [Direct supervisor name]\n- Office Location: [Building/Room]\n- Phone Extension: [If assigned]\n\n**Required Access:**\n- [ ] Email account\n- [ ] Network login\n- [ ] VPN access\n- [ ] [Specific application 1]\n- [ ] [Specific application 2]\n- [ ] Shared drives: [List drive names]\n\n**Equipment Needed:**\n- [ ] Desktop computer\n- [ ] Laptop\n- [ ] Monitor(s): [Number needed]\n- [ ] Phone\n- [ ] Other: [Specify]\n\n**Account Information:**\n- Preferred username: [First.Last or other format]\n- Personal email (for initial credentials): [Enter email]\n\n**Approvals:**\n- Manager approval: [Name and Date]\n- HR confirmation: [Name and Date]\n\n**Additional Notes:**\n[Any special requirements or access needs]',
        '["new user", "account", "onboarding", "new hire", "access"]'::jsonb,
        '{"employee_name": "required", "start_date": "required", "manager_name": "required", "department": "required"}'::jsonb,
        '[{"name": "employee_name", "description": "New employee full name"}, {"name": "start_date", "description": "Employee start date"}, {"name": "manager_name", "description": "Direct supervisor name"}]'::jsonb,
        1,
        true
    )
) AS defaults(name, template_category, category, description, instructions, default_priority, pre_filled_subject, pre_filled_description, common_tags, field_requirements, custom_placeholders, created_by, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM ticket_templates WHERE ticket_templates.name = defaults.name
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ticket_templates IS 'Predefined ticket templates for common issues with support for placeholders, versioning, and usage tracking';
COMMENT ON TABLE template_versions IS 'Version history for ticket templates to support auditing changes';
COMMENT ON TABLE ticket_template_usage IS 'Tracks which templates are used when creating tickets';
COMMENT ON VIEW v_template_analytics IS 'Analytics view for template usage and effectiveness';
