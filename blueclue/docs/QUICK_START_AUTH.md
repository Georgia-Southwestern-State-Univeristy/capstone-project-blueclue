# 🚀 BlueClue Authentication - Quick Start Guide

Get the authentication system running in 5 minutes!

## Prerequisites
- PostgreSQL installed and running
- Node.js 18+ installed
- BlueClue database already created

---

## Step 1: Database Setup (2 minutes)

### Option A: Automated (Recommended)
```powershell
cd blueclue\database
.\SETUP_AUTH.ps1
```
Follow the prompts to enter database credentials.

### Option B: Manual
```bash
cd blueclue/database
psql -U postgres -d blueclue_db -f auth_setup.sql
```

**✅ Verify**: You should see 3 technician accounts created (tnewc, cmcgo, jwill)

---

## Step 2: Backend Setup (1 minute)

```bash
cd blueclue\backend

# Install dependencies (if not already installed)
npm install

# Verify auth packages
npm list bcrypt jsonwebtoken cookie-parser

# Start server
npm run dev
```

**✅ Verify**: Server running on http://localhost:3000

---

## Step 3: Frontend Setup (1 minute)

```bash
cd blueclue\frontend

# Install dependencies (if needed)
npm install

# Start dev server
npm run dev
```

**✅ Verify**: Frontend running on http://localhost:5173

---

## Step 4: Test Login (1 minute)

### Test Technician Login
1. Navigate to http://localhost:5173/login
2. Click "Technician" tab
3. Enter:
   - Username: `tnewc`
   - Password: `admin123`
4. Click "Sign In"
5. You'll be redirected to change password (first login)
6. Create new password (min 8 characters)
7. Login again with new password
8. ✅ You should be on the Technician Dashboard

### Test Customer Registration
1. Navigate to http://localhost:5173/register
2. Fill in:
   - First Name: Jane
   - Last Name: Doe
   - Email: jane@example.com
   - Password: SecurePass123 (min 8 chars)
3. Click "Create Account"
4. ✅ Auto-logged in and redirected to Client Dashboard

### Test Guest Access
1. Navigate to http://localhost:5173/login
2. Click "Guest" tab
3. Enter:
   - Full Name: John Guest
   - Email: john@example.com
4. Click "Sign In"
5. ✅ Redirected to Client Dashboard (24-hour session)

---

## 🎉 You're Done!

The authentication system is now fully operational!

### Default Credentials

**Technicians** (must change password on first login):
- Username: `tnewc` | Password: `admin123`
- Username: `cmcgo` | Password: `admin123`
- Username: `jwill` | Password: `admin123`

---

## 🔧 Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
psql --version

# Test database connection
psql -U postgres -d blueclue_db -c "SELECT NOW();"
```

### "bcrypt not found"
```bash
cd blueclue\backend
npm install bcrypt jsonwebtoken cookie-parser
```

### "Login page not found"
- Verify frontend is running: http://localhost:5173
- Check browser console for errors (F12)
- Ensure all routes are in App.jsx

### "Invalid username or password"
- Verify technician accounts were created:
  ```sql
  psql -U postgres -d blueclue_db -c "SELECT username, email FROM users WHERE role = 'technician';"
  ```
- Ensure you're using username (not email) for technicians
- Password is `admin123` (case-sensitive)

### Backend won't start
- Check if port 3000 is already in use
- Verify .env file exists with database credentials
- Check database connection in .env

---

## 📚 Next Steps

1. **Read Full Documentation**: See `docs/AUTH_SYSTEM_README.md`
2. **API Documentation**: Check available endpoints in README
3. **Security**: Change JWT_SECRET in `.env` before production
4. **Customization**: Modify UI components in `frontend/src/pages/`

---

## 🆘 Need Help?

- Full documentation: `docs/AUTH_SYSTEM_README.md`
- Implementation details: `docs/AUTH_IMPLEMENTATION_SUMMARY.md`
- API reference: In main README file

---

## ✅ Checklist

- [ ] Database setup completed (3 technician accounts exist)
- [ ] Backend running on port 3000
- [ ] Frontend running on port 5173
- [ ] Technician login tested (tnewc / admin123)
- [ ] Password change flow tested
- [ ] Customer registration tested
- [ ] Guest access tested
- [ ] JWT_SECRET set in backend/.env
- [ ] All packages installed (bcrypt, jsonwebtoken, cookie-parser)

**If all checked, you're ready to go! 🚀**
