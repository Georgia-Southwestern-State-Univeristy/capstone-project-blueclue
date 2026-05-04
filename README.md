# BlueClue — AI-Powered IT Support Ticketing System

> Georgia Southwestern State University · Capstone Project · Spring 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites & System Requirements](#3-prerequisites--system-requirements)
4. [Local Setup — All Services](#4-local-setup--all-services)
   - 4.1 [Database](#41-database)
   - 4.2 [Backend API](#42-backend-api)
   - 4.3 [AI / ML Service](#43-ai--ml-service)
   - 4.4 [Frontend](#44-frontend)
5. [Environment Variable Reference](#5-environment-variable-reference)
6. [Running the Full Stack](#6-running-the-full-stack)
7. [Docker Compose](#7-docker-compose)
8. [Deploying to Railway](#8-deploying-to-railway)
9. [User Guide](#9-user-guide)
10. [API Documentation](#10-api-documentation)
11. [Testing](#11-testing)
12. [Troubleshooting](#12-troubleshooting)
13. [Contributors](#13-contributors)

---

## 1. Project Overview

### Problem Statement

IT support teams at small-to-medium organisations spend a disproportionate amount of time on two low-value tasks: **manually sorting incoming tickets** into the right category/priority queue, and **answering repetitive questions** that already have documented solutions. Mis-categorised tickets delay response times, and staff-hours spent on FAQ-style questions are hours not spent on real incidents.

### What BlueClue Does

BlueClue is a full-stack IT support ticketing system that removes both bottlenecks:

1. **Automatic ticket classification.** Every submitted ticket is sent to an on-premise ML service that classifies it into one of 5 top-level categories (hardware, software, network, account, billing) and 24 subcategories with 93 % category accuracy, and assigns a priority level (low → critical) in under 200 ms.

2. **Intelligent chatbot.** Users can interact with a RAG (Retrieval-Augmented Generation) chatbot backed by the internal Knowledge Base. Common questions are resolved instantly; if the bot cannot help it either opens a ticket automatically or escalates to a live technician via real-time handoff.

3. **Role-based dashboards.** Customers, technicians, senior technicians, managers, and admins each see a tailored view — from "my open tickets" to organisation-wide analytics with SLA tracking, category heatmaps, and technician workload distribution.

### Key Capabilities

| Capability | Detail |
|---|---|
| AI classification | 93 % category accuracy, 67 % priority accuracy, <200 ms p95 |
| 24-subcategory taxonomy | Covers hardware/software/network/account/billing with subcats |
| Abbreviation expansion | "pc wont turn on" → hardware/computer |
| RAG chatbot (GPT-3.5-turbo) | Grounded answers with KB article citations |
| MiniLM fallback | Full chatbot function at $0 with no OpenAI key |
| JWT auth + refresh tokens | 15 min access / 7-day rotating refresh |
| Guest ticket submission | No account required |
| Real-time dashboards | Socket.IO — no page reload needed |
| Email-to-ticket pipeline | Inbound Mailgun emails create tickets automatically |
| SLA tracking | Response/resolution deadlines by priority |
| ML model management | Admin UI for retraining, drift detection, model cards |

---

## 2. Architecture

```
Browser
  │
  ▼
┌─────────────────────────────────┐   port 5173 (dev) / 80 (prod)
│  Frontend  (React + Vite)       │
│  Tailwind CSS · React Router    │
│  Socket.IO client               │
└──────────────┬──────────────────┘
               │ HTTP REST + Socket.IO
               ▼
┌─────────────────────────────────┐   port 3000
│  Backend API  (Node.js/Express) │
│  Passport · JWT · Multer        │
│  Socket.IO server               │
│  node-cron scheduled jobs       │
└────────┬───────────┬────────────┘
         │           │
         │ psql      │ HTTP
         ▼           ▼
┌──────────────┐  ┌──────────────────────────────────┐
│  PostgreSQL  │  │  ML Inference Service (FastAPI)   │
│  pgvector    │  │  scikit-learn · SHAP · spaCy      │
│  (port 5432) │  │  sentence-transformers            │
└──────────────┘  │  (port 5000)                      │
                  └──────────────────────────────────┘
```

- **Interactive HTML architecture diagram:** [`blueclue/docs/architecture/backend-architecture.html`](blueclue/docs/architecture/backend-architecture.html) (open in a browser)
- **ER Diagram (PNG):** [`blueclue/docs/architecture/er diagram.png`](blueclue/docs/architecture/er%20diagram.png)
- **ER Diagram (DBML source):** [`blueclue/docs/architecture/er-diagram.dbml`](blueclue/docs/architecture/er-diagram.dbml)

### Service responsibilities

| Service | Language / Framework | Responsibility |
|---|---|---|
| **Frontend** | React 19 + Vite + Tailwind | All UI: ticket forms, dashboards, chat widget, admin panels |
| **Backend** | Node.js 20 + Express 5 | REST API, auth, business logic, Socket.IO, email queue, cron jobs |
| **ML Service** | Python 3.12 + FastAPI | Ticket classification, SHAP explanations, resolution-time prediction |
| **Database** | PostgreSQL 14+ | All persistent data; pgvector extension for KB embeddings |

---

## 3. Prerequisites & System Requirements

### Required software

| Tool | Version | Install |
|---|---|---|
| Node.js (includes npm) | 20.x LTS | [nodejs.org](https://nodejs.org/) |
| Python | 3.12.x | [python.org](https://www.python.org/) |
| PostgreSQL | 14.x+ | [postgresql.org](https://www.postgresql.org/download/) |
| Git | 2.x+ | [git-scm.com](https://git-scm.com/) |

### Verify installations

```bash
node --version   # v20.x.x
npm --version    # 10.x.x
python --version # Python 3.12.x
psql --version   # psql (PostgreSQL) 14.x
git --version    # git version 2.x.x
```

### Minimum hardware

| Resource | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 16 GB |
| Free disk | 2 GB | 5 GB |
| CPU | Dual-core | Quad-core |

Operating systems: Windows 10/11, macOS 10.15+, Ubuntu 20.04+.

---

## 4. Local Setup — All Services

### Clone the repository

```bash
git clone https://github.com/Georgia-Southwestern-State-Univeristy/capstone-project-blueclue.git
cd capstone-project-blueclue
```

All service directories live inside `blueclue/`.

---

### 4.1 Database

> **Complete this step first.** Backend and AI service fail to start without the database.

```powershell
cd blueclue/database

# Windows — automated setup
.\SETUP.ps1
```

The script:
1. Drops and recreates the `blueclue` database
2. Applies `schema.sql` (tables, ENUMs, indexes, triggers)
3. Applies `auth_setup.sql` (RBAC system, refresh tokens table, 7 staff accounts — all with password `admin123`, force-change on first login)
4. Applies all feature migrations (themes, pgvector/RAG, chat, attachments, ML monitoring, etc.)
5. Loads `seed.sql` (sample customer accounts with password `BlueClue2026!`)
6. Prompts to optionally reset the admin password and create a `manager@blueclue.com` account

Accounts created by `auth_setup.sql`:

| Username | Email | Role |
|---|---|---|
| `tnewc` | tnewc@blueclue.com | technician |
| `cmcgo` | cmcgo@blueclue.com | technician |
| `jwill` | jwill@blueclue.com | technician |
| `mjohnson` | mjohnson@blueclue.com | senior_technician |
| `ebrown` | ebrown@blueclue.com | senior_technician |
| `jdoe` | jdoe@blueclue.com | management |
| `ssmith` | ssmith@blueclue.com | management |

**Verify:**
```bash
psql -U postgres -d blueclue -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

**Manual setup** (if the script fails): see [`blueclue/database/README.md`](blueclue/database/README.md).

---

### 4.2 Backend API

```bash
cd blueclue/backend
npm install
```

Create `blueclue/backend/.env` (see [Section 5](#5-environment-variable-reference) for all variables):

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PG_PASSWORD@localhost:5432/blueclue
JWT_SECRET=change-me-at-least-32-chars
JWT_REFRESH_SECRET=change-me-different-secret
AI_SERVICE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

Start in development mode (nodemon auto-restart):
```bash
npm run dev
# → Server listening on http://localhost:3000
```

Verify:
```bash
curl http://localhost:3000/api/auth/health
# → {"status":"ok"}
```

---

### 4.3 AI / ML Service

```bash
cd blueclue/ai
```

**Create and activate a virtual environment:**
```bash
# Windows
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Download the spaCy model** (one-time, ~12 MB):
```bash
python -m spacy download en_core_web_sm
```

Create `blueclue/ai/.env` (see [Section 5](#5-environment-variable-reference)):

```env
ML_SERVICE_PORT=5000
ML_SERVICE_HOST=0.0.0.0
ML_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PG_PASSWORD@localhost:5432/blueclue
# OPENAI_API_KEY=sk-...   # optional — chatbot works without it via MiniLM
```

**Start the service (FastAPI / uvicorn):**
```bash
# Recommended
uvicorn app:app --host 0.0.0.0 --port 5000 --reload

# Shortcut (calls uvicorn internally)
python app.py
# → Uvicorn running on http://0.0.0.0:5000
```

**Smoke-test:**
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"My laptop won\'t turn on\"}"
# → {"category":"hardware","priority":"high","confidence":0.91,...}
```

---

### 4.4 Frontend

```bash
cd blueclue/frontend
npm install
```

Create `blueclue/frontend/.env` (optional — defaults work for local dev):

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

Start the dev server:
```bash
npm run dev
# → Local: http://localhost:5173
```

---

## 5. Environment Variable Reference

### 5.1 Backend (`blueclue/backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the Express server listens on |
| `NODE_ENV` | Yes | — | `development` or `production`. Controls error verbosity and cookie flags |
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/blueclue` |
| `DB_HOST` | Alt | `localhost` | Used if `DATABASE_URL` is not set |
| `DB_PORT` | Alt | `5432` | Used if `DATABASE_URL` is not set |
| `DB_NAME` | Alt | `blueclue` | Used if `DATABASE_URL` is not set |
| `DB_USER` | Alt | `postgres` | Used if `DATABASE_URL` is not set |
| `DB_PASSWORD` | Alt | — | Used if `DATABASE_URL` is not set |
| `JWT_SECRET` | Yes | — | HMAC-SHA-256 secret for signing access tokens. Must be ≥32 random chars |
| `JWT_REFRESH_SECRET` | Yes | — | Separate secret for refresh tokens. Must differ from `JWT_SECRET` |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime (e.g. `15m`, `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `AI_SERVICE_URL` | Yes | — | Base URL of the ML service, e.g. `http://localhost:5000` |
| `AI_SERVICE_TIMEOUT` | No | `5000` | Milliseconds before falling back to rule-based classification |
| `AI_MAX_RETRIES` | No | `2` | Number of retry attempts before fallback |
| `FRONTEND_URL` | Yes | — | Browser origin of the frontend (used for CORS and Socket.IO). e.g. `http://localhost:5173` |
| `MAILGUN_API_KEY` | No | — | Mailgun API key for outbound email. Email features disabled if unset |
| `MAILGUN_DOMAIN` | No | — | Mailgun sending domain, e.g. `mail.yourdomain.com` |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | No | — | Validates inbound Mailgun webhook signatures (HMAC-SHA-256) |
| `USE_EMAIL_QUEUE` | No | `false` | Set `true` to enable async email queue with retry/backoff instead of direct send |
| `UPLOAD_MAX_SIZE_MB` | No | `10` | Max attachment size in megabytes |

### 5.2 AI / ML Service (`blueclue/ai/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ML_SERVICE_PORT` | No | `5000` | Uvicorn listen port |
| `ML_SERVICE_HOST` | No | `0.0.0.0` | Uvicorn bind address |
| `ML_ENV` | No | `development` | `development` or `production`. Controls log level and reload |
| `ML_WORKERS` | No | `2` | Number of uvicorn worker processes (production only) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection for KB article embeddings and RAG retrieval |
| `OPENAI_API_KEY` | No | — | OpenAI API key. If absent, the service falls back to the free local `sentence-transformers/all-MiniLM-L6-v2` model for embeddings and disables GPT generation |
| `LLM_MODEL` | No | `gpt-3.5-turbo` | OpenAI chat model used for RAG response generation |
| `CONFIDENCE_THRESHOLD` | No | `0.5` | Minimum confidence for ML predictions; below this the rule-based fallback is used |
| `CACHE_MAX_SIZE` | No | `1024` | Maximum number of entries in the in-process TTL-LRU classification cache |
| `CACHE_TTL_SECONDS` | No | `3600` | Cache entry lifetime in seconds |

### 5.3 Frontend (`blueclue/frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3000/api` | Backend REST API base URL (must be accessible from the user's browser) |
| `VITE_SOCKET_URL` | No | `http://localhost:3000` | Socket.IO server URL for real-time dashboard updates |

---

## 6. Running the Full Stack

Open three separate terminal windows and start each service:

| Terminal | Commands | URL |
|---|---|---|
| **1 — ML Service** | `cd blueclue/ai` → activate venv → `python app.py` | http://localhost:5000 |
| **2 — Backend** | `cd blueclue/backend` → `npm run dev` | http://localhost:3000 |
| **3 — Frontend** | `cd blueclue/frontend` → `npm run dev` | http://localhost:5173 |

**Startup order matters:** the backend health-checks the ML service on startup; start the ML service first.

### Quick-start script (Windows)

```powershell
cd blueclue/docs/setup
.\start-dev.ps1
```

Opens three separate PowerShell windows and starts each service automatically.

### Service URLs at a glance

| URL | What you get |
|---|---|
| http://localhost:5173 | BlueClue web app |
| http://localhost:3000/api | Backend REST API |
| http://localhost:3000/api/auth/health | Backend health check |
| http://localhost:5000/health | ML service health check |
| http://localhost:5000/docs | ML service interactive API docs (Swagger UI) |

---

## 7. Docker Compose

The `docker-compose.yml` at the repo root builds and runs the **ML service** and **backend** together. PostgreSQL must be reachable externally (local install or Railway).

```bash
# Copy environment template if present
cp .env.example .env   # or create .env manually

# Required .env keys for Docker Compose
# DATABASE_URL=postgresql://...
# JWT_SECRET=...
# FRONTEND_URL=http://localhost:5173

# Build and start
docker compose up --build

# Start only the ML service
docker compose up ml-service

# Tear down
docker compose down
```

**Hot-swap models without rebuilding:** the models directory is bind-mounted at `./blueclue/ai/models:/app/models`. Drop updated `.pkl` files there and restart the container — no rebuild needed.

The `frontend` block is commented out in `docker-compose.yml`. Uncomment it to build and serve the React app from nginx inside Docker.

---

## 8. Deploying to Railway

### Why Railway?

Railway was chosen for three reasons:

1. **Monorepo-friendly.** Each service sets its own *Root Directory* inside the shared repo; Railway's build system handles the rest. No separate repos needed.
2. **Zero-config PostgreSQL plugin.** The managed Postgres add-on injects `${{Postgres.DATABASE_URL}}` as an environment variable automatically — no connection string wrangling.
3. **Dockerfile-based deploys.** Every service already has a `Dockerfile`. Railway picks it up with no additional configuration file, keeping local development and production identical.

### Service layout

Create four services in the Railway project dashboard and configure *Settings → Source → Root Directory* for each:

| Railway service | Root Directory | Build method |
|---|---|---|
| `database` | — | PostgreSQL plugin (add via **+ New → Database → PostgreSQL**) |
| `ml-service` | `blueclue/ai` | Dockerfile |
| `backend` | `blueclue/backend` | Dockerfile |
| `frontend` | `blueclue/frontend` | Dockerfile (multi-stage nginx) |

### Environment variables per service

Set these in **Settings → Variables** for each Railway service:

#### `backend`

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Strong random string (≥32 chars) |
| `JWT_REFRESH_SECRET` | Different strong random string |
| `AI_SERVICE_URL` | Internal URL of the `ml-service` Railway service |
| `FRONTEND_URL` | Public URL of the `frontend` Railway service |
| `NODE_ENV` | `production` |
| `MAILGUN_API_KEY` | Your Mailgun key (optional) |
| `MAILGUN_DOMAIN` | Your Mailgun domain (optional) |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Your Mailgun webhook key (optional) |
| `USE_EMAIL_QUEUE` | `true` (recommended for production) |

#### `ml-service`

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ML_ENV` | `production` |
| `ML_WORKERS` | `2` |
| `OPENAI_API_KEY` | Your OpenAI key (optional — chatbot works without it) |

#### `frontend`

| Variable | Value |
|---|---|
| `VITE_API_URL` | Public URL of the `backend` Railway service + `/api` |
| `VITE_SOCKET_URL` | Public URL of the `backend` Railway service |

### Database seed on first deploy

After the PostgreSQL plugin is provisioned, open the Railway shell for `backend` and run:

```bash
# From the backend container shell
psql $DATABASE_URL -f /app/../../database/schema.sql
psql $DATABASE_URL -f /app/../../database/auth_setup.sql
psql $DATABASE_URL -f /app/../../database/seed.sql
```

Or connect to the Railway DB from your local machine using the *Connect* tab and run the SQL files directly.

For a full step-by-step walkthrough see [`blueclue/docs/setup/RAILWAY_DEPLOYMENT.md`](blueclue/docs/setup/RAILWAY_DEPLOYMENT.md).

---

## 9. User Guide

Default credentials for testing:

| Role | Email | Password | Notes |
|---|---|---|---|
| Technician | `tnewc@blueclue.com`, `cmcgo@blueclue.com`, `jwill@blueclue.com` | `admin123` | Must change password on first login |
| Senior Technician | `mjohnson@blueclue.com`, `ebrown@blueclue.com` | `admin123` | Must change password on first login |
| Management | `jdoe@blueclue.com`, `ssmith@blueclue.com` | `admin123` | Must change password on first login |
| Customer (sample) | `mike.chen@startupxyz.io`, `emily.rodriguez@freelance.net` | `BlueClue2026!` | From seed.sql |
| Admin | `admin@blueclue.com` | `BlueClue2026!` | Only if you chose yes at the SETUP.ps1 admin-reset prompt |
| Guest | — | No login required | — |

---

### 9.1 Submit a Support Ticket

**As a logged-in customer:**
1. Log in at the top-right corner, then navigate to **Submit a Ticket**.
2. Fill in **Subject** (required) and **Description** (required, at least a sentence).
3. Optionally select **Category** and **Priority** from the dropdowns — or leave both as *Auto* to let the AI decide.
4. Attach files if needed (max 10 MB each).
5. Click **Submit**. You'll receive a ticket number in the format `TICK-2026-XXXXX`.
6. The AI automatically classifies the ticket; if you provided a priority it will be respected over the AI's suggestion.

**As a guest (no account):**
1. Click **Submit a Ticket** from the landing page — no login required.
2. Provide your name, email, subject, and description.
3. You'll receive your ticket number and status updates by email.

---

### 9.2 Use the AI Chatbot

1. Click the **chat bubble** in the bottom-right corner of any page.
2. Type your question in natural language, e.g. *"How do I reset my VPN password?"*.
3. The bot searches the Knowledge Base using RAG and replies with a cited answer and a **Source** link.
4. If the bot can't resolve your issue it will offer to **create a ticket** for you automatically — the ticket will be fully classified by the AI.
5. If you need a human, type *"talk to a technician"* or click **Escalate**. A live technician will be notified and can join the conversation.

> **Tip:** The chatbot works even without an OpenAI key — it uses a local embedding model and rule-based responses in that mode, but KB search still works.

---

### 9.3 Search the Knowledge Base

1. Navigate to **Knowledge Base** from the top navigation.
2. Type keywords or a full question in the search bar. Results are ranked by semantic similarity (vector search), not just keyword match.
3. Click any article title to read the full content.
4. Articles can be bookmarked by logged-in users.

---

### 9.4 Manage Tickets (Technician)

1. Log in with a technician account (`tnewc`, `cmcgo`, or `jwill`).
2. The **Technician Dashboard** shows your assigned tickets grouped by status (Open, In Progress, Resolved).
3. Click a ticket to open its detail view:
   - Change **Status** via the dropdown (Open → In Progress → Resolved → Closed).
   - Add **internal notes** (not visible to the customer).
   - Add a **customer-visible reply** via *Add Response*.
   - **Reassign** the ticket (senior technicians and above only).
4. The AI classification fields (`category`, `priority`, `confidence`) are shown read-only at the top of the ticket — click **Re-classify** to trigger a fresh AI analysis.
5. The SLA timer counts down in the header — tickets near breach are highlighted in red.

---

### 9.5 Manage Technicians and Analytics (Management)

1. Log in with a management account.
2. The **Management Dashboard** shows:
   - All open/in-progress/resolved tickets across the organisation.
   - **Category heatmap** — volume by category and hour of day.
   - **SLA compliance** rate and breach tracking.
   - **Technician workload** table showing open-ticket counts per tech.
3. Navigate to **Manage Technicians** to:
   - Create or deactivate technician accounts.
   - Promote a technician to *senior_technician*.
   - View per-technician resolution metrics.
4. Navigate to **Analytics** for trend charts (tickets per day, avg resolution time, chatbot deflection rate).

---

### 9.6 ML Admin Panel (Admin / Management)

1. Log in as `admin` or a management account.
2. Navigate to **Admin → ML Models**.
3. The panel shows:
   - Current deployed model version and accuracy metrics.
   - Recent classification confidence distribution.
   - Drift alerts (when production confidence drops below threshold).
4. To retrain models from fresh labelled data:
   ```bash
   cd blueclue/ai
   source venv/bin/activate   # or .\venv\Scripts\Activate.ps1
   python scripts/export_training_data.py
   python scripts/prepare_ml_data.py
   python scripts/retrain_pipeline.py
   python test_accuracy.py
   ```
   Artefacts are saved to `blueclue/ai/models/`. Upload to production by uploading the `.pkl` files (or via the bind-mount volume in Docker).

---

## 10. API Documentation

Full REST API reference with request/response examples: [`blueclue/docs/api/endpoints.md`](blueclue/docs/api/endpoints.md)

The ML service exposes interactive Swagger UI docs at runtime: http://localhost:5000/docs

### Quick reference — most-used endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | None | Log in; returns `accessToken` + `refreshToken` |
| `POST` | `/api/auth/refresh` | Refresh cookie | Issue new access token |
| `GET` | `/api/tickets` | Bearer | List tickets (filtered by role) |
| `POST` | `/api/tickets` | Bearer / Guest | Create a ticket |
| `PATCH` | `/api/tickets/:id/status` | Bearer (tech+) | Update ticket status |
| `POST` | `/api/chat` | Bearer | Send a chat message; returns RAG response |
| `GET` | `/api/kb/search?q=` | None | Semantic KB search |
| `GET` | `/api/analytics/overview` | Bearer (mgmt+) | Dashboard analytics data |
| `POST` | `/classify` *(ML service)* | None | Classify ticket text (category + priority) |
| `GET` | `/health` *(ML service)* | None | ML service health + uptime |

For Postman: import `blueclue/backend/postman/BlueClue-Tickets-API.postman_collection.json` and set the `base_url` variable to `http://localhost:3000/api`.

---

## 11. Testing

### Run all AI tests
```bash
cd blueclue/ai
source venv/bin/activate   # or .\venv\Scripts\Activate.ps1

# Full pytest suite (unit + integration + chat quality)
pytest tests/ -v

# Load test — 100 concurrent classify requests
python tests/test_load.py

# Accuracy report against the 57-case golden dataset
python test_accuracy.py
```

Expected: ~93 % category accuracy, ~67 % priority accuracy.

### Run backend tests
```bash
cd blueclue/backend
npm test
```

### Run backend integration smoke-test
```bash
node test-ai-integration.js
```

### Testing report
Complete documented test results for all 63 test cases: [`blueclue/docs/testing_report.txt`](blueclue/docs/testing_report.txt)

---

## 12. Troubleshooting

### Database connection refused
```
Error: ECONNREFUSED  /  password authentication failed
```
1. Confirm PostgreSQL is running: `services.msc` (Windows) or `sudo systemctl status postgresql`.
2. Check `DATABASE_URL` (or `DB_PASSWORD`) in `backend/.env`.
3. Verify the database exists: `psql -U postgres -l | findstr blueclue`.

### AI service unavailable
```
Backend: "AI classification service unavailable — using fallback"
```
1. Is the ML service running on port 5000? Check the terminal.
2. Is the virtual environment activated? (`.\venv\Scripts\Activate.ps1`)
3. Does `AI_SERVICE_URL` in `backend/.env` match the running address?

### Port already in use
```bash
# Windows — find and kill the process on port 3000
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

### spaCy model not found
```
Can't find model 'en_core_web_sm'
```
```bash
cd blueclue/ai && .\venv\Scripts\Activate.ps1
python -m spacy download en_core_web_sm
```

### npm install failures
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Frontend can't reach the backend (CORS error)
Ensure `FRONTEND_URL` in `backend/.env` exactly matches the browser origin (including port), e.g. `http://localhost:5173`.

---

## 13. Contributors

| Name | Role |
|---|---|
| **Thomas Newcomb** | Project Manager · AI/ML Engineer |
| **Jacob Williams** | Frontend Developer |
| **Clayton McGough** | Backend Developer |

**Repository:** [Georgia-Southwestern-State-Univeristy/capstone-project-blueclue](https://github.com/Georgia-Southwestern-State-Univeristy/capstone-project-blueclue)

**Last updated:** May 3, 2026
