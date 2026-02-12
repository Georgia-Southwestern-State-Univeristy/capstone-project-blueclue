# BlueClue Authentication System - Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BLUECLUE AUTH SYSTEM                         │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                  │         │                  │         │                  │
│    FRONTEND      │◄───────►│     BACKEND      │◄───────►│    DATABASE      │
│   (React/Vite)   │  HTTP   │  (Express/Node)  │   SQL   │   (PostgreSQL)   │
│                  │         │                  │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
       │                            │                             │
       │                            │                             │
   ┌───▼────┐                  ┌───▼────┐                   ┌────▼─────┐
   │ Pages  │                  │ Routes │                   │  Tables  │
   ├────────┤                  ├────────┤                   ├──────────┤
   │ Login  │                  │ /login │                   │  users   │
   │Register│                  │/register│                  │ refresh_ │
   │ Change │                  │/change │                   │  tokens  │
   │Password│                  │/logout │                   │  guest_  │
   └────────┘                  │/refresh│                   │ sessions │
                               │  /me   │                   └──────────┘
   ┌────────┐                  └────────┘
   │Service │
   ├────────┤                  ┌────────┐
   │  auth  │                  │Middleware│
   │Service │                  ├────────┤
   │  .js   │                  │  auth  │
   └────────┘                  │  .js   │
                               └────────┘
   ┌────────┐
   │Component│                 ┌────────┐
   ├────────┤                  │Controller│
   │ Navbar │                  ├────────┤
   └────────┘                  │  auth  │
                               │Controller│
                               │  .js   │
                               └────────┘
```

---

## Authentication Flows

### 1️⃣ Technician Login Flow

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────────────────────┐
│ User navigates to       │
│ /login                  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Selects "Technician"    │
│ tab                     │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Enters:                 │
│ • username: tnewc       │
│ • password: admin123    │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ POST /api/auth/login    │
│ {username, password}    │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Backend verifies:       │
│ 1. User exists          │
│ 2. Password matches     │
│ 3. Account active       │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Check                   │
│ force_password_change   │
└────┬────────────────────┘
     │
     ├──► YES ──────────────┐
     │                      │
     │                      ▼
     │              ┌──────────────────┐
     │              │ Redirect to      │
     │              │ /change-password │
     │              └───────┬──────────┘
     │                      │
     │                      ▼
     │              ┌──────────────────┐
     │              │ User creates new │
     │              │ password         │
     │              └───────┬──────────┘
     │                      │
     │                      ▼
     │              ┌──────────────────┐
     │              │ Update password, │
     │              │ clear flag       │
     │              └───────┬──────────┘
     │                      │
     │                      ▼
     │              ┌──────────────────┐
     │              │ Redirect to      │
     │              │ /login           │
     │              └───────┬──────────┘
     │                      │
     │◄─────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ NO: Return JWT token    │
│ + user data             │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Store token in          │
│ localStorage            │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Redirect to             │
│ /technician             │
└────┬────────────────────┘
     │
     ▼
┌─────────┐
│   END   │
└─────────┘
```

---

### 2️⃣ Customer Registration Flow

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────────────────────┐
│ User navigates to       │
│ /register               │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Fills form:             │
│ • Email                 │
│ • Password (min 8)      │
│ • First/Last Name       │
│ • Phone (optional)      │
│ • Company (optional)    │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Real-time password      │
│ strength indicator      │
│ (Weak/Medium/Strong)    │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Click "Create Account"  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Frontend validation:    │
│ • Email format          │
│ • Password length       │
│ • Required fields       │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ POST /api/auth/register │
│ {email, password, etc}  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Backend checks:         │
│ • Email unique          │
│ • Valid format          │
│ • Password length       │
└────┬────────────────────┘
     │
     ├──► DUPLICATE EMAIL ──┐
     │                      │
     │                      ▼
     │              ┌──────────────────┐
     │              │ Return 409       │
     │              │ "Email exists"   │
     │              └──────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Hash password (bcrypt)  │
│ 10 salt rounds          │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ INSERT INTO users       │
│ role = 'customer'       │
│ is_active = true        │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Generate JWT token      │
│ + refresh token         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Store tokens in         │
│ localStorage            │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Auto-login & redirect   │
│ to /client-dashboard    │
└────┬────────────────────┘
     │
     ▼
┌─────────┐
│   END   │
└─────────┘
```

---

### 3️⃣ Guest Access Flow

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────────────────────┐
│ User navigates to       │
│ /login                  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Selects "Guest" tab     │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Enters:                 │
│ • Full Name             │
│ • Email                 │
│ (NO PASSWORD)           │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Click "Sign In"         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ POST /api/auth/login    │
│ {email, fullName,       │
│  isGuest: true}         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Backend validates       │
│ email format            │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Generate guest token    │
│ (24-hour expiration)    │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ INSERT INTO             │
│ guest_sessions          │
│ expires_at = NOW()+24h  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Return guest token      │
│ + user data             │
│ {role: 'guest'}         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Store token in          │
│ localStorage            │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Redirect to             │
│ /client-dashboard       │
└────┬────────────────────┘
     │
     ▼
┌─────────┐
│   END   │
│ (Session expires in 24h)│
└─────────┘
```

---

## Token Management Flow

```
┌────────────────────┐
│ User authenticated │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Access Token:      │
│ • Valid 24 hours   │
│ • Stored in        │
│   localStorage     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Refresh Token:     │
│ • Valid 7 days     │
│ • Stored in        │
│   localStorage     │
│ • DB tracking      │
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────┐
│ Every API request includes:    │
│ Authorization: Bearer <token>  │
└────────┬───────────────────────┘
         │
         ├──► Token Valid ──────┐
         │                      │
         │                      ▼
         │              ┌───────────────┐
         │              │ Process       │
         │              │ request       │
         │              └───────────────┘
         │
         ├──► Token Expired ────┐
         │                      │
         │                      ▼
         │              ┌────────────────┐
         │              │ POST           │
         │              │ /api/auth/     │
         │              │ refresh        │
         │              └───────┬────────┘
         │                      │
         │                      ▼
         │              ┌────────────────┐
         │              │ Get new access │
         │              │ token          │
         │              └───────┬────────┘
         │                      │
         │                      ▼
         │              ┌────────────────┐
         │              │ Retry original │
         │              │ request        │
         │              └────────────────┘
         │
         ▼
┌────────────────────┐
│ Logout clicked     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ POST               │
│ /api/auth/logout   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Revoke all refresh │
│ tokens in DB       │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Clear localStorage │
│ • token            │
│ • refreshToken     │
│ • user             │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Redirect to /login │
└────────────────────┘
```

---

## Password Security Flow

```
┌──────────────┐
│ User enters  │
│ password     │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ bcrypt.hash()        │
│ • Salt rounds: 10    │
│ • Generates unique   │
│   hash each time     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Store in database:   │
│ password_hash column │
│ (60 characters)      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Original password    │
│ NEVER stored         │
└──────────────────────┘

LOGIN VERIFICATION:
┌──────────────┐
│ User enters  │
│ password     │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ bcrypt.compare()     │
│ • Input password     │
│ • Stored hash        │
└──────┬───────────────┘
       │
       ├──► Match ──────┐
       │                │
       │                ▼
       │         ┌─────────────┐
       │         │ Login       │
       │         │ successful  │
       │         └─────────────┘
       │
       ├──► No Match ───┐
       │                │
       │                ▼
       │         ┌─────────────┐
       │         │ Return 401  │
       │         │ Invalid     │
       │         │ credentials │
       │         └─────────────┘
```

---

## Database Schema

```sql
┌─────────────────┐
│     users       │
├─────────────────┤
│ id              │ SERIAL PRIMARY KEY
│ email           │ VARCHAR UNIQUE
│ username        │ VARCHAR UNIQUE (technicians only)
│ password_hash   │ VARCHAR (bcrypt hash)
│ first_name      │ VARCHAR
│ last_name       │ VARCHAR
│ role            │ ENUM (customer, technician, admin)
│ force_password_ │ BOOLEAN
│   change        │
│ is_active       │ BOOLEAN
│ created_at      │ TIMESTAMP
│ last_login      │ TIMESTAMP
└─────────────────┘
        │
        │ 1
        │
        │ N
        ▼
┌─────────────────┐
│ refresh_tokens  │
├─────────────────┤
│ id              │ SERIAL PRIMARY KEY
│ user_id         │ FK → users(id)
│ token           │ VARCHAR UNIQUE
│ expires_at      │ TIMESTAMP
│ is_revoked      │ BOOLEAN
│ created_at      │ TIMESTAMP
└─────────────────┘

┌─────────────────┐
│ guest_sessions  │
├─────────────────┤
│ id              │ SERIAL PRIMARY KEY
│ session_token   │ VARCHAR UNIQUE
│ email           │ VARCHAR
│ full_name       │ VARCHAR
│ created_at      │ TIMESTAMP
│ expires_at      │ TIMESTAMP (NOW() + 24h)
│ is_active       │ BOOLEAN
└─────────────────┘
```

---

## Component Hierarchy

```
App.jsx
├── Navbar.jsx (auth-aware)
│   ├── Login button (if not auth)
│   └── User menu (if auth)
│       ├── Change Password
│       └── Logout
│
├── Routes
│   ├── /login → Login.jsx
│   │   ├── Customer tab
│   │   ├── Technician tab
│   │   └── Guest tab
│   │
│   ├── /register → Register.jsx
│   │   └── Customer registration form
│   │
│   ├── /change-password → ChangePassword.jsx
│   │   ├── Current password (if not forced)
│   │   ├── New password (with strength indicator)
│   │   └── Confirm password
│   │
│   ├── /client-dashboard (customers/guests)
│   └── /technician (technicians only)
│
└── authService.js (API calls & token mgmt)
    ├── login()
    ├── register()
    ├── changePassword()
    ├── logout()
    ├── refreshAccessToken()
    └── getCurrentUser()
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────┐
│               SECURITY LAYERS                        │
└─────────────────────────────────────────────────────┘

LAYER 1: Frontend Validation
├── Email format check
├── Password strength requirements
├── Required field validation
└── Immediate user feedback

LAYER 2: Backend Validation
├── Request body validation
├── Email uniqueness check
├── Password length enforcement
└── Role-based access control

LAYER 3: Database Constraints
├── UNIQUE constraints (email, username)
├── CHECK constraints (email format)
├── Foreign key constraints
└── NOT NULL constraints

LAYER 4: Encryption & Hashing
├── Password: bcrypt (10 salt rounds)
├── Tokens: JWT with secret key
└── HTTPS in production (recommended)

LAYER 5: Token Management
├── Access token expiration (24h)
├── Refresh token expiration (7d)
├── Token revocation on logout
└── Automatic refresh on expiry

LAYER 6: Session Management
├── Guest session expiration (24h)
├── Cleanup functions for expired data
└── Active session tracking
```

---

## API Response Flow

```
CLIENT REQUEST → BACKEND → DATABASE → BACKEND → CLIENT

Example: Login Request

1. Frontend
   ↓
   fetch('/api/auth/login', {
     method: 'POST',
     body: {username: 'tnewc', password: 'admin123'}
   })

2. Backend Routes (routes/auth.js)
   ↓
   router.post('/login', login)

3. Controller (controllers/authController.js)
   ↓
   • Validate input
   • Query database
   • Verify password
   • Generate tokens

4. Database
   ↓
   SELECT * FROM users WHERE username = 'tnewc'

5. Password Verification
   ↓
   bcrypt.compare(password, hash)

6. Token Generation
   ↓
   jwt.sign({id, role, ...}, secret, {expiresIn: '24h'})

7. Response
   ↓
   {
     success: true,
     token: "eyJhbG...",
     refreshToken: "eyJhbG...",
     user: {id, role, ...}
   }

8. Frontend
   ↓
   • Store tokens in localStorage
   • Update UI
   • Redirect to dashboard
```

---

## Development vs Production

```
┌─────────────────────────────────────────────────────┐
│                  DEVELOPMENT                         │
└─────────────────────────────────────────────────────┘
• HTTP (localhost)
• JWT_SECRET: simple key
• Tokens in localStorage
• CORS: open
• Detailed error messages
• No rate limiting

┌─────────────────────────────────────────────────────┐
│                  PRODUCTION                          │
└─────────────────────────────────────────────────────┘
• HTTPS only
• JWT_SECRET: strong random key (32+ chars)
• Tokens in httpOnly cookies
• CORS: specific origins
• Generic error messages
• Rate limiting enabled
• Password reset via email
• Account lockout after failed attempts
• Audit logging
• 2FA (optional)
```

This architecture provides a secure, scalable authentication system for BlueClue!
