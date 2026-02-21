# Technician Role Hierarchy Implementation

## Overview

The technician role hierarchy is **now included in the base database setup**. When you run `SETUP.ps1`, it automatically creates a 3-level hierarchy with different access permissions:
- **Management**: Full access to all categories (assign level)
- **Senior Technician**: Edit access to most categories, assign access to critical categories
- **Technician**: Limited access - edit for common tasks, view only for critical categories

## Access Level Summary

| Category | Technician | Senior Tech | Management |
|----------|-----------|-------------|------------|
| Hardware | Edit | Edit | Assign |
| Software | Edit | Edit | Assign |
| Network | View | Assign | Assign |
| Access & Security | View | Assign | Assign |
| Email & Communication | Edit | Edit | Assign |
| Printing & Scanning | Edit | Edit | Assign |
| Database | View | Assign | Assign |
| Infrastructure | View | Assign | Assign |
| User Account & Support | Edit | Edit | Assign |
| Mobile Devices | Edit | Edit | Assign |

**Access Level Hierarchy**: Assign > Edit > View
- Assign access includes edit and view
- Edit access includes view

## Installation

### Fresh Database Setup (Recommended)

Run the standard database setup to get the hierarchy automatically:

```powershell
cd blueclue\database
.\SETUP.ps1
```

This creates the complete database including:
- All three technician role levels (technician, senior_technician, management)
- Role-based category access defaults for each level
- Sample users at each hierarchy level

### Legacy Migration Files

The migration files in `blueclue/database/migrations/` are kept for reference but are no longer needed:
- `add_technician_hierarchy.sql` - Now integrated into `schema.sql`
- `add_hierarchy_users.sql` - Now integrated into `auth_setup.sql`

## Sample Users

The following test accounts are automatically created when you run `SETUP.ps1`:

| Username | Role | Email | Password |
|----------|------|-------|----------|
| jdoe | Management | jdoe@blueclue.com | admin123 |
| ssmith | Management | ssmith@blueclue.com | admin123 |
| mjohnson | Senior Technician | mjohnson@blueclue.com | admin123 |
| ebrown | Senior Technician | ebrown@blueclue.com | admin123 |
| tnewc | Technician | tnewc@blueclue.com | admin123 |
| cmcgo | Technician | cmcgo@blueclue.com | admin123 |
| jwill | Technician | jwill@blueclue.com | admin123 |

All accounts require password change on first login.

## Testing

### 1. Test Management Access (Full)

```bash
# Login as management
POST http://localhost:3000/api/auth/login
{
  "username": "jdoe",
  "password": "admin123"
}

# Check accessible categories (should return all with assign access)
GET http://localhost:3000/api/categories/accessible?access_level=assign
Authorization: Bearer <token>

# Expected: All 10 categories
```

### 2. Test Senior Technician Access (Edit + Critical Assign)

```bash
# Login as senior tech
POST http://localhost:3000/api/auth/login
{
  "username": "mjohnson",
  "password": "admin123"
}

# Check assign access (should have Network, Security, Database, Infrastructure)
GET http://localhost:3000/api/categories/accessible?access_level=assign
Authorization: Bearer <token>

# Expected: Categories 3, 4, 7, 8

# Check edit access (should have all)
GET http://localhost:3000/api/categories/accessible?access_level=edit
Authorization: Bearer <token>

# Expected: All 10 categories
```

### 3. Test Technician Access (Limited)

```bash
# Login as basic technician
POST http://localhost:3000/api/auth/login
{
  "username": "tnewc",
  "password": "admin123"
}

# Check edit access (should have Hardware, Software, Email, Printing, User Account, Mobile)
GET http://localhost:3000/api/categories/accessible?access_level=edit
Authorization: Bearer <token>

# Expected: Categories 1, 2, 5, 6, 9, 10

# Check view access (should have all)
GET http://localhost:3000/api/categories/accessible?access_level=view
Authorization: Bearer <token>

# Expected: All 10 categories
```

### 4. Test Ticket Filtering

All technician levels should only see tickets from categories they have access to:

```bash
GET http://localhost:3000/api/tickets
Authorization: Bearer <token-for-any-tech-level>

# Tickets are filtered based on user's category access
```

## Backend Changes

### Files Modified

1. **database/schema.sql**
   - Updated `user_role` ENUM to include `senior_technician` and `management`

2. **backend/src/controllers/authController.js**
   - Updated username login to recognize all technician roles
   - Changed: `role = 'technician'` → `role IN ('technician', 'senior_technician', 'management')`

3. **backend/src/controllers/ticketController.js**
   - Added `isTechnician(role)` helper function
   - Updated all role checks to use helper function
   - All technician levels now use same RBAC logic (access determined by category permissions)

### New Files

1. **database/migrations/add_technician_hierarchy.sql**
   - Adds new role types
   - Sets up role_category_defaults for each level
   - Removes old technician defaults, replaces with new hierarchy

2. **database/migrations/add_hierarchy_users.sql**
   - Creates sample management and senior tech users
   - Uses same password hash as existing technicians

3. **database/apply_hierarchy.ps1**
   - PowerShell script to apply both migrations
   - Provides verification output

## How It Works

1. **Role-Based Defaults**: 
   - Each role (technician, senior_technician, management) has default access levels defined in `role_category_defaults`
   - CategoryAccess model automatically includes these defaults when checking permissions

2. **Access Level Hierarchy**:
   - The system understands: assign > edit > view
   - If you have assign access, you automatically have edit and view
   - If you have edit access, you automatically have view

3. **User Overrides**:
   - Admins can still grant individual users specific access via `user_category_access`
   - Overrides take precedence over role defaults

4. **Backward Compatible**:
   - Existing technician accounts continue to work
   - They retain "technician" role with appropriate limited access

## Rollback

If you need to rollback:

```sql
-- Remove new users
DELETE FROM users WHERE username IN ('jdoe', 'ssmith', 'mjohnson', 'ebrown');

-- Remove role defaults for new roles
DELETE FROM role_category_defaults WHERE role IN ('management', 'senior_technician');

-- Restore original technician defaults
-- (Re-run the technician section from the original role_category_defaults setup)
```

## Notes

- Password change required on first login for all new users (force_password_change = true)
- Backend automatically recognizes new roles (no restart needed with nodemon)
- Frontend may need updates if you want to display role-specific UI features
- All technician levels use username-based login (not email)
