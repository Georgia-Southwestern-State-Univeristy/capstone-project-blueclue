# Quick Reference Guide - Schema v2.0.0

Quick reference for the most common queries and operations with the new database features.

## Comments

### Create a Comment
```sql
INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, is_internal)
VALUES (1, 5, 'tech', 'Working on this issue now', false)
RETURNING *;
```

### Get All Comments for a Ticket
```sql
SELECT 
    c.id,
    c.content,
    c.is_internal,
    c.created_at,
    u.first_name || ' ' || u.last_name AS author,
    c.user_type
FROM ticket_comments c
JOIN users u ON c.user_id = u.id
WHERE c.ticket_id = 1 
  AND c.deleted_at IS NULL
ORDER BY c.created_at ASC;
```

### Create Threaded Reply
```sql
INSERT INTO ticket_comments (ticket_id, user_id, user_type, content, parent_comment_id)
VALUES (1, 5, 'tech', 'Following up on this', 12)
RETURNING *;
```

### Get Comment Thread
```sql
WITH RECURSIVE comment_tree AS (
    -- Root comment
    SELECT id, ticket_id, content, parent_comment_id, created_at, 1 as depth
    FROM ticket_comments
    WHERE id = 12 AND deleted_at IS NULL
    
    UNION ALL
    
    -- Replies
    SELECT c.id, c.ticket_id, c.content, c.parent_comment_id, c.created_at, ct.depth + 1
    FROM ticket_comments c
    JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.deleted_at IS NULL
)
SELECT * FROM comment_tree ORDER BY created_at ASC;
```

### Soft Delete Comment
```sql
UPDATE ticket_comments 
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = 15 AND user_id = 5;
```

## Multi-Technician Assignments

### Assign Primary Technician
```sql
INSERT INTO ticket_assignments (ticket_id, user_id, role, assigned_by)
VALUES (1, 5, 'primary', 2)
RETURNING *;
```

### Assign Assisting Technician
```sql
INSERT INTO ticket_assignments (ticket_id, user_id, role, assigned_by)
VALUES (1, 6, 'assisting', 5)
RETURNING *;
```

### Get All Assigned Technicians for a Ticket
```sql
SELECT 
    ta.id,
    ta.role,
    ta.assigned_at,
    u.id AS tech_id,
    u.first_name,
    u.last_name,
    u.email,
    assigner.first_name || ' ' || assigner.last_name AS assigned_by_name
FROM ticket_assignments ta
JOIN users u ON ta.user_id = u.id
LEFT JOIN users assigner ON ta.assigned_by = assigner.id
WHERE ta.ticket_id = 1 
  AND ta.unassigned_at IS NULL
ORDER BY 
    CASE ta.role WHEN 'primary' THEN 1 ELSE 2 END,
    ta.assigned_at;
```

### Get All Tickets for a Technician
```sql
SELECT 
    t.id,
    t.ticket_number,
    t.subject,
    t.status,
    t.priority,
    ta.role,
    ta.assigned_at
FROM tickets t
JOIN ticket_assignments ta ON t.id = ta.ticket_id
WHERE ta.user_id = 5 
  AND ta.unassigned_at IS NULL
ORDER BY 
    CASE ta.role WHEN 'primary' THEN 1 ELSE 2 END,
    t.priority DESC,
    t.created_at DESC;
```

### Unassign Technician
```sql
UPDATE ticket_assignments 
SET unassigned_at = CURRENT_TIMESTAMP
WHERE ticket_id = 1 AND user_id = 6;
```

### Change Assignment Role
```sql
-- First unassign
UPDATE ticket_assignments 
SET unassigned_at = CURRENT_TIMESTAMP
WHERE ticket_id = 1 AND user_id = 6 AND unassigned_at IS NULL;

-- Then reassign with new role
INSERT INTO ticket_assignments (ticket_id, user_id, role, assigned_by)
VALUES (1, 6, 'primary', 5);
```

## Templates

### Get All Active Templates
```sql
SELECT 
    id,
    name,
    category,
    description,
    default_priority,
    field_mappings
FROM ticket_templates
WHERE is_active = true
ORDER BY category, name;
```

### Get Templates by Category
```sql
SELECT * FROM ticket_templates
WHERE category = 'hardware' 
  AND is_active = true
ORDER BY name;
```

### Get Template Details with Field Mappings
```sql
SELECT 
    id,
    name,
    description,
    default_priority,
    field_mappings->>'subject' AS suggested_subject,
    field_mappings->'common_solutions' AS solutions,
    field_mappings->'required_info' AS required_info
FROM ticket_templates
WHERE id = 1;
```

### Create Template
```sql
INSERT INTO ticket_templates (name, category, description, default_priority, field_mappings, created_by)
VALUES (
    'Email Not Sending',
    'software',
    'Template for email sending issues',
    'medium',
    '{
        "subject": "Cannot send emails",
        "troubleshooting": ["Check internet", "Verify email settings", "Test SMTP"],
        "required_info": ["Email client", "Error message", "Can receive emails?"]
    }'::jsonb,
    2
)
RETURNING *;
```

### Deactivate Template
```sql
UPDATE ticket_templates
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE id = 5;
```

### Search Templates by Field Mappings (JSON)
```sql
-- Find templates with specific keyword in field_mappings
SELECT name, category, field_mappings
FROM ticket_templates
WHERE field_mappings::text ILIKE '%password%'
  AND is_active = true;
```

## Reopen Tracking

### Reopen a Ticket
```sql
UPDATE tickets
SET 
    status = 'reopened',
    reopen_count = reopen_count + 1,
    last_reopened_at = CURRENT_TIMESTAMP,
    resolved_at = NULL,
    resolved_by = NULL,
    closed_at = NULL
WHERE id = 1
RETURNING *;
```

### Get Frequently Reopened Tickets
```sql
SELECT 
    ticket_number,
    subject,
    status,
    reopen_count,
    last_reopened_at,
    created_at
FROM tickets
WHERE reopen_count >= 2
ORDER BY reopen_count DESC, last_reopened_at DESC;
```

### Get Reopened Tickets Last 7 Days
```sql
SELECT 
    t.ticket_number,
    t.subject,
    t.reopen_count,
    t.last_reopened_at,
    u.first_name || ' ' || u.last_name AS customer_name
FROM tickets t
JOIN users u ON t.customer_id = u.id
WHERE t.last_reopened_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY t.last_reopened_at DESC;
```

### Cancel a Ticket
```sql
UPDATE tickets
SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
WHERE id = 1
RETURNING *;
```

## Combined Queries

### Get Full Ticket Details with Comments and Assignments
```sql
SELECT 
    t.id,
    t.ticket_number,
    t.subject,
    t.status,
    t.priority,
    t.reopen_count,
    -- Customer info
    customer.first_name || ' ' || customer.last_name AS customer_name,
    customer.email AS customer_email,
    -- Comments count
    COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL) AS comment_count,
    COUNT(DISTINCT c.id) FILTER (WHERE c.is_internal AND c.deleted_at IS NULL) AS internal_comment_count,
    -- Assignments
    json_agg(DISTINCT jsonb_build_object(
        'tech_id', tech.id,
        'tech_name', tech.first_name || ' ' || tech.last_name,
        'role', ta.role
    )) FILTER (WHERE ta.unassigned_at IS NULL) AS assigned_technicians
FROM tickets t
JOIN users customer ON t.customer_id = customer.id
LEFT JOIN ticket_comments c ON t.id = c.ticket_id
LEFT JOIN ticket_assignments ta ON t.id = ta.ticket_id AND ta.unassigned_at IS NULL
LEFT JOIN users tech ON ta.user_id = tech.id
WHERE t.id = 1
GROUP BY t.id, customer.id;
```

### Get Technician Workload with Assignment Roles
```sql
SELECT 
    u.id,
    u.first_name || ' ' || u.last_name AS technician_name,
    COUNT(*) FILTER (WHERE ta.role = 'primary') AS primary_tickets,
    COUNT(*) FILTER (WHERE ta.role = 'assisting') AS assisting_tickets,
    COUNT(*) AS total_assigned
FROM users u
JOIN ticket_assignments ta ON u.id = ta.user_id
JOIN tickets t ON ta.ticket_id = t.id
WHERE u.role IN ('technician', 'senior_technician')
  AND ta.unassigned_at IS NULL
  AND t.status NOT IN ('resolved', 'closed', 'cancelled')
GROUP BY u.id
ORDER BY total_assigned DESC;
```

### Get Recent Activity for a Ticket
```sql
SELECT 
    'comment' AS activity_type,
    c.created_at AS activity_time,
    u.first_name || ' ' || u.last_name AS actor,
    c.content AS details,
    c.is_internal
FROM ticket_comments c
JOIN users u ON c.user_id = u.id
WHERE c.ticket_id = 1 AND c.deleted_at IS NULL

UNION ALL

SELECT 
    'assignment' AS activity_type,
    ta.assigned_at AS activity_time,
    u.first_name || ' ' || u.last_name AS actor,
    'Assigned as ' || ta.role || ' technician' AS details,
    false AS is_internal
FROM ticket_assignments ta
JOIN users u ON ta.user_id = u.id
WHERE ta.ticket_id = 1

UNION ALL

SELECT 
    'history' AS activity_type,
    th.created_at AS activity_time,
    u.first_name || ' ' || u.last_name AS actor,
    th.change_type || ': ' || COALESCE(th.old_value, '') || ' → ' || COALESCE(th.new_value, '') AS details,
    false AS is_internal
FROM ticket_history th
LEFT JOIN users u ON th.changed_by = u.id
WHERE th.ticket_id = 1

ORDER BY activity_time DESC
LIMIT 20;
```

## Analytics Queries

### Template Usage Statistics
```sql
SELECT 
    tt.name,
    tt.category,
    COUNT(t.id) AS tickets_created,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) AS avg_resolution_hours
FROM ticket_templates tt
LEFT JOIN tickets t ON t.category = tt.category
WHERE tt.is_active = true
GROUP BY tt.id, tt.name, tt.category
ORDER BY tickets_created DESC;
```

### Comment Activity by User Type
```sql
SELECT 
    user_type,
    COUNT(*) AS total_comments,
    COUNT(*) FILTER (WHERE is_internal) AS internal_comments,
    COUNT(DISTINCT ticket_id) AS unique_tickets,
    DATE_TRUNC('day', created_at) AS day
FROM ticket_comments
WHERE deleted_at IS NULL
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY user_type, DATE_TRUNC('day', created_at)
ORDER BY day DESC, user_type;
```

### Reopen Rate by Category
```sql
SELECT 
    category,
    COUNT(*) AS total_tickets,
    COUNT(*) FILTER (WHERE reopen_count > 0) AS reopened_tickets,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE reopen_count > 0) / NULLIF(COUNT(*), 0),
        2
    ) AS reopen_percentage,
    AVG(reopen_count) FILTER (WHERE reopen_count > 0) AS avg_reopens_when_reopened
FROM tickets
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
GROUP BY category
ORDER BY reopen_percentage DESC;
```

## Useful Functions

### Get User Type by ID
```sql
CREATE OR REPLACE FUNCTION get_user_type(user_id INTEGER)
RETURNS VARCHAR AS $$
    SELECT 
        CASE 
            WHEN role IN ('customer') THEN 'client'
            WHEN role IN ('technician', 'senior_technician') THEN 'tech'
            WHEN role IN ('management', 'admin') THEN 'management'
            ELSE 'client'
        END
    FROM users
    WHERE id = user_id;
$$ LANGUAGE SQL;
```

### Count Active Assignments for Ticket
```sql
CREATE OR REPLACE FUNCTION count_active_assignments(ticket_id INTEGER)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM ticket_assignments
    WHERE ticket_id = $1 AND unassigned_at IS NULL;
$$ LANGUAGE SQL;
```

---

**Tip:** Save commonly used queries as views or functions for easy reuse!
