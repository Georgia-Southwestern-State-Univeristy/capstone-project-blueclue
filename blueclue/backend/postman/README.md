# Ticket API Testing Guide

## Postman Collection

Import `BlueClue-Tickets-API.postman_collection.json` into Postman to test all endpoints.

## Manual Testing

### 1. Create Ticket (Valid Data)

**Request:**
```http
POST http://localhost:3000/api/tickets
Content-Type: application/json

{
    "title": "Cannot access email",
    "description": "Getting authentication errors when trying to log into Outlook",
    "created_by": 1,
    "priority": "high",
    "category_id": 1
}
```

**Expected Response:** `201 Created`
```json
{
    "status": "success",
    "message": "Ticket created successfully",
    "data": {
        "ticket_id": 11,
        "ticket_number": "TICK-2026-00011",
        "title": "Cannot access email",
        "description": "Getting authentication errors when trying to log into Outlook",
        "status": "open",
        "priority": "high",
        "created_by": 1,
        "category_id": 1,
        "created_at": "2026-02-03T17:43:14.156Z",
        "updated_at": "2026-02-03T17:43:14.156Z"
    }
}
```

### 2. Create Ticket (Missing Title)

**Request:**
```http
POST http://localhost:3000/api/tickets
Content-Type: application/json

{
    "description": "Test description",
    "created_by": 1
}
```

**Expected Response:** `400 Bad Request`
```json
{
    "status": "error",
    "message": "Title is required"
}
```

### 3. Create Ticket (Missing Description)

**Request:**
```http
POST http://localhost:3000/api/tickets
Content-Type: application/json

{
    "title": "Test Ticket",
    "created_by": 1
}
```

**Expected Response:** `400 Bad Request`
```json
{
    "status": "error",
    "message": "Description is required"
}
```

### 4. Get All Tickets

**Request:**
```http
GET http://localhost:3000/api/tickets
```

**Expected Response:** `200 OK`
```json
{
    "status": "success",
    "count": 10,
    "data": [
        {
            "ticket_id": 1,
            "ticket_number": "TICK-2026-00001",
            "title": "Login Issues",
            "description": "Cannot log into the system",
            "status": "open",
            "priority": "high",
            "created_by": 1,
            "created_by_name": "Sarah Johnson",
            "created_by_email": "sarah.johnson@techcorp.com",
            "category_name": "Account Access",
            "category_description": "Account access, login, and password issues",
            "created_at": "2026-01-15T09:00:00.000Z",
            "updated_at": "2026-01-15T09:00:00.000Z"
        }
        // ... more tickets
    ]
}
```

### 5. Get Single Ticket

**Request:**
```http
GET http://localhost:3000/api/tickets/1
```

**Expected Response:** `200 OK`
```json
{
    "status": "success",
    "data": {
        "ticket_id": 1,
        "ticket_number": "TICK-2026-00001",
        "title": "Login Issues",
        "description": "Cannot log into the system",
        "status": "open",
        "priority": "high",
        "created_by": 1,
        "created_by_name": "Sarah Johnson",
        "created_by_email": "sarah.johnson@techcorp.com",
        "category_name": "Account Access",
        "assigned_to_name": "David Park",
        "assigned_to_email": "david.park@blueclue.com",
        "created_at": "2026-01-15T09:00:00.000Z",
        "updated_at": "2026-01-15T09:00:00.000Z"
    }
}
```

### 6. Get Non-Existent Ticket

**Request:**
```http
GET http://localhost:3000/api/tickets/99999
```

**Expected Response:** `404 Not Found`
```json
{
    "status": "error",
    "message": "Ticket not found"
}
```

### 7. Update Ticket

**Request:**
```http
PUT http://localhost:3000/api/tickets/1
Content-Type: application/json

{
    "status": "in_progress",
    "priority": "urgent"
}
```

**Expected Response:** `200 OK`
```json
{
    "status": "success",
    "message": "Ticket updated successfully",
    "data": {
        "ticket_id": 1,
        "ticket_number": "TICK-2026-00001",
        "title": "Login Issues",
        "description": "Cannot log into the system",
        "status": "in_progress",
        "priority": "urgent",
        "created_by": 1,
        "category_id": 1,
        "created_at": "2026-01-15T09:00:00.000Z",
        "updated_at": "2026-02-03T17:45:00.000Z"
    }
}
```

### 8. Delete Ticket (Soft Delete)

**Request:**
```http
DELETE http://localhost:3000/api/tickets/2
```

**Expected Response:** `200 OK`
```json
{
    "status": "success",
    "message": "Ticket deleted successfully",
    "data": {
        "ticket_id": 2,
        "status": "closed",
        "updated_at": "2026-02-03T17:46:00.000Z"
    }
}
```

## Test Results Checklist

- [x] Ticket model created with all CRUD methods
- [x] Controller handles all operations
- [x] All routes registered and working
- [x] Validation prevents invalid submissions
- [x] Error handling returns proper status codes
- [ ] All Postman tests pass
- [ ] Returns 201 for successful creation
- [ ] Returns 400 for invalid data
- [ ] Returns 404 for non-existent tickets

## Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | Get all tickets |
| GET | `/api/tickets/:id` | Get single ticket by ID |
| POST | `/api/tickets` | Create new ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket (soft delete) |

## Notes

- **Soft Delete**: DELETE endpoint sets status to 'closed' rather than removing from database
- **Validation**: Title and description are required fields
- **Foreign Keys**: `created_by` must reference valid user, `category_id` must reference valid category
- **Auto-generated**: `ticket_number`, `created_at`, `updated_at` are auto-generated by database
