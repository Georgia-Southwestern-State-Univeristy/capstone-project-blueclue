# BlueClue Troubleshooting Guide

Common setup issues and solutions for Windows development environment.

## Table of Contents
- [PostgreSQL Setup Issues](#postgresql-setup-issues)
- [Python Setup Issues](#python-setup-issues)
- [Backend Database Connection Issues](#backend-database-connection-issues)
- [Development Server Issues](#development-server-issues)

---

## PostgreSQL Setup Issues

### `psql` command not recognized

**Problem:** Running `psql` commands returns "command not found" or similar error.

**Solution:** Add PostgreSQL to your Windows PATH:

1. Open **System Environment Variables**:
   - Press `Win + R`
   - Type `sysdm.cpl` and press Enter
   - Click **Environment Variables**

2. Edit **User PATH** variable (NOT System variable):
   - Under "User variables", select **Path**
   - Click **Edit**

3. Add these two entries (replace `<version>` with your version, e.g., 18):
   ```
   C:\Program Files\PostgreSQL\<version>\bin
   C:\Program Files\PostgreSQL\<version>\lib
   ```

4. **Important:** Click OK on all dialogs, then **restart PowerShell** or open a new terminal

5. Verify the fix:
   ```powershell
   psql --version
   ```

**Note:** This also fixes pgAdmin4 connection issues.

### Password authentication failed

**Problem:** `psql: FATAL: password authentication failed for user "postgres"`

**Solution:** Set the password as an environment variable before running commands:

```powershell
$env:PGPASSWORD = "your_postgres_password"
psql -U postgres -c "CREATE DATABASE blueclue;"
```

Alternatively, PostgreSQL will prompt you for the password if you don't set it.

### Database already exists error

**Problem:** `ERROR: database "blueclue" already exists`

**Solution:** Either use the existing database or drop and recreate:

```powershell
# Drop the existing database
psql -U postgres -c "DROP DATABASE blueclue;"

# Create fresh database
psql -U postgres -c "CREATE DATABASE blueclue;"
psql -U postgres -d blueclue -f schema.sql
psql -U postgres -d blueclue -f seed.sql
```

---

## Python Setup Issues

### Python command not recognized

**Problem:** Running `python` opens Microsoft Store instead of Python interpreter.

**Solution:** Disable the Microsoft Store alias:

1. Go to **Settings** → **Apps** → **App execution aliases**
2. Find and **disable** both:
   - `python.exe` (App Installer)
   - `python3.exe` (App Installer)
3. Restart your terminal
4. Test: `python --version`

### Python not in PATH

**Problem:** `python` command not found even after disabling Microsoft Store alias.

**Solution:** Add Python to your PATH:

1. Find your Python installation path (usually):
   ```
   C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python<version>
   ```

2. Add these paths to User PATH:
   ```
   C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python<version>
   C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python<version>\Scripts
   ```

3. Restart terminal and verify:
   ```powershell
   python --version
   pip --version
   ```

### pip command not found

**Problem:** `pip` command not recognized, even with Python working.

**Solution:** The pip Scripts folder may be in a different location:

1. Common pip locations:
   ```
   C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python<version>\Scripts
   C:\Users\<YourUsername>\AppData\Local\Python\pythoncore-<version>-64\Scripts
   ```

2. Find your pip location:
   ```powershell
   python -m pip --version
   ```
   This will show you where pip is installed.

3. Add the Scripts directory to your PATH

4. Restart terminal and verify:
   ```powershell
   pip --version
   ```

**Temporary workaround:** Use `python -m pip` instead of `pip`:
```powershell
python -m pip install package_name
```

---

## Backend Database Connection Issues

### Invalid URL error

**Problem:** Backend shows `Database connection failed: Invalid URL`

**Solution:** Special characters in passwords can break connection URLs. Use individual parameters instead:

**In `.env` file:**
```env
# Don't use this if password has special characters
# DATABASE_URL=postgresql://postgres:password@localhost:5432/blueclue

# Use this instead
DB_USER=postgres
DB_HOST=localhost
DB_NAME=blueclue
DB_PASSWORD=Your?Password!Here
DB_PORT=5432
```

**Important:** Don't wrap the password in quotes in `.env` files.

### SCRAM authentication error

**Problem:** `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Solution:** This usually means the password environment variable is not being read correctly.

1. Check `.env` file exists at `blueclue/backend/.env`
2. Verify `dotenv` is installed: `npm list dotenv`
3. Ensure password has no quotes in `.env`:
   ```env
   DB_PASSWORD=MyPassword123!
   ```
   Not: `DB_PASSWORD="MyPassword123!"`

### Connection timeout

**Problem:** Backend can't connect, times out.

**Solution:**

1. Verify PostgreSQL service is running:
   - Open **Services** (Win + R, type `services.msc`)
   - Find **postgresql-x64-<version>**
   - Ensure Status is "Running"
   - If not, right-click → Start

2. Test manual connection:
   ```powershell
   psql -U postgres -d blueclue -c "SELECT NOW();"
   ```

3. If manual connection works but backend doesn't:
   - Restart backend server
   - Check `.env` file for typos
   - Ensure `pg` package is installed: `npm list pg`

### Can't find database "blueclue"

**Problem:** `FATAL: database "blueclue" does not exist`

**Solution:** Create the database:

```powershell
cd blueclue/database
psql -U postgres -c "CREATE DATABASE blueclue;"
psql -U postgres -d blueclue -f schema.sql
psql -U postgres -d blueclue -f seed.sql
```

---

## Development Server Issues

### Port already in use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:** The port is already occupied by another process.

**Option 1:** Kill the process using the port:
```powershell
# Find the process using port 3000
netstat -ano | findstr :3000

# Kill it (replace <PID> with the process ID from above)
taskkill /PID <PID> /F
```

**Option 2:** Use a different port by editing `.env`:
```env
PORT=3001
```

### Module not found errors

**Problem:** `Error: Cannot find module 'express'` or similar.

**Solution:** Install dependencies:

```powershell
cd blueclue/backend
npm install
```

Or from project root:
```powershell
npm run install:all
```

### nodemon not found

**Problem:** `nodemon: command not found`

**Solution:** Install nodemon (should be in devDependencies):

```powershell
cd blueclue/backend
npm install
```

Or install globally:
```powershell
npm install -g nodemon
```

### Frontend won't start (Vite errors)

**Problem:** Vite build errors or frontend won't start.

**Solution:**

1. Clear cache and reinstall:
   ```powershell
   cd blueclue/frontend
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Force package-lock.json
   npm install
   npm run dev
   ```

2. If still failing, check Node.js version:
   ```powershell
   node --version
   ```
   Ensure you're using Node.js 18 or higher.

---

## Getting Help

If you're still experiencing issues:

1. Check the specific README files:
   - [Database README](../database/README.md)
   - [AI Setup Guide](setup/AI_SETUP_GUIDE.md)

2. Review error messages carefully - they often contain the solution

3. Search the project issues on GitHub

4. Contact the team:
   - Thomas Newcomb (AI/Database)
   - Clayton McGough (Backend)
   - Jacob Williams (Frontend)

---

## Quick Reference: Common Commands

### Database
```powershell
# Create database
psql -U postgres -c "CREATE DATABASE blueclue;"

# Run schema
psql -U postgres -d blueclue -f schema.sql

# Add seed data
psql -U postgres -d blueclue -f seed.sql

# Verify data
psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM tickets;"
```

### Backend
```powershell
# Install dependencies
cd blueclue/backend
npm install

# Start dev server
npm run dev

# Test database connection
# Visit: http://localhost:3000/api/test-db
```

### Frontend
```powershell
# Install dependencies
cd blueclue/frontend
npm install

# Start dev server
npm run dev
```

### Python/AI
```powershell
# Create virtual environment
cd blueclue/ai
python -m venv venv

# Activate venv
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```
