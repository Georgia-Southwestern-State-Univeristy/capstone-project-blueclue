# Error Handling Migration Guide

## Overview

This guide shows how to migrate controllers from inline error handling to using the centralized error handling middleware.

## New Error Classes Available

Located in `src/middleware/errorHandler.js`:

- **BadRequestError(message, details)** - 400 (validation errors, malformed requests)
- **UnauthorizedError(message, details)** - 401 (authentication failures)
- **ForbiddenError(message, details)** - 403 (authorization failures)
- **NotFoundError(message, details)** - 404 (resource not found)
- **ConflictError(message, details)** - 409 (duplicate resources, conflicts)
- **InternalServerError(message, details)** - 500 (unexpected errors)
- **AppError(message, statusCode, details)** - Base class for custom errors

## Migration Pattern

### Before (Old Pattern)
```javascript
export const getTicket = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Ticket ID is required'
            });
        }
        
        const result = await pool.query(
            'SELECT * FROM tickets WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }
        
        res.json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};
```

### After (New Pattern)
```javascript
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

export const getTicket = async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        throw new BadRequestError('Ticket ID is required');
    }
    
    const result = await pool.query(
        'SELECT * FROM tickets WHERE id = $1',
        [id]
    );
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Ticket not found');
    }
    
    res.json({
        status: 'success',
        data: result.rows[0]
    });
};
```

**Key Changes:**
1. ✅ Remove try-catch blocks (error middleware catches them)
2. ✅ Throw errors instead of returning res.status()
3. ✅ Use specific error classes
4. ✅ Simpler, cleaner code

## Migration Checklist

### 1. Add Import Statement
```javascript
import {
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError
} from '../middleware/errorHandler.js';
```

### 2. Remove Try-Catch Blocks
❌ Remove try-catch unless you need specific error transformation
✅ Let errors bubble up to the middleware

### 3. Replace Status Responses with Throws

| Old Code | New Code |
|----------|----------|
| `res.status(400).json(...)` | `throw new BadRequestError(message)` |
| `res.status(401).json(...)` | `throw new UnauthorizedError(message)` |
| `res.status(403).json(...)` | `throw new ForbiddenError(message)` |
| `res.status(404).json(...)` | `throw new NotFoundError(message)` |
| `res.status(409).json(...)` | `throw new ConflictError(message)` |
| `res.status(500).json(...)` | `throw new InternalServerError(message)` or just `throw error` |

### 4. Add Details (Optional)
Errors can include additional context:
```javascript
throw new BadRequestError('Validation failed', {
    fields: {
        email: 'Invalid format',
        password: 'Too short'
    }
});
```

## Common Patterns

### Validation
```javascript
// Before
if (!email) {
    return res.status(400).json({ error: 'Email required' });
}

// After
if (!email) {
    throw new BadRequestError('Email required');
}
```

### Authentication
```javascript
// Before
if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
}

// After
if (!token) {
    throw new UnauthorizedError('Not authenticated');
}
```

### Authorization
```javascript
// Before
if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
}

// After
if (user.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
}
```

### Resource Not Found
```javascript
// Before
if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Ticket not found' });
}

// After
if (result.rows.length === 0) {
    throw new NotFoundError('Ticket not found');
}
```

### Duplicate Resources
```javascript
// Before
if (existingUser) {
    return res.status(409).json({ error: 'Email already exists' });
}

// After
if (existingUser) {
    throw new ConflictError('Email already exists');
}
```

### Database Errors
```javascript
// Before
try {
    const result = await pool.query(..);
} catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
}

// After
// Just let it throw - middleware will catch it
const result = await pool.query(..);
```

## Response Format

All errors now return the same format:

### Development Mode
```json
{
    "status": "fail",
    "message": "Validation failed",
    "details": {
        "field": "email",
        "issue": "Invalid format"
    },
    "stack": "Error: Validation failed\n    at ..."
}
```

### Production Mode
```json
{
    "status": "fail",
    "message": "Validation failed",
    "details": {
        "field": "email",
        "issue": "Invalid format"
    }
}
```

**Note:** Stack traces are automatically hidden in production (NODE_ENV=production)

## Using asyncHandler (Optional)

For routes that need explicit async error handling:

```javascript
import { asyncHandler } from '../middleware/errorHandler.js';

router.get('/tickets/:id', asyncHandler(async (req, res) => {
    const ticket = await getTicket(req.params.id);
    if (!ticket) {
        throw new NotFoundError('Ticket not found');
    }
    res.json(ticket);
}));
```

## Complete Example

### Before
```javascript
export const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, priority } = req.body;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID required'
            });
        }
        
        if (!title && !description && !priority) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }
        
        const existing = await pool.query(
            'SELECT id FROM tickets WHERE id = $1',
            [id]
        );
        
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }
        
        const result = await pool.query(
            `UPDATE tickets SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                priority = COALESCE($3, priority),
                updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [title, description, priority, id]
        );
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ticket'
        });
    }
};
```

### After
```javascript
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

export const updateTicket = async (req, res) => {
    const { id } = req.params;
    const { title, description, priority } = req.body;
    
    if (!id) {
        throw new BadRequestError('ID required');
    }
    
    if (!title && !description && !priority) {
        throw new BadRequestError('No fields to update');
    }
    
    const existing = await pool.query(
        'SELECT id FROM tickets WHERE id = $1',
        [id]
    );
    
    if (existing.rows.length === 0) {
        throw new NotFoundError('Ticket not found');
    }
    
    const result = await pool.query(
        `UPDATE tickets SET 
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            priority = COALESCE($3, priority),
            updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [title, description, priority, id]
    );
    
    res.json({
        success: true,
        data: result.rows[0]
    });
};
```

**Benefits:**
- ✅ 50% less code
- ✅ Cleaner logic flow
- ✅ Consistent error format
- ✅ Automatic stack trace handling
- ✅ Easier to test
- ✅ DRY principle

## Migration Priority

**High Priority (User-facing):**
1. authController.js (login, register, password reset)
2. ticketController.js (ticket operations)
3. userController.js (user management)

**Medium Priority:**
4. adminController.js
5. commentController.js
6. categoryController.js

**Low Priority (Internal):**
7. analyticsController.js
8. configController.js
9. Other internal controllers

## Testing

After migrating a controller:

1. Test successful responses (should NOT change)
2. Test error responses (should return new format)
3. Verify stack traces hidden in production
4. Check console logs for debugging info

## Questions?

The error handling middleware is in `src/middleware/errorHandler.js`. Review the code for more details or examples.
