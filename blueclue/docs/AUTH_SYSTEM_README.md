# BlueClue Authentication System

Complete login and authentication system with role-based access control, password encryption, and guest access.

## Features

### 🔐 Authentication Types

1. **Technician Login**
   - Username-based authentication
   - Hardcoded accounts: `tnewc`, `cmcgo`, `jwill`
   - Default password: `admin123` (must be changed on first login)
   - Force password change on first login

2. **Customer Login**
   - Email-based authentication
   - Self-service registration
   - Password strength validation
   - Encrypted password storage (bcrypt)

3. **Guest Access**
   - Email + name only (no password required)
   - 24-hour session expiration
   - Submit tickets without account creation

### 🛡️ Security Features

- **Password Encryption**: All passwords hashed with bcrypt (10 salt rounds)
- **JWT Authentication**: Secure token-based authentication
- **Refresh Tokens**: 7-day refresh tokens for extended sessions
- **Force Password Change**: Technicians must change default password on first login
- **Password Strength Validation**: Real-time password strength indicator
- **Secure Token Storage**: Local storage with automatic token refresh

### 📝 User Roles

- **Customer**: Submit and view tickets, access client dashboard
- **Technician**: View and manage all tickets, access technician dashboard
- **Guest**: Temporary access to submit tickets (24-hour session)

## Database Setup

### 1. Run Authentication Schema

```bash
cd blueclue/database
psql -U your_username -d blueclue_db -f auth_setup.sql
```

This will:
- Add `force_password_change` column to users table
- Add `username` column to users table
- Create `guest_sessions` table
- Create `refresh_tokens` table
- Insert hardcoded technician accounts
- Create cleanup functions for expired sessions

### 2. Verify Technician Accounts

```sql
SELECT username, email, role, force_password_change 
FROM users 
WHERE role = 'technician';
```

Expected output:
```
 username |         email          |    role     | force_password_change
----------+------------------------+-------------+-----------------------
 tnewc    | tnewc@blueclue.com     | technician  | t
 cmcgo    | cmcgo@blueclue.com     | technician  | t
 jwill    | jwill@blueclue.com     | technician  | t
```

## Backend Setup

### 1. Install Dependencies

```bash
cd blueclue/backend
npm install bcrypt jsonwebtoken cookie-parser
```

### 2. Environment Variables

Create/update `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Database Configuration (existing)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blueclue_db
DB_USER=your_username
DB_PASSWORD=your_password

# Server Configuration
PORT=3000
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` in production!

### 3. Start Backend Server

```bash
npm run dev
```

## Frontend Setup

### 1. Environment Variables

Create/update `blueclue/frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 2. Start Frontend

```bash
cd blueclue/frontend
npm run dev
```

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/login`
Login for technicians, customers, or guests.

**Technician Login:**
```json
{
  "username": "tnewc",
  "password": "admin123"
}
```

**Customer Login:**
```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

**Guest Login:**
```json
{
  "email": "guest@example.com",
  "fullName": "John Doe",
  "isGuest": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "tnewc@blueclue.com",
    "username": "tnewc",
    "firstName": "Thomas",
    "lastName": "Newcomb",
    "role": "technician",
    "forcePasswordChange": true
  }
}
```

#### POST `/api/auth/register`
Register new customer account.

**Request:**
```json
{
  "email": "newcustomer@example.com",
  "password": "SecurePassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "555-0123",
  "company": "Acme Corp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 5,
    "email": "newcustomer@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "customer"
  }
}
```

#### POST `/api/auth/change-password`
Change user password (requires authentication).

**Request:**
```json
{
  "currentPassword": "admin123",
  "newPassword": "NewSecurePassword456"
}
```

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

#### POST `/api/auth/logout`
Logout and revoke refresh tokens (requires authentication).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Access token refreshed successfully.",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### GET `/api/auth/me`
Get current authenticated user information.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "tnewc@blueclue.com",
    "username": "tnewc",
    "firstName": "Thomas",
    "lastName": "Newcomb",
    "role": "technician",
    "forcePasswordChange": false
  }
}
```

## Frontend Pages

### Login Page (`/login`)
- Tab-based interface for Customer, Technician, or Guest login
- Form validation
- Error handling
- Auto-redirect based on role
- Force password change detection

### Register Page (`/register`)
- Customer registration form
- Real-time password strength indicator
- Email validation
- Optional fields: phone, company
- Auto-login after registration

### Change Password Page (`/change-password`)
- Password strength indicator
- Password requirements checklist
- Support for forced password changes (technicians)
- Secure password validation

## Usage Examples

### Technician Login Flow

1. Navigate to `/login`
2. Select "Technician" tab
3. Enter username: `tnewc`
4. Enter password: `admin123`
5. Click "Sign In"
6. Redirected to `/change-password` (first login)
7. Create new secure password
8. Redirected to `/login`
9. Login with new password
10. Redirected to `/technician` dashboard

### Customer Registration Flow

1. Navigate to `/register`
2. Fill in registration form:
   - First Name: Jane
   - Last Name: Smith
   - Email: jane@example.com
   - Password: SecurePass123
3. Click "Create Account"
4. Auto-logged in and redirected to `/client-dashboard`

### Guest Access Flow

1. Navigate to `/login`
2. Select "Guest" tab
3. Enter email and full name
4. Click "Sign In"
5. Redirected to `/client-dashboard`
6. Can submit tickets for 24 hours

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- Recommended: uppercase, lowercase, numbers
- No password reuse (for password changes)
- Bcrypt hashing with 10 salt rounds

### Token Management
- Access tokens expire in 24 hours
- Refresh tokens expire in 7 days
- Tokens stored in localStorage
- Automatic token refresh on expired requests
- All tokens revoked on logout

### Production Checklist
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Use HTTPS in production
- [ ] Set secure cookie flags
- [ ] Implement rate limiting on auth endpoints
- [ ] Add CSRF protection
- [ ] Enable database SSL connections
- [ ] Set strong database passwords
- [ ] Regular security audits

## Troubleshooting

### "Invalid username or password"
- Verify technician username is correct: `tnewc`, `cmcgo`, or `jwill`
- Default password is `admin123`
- Check if account is active in database

### "Account is disabled"
- Check `is_active` column in users table
- Contact administrator to reactivate account

### "Token expired"
- Token expires after 24 hours
- Use refresh token to get new access token
- Re-login if refresh token also expired

### Guest session expired
- Guest sessions expire after 24 hours
- Create new guest session or register for permanent account

## Files Created

### Backend
- `backend/src/middleware/auth.js` - JWT authentication middleware
- `backend/src/controllers/authController.js` - Auth logic
- `backend/src/routes/auth.js` - Auth API endpoints
- `backend/scripts/generate-password-hashes.js` - Password hash generator

### Frontend
- `frontend/src/services/authService.js` - Auth API client
- `frontend/src/pages/Login.jsx` - Login page component
- `frontend/src/pages/Register.jsx` - Registration page component
- `frontend/src/pages/ChangePassword.jsx` - Password change page
- Updated `frontend/src/components/Navbar.jsx` - Auth-aware navigation
- Updated `frontend/src/App.jsx` - Auth routes

### Database
- `database/auth_setup.sql` - Authentication schema and technician accounts

## Testing

### Test Technician Accounts

| Username | Password (Default) | Email | Role |
|----------|-------------------|-------|------|
| tnewc | admin123 | tnewc@blueclue.com | technician |
| cmcgo | admin123 | cmcgo@blueclue.com | technician |
| jwill | admin123 | jwill@blueclue.com | technician |

**Note**: Password must be changed on first login.

### Test Customer Account

1. Register at `/register`
2. Use any valid email
3. Password minimum 8 characters
4. All fields except phone/company are required

### Test Guest Access

1. Go to `/login`
2. Select "Guest" tab
3. Enter any email and name
4. No password required
5. Session expires in 24 hours

## Future Enhancements

- [ ] Email verification for customer registration
- [ ] Password reset via email
- [ ] Two-factor authentication (2FA)
- [ ] OAuth integration (Google, Microsoft)
- [ ] Admin panel for user management
- [ ] Audit logging for authentication events
- [ ] Account lockout after failed login attempts
- [ ] Session management dashboard
