# Database Schema Changelog

All notable changes to the BlueClue database schema are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-21

### Added

#### Tables
- **ticket_comments** - Support for ticket comments and conversations
  - Public and internal comments
  - Threaded replies via parent_comment_id
  - Soft delete capability (deleted_at field)
  - User type tracking (client/tech/management)
  - Automatic updated_at trigger

- **ticket_templates** - Predefined templates for common ticket types
  - Category-based organization
  - Default priority settings
  - JSONB field_mappings for flexible field definitions
  - Active/inactive flag
  - Created by tracking
  - 15 sample templates in seed data

#### Columns (tickets table)
- `reopen_count` (INTEGER) - Track number of times ticket has been reopened
- `last_reopened_at` (TIMESTAMP) - Timestamp of most recent reopen

#### Enum Values (ticket_status)
- `cancelled` - For tickets cancelled by customer or management
- `reopened` - For tickets reopened after closure

#### Indexes
- `idx_ticket_comments_ticket` - Fast comment lookup by ticket
- `idx_ticket_comments_user` - Comments by user
- `idx_ticket_comments_parent` - Navigate comment threads
- `idx_ticket_comments_created_at` - Chronological sorting
- `idx_ticket_comments_active` - Filter active (non-deleted) comments
- `idx_ticket_comments_internal` - Filter internal comments
- `idx_ticket_templates_category` - Templates by category
- `idx_ticket_templates_active` - Active templates only
- `idx_ticket_templates_name` - Template name lookup
- `idx_ticket_templates_created_by` - Templates by creator
- `idx_ticket_templates_field_mappings` - GIN index for JSON search
- `idx_tickets_reopened` - Find reopened tickets efficiently
- `idx_ticket_assignments_user` - Assignments for a user
- `idx_ticket_assignments_role` - Filter by assignment role
- `idx_ticket_assignments_assigned_by` - Track who made assignments

#### Constraints
- `user_type_valid` - Validate comment user type (client/tech/management)
- `content_not_empty` - Ensure comments have content
- `internal_comment_rules` - Only tech/management can create internal comments
- `template_name_not_empty` - Templates must have names
- `reopen_count_positive` - Reopen count cannot be negative
- `assignment_role` - Assignment role must be primary or assisting
- `unique_active_assignment` - Prevent duplicate active assignments

#### Documentation
- `SCHEMA_EXTENSION_SUMMARY.md` - Comprehensive implementation guide
- `QUICK_REFERENCE.md` - Common queries and operations
- `migrations/README.md` - Migration documentation
- Table comments for all new tables
- Column comments for new fields

#### Sample Data
- 15 ticket templates across 5 categories
  - 3 Hardware templates
  - 3 Software templates  
  - 3 Network templates
  - 3 Login/Access templates
  - 2 General templates

### Changed

#### Tables
- **ticket_assignments** - Restructured for multi-technician support
  - Renamed `assigned_to` → `user_id` (clearer naming)
  - Added `role` field (primary/assisting)
  - Changed from single assignment to many-to-many relationship
  - Maintains full assignment history
  - Migration preserves existing data as 'primary' assignments

#### Schema Structure
- Updated DROP TABLE order to include new tables
- Schema version updated from 1.0.0 to 2.0.0
- Enhanced documentation in all schema sections

#### Documentation
- README.md updated with v2.0.0 features
- Added sections for all new capabilities
- Updated verification commands
- Added migration instructions
- Enhanced sample queries

### Migration

#### Scripts Added
- `migrations/001_add_comments_templates_reopen_tracking.sql`
  - Forward migration (1.0.0 → 2.0.0)
  - Atomic transaction (all or nothing)
  - Preserves all existing data
  - Progress messages during execution

- `migrations/001_rollback.sql`
  - Rollback migration (2.0.0 → 1.0.0)
  - Removes new tables
  - Reverts ticket_assignments structure
  - ⚠️ WARNING: Deletes comments and templates

#### Migration Process
1. Backup database before migration
2. Run forward migration script
3. Verify schema version is 2.0.0
4. Test new features
5. Rollback available if needed (with data loss warning)

### Technical Details

#### Performance Optimizations
- GIN index on ticket_templates.field_mappings for fast JSON queries
- Composite indexes on frequently queried field combinations
- Partial indexes using WHERE clauses for efficiency
- Proper foreign key constraints with cascading deletes

#### Data Integrity
- All new tables use SERIAL PRIMARY KEYs
- Foreign key constraints with appropriate ON DELETE actions
- CHECK constraints for data validation
- UNIQUE constraints prevent duplicate active assignments
- Triggers maintain updated_at timestamps automatically

#### Backward Compatibility
- All existing queries continue to work
- ticket_assignments migration preserves historical data
- Extended enum values don't break existing status checks
- New fields have sensible defaults (reopen_count = 0)

### Security Considerations

- Internal comments must be filtered by user role in application layer
- Template creation/editing should be admin-only
- Assignment permissions should be validated  
- Soft deletes prevent accidental data loss
- User type validation prevents privilege escalation

### Database Size Impact

Estimated storage impact for typical usage:
- ticket_comments: ~500 bytes per comment
- ticket_templates: ~1-2 KB per template (mostly in field_mappings)
- ticket_assignments: ~100 bytes per assignment
- tickets (new fields): ~20 bytes per ticket

For a database with 10,000 tickets:
- ~20,000 comments: 10 MB
- ~20 templates: 40 KB
- ~15,000 assignments: 1.5 MB
- Total additional storage: ~12 MB

### API Impact

New endpoints required:
- Comment CRUD operations
- Assignment management
- Template management
- Reopen ticket functionality

See SCHEMA_EXTENSION_SUMMARY.md for implementation details.

### Testing Requirements

#### Unit Tests
- Comment creation, retrieval, deletion
- Internal comment access control
- Threaded comment navigation
- Multi-technician assignment/unassignment
- Template CRUD operations
- Ticket reopen logic
- Status enum validation

#### Integration Tests
- Comment notifications
- Assignment change notifications
- Template-based ticket creation
- Reopen tracking accuracy
- Migration forward and rollback

#### Performance Tests
- Comment pagination with large datasets
- Template JSON field queries
- Complex assignment lookups
- Reopen analytics queries

### Known Issues

None at this time.

### Future Enhancements (Not in v2.0.0)

Potential future additions:
- Comment reactions/likes
- Template versioning
- Assignment workload balancing
- Reopen prevention/limits
- Comment search/indexing
- Template categories and tags
- Rich text support for comments
- File attachments for comments

### Breaking Changes

⚠️ **IMPORTANT:** The ticket_assignments table structure has changed.

**If you have custom queries:**
- Replace `assigned_to` with `user_id`
- Add `WHERE unassigned_at IS NULL` to get active assignments
- Handle multiple assignments per ticket
- Check the `role` field to distinguish primary vs. assisting

**Example migration:**
```sql
-- OLD QUERY (v1.0.0)
SELECT * FROM ticket_assignments 
WHERE assigned_to = 5;

-- NEW QUERY (v2.0.0)
SELECT * FROM ticket_assignments 
WHERE user_id = 5 
  AND unassigned_at IS NULL;
```

### Upgrade Path

**From v1.0.0 to v2.0.0:**
1. Backup database: `pg_dump blueclue > backup_v1.0.0.sql`
2. Run migration: `psql -d blueclue -f migrations/001_add_comments_templates_reopen_tracking.sql`
3. Verify: `SELECT * FROM schema_version;`
4. Test: Run verification queries from README.md
5. Update backend application code
6. Deploy new API endpoints
7. Update frontend

**Rollback (if needed):**
```bash
psql -d blueclue -f migrations/001_rollback.sql
```

### Contributors

- Database Team
- Backend Development Team

---

## [1.0.0] - 2026-02-02

### Added
- Initial database schema
- Core tables: users, tickets, categories
- AI classification support
- Guest user system
- RBAC (Role-Based Access Control)
- Audit logging
- Automated triggers and views
- Sample seed data
- Documentation

---

## Version History Summary

| Version | Date       | Description                                      |
|---------|------------|--------------------------------------------------|
| 2.0.0   | 2026-02-21 | Comments, templates, multi-tech, reopen tracking |
| 1.0.0   | 2026-02-02 | Initial schema with AI classification            |

---

**Note:** Always backup your database before applying schema changes!
