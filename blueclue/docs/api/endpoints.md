# BlueClue API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000/api`  
**AI Service URL:** `http://localhost:5000`  
**Last Updated:** February 13, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Authentication Endpoints](#authentication-endpoints)
4. [Ticket Endpoints](#ticket-endpoints)
5. [User Endpoints](#user-endpoints)
6. [AI Classification Endpoints](#ai-classification-endpoints)
7. [Error Codes](#error-codes)
8. [Rate Limiting](#rate-limiting)
9. [Examples](#examples)

---

## Overview

The BlueClue API is a RESTful API that provides endpoints for managing IT support tickets, user authentication, and AI-powered ticket classification. All endpoints return JSON responses.

### Base URLs

- **Backend API:** `http://localhost:3000/api`
- **AI Service:** `http://localhost:5000`

### Content Type

All requests and responses use `application/json` content type.

### Response Format

All API responses follow a consistent structure:

**Success Response:**
```json
{
  "status": "success",
  "data": { /* response data */ },
  "message": "Optional message"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

---

## Authentication

BlueClue uses JWT (JSON Web Tokens) for authentication with a dual-token system:

- **Access Token:** Short-lived (15 minutes), used for API requests
- **Refresh Token:** Long-lived (7 days), used to obtain new access tokens

### Token Usage

Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Refresh

When the access token expires, use the refresh endpoint with your refresh token to obtain a new access token.

---

## Authentication Endpoints

### POST /api/auth/login

Authenticate user and receive JWT tokens.

**Authentication:** None (Public)

#### Technician Login

**Request:**
```json
{
  "username": "tnewc",
  "password": "admin123"
}
```

**Response:** 200 OK
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "tnewc",
    "email": "tnewc@blueclue.com",
    "role": "technician",
    "first_name": "Thomas",
    "last_name": "Newcomb",
    "force_password_change": false
  }
}
```

#### Customer Login

**Request:**
```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

**Response:** 200 OK
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "email": "customer@example.com",
    "role": "customer",
    "first_name": "John",
    "last_name": "Doe",
    "force_password_change": false
  }
}
```

#### Guest Login

**Request:**
```json
{
  "email": "guest@example.com",
  "fullName": "Jane Smith",
  "isGuest": true
}
```

**Response:** 200 OK
```json
{
  "status": "success",
  "sessionToken": "guest-session-token-here",
  "user": {
    "id": 100,
    "email": "guest@example.com",
    "role": "customer",
    "is_guest": true,
    "full_name": "Jane Smith",
    "session_expires_at": "2026-02-14T10:00:00Z"
  }
}
```

**Error Responses:**

**401 Unauthorized** - Invalid credentials
```json
{
  "status": "error",
  "message": "Invalid username or password"
}
```

**400 Bad Request** - Missing required fields
```json
{
  "status": "error",
  "message": "Username and password are required"
}
```

---

### POST /api/auth/register

Register a new customer account.

**Authentication:** None (Public)

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "firstName": "Alice",
  "lastName": "Johnson",
  "phone": "555-0199",
  "company": "Acme Corp"
}
```

**Required Fields:**
- `email` (string, valid email format)
- `password` (string, min 8 characters)
- `firstName` (string)
- `lastName` (string)

**Optional Fields:**
- `phone` (string)
- `company` (string)

**Response:** 201 Created
```json
{
  "status": "success",
  "message": "User registered successfully",
  "user": {
    "id": 10,
    "email": "newuser@example.com",
    "first_name": "Alice",
    "last_name": "Johnson",
    "role": "customer"
  }
}
```

**Error Responses:**

**409 Conflict** - Email already exists
```json
{
  "status": "error",
  "message": "Email already registered"
}
```

**400 Bad Request** - Validation error
```json
{
  "status": "error",
  "message": "Password must be at least 8 characters"
}
```

---

### POST /api/auth/refresh

Refresh access token using refresh token.

**Authentication:** None (Requires refresh token)

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** 200 OK
```json
{
  "status": "success",
  "token": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

**Error Responses:**

**401 Unauthorized** - Invalid or expired refresh token
```json
{
  "status": "error",
  "message": "Invalid or expired refresh token"
}
```

---

### GET /api/auth/me

Get current authenticated user information.

**Authentication:** Required (Bearer token)

**Request:**
```
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response:** 200 OK
```json
{
  "status": "success",
  "user": {
    "id": 1,
    "username": "tnewc",
    "email": "tnewc@blueclue.com",
    "role": "technician",
    "first_name": "Thomas",
    "last_name": "Newcomb",
    "is_guest": false,
    "force_password_change": false
  }
}
```

**Error Responses:**

**401 Unauthorized** - Missing or invalid token
```json
{
  "status": "error",
  "message": "No token provided"
}
```

---

### POST /api/auth/change-password

Change user password.

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456!"
}
```

**Note:** For first-time technician login (force password change), `currentPassword` is optional.

**Response:** 200 OK
```json
{
  "status": "success",
  "message": "Password changed successfully",
  "force_password_change": false
}
```

**Error Responses:**

**400 Bad Request** - Current password incorrect
```json
{
  "status": "error",
  "message": "Current password is incorrect"
}
```

**400 Bad Request** - Weak password
```json
{
  "status": "error",
  "message": "Password must be at least 8 characters"
}
```

---

### POST /api/auth/logout

Logout and invalidate refresh tokens.

**Authentication:** Required (Bearer token)

**Request:**
```
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**Response:** 200 OK
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## Ticket Endpoints

### POST /api/tickets

Create a new support ticket.

**Authentication:** Optional (Public endpoint with optional auth)

**Request:**
```json
{
  "subject": "Laptop won't turn on",
  "description": "My laptop is not responding when I press the power button. Need urgent help!",
  "customer_id": 1,
  "priority": "high",
  "category": "hardware"
}
```

**Required Fields:**
- `subject` (string, max 255 chars)
- `description` (string)

**Optional Fields:**
- `customer_id` (integer, auto-populated if authenticated)
- `priority` (enum: 'low', 'medium', 'high')
- `category` (string)
- `user_priority` (enum: 'low', 'medium', 'high') - User's priority choice

**Response:** 201 Created
```json
{
  "status": "success",
  "message": "Ticket created successfully",
  "data": {
    "id": 42,
    "subject": "Laptop won't turn on",
    "description": "My laptop is not responding when I press the power button. Need urgent help!",
    "customer_id": 1,
    "status": "open",
    "priority": "high",
    "category": "hardware",
    "ai_category": "hardware",
    "ai_subcategory": "power",
    "ai_priority": "high",
    "ai_confidence": 0.89,
    "ai_classified": true,
    "user_priority": null,
    "created_at": "2026-02-13T10:30:00Z",
    "updated_at": "2026-02-13T10:30:00Z"
  }
}
```

**AI Classification:**
The API automatically calls the AI classification service and stores the results in `ai_category`, `ai_subcategory`, `ai_priority`, and `ai_confidence` fields.

**Error Responses:**

**400 Bad Request** - Missing required fields
```json
{
  "status": "error",
  "message": "Subject is required"
}
```

**500 Internal Server Error** - AI service unavailable
```json
{
  "status": "error",
  "message": "Ticket created but AI classification failed"
}
```

---

### GET /api/tickets

Get all tickets (filtered by user role).

**Authentication:** Optional (affects filtering)

**Query Parameters:**
- `status` (optional) - Filter by status: 'open', 'in_progress', 'resolved', 'closed'
- `priority` (optional) - Filter by priority: 'low', 'medium', 'high'
- `category` (optional) - Filter by category
- `assigned_to` (optional) - Filter by assigned technician ID

**Request:**
```
GET /api/tickets?status=open&priority=high
```

**Response:** 200 OK
```json
{
  "status": "success",
  "count": 15,
  "data": [
    {
      "id": 1,
      "subject": "Network connectivity issue",
      "description": "Can't connect to wifi",
      "customer_id": 5,
      "customer_name": "John Doe",
      "status": "open",
      "priority": "high",
      "category": "network",
      "ai_category": "network",
      "ai_subcategory": "wireless",
      "ai_confidence": 0.95,
      "assigned_to": null,
      "assigned_to_name": null,
      "created_at": "2026-02-13T09:00:00Z",
      "updated_at": "2026-02-13T09:00:00Z"
    },
    // ... more tickets
  ]
}
```

**Filtering Behavior:**
- **Technician/Admin:** See all tickets
- **Customer:** See only their own tickets (where customer_id matches)
- **Guest:** See only their own tickets
- **Unauthenticated:** See all tickets (public access)

---

### GET /api/tickets/:id

Get a single ticket by ID.

**Authentication:** Optional (Public)

**Request:**
```
GET /api/tickets/42
```

**Response:** 200 OK
```json
{
  "status": "success",
  "data": {
    "id": 42,
    "subject": "Laptop won't turn on",
    "description": "My laptop is not responding when I press the power button. Need urgent help!",
    "customer_id": 1,
    "customer_name": "Jane Smith",
    "customer_email": "jane@example.com",
    "status": "in_progress",
    "priority": "high",
    "category": "hardware",
    "ai_category": "hardware",
    "ai_subcategory": "power",
    "ai_priority": "high",
    "ai_confidence": 0.89,
    "user_priority": null,
    "assigned_to": 1,
    "assigned_to_name": "Thomas Newcomb",
    "resolution": null,
    "created_at": "2026-02-13T10:30:00Z",
    "updated_at": "2026-02-13T11:15:00Z",
    "resolved_at": null
  }
}
```

**Error Responses:**

**404 Not Found** - Ticket doesn't exist
```json
{
  "status": "error",
  "message": "Ticket not found"
}
```

---

### GET /api/tickets/assigned/me

Get tickets assigned to the authenticated technician.

**Authentication:** Required (Technician/Admin only)

**Request:**
```
GET /api/tickets/assigned/me
Authorization: Bearer <technician_token>
```

**Response:** 200 OK
```json
{
  "status": "success",
  "count": 5,
  "data": [
    {
      "id": 10,
      "subject": "Printer not working",
      "customer_name": "Bob Wilson",
      "status": "in_progress",
      "priority": "medium",
      "category": "hardware",
      "created_at": "2026-02-12T14:00:00Z"
    },
    // ... more assigned tickets
  ]
}
```

**Error Responses:**

**401 Unauthorized** - Not authenticated
```json
{
  "status": "error",
  "message": "No token provided"
}
```

**403 Forbidden** - Not a technician
```json
{
  "status": "error",
  "message": "Access denied. Technicians only."
}
```

---

### GET /api/tickets/timeline

Get all tickets for timeline visualization (no filtering).

**Authentication:** None (Public)

**Request:**
```
GET /api/tickets/timeline
```

**Response:** 200 OK
```json
{
  "status": "success",
  "count": 25,
  "data": [
    {
      "id": 1,
      "subject": "Network issue",
      "status": "open",
      "priority": "high",
      "created_at": "2026-02-13T09:00:00Z"
    },
    // ... all tickets
  ]
}
```

---

### PATCH /api/tickets/:id/status

Update ticket status only.

**Authentication:** Optional (Public)

**Request:**
```json
{
  "status": "in_progress"
}
```

**Valid Status Values:**
- `open`
- `in_progress`
- `resolved`
- `closed`

**Response:** 200 OK
```json
{
  "status": "success",
  "message": "Ticket status updated",
  "data": {
    "id": 42,
    "status": "in_progress",
    "updated_at": "2026-02-13T12:00:00Z"
  }
}
```

**Error Responses:**

**400 Bad Request** - Invalid status
```json
{
  "status": "error",
  "message": "Invalid status value"
}
```

---

### PUT /api/tickets/:id

Update ticket (full update).

**Authentication:** Optional (Public)

**Request:**
```json
{
  "subject": "Updated laptop issue",
  "description": "Updated description with more details",
  "priority": "high",
  "category": "hardware",
  "status": "in_progress",
  "assigned_to": 1,
  "resolution": "Replaced power adapter"
}
```

**Response:** 200 OK
```json
{
  "status": "success",
  "message": "Ticket updated successfully",
  "data": {
    "id": 42,
    "subject": "Updated laptop issue",
    "priority": "high",
    "status": "in_progress",
    "assigned_to": 1,
    "updated_at": "2026-02-13T13:00:00Z"
  }
}
```

**Error Responses:**

**404 Not Found** - Ticket doesn't exist
```json
{
  "status": "error",
  "message": "Ticket not found"
}
```

---

### DELETE /api/tickets/:id

Delete a ticket (soft delete).

**Authentication:** Optional (Public)

**Request:**
```
DELETE /api/tickets/42
```

**Response:** 200 OK
```json
{
  "status": "success",
  "message": "Ticket deleted successfully"
}
```

**Note:** This is a soft delete - the ticket is marked as deleted but not removed from the database.

**Error Responses:**

**404 Not Found** - Ticket doesn't exist
```json
{
  "status": "error",
  "message": "Ticket not found"
}
```

---

## User Endpoints

### GET /api/users/technicians

Get list of all active technicians.

**Authentication:** Required (Bearer token)

**Use Case:** Populating assignment dropdowns in the UI

**Request:**
```
GET /api/users/technicians
Authorization: Bearer <access_token>
```

**Response:** 200 OK
```json
{
  "status": "success",
  "count": 3,
  "data": [
    {
      "id": 1,
      "username": "tnewc",
      "first_name": "Thomas",
      "last_name": "Newcomb",
      "email": "tnewc@blueclue.com"
    },
    {
      "id": 2,
      "username": "cmcgo",
      "first_name": "Clayton",
      "last_name": "McGough",
      "email": "cmcgo@blueclue.com"
    },
    {
      "id": 3,
      "username": "jwill",
      "first_name": "Jacob",
      "last_name": "Williams",
      "email": "jwill@blueclue.com"
    }
  ]
}
```

**Error Responses:**

**401 Unauthorized** - Not authenticated
```json
{
  "status": "error",
  "message": "No token provided"
}
```

---

## AI Classification Endpoints

### GET /health

AI service health check.

**Base URL:** `http://localhost:5000`

**Request:**
```
GET http://localhost:5000/health
```

**Response:** 200 OK
```json
{
  "status": "OK",
  "message": "BlueClue AI Classification API is running",
  "timestamp": "2026-02-13T10:00:00.000Z",
  "version": "1.0.0"
}
```

---

### POST /classify

Classify ticket text for category and priority.

**Base URL:** `http://localhost:5000`

**Authentication:** None (Internal service)

**Request:**
```json
{
  "text": "My laptop screen is broken and I need help urgently",
  "subject": "Laptop Screen Issue",
  "user_priority": "high"
}
```

**Required Fields:**
- `text` (string) - The ticket description to classify

**Optional Fields:**
- `subject` (string) - Ticket subject (concatenated with description for classification)
- `user_priority` (string) - User's selected priority ('low', 'medium', 'high')

**Response:** 200 OK
```json
{
  "success": true,
  "input": "My laptop screen is broken and I need help urgently",
  "classification": {
    "category": "hardware",
    "priority": "high",
    "confidence": 0.91,
    "category_confidence": 0.89,
    "priority_confidence": 0.93,
    "subcategory": "damage",
    "fallback_used": false,
    "is_multi_category": false,
    "all_categories": [
      {
        "category": "hardware",
        "score": 15.5,
        "confidence": 0.89,
        "keywords": ["laptop", "screen", "broken"],
        "subcategory": "damage"
      }
    ],
    "keywords_matched": {
      "category": ["laptop", "screen", "broken"],
      "priority": ["urgently", "need help"]
    },
    "user_priority_used": false
  },
  "timestamp": "2026-02-13T10:00:00.000Z"
}
```

**Classification Fields Explained:**

- `category` (string) - Primary category: 'hardware', 'software', 'network', 'login', 'other'
- `priority` (string) - Suggested priority: 'low', 'medium', 'high'
- `confidence` (float) - Overall confidence score (0-1)
- `category_confidence` (float) - Category-specific confidence (0-1)
- `priority_confidence` (float) - Priority-specific confidence (0-1)
- `subcategory` (string) - Granular subcategory (24 options)
- `fallback_used` (boolean) - Whether fallback logic was triggered
- `is_multi_category` (boolean) - Whether multiple categories detected
- `all_categories` (array) - Top 3 matching categories with scores
- `keywords_matched` (object) - Keywords that triggered classification
- `user_priority_used` (boolean) - Whether user's priority choice was used

**Subcategories by Category:**

**Hardware:**
- computer, display, peripheral, printer, power, connectivity, damage, general

**Software:**
- os, office, browser, application, installation, error, security

**Network:**
- wireless, connectivity, vpn, hardware, performance, configuration

**Login:**
- authentication, password, account, credentials, email, mfa

**Other:**
- inquiry, policy, general

**Error Responses:**

**400 Bad Request** - Missing text field
```json
{
  "error": "Missing required field",
  "message": "Request body must include 'text' field with ticket description"
}
```

**400 Bad Request** - Invalid JSON
```json
{
  "error": "Request must be JSON",
  "message": "Content-Type must be application/json"
}
```

**500 Internal Server Error** - Classification failure
```json
{
  "error": "Classification failed",
  "message": "Error details here"
}
```

---

### POST /classify (with user priority)

Example showing user priority override.

**Request:**
```json
{
  "text": "Question about software license",
  "user_priority": "low"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "classification": {
    "category": "other",
    "priority": "low",
    "user_priority_used": true,
    "confidence": 0.75,
    "subcategory": "inquiry"
  }
}
```

**Note:** When `user_priority` is provided, it overrides the AI-suggested priority. The `user_priority_used` flag will be `true`.

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input, missing required fields |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., email exists) |
| 500 | Internal Server Error | Server error, check logs |
| 503 | Service Unavailable | AI service down |

### Common Error Messages

**Authentication Errors:**
- "No token provided"
- "Invalid or expired token"
- "Invalid username or password"
- "Access denied. Technicians only."

**Validation Errors:**
- "Subject is required"
- "Description is required"
- "Password must be at least 8 characters"
- "Invalid email format"
- "Email already registered"

**Resource Errors:**
- "Ticket not found"
- "User not found"

**AI Service Errors:**
- "AI classification service unavailable"
- "Classification failed"

---

## Rate Limiting

**Current Status:** Not implemented  
**Recommendation:** Implement rate limiting for production

**Suggested Limits:**
- Authentication endpoints: 5 requests/minute per IP
- API endpoints: 100 requests/15 minutes per user
- AI classification: 50 requests/minute per IP

---

## Examples

### Example 1: Complete Guest Ticket Submission Flow

**Step 1: Guest Login**
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "guest@example.com",
  "fullName": "Guest User",
  "isGuest": true
}
```

**Response:**
```json
{
  "status": "success",
  "sessionToken": "guest-token-xyz",
  "user": {
    "id": 50,
    "is_guest": true,
    "email": "guest@example.com"
  }
}
```

**Step 2: Create Ticket**
```bash
POST http://localhost:3000/api/tickets
Content-Type: application/json

{
  "subject": "WiFi not working",
  "description": "Can't connect to office wifi urgent",
  "customer_id": 50
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 100,
    "subject": "WiFi not working",
    "ai_category": "network",
    "ai_subcategory": "wireless",
    "ai_priority": "high",
    "ai_confidence": 0.92
  }
}
```

---

### Example 2: Technician Workflow

**Step 1: Login**
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "tnewc",
  "password": "myNewPassword123"
}
```

**Step 2: Get Assigned Tickets**
```bash
GET http://localhost:3000/api/tickets/assigned/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 3: Update Ticket Status**
```bash
PATCH http://localhost:3000/api/tickets/15/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "status": "in_progress"
}
```

**Step 4: Complete Ticket**
```bash
PUT http://localhost:3000/api/tickets/15
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "status": "resolved",
  "resolution": "Replaced ethernet cable and verified connection"
}
```

---

### Example 3: Customer Registration and Ticket Creation

**Step 1: Register**
```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "SecurePass123!",
  "firstName": "Alice",
  "lastName": "Johnson"
}
```

**Step 2: Login**
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "SecurePass123!"
}
```

**Step 3: Create Ticket**
```bash
POST http://localhost:3000/api/tickets
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "subject": "Excel keeps crashing",
  "description": "Excel crashes when opening large files",
  "user_priority": "medium"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 101,
    "ai_category": "software",
    "ai_subcategory": "office",
    "ai_priority": "medium",
    "user_priority": "medium",
    "ai_confidence": 0.96
  }
}
```

---

### Example 4: Direct AI Classification Test

**Request:**
```bash
POST http://localhost:5000/classify
Content-Type: application/json

{
  "text": "My computer has a blue screen error and won't boot"
}
```

**Response:**
```json
{
  "success": true,
  "classification": {
    "category": "software",
    "subcategory": "os",
    "priority": "high",
    "confidence": 0.88,
    "is_multi_category": false,
    "keywords_matched": {
      "category": ["computer", "blue screen", "error"],
      "priority": ["won't boot"]
    }
  }
}
```

---

### Example 5: Token Refresh Flow

**Step 1: Access token expires (after 15 minutes)**

**Step 2: Refresh token**
```bash
POST http://localhost:3000/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "status": "success",
  "token": "new-access-token-here",
  "refreshToken": "new-refresh-token-here"
}
```

**Step 3: Use new access token**
```bash
GET http://localhost:3000/api/tickets
Authorization: Bearer <new-access-token>
```

---

## Postman Collection

A complete Postman collection with all endpoints is available at:

**Location:** `backend/postman/BlueClue-Tickets-API.postman_collection.json`

### Import Instructions

1. Open Postman
2. Click **File** → **Import**
3. Select `BlueClue-Tickets-API.postman_collection.json`
4. Collection will be imported with all requests and tests

### Collection Contents

- **Authentication** folder (7 requests)
  - Technician Login
  - Customer Login
  - Guest Login
  - Register
  - Refresh Token
  - Get Current User
  - Change Password
  - Logout

- **Tickets** folder (12 requests)
  - Create Ticket (valid)
  - Create Ticket (missing subject)
  - Create Ticket (missing description)
  - Get All Tickets
  - Get Ticket by ID
  - Get My Assigned Tickets
  - Update Ticket Status
  - Update Ticket (full)
  - Delete Ticket

- **Users** folder (1 request)
  - Get Technicians

- **AI Service** folder (2 requests)
  - Health Check
  - Classify Ticket

### Environment Variables

Create a Postman environment with:

```json
{
  "baseUrl": "http://localhost:3000/api",
  "aiUrl": "http://localhost:5000",
  "token": "",
  "refreshToken": ""
}
```

---

## Development Notes

### Starting the Services

**Backend:**
```bash
cd blueclue/backend
npm install
npm run dev
# Runs on http://localhost:3000
```

**AI Service:**
```bash
cd blueclue/ai
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
# Runs on http://localhost:5000
```

**Database:**
```powershell
cd blueclue/database
.\SETUP.ps1
```

### Testing

**Run Backend Integration Tests:**
```bash
cd blueclue/backend
node test-ai-integration.js
```

**Run AI Classification Tests:**
```bash
cd blueclue/ai
python test_accuracy.py
```

---

**Last Updated:** February 13, 2026  
**Maintained By:** BlueClue Development Team  
**Questions:** Contact Thomas Newcomb (Project Manager)
