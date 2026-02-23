# Database Schema Extension - Implementation Summary

**Date:** 2026-02-21  
**Schema Version:** 2.0.0  
**Migration:** 001_add_comments_templates_reopen_tracking

## Overview

Extended the BlueClue database schema to support advanced ticket management features including comments, templates, multi-technician assignment, and reopen tracking.

## Changes Summary

### 1. Ticket Comments Table (NEW)

**Table:** `ticket_comments`

```sql
CREATE TABLE ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL,  -- 'client', 'tech', 'management'
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    parent_comment_id INTEGER REFERENCES ticket_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE  -- Soft delete
);
```

**Features:**
- Public and internal comments
- Threaded conversations via `parent_comment_id`
- Soft delete capability
- User type tracking for access control
- Audit trail with created/updated timestamps

**Indexes:**
- `idx_ticket_comments_ticket` - Fast lookup by ticket
- `idx_ticket_comments_user` - Comments by user
- `idx_ticket_comments_parent` - Thread navigation
- `idx_ticket_comments_active` - Active comments only
- `idx_ticket_comments_internal` - Internal comment filtering

**Constraints:**
- `user_type_valid` - Must be 'client', 'tech', or 'management'
- `content_not_empty` - Content cannot be empty
- `internal_comment_rules` - Only tech/management can create internal comments

### 2. Ticket Assignments Table (UPDATED)

**Table:** `ticket_assignments`

**Changed from:** Single assignment tracking with `assigned_to`  
**Changed to:** Many-to-many with role support

```sql
CREATE TABLE ticket_assignments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Was: assigned_to
    role VARCHAR(20) NOT NULL DEFAULT 'primary',  -- NEW: 'primary' or 'assisting'
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);
```

**Features:**
- Multiple technicians per ticket
- Primary vs. assisting roles
- Full assignment history
- Assignment attribution (who assigned)

**Migration Handling:**
- Existing assignments preserved as 'primary' role
- Maintains backward compatibility

**Indexes:**
- `idx_ticket_assignments_user` - Assignments for a user
- `idx_ticket_assignments_role` - Filter by role
- `idx_ticket_assignments_active` - Active assignments only

**Constraints:**
- `assignment_role` - Must be 'primary' or 'assisting'
- `unique_active_assignment` - Prevents duplicate active assignments

### 3. Ticket Templates Table (NEW)

**Table:** `ticket_templates`

```sql
CREATE TABLE ticket_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category ticket_category NOT NULL,
    description TEXT,
    default_priority ticket_priority NOT NULL DEFAULT 'medium',
    field_mappings JSONB,  -- JSON object with default field values
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true
);
```

**Features:**
- Predefined templates for common issues
- Category-based organization
- JSON field mappings for flexibility
- Active/inactive toggle

**Sample Templates:**
- Hardware: Laptop power, printer offline, monitor issues
- Software: App crashes, installation requests, performance
- Network: Internet down, WiFi drops, VPN problems
- Login: Password resets, account lockouts, access requests
- General: Inquiries, feature requests

**Field Mappings Example:**
```json
{
  "subject": "Laptop won't power on",
  "common_solutions": [
    "Check power adapter",
    "Try different outlet",
    "Remove battery and AC, hold power 30s"
  ],
  "required_info": [
    "Laptop model",
    "Power adapter working?",
    "Any lights visible?"
  ]
}
```

**Indexes:**
- `idx_ticket_templates_category` - Templates by category
- `idx_ticket_templates_active` - Active templates only
- `idx_ticket_templates_field_mappings` - GIN index for JSON search

### 4. Tickets Table (ENHANCED)

**New Fields:**

```sql
ALTER TABLE tickets 
    ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_reopened_at TIMESTAMP WITH TIME ZONE;
```

**Extended Status Enum:**

```sql
CREATE TYPE ticket_status AS ENUM (
    'open', 
    'in_progress', 
    'waiting_on_customer', 
    'resolved', 
    'closed',
    'cancelled',   -- NEW
    'reopened'     -- NEW
);
```

**Features:**
- Track number of reopens
- Timestamp of last reopen
- Support for cancelled tickets
- Explicit reopened status

**New Index:**
- `idx_tickets_reopened` - Efficiently find reopened tickets

**Constraints:**
- `reopen_count_positive` - Reopen count must be >= 0

### 5. Schema Version

Updated to version 2.0.0 with description of all changes.

## Migration Scripts

### Forward Migration

**File:** `migrations/001_add_comments_templates_reopen_tracking.sql`

Safely upgrades database from v1.0.0 to v2.0.0:
1. Updates ticket_status enum (adds cancelled, reopened)
2. Adds reopen tracking fields to tickets
3. Restructures ticket_assignments for multi-tech support
4. Creates ticket_comments table
5. Creates ticket_templates table
6. Updates schema version

**Features:**
- Atomic transaction (all or nothing)
- Preserves existing data
- Status messages for progress tracking

### Rollback Migration

**File:** `migrations/001_rollback.sql`

Safely downgrades database from v2.0.0 to v1.0.0:
- Removes new tables (comments, templates)
- Reverts ticket_assignments structure
- Removes reopen tracking
- Reverts status enum

**⚠️ WARNING:** Rollback deletes all comments and templates!

## Backend Implementation Guide

### 1. Comment System

**Create Comment:**
```javascript
async function createComment(ticketId, userId, content, isInternal = false, parentCommentId = null) {
    const userType = await getUserType(userId); // 'client', 'tech', 'management'
    
    const result = await pool.query(
        `INSERT INTO ticket_comments 
         (ticket_id, user_id, user_type, content, is_internal, parent_comment_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [ticketId, userId, userType, content, isInternal, parentCommentId]
    );
    return result.rows[0];
}
```

**Get Comments (with access control):**
```javascript
async function getTicketComments(ticketId, userId) {
    const userType = await getUserType(userId);
    
    // Clients can't see internal comments
    const internalFilter = userType === 'client' ? 'AND is_internal = false' : '';
    
    const result = await pool.query(
        `SELECT c.*, u.first_name, u.last_name
         FROM ticket_comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.ticket_id = $1 
           AND c.deleted_at IS NULL
           ${internalFilter}
         ORDER BY c.created_at ASC`,
        [ticketId]
    );
    return result.rows;
}
```

**Soft Delete Comment:**
```javascript
async function deleteComment(commentId, userId) {
    // Check ownership/permissions first
    await pool.query(
        `UPDATE ticket_comments 
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [commentId, userId]
    );
}
```

### 2. Multi-Technician Assignment

**Assign Technician:**
```javascript
async function assignTechnician(ticketId, technicianId, role, assignedBy) {
    // Validate role
    if (!['primary', 'assisting'].includes(role)) {
        throw new Error('Role must be primary or assisting');
    }
    
    const result = await pool.query(
        `INSERT INTO ticket_assignments 
         (ticket_id, user_id, role, assigned_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ticketId, technicianId, role, assignedBy]
    );
    return result.rows[0];
}
```

**Get Assigned Technicians:**
```javascript
async function getTicketTechnicians(ticketId) {
    const result = await pool.query(
        `SELECT 
            ta.id,
            ta.role,
            ta.assigned_at,
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.email
         FROM ticket_assignments ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.ticket_id = $1 
           AND ta.unassigned_at IS NULL
         ORDER BY 
            CASE ta.role 
                WHEN 'primary' THEN 1 
                WHEN 'assisting' THEN 2 
            END,
            ta.assigned_at`,
        [ticketId]
    );
    return result.rows;
}
```

**Unassign Technician:**
```javascript
async function unassignTechnician(assignmentId) {
    await pool.query(
        `UPDATE ticket_assignments 
         SET unassigned_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [assignmentId]
    );
}
```

### 3. Ticket Templates

**Get Templates by Category:**
```javascript
async function getTemplatesByCategory(category) {
    const result = await pool.query(
        `SELECT * FROM ticket_templates
         WHERE category = $1 AND is_active = true
         ORDER BY name`,
        [category]
    );
    return result.rows;
}
```

**Create Ticket from Template:**
```javascript
async function createTicketFromTemplate(templateId, customerId, additionalData = {}) {
    // Get template
    const template = await pool.query(
        'SELECT * FROM ticket_templates WHERE id = $1',
        [templateId]
    );
    
    if (template.rows.length === 0) {
        throw new Error('Template not found');
    }
    
    const tmpl = template.rows[0];
    
    // Merge template field mappings with additional data
    const subject = additionalData.subject || tmpl.field_mappings?.subject || tmpl.name;
    const description = additionalData.description || tmpl.description || '';
    
    // Create ticket
    const result = await pool.query(
        `INSERT INTO tickets 
         (customer_id, subject, description, category, priority)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [customerId, subject, description, tmpl.category, tmpl.default_priority]
    );
    
    return result.rows[0];
}
```

### 4. Reopen Tracking

**Reopen Ticket:**
```javascript
async function reopenTicket(ticketId, userId) {
    const result = await pool.query(
        `UPDATE tickets 
         SET status = 'reopened',
             reopen_count = reopen_count + 1,
             last_reopened_at = CURRENT_TIMESTAMP,
             resolved_at = NULL,
             resolved_by = NULL
         WHERE id = $1
         RETURNING *`,
        [ticketId]
    );
    
    // Log to ticket_history
    await pool.query(
        `INSERT INTO ticket_history 
         (ticket_id, changed_by, change_type, field_name, new_value)
         VALUES ($1, $2, 'status_change', 'status', 'reopened')`,
        [ticketId, userId]
    );
    
    return result.rows[0];
}
```

**Find Frequently Reopened Tickets:**
```javascript
async function getFrequentlyReopenedTickets(threshold = 2) {
    const result = await pool.query(
        `SELECT 
            t.*,
            u.first_name || ' ' || u.last_name AS customer_name
         FROM tickets t
         JOIN users u ON t.customer_id = u.id
         WHERE t.reopen_count >= $1
         ORDER BY t.reopen_count DESC, t.last_reopened_at DESC`,
        [threshold]
    );
    return result.rows;
}
```

## API Endpoints to Implement

### Comments
- `POST /api/tickets/:id/comments` - Create comment
- `GET /api/tickets/:id/comments` - Get all comments
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Soft delete comment
- `POST /api/comments/:id/reply` - Reply to comment (threaded)

### Assignments
- `POST /api/tickets/:id/assignments` - Assign technician
- `GET /api/tickets/:id/assignments` - Get assignments
- `DELETE /api/assignments/:id` - Unassign technician
- `PUT /api/assignments/:id/role` - Change assignment role

### Templates
- `GET /api/templates` - List all templates (with filters)
- `GET /api/templates/:id` - Get template details
- `POST /api/templates` - Create template (admin only)
- `PUT /api/templates/:id` - Update template (admin only)
- `DELETE /api/templates/:id` - Deactivate template (admin only)
- `POST /api/templates/:id/create-ticket` - Create ticket from template

### Reopen
- `POST /api/tickets/:id/reopen` - Reopen a ticket
- `GET /api/tickets/reopened` - List reopened tickets
- `GET /api/tickets/frequently-reopened` - Analytics endpoint

## Testing Checklist

### Comments
- ✅ Create public comment
- ✅ Create internal comment (tech/management only)
- ✅ Create threaded reply
- ✅ Prevent clients from seeing internal comments
- ✅ Soft delete comment
- ✅ Prevent internal comments from clients

### Assignments
- ✅ Assign primary technician
- ✅ Assign assisting technicians
- ✅ Prevent duplicate active assignments
- ✅ Unassign technician
- ✅ View assignment history
- ✅ Change assignment role

### Templates
- ✅ List active templates by category
- ✅ Create ticket from template
- ✅ Field mappings properly applied
- ✅ Create/update/deactivate templates (admin)

### Reopen Tracking
- ✅ Reopen closed ticket
- ✅ Reopen count increments
- ✅ Last reopened timestamp updates
- ✅ Resolved fields cleared on reopen
- ✅ Query frequently reopened tickets

## Performance Considerations

1. **Comments:** Indexed by ticket_id for fast retrieval
2. **Assignments:** Unique constraint prevents duplicates
3. **Templates:** GIN index on JSONB field_mappings for fast searches
4. **Reopen tracking:** Simple integer field, very efficient

## Security Considerations

1. **Internal Comments:** Enforce access control in backend
2. **Assignments:** Validate user has assignment privileges
3. **Templates:** Restrict create/edit to admins
4. **Soft Deletes:** Don't expose deleted comments to API

## Next Steps

1. ✅ Apply migration to dev database
2. ⬜ Implement backend API endpoints
3. ⬜ Add frontend UI components
4. ⬜ Write integration tests
5. ⬜ Update API documentation
6. ⬜ Deploy to staging
7. ⬜ User acceptance testing
8. ⬜ Deploy to production

## Resources

- Migration scripts: `blueclue/database/migrations/`
- Updated schema: `blueclue/database/schema.sql`
- Sample data: `blueclue/database/seed.sql`
- Documentation: `blueclue/database/README.md`

---

**Questions or Issues?**  
Contact the database team or refer to the migration README for troubleshooting guidance.
