# Role-Based Default Category Access

## Overview

The RBAC system supports **role-based default category access** with **user-specific overrides**. This allows administrators to configure default access patterns for roles (e.g., all technicians can view billing tickets) while still allowing individual exceptions.

## Access Precedence

The system checks access in the following order:

1. **User-Specific Access** (category_access table) - Takes priority
2. **Role-Based Defaults** (role_category_defaults table) - Fallback if no user-specific access
3. **Deny** - If neither exists

## Database Tables

### role_category_defaults

Stores default category access for each role:

```sql
CREATE TABLE role_category_defaults (
    id SERIAL PRIMARY KEY,
    role user_role NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    access_level access_level NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    notes TEXT,
    UNIQUE(role, category_id, access_level)
);
```

### category_access

Stores user-specific access overrides:

```sql
CREATE TABLE category_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    access_level access_level NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    notes TEXT
);
```

## Default Access Rules

The system comes pre-configured with these default rules:

### Admin Role
- **All Categories**: `assign` level access
  - Includes: view, edit, assign permissions

### Technician Role
- **Technical Categories** (hardware, software, network, technical): `edit` level access
  - Includes: view, edit permissions
- **Other Categories** (billing, account, general): `view` level access
  - Includes: view permission only

### Customer Role
- No default category access
- Customers can only access their own tickets

## Access Level Hierarchy

Access levels are hierarchical:

- `view` < `edit` < `assign`
- Having `edit` level automatically grants `view`
- Having `assign` level automatically grants `edit` and `view`

## CategoryAccess Model Methods

### hasAccess(userId, categoryId, accessLevel)

Checks if user has access to a category at the specified level:

```javascript
const hasAccess = await CategoryAccess.hasAccess(userId, categoryId, 'edit');
// Returns: true if user has edit or assign access (user-specific OR role default)
```

**Logic:**
1. Check category_access for user-specific grant
2. If not found, check role_category_defaults for role's default
3. Return true if either exists with required level or higher

### getUserAccessibleCategories(userId, accessLevel)

Gets all category IDs accessible to a user:

```javascript
const categories = await CategoryAccess.getUserAccessibleCategories(userId, 'view');
// Returns: [1, 2, 3, 5] - Array of category IDs from both overrides and defaults
```

**Logic:**
1. Query user's role from users table
2. UNION query combining:
   - User-specific access from category_access
   - Role defaults from role_category_defaults
3. Return DISTINCT category IDs

### getRoleDefaults(role)

Gets all default category access for a specific role:

```javascript
const defaults = await CategoryAccess.getRoleDefaults('technician');
// Returns: Array of default access records with category names
```

### getUserOverride(userId, categoryId)

Checks if user has a specific override for a category:

```javascript
const override = await CategoryAccess.getUserOverride(userId, categoryId);
// Returns: Override object or null if using role defaults
```

### getUserAccessSummary(userId)

Gets summary showing which access is custom vs inherited:

```javascript
const summary = await CategoryAccess.getUserAccessSummary(userId);
// Returns: { 
//   overrides: [...], // User-specific grants
//   defaults: [...]   // Access from role defaults (not overridden)
// }
```

## Use Cases

### Example 1: Standard Technician Access

**Scenario:** Sarah is a technician with no custom overrides

**Result:**
- Can EDIT: hardware, software, network, technical tickets (role default)
- Can VIEW: billing, account, general tickets (role default)

### Example 2: Technician with Override

**Scenario:** Bob is a technician who needs EDIT access to billing tickets

**Configuration:**
```sql
INSERT INTO category_access (user_id, category_id, access_level, granted_by)
VALUES (bob_id, billing_category_id, 'edit', admin_id);
```

**Result:**
- Can EDIT: hardware, software, network, technical, billing tickets
- Can VIEW: account, general tickets (role default for these only)

### Example 3: Restricted Technician

**Scenario:** Alice is a junior technician who should only VIEW technical tickets

**Configuration:**
```sql
-- Add view-only override for technical categories
INSERT INTO category_access (user_id, category_id, access_level, granted_by, notes)
VALUES (alice_id, technical_category_id, 'view', admin_id, 'Junior tech - view only');
```

**Result:**
- Can VIEW: technical tickets (override takes precedence over role default)
- Can EDIT: hardware, software, network (still has role defaults for other technical categories)
- Can VIEW: billing, account, general (role defaults)

## API Endpoints

### Get User's Accessible Categories

```http
GET /api/categories/accessible?access_level=edit
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "categories": [1, 2, 3, 5, 7]
}
```

### Get Role Defaults (Admin Only)

```http
GET /api/roles/:role/defaults
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "role": "technician",
  "defaults": [
    {
      "category_id": 1,
      "category_name": "Hardware",
      "access_level": "edit"
    },
    {
      "category_id": 5,
      "category_name": "Billing",
      "access_level": "view"
    }
  ]
}
```

### Get User Access Summary (Admin Only)

```http
GET /api/users/:userId/access-summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user_id": 42,
  "role": "technician",
  "overrides": [
    {
      "category_id": 5,
      "category_name": "Billing",
      "access_level": "edit",
      "granted_at": "2026-02-21T10:30:00Z",
      "granted_by": 1
    }
  ],
  "defaults": [
    {
      "category_id": 1,
      "category_name": "Hardware",
      "access_level": "edit"
    },
    {
      "category_id": 6,
      "category_name": "Account",
      "access_level": "view"
    }
  ]
}
```

## Managing Role Defaults

### Adding New Default Access

```sql
INSERT INTO role_category_defaults (role, category_id, access_level, created_by, notes)
VALUES ('technician', 8, 'view', admin_id, 'Allow techs to view security tickets');
```

### Removing Default Access

```sql
UPDATE role_category_defaults
SET is_active = false
WHERE role = 'technician' AND category_id = 8;
```

### Modifying Default Access Level

```sql
-- First deactivate old level
UPDATE role_category_defaults
SET is_active = false
WHERE role = 'technician' AND category_id = 8 AND access_level = 'view';

-- Add new level
INSERT INTO role_category_defaults (role, category_id, access_level, created_by, notes)
VALUES ('technician', 8, 'edit', admin_id, 'Upgraded tech access to security tickets');
```

## Best Practices

1. **Use Role Defaults for Common Patterns**
   - Configure standard access patterns in role_category_defaults
   - Most users should function with just defaults

2. **Use Overrides Sparingly**
   - Only add user-specific access when needed
   - Document the reason in the notes field

3. **Higher Level Overrides Replace Defaults**
   - If a user has an override, role defaults are ignored for that category
   - Grant the highest level needed in the override

4. **Monitor Override Usage**
   - Use getUserAccessSummary() to audit custom access
   - Review overrides periodically for outdated grants

5. **Document Changes**
   - Always populate the notes field
   - Include granted_by for audit trail

## Security Considerations

- **Least Privilege**: Grant minimum access level needed
- **Regular Audits**: Review both defaults and overrides quarterly
- **Soft Deletes**: Use is_active=false instead of DELETE
- **Audit Trail**: Track created_by, granted_by, granted_at
- **Validation**: Ensure only admins can modify role defaults and user overrides
