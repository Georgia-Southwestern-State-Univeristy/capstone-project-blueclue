# BlueClue - AI Powered IT Ticketing System

## System Overview
BlueClue is a next-generation IT ticketing system designed to deliver an outstanding user experience by leveraging advanced AI technology for automated ticket classification, real-time analytics, and intelligent support features.

**Key Features:**
- AI-powered ticket classification (93% accuracy)
- Automated priority detection
- Secure JWT authentication with refresh tokens
- Guest access for quick ticket submission
- Real-time analytics dashboard
- 24 subcategory classification system
- Natural language processing with abbreviation support

---

## Contributors
- **Thomas Newcomb** - Project Manager / AI Engineer
- **Jacob Williams** - Frontend Developer
- **Clayton McGough** - Backend Developer

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation & Setup](#installation--setup)
4. [Running the Application](#running-the-application)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up BlueClue, ensure you have the following installed:

### Required Software

| Software | Version | Download Link | Notes |
|----------|---------|---------------|-------|
| **Node.js** | 20.x or higher | [nodejs.org](https://nodejs.org/) | Includes npm |
| **Python** | 3.12.x | [python.org](https://www.python.org/) | Required for AI service |
| **PostgreSQL** | 14.x or higher | [postgresql.org](https://www.postgresql.org/download/) | Database server |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) | Version control |

### Verify Installations

After installing, verify each component:

```bash
# Check Node.js version
node --version
# Expected: v20.x.x or higher

# Check npm version
npm --version
# Expected: 10.x.x or higher

# Check Python version
python --version
# Expected: Python 3.12.x

# Check PostgreSQL
psql --version
# Expected: psql (PostgreSQL) 14.x or higher

# Check Git
git --version
# Expected: git version 2.x.x
```

### PostgreSQL Setup

During PostgreSQL installation:
1. **Remember your postgres user password** - you'll need it for database setup
2. Default port: 5432 (don't change unless necessary)
3. Add PostgreSQL to your PATH environment variable

---

## System Requirements

### Minimum Hardware
- **RAM:** 8 GB
- **Storage:** 2 GB free space
- **Processor:** Dual-core CPU

### Recommended Hardware
- **RAM:** 16 GB
- **Storage:** 5 GB free space
- **Processor:** Quad-core CPU

### Operating System
- **Windows:** 10/11
- **macOS:** 10.15+
- **Linux:** Ubuntu 20.04+ or equivalent

### Network
- Internet connection required for:
  - Package installation (npm, pip)
  - Python spaCy model download

---

## Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/Georgia-Southwestern-State-Univeristy/capstone-project-blueclue.git
cd capstone-project-blueclue/blueclue
```

### Step 2: Database Setup

**Important:** Complete database setup before backend/frontend setup.

```powershell
# Navigate to database folder
cd database

# Run automated setup script
.\SETUP.ps1
```

**What the script does:**
1. Drops existing `blueclue` database (if exists)
2. Creates fresh `blueclue` database
3. Creates schema (tables, ENUMs, indexes, triggers)
4. Sets up authentication system
5. Creates technician accounts (tnewc, cmcgo, jwill)
6. Loads sample data (customers, categories)

**Default Technician Credentials:**
- Username: `tnewc`, `cmcgo`, or `jwill`
- Password: `admin123` (must change on first login)

**Verify Database Setup:**
```bash
psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM users WHERE role = 'technician';"
# Expected: 3
```

**Troubleshooting Database Setup:**
- If script fails, ensure PostgreSQL service is running
- Verify you know your postgres user password
- See `database/README.md` for manual setup instructions

---

### Step 3: Backend Setup

**Navigate to backend directory:**
```bash
cd ../backend
```

**Install dependencies:**
```bash
npm install
```

**Create environment file:**
```bash
# Create .env file in backend directory
```

**Backend .env configuration:**
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blueclue
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-too
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AI Service Configuration
AI_SERVICE_URL=http://localhost:5000
```

**Important:** Replace `your_postgres_password` with your actual PostgreSQL password.

**Verify backend setup:**
```bash
npm run dev
# Expected: Server running on http://localhost:3000
```

Press `Ctrl+C` to stop the server after verification.

---

### Step 4: AI Service Setup

**Navigate to AI directory:**
```bash
cd ../ai
```

**Create virtual environment:**
```bash
# Windows
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**Download spaCy language model:**
```bash
python -m spacy download en_core_web_sm
```

**Create environment file:**
```bash
# Create .env file in ai directory
```

**AI Service .env configuration:**
```env
# Flask Configuration
PORT=5000
FLASK_ENV=development
```

**Verify AI service:**
```bash
python app.py
# Expected: Running on http://127.0.0.1:5000
```

Press `Ctrl+C` to stop the service after verification.

**Test classification:**
```bash
# In a new terminal (keep AI service running)
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"My laptop won't turn on\"}"

# Expected: JSON response with category="hardware", priority="high"
```

---

### Step 5: Frontend Setup

**Navigate to frontend directory:**
```bash
cd ../frontend
```

**Install dependencies:**
```bash
npm install
```

**Create environment file (optional):**
```bash
# Create .env file in frontend directory
```

**Frontend .env configuration (optional):**
```env
VITE_API_URL=http://localhost:3000/api
```

**Verify frontend setup:**
```bash
npm run dev
# Expected: Local: http://localhost:5173
```

Press `Ctrl+C` to stop the dev server after verification.

---

## Running the Application

### Complete Startup Sequence

You need to start all three services in separate terminals:

**Terminal 1 - AI Service:**
```bash
cd blueclue/ai
.\venv\Scripts\Activate.ps1   # Windows
# or: source venv/bin/activate  # macOS/Linux
python app.py
```
**Status:** Running on http://localhost:5000

**Terminal 2 - Backend:**
```bash
cd blueclue/backend
npm run dev
```
**Status:** Running on http://localhost:3000

**Terminal 3 - Frontend:**
```bash
cd blueclue/frontend
npm run dev
```
**Status:** Running on http://localhost:5173

### Access the Application

Once all services are running:

- **Frontend UI:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **AI Service:** http://localhost:5000
- **API Health Check:** http://localhost:3000/api/auth/health
- **AI Health Check:** http://localhost:5000/health

### Quick Start (Automated)

For faster startup, use the automated script:

```powershell
cd blueclue/docs/setup
.\start-dev.ps1
```

This will:
- Install dependencies (if needed)
- Start all three services automatically
- Open separate terminal windows for each service

---

## Testing

### Run All Tests

**AI Classification Tests:**
```bash
cd blueclue/ai
python test_accuracy.py
# Expected: 93% category accuracy, 67% priority accuracy
```

**Backend Integration Tests:**
```bash
cd blueclue/backend
node test-ai-integration.js
# Expected: All tests passing
```

**Database Tests:**
```bash
cd blueclue/database
# Follow checklist in TESTING_CHECKLIST.md
```

### API Testing with Postman

1. Import collection: `backend/postman/BlueClue-Tickets-API.postman_collection.json`
2. Set up environment variables (see `docs/api/endpoints.md`)
3. Run collection to test all endpoints

### Test User Accounts

**Technicians:**
- Username: `tnewc`, `cmcgo`, `jwill`
- Password: `admin123` (change on first login)

**Customers (if seed data loaded):**
- Email: `customer@example.com`
- Password: `password123`

**Guest Access:**
- No login required - submit tickets directly

---

## Documentation

### Complete Documentation Files

| Document | Location | Description |
|----------|----------|-------------|
| **API Documentation** | `docs/api/endpoints.md` | All API endpoints with examples |
| **Testing Report** | `docs/testing/preliminary-testing-report.md` | Comprehensive test results |
| **Database Setup** | `database/README.md` | Database schema and setup |
| **AI Service Guide** | `ai/README.md` | AI classification documentation |
| **Authentication Guide** | `docs/AUTH_ARCHITECTURE.md` | Auth system architecture |
| **Troubleshooting** | `docs/TROUBLESHOOTING.md` | Common issues and solutions |

### Quick References

**Default Ports:**
- Frontend: 5173
- Backend: 3000
- AI Service: 5000
- PostgreSQL: 5432

**Project Structure:**
```
blueclue/
├── frontend/          # React + Vite frontend
├── backend/           # Node.js + Express API
├── ai/               # Python Flask AI service
├── database/         # PostgreSQL setup scripts
└── docs/             # Documentation
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
**Error:** `ECONNREFUSED` or `password authentication failed`

**Solution:**
1. Verify PostgreSQL is running: `services.msc` (Windows)
2. Check password in `backend/.env` matches postgres password
3. Verify database exists: `psql -U postgres -l | findstr blueclue`

#### AI Service Not Running
**Error:** Backend shows "AI classification service unavailable"

**Solution:**
1. Check AI service is running on port 5000
2. Verify virtual environment is activated
3. Check `AI_SERVICE_URL` in `backend/.env`

#### Port Already in Use
**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Windows - Find process using port 3000
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

#### spaCy Model Not Found
**Error:** `Can't find model 'en_core_web_sm'`

**Solution:**
```bash
cd blueclue/ai
.\venv\Scripts\Activate.ps1
python -m spacy download en_core_web_sm
```

#### npm Install Failures
**Error:** Various npm errors during installation

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Getting Help

1. Check `docs/TROUBLESHOOTING.md` for detailed solutions
2. Review service logs in terminal windows
3. Verify all prerequisites are installed correctly
4. Ensure all environment variables are set

---

## Development Workflow

### Making Changes

**Frontend Development:**
```bash
cd blueclue/frontend
npm run dev
# Changes auto-reload at http://localhost:5173
```

**Backend Development:**
```bash
cd blueclue/backend
npm run dev
# Nodemon auto-restarts on file changes
```

**AI Service Development:**
```bash
cd blueclue/ai
python app.py
# Manual restart required after changes
```

### Code Style

- **Frontend:** ESLint + Prettier
- **Backend:** ESLint
- **Python:** PEP 8

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Description of changes"

# Push to remote
git push origin feature/your-feature-name
```





---

## Contact

**Project Manager:** Thomas Newcomb  
**Repository:** [capstone-project-blueclue](https://github.com/Georgia-Southwestern-State-Univeristy/capstone-project-blueclue)

**Last Updated:** February 13, 2026
