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
# ── Server ──────────────────────────────────────────────────────────────────
ML_SERVICE_PORT=5000
ML_SERVICE_HOST=0.0.0.0
ML_ENV=development        # or 'production'
ML_WORKERS=2

# ── Database (for RAG / vector search) ──────────────────────────────────────
DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/blueclue

# ── OpenAI (optional) ───────────────────────────────────────────────────────
# Leave blank to fall back to free local sentence-transformers embeddings.
# Chat generation is disabled without a key; rule-based fallback is used.
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-3.5-turbo

# ── ML tuning ───────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD=0.5
```

> **Heads-up:** The AI service uses **FastAPI + uvicorn**, not Flask.
> Start it with `uvicorn src.app:app --host 0.0.0.0 --port 5000 --reload`
> (or `python app.py` which internally calls uvicorn).

**Start the AI service (FastAPI / uvicorn):**
```bash
# Recommended
uvicorn src.app:app --host 0.0.0.0 --port 5000 --reload

# Shortcut wrapper (calls uvicorn internally)
python app.py
# Expected: Uvicorn running on http://0.0.0.0:5000
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

## Docker Compose

A `docker-compose.yml` at the repo root builds and runs the ML service and backend together.  
The database must be reachable externally (local Postgres, Railway plugin, etc.).

```bash
# Copy the template and set required variables
cp .env.example .env   # if present, otherwise create an .env file
# Required: DATABASE_URL, JWT_SECRET
# Optional: FRONTEND_URL, ML_SERVICE_PORT, BACKEND_PORT

# Build and start all services (ml-service + backend)
docker compose up --build

# Start only the ML service
docker compose up ml-service

# Tear down
docker compose down
```

The `frontend` block in `docker-compose.yml` is commented out.  
Uncomment it to build and serve the React app from nginx inside Docker.

**Hot-swapping models without rebuilding:**
The ML models directory is bind-mounted: `./blueclue/ai/models:/app/models`.  
Drop updated model files there and restart the container — no rebuild needed.

---

## Cloud Hosting — Railway

BlueClue is designed to deploy on [Railway](https://railway.app).  
See `docs/setup/RAILWAY_DEPLOYMENT.md` for the full walkthrough.

### Service layout

Create four services in Railway and set each service's **Root Directory**:

| Service | Root Directory | Build Method |
|---------|---------------|-------------|
| `database` | — | PostgreSQL plugin (built-in add-on) |
| `ml-service` | `blueclue/ai` | Dockerfile |
| `backend` | `blueclue/backend` | Dockerfile |
| `frontend` | `blueclue/frontend` | Dockerfile (multi-stage nginx) |

### Minimum environment variables (Railway dashboard)

| Service | Variable | Value / Source |
|---------|----------|---------------|
| `backend` | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `backend` | `JWT_SECRET` | Strong random string |
| `backend` | `FRONTEND_URL` | Your Railway frontend public URL |
| `backend` | `AI_SERVICE_URL` | Your Railway ml-service internal URL |
| `backend` | `NODE_ENV` | `production` |
| `ml-service` | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ml-service` | `OPENAI_API_KEY` | Your OpenAI key (optional) |
| `ml-service` | `ML_ENV` | `production` |
| `frontend` | `VITE_API_URL` | Your backend public URL + `/api` |

---

## User Roles

| Role | Dashboard | Capabilities |
|------|-----------|-------------|
| `customer` | Client Dashboard | Submit tickets, view own tickets, use chatbot |
| `guest` | Client Dashboard | Submit tickets without an account |
| `technician` | Technician Dashboard | Manage assigned tickets, update status |
| `senior_technician` | Technician Dashboard | Same as technician + reassign to others |
| `management` | Management Dashboard | All tickets, analytics, manage technicians |
| `admin` | Management + ML Admin | Full access including ML configuration |

> The ML Admin dashboard (model management, drift detection, retraining) is accessible to `admin` and `management` roles only.

---

## AI Chatbot & ML Pipeline

### How tickets are classified

1. A ticket is submitted (via the form **or** the chatbot).
2. The backend calls `classifyTicketWithFallback()` in `aiService.js`.
3. That function POSTs the ticket text to `<AI_SERVICE_URL>/classify`.
4. The ML service returns `category`, `priority`, and `confidence` from its scikit-learn model.
5. `calculateFinalPriority()` blends the AI priority with any user-specified priority, weighted by confidence.
6. If the ML service is unavailable the fallback assigns `category: 'general'`, `priority: 'low'` silently.

### Chatbot capabilities

- Intent detection with NLP (spaCy) and rule-based matching
- RAG (Retrieval-Augmented Generation) over the knowledge base using pgvector
- Ticket creation directly from chat — fully ML-classified
- Handoff to a live technician via TechChatPanel
- Chat analytics: NPS, deflection rate, peak-hour heatmap

### Retraining models

```bash
cd blueclue/ai
source venv/bin/activate   # or .\venv\Scripts\Activate.ps1

# 1. Export labelled data from the database
python scripts/export_training_data.py

# 2. Prepare features
python scripts/prepare_ml_data.py

# 3. Retrain all models (category + priority + time-to-resolve)
python scripts/retrain_pipeline.py

# 4. Verify accuracy
python test_accuracy.py
# Expected: ~93% category accuracy
```

Retrained artefacts are saved to `blueclue/ai/models/`.  
Model cards (metadata, accuracy, version) are saved to the same directory.

---

## Real-Time Auto-Refresh (WebSocket)

The dashboards update in real time without page reload using Socket.IO:

- **backend** emits `ticket_created` when a new ticket is created.
- **backend** emits `ticket_updated` when a ticket status changes.
- **frontend** hook `useNotificationSocket` receives these events and
  debounces a `fetchTickets()` call with a 300 ms delay.

Socket.IO shares the same port as the Express API (default **3000**).  
Make sure `FRONTEND_URL` in the backend `.env` matches the browser origin so
the CORS handshake succeeds.

---

## Contact

**Project Manager:** Thomas Newcomb  
**Repository:** [capstone-project-blueclue](https://github.com/Georgia-Southwestern-State-Univeristy/capstone-project-blueclue)

**Last Updated:** February 13, 2026
