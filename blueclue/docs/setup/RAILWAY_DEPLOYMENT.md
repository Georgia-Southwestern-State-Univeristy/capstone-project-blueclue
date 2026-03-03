# Railway Deployment Guide

This guide walks you through deploying BlueClue on [Railway](https://railway.app).

---

## Overview

BlueClue runs as **4 separate Railway services** inside one project:

| Service | Root Directory | Build Method |
|---|---|---|
| `database` | — (Railway plug-in) | PostgreSQL add-on |
| `ml-service` | `blueclue/ai` | Dockerfile |
| `backend` | `blueclue/backend` | Dockerfile |
| `frontend` | `blueclue/frontend` | Dockerfile (multi-stage) |

---

## Step 1 — Create the Railway Project

1. Go to [railway.app](https://railway.app) and log in.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo** and select `capstone-project-blueclue`.
4. Railway will create the project. **Cancel or skip** adding a default service — you'll add services manually below.

---

## Step 2 — Add the PostgreSQL Database

1. Inside your project, click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway provisions the database automatically.
3. Click the **PostgreSQL** service → **Variables** tab.
4. Note the `DATABASE_URL` value — you'll paste it into the backend service.

---

## Step 3 — Add the ML Service

1. Click **+ New** → **GitHub Repo** → pick the repo again.
2. In the service settings, go to **Settings** → **Source**.
3. Set **Root Directory** to `blueclue/ai`.
4. Railway detects the `Dockerfile` automatically — no build command needed.
5. Go to **Variables** and add:

```
ML_ENV=production
ML_WORKERS=2
CONFIDENCE_THRESHOLD=0.5
CACHE_MAX_SIZE=1024
CACHE_TTL_SECONDS=3600
```

6. Railway auto-assigns a public URL. Copy it — you'll need it for the backend.

---

## Step 4 — Add the Backend Service

1. Click **+ New** → **GitHub Repo** → pick the repo.
2. Set **Root Directory** to `blueclue/backend`.
3. Railway detects the `Dockerfile` automatically.
4. Go to **Variables** and add the following (replace placeholder values):

```
NODE_ENV=production
PORT=3000

# Paste the full DATABASE_URL from the PostgreSQL service
DATABASE_URL=<paste from Step 2>

# Strong random string — generate with: openssl rand -hex 32
JWT_SECRET=<your-secret>

# The Railway public URL of the frontend service (fill in after Step 5)
FRONTEND_URL=https://<frontend-service>.up.railway.app

# The Railway internal URL of the ML service
# Format: http://<ml-service-name>.railway.internal:5000
AI_SERVICE_URL=http://<ml-service-name>.railway.internal:5000
AI_SERVICE_TIMEOUT=5000
AI_MAX_RETRIES=2

# Email (optional — skip for initial deployment)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your@gmail.com
# EMAIL_PASS=your-app-password
# EMAIL_FROM=BlueClue Support <noreply@blueclue.com>
```

5. Click **Deploy**.

---

## Step 5 — Add the Frontend Service

1. Click **+ New** → **GitHub Repo** → pick the repo.
2. Set **Root Directory** to `blueclue/frontend`.
3. Railway detects the `Dockerfile` automatically.
4. Go to **Variables** and add:

```
# The Railway public URL of the backend service
VITE_API_URL=https://<backend-service>.up.railway.app/api
```

> **Important**: `VITE_API_URL` is a **build-time** variable. Vite bakes it into
> the JS bundle. Changing it after deploy requires a **redeploy**.

5. Click **Deploy**.

---

## Step 6 — Wire Up Cross-Service URLs

After all services are deployed and have their public URLs:

1. **Backend → `FRONTEND_URL`**: Set to the frontend's public Railway URL.
2. **Backend → `AI_SERVICE_URL`**: Use the **private/internal** Railway URL for
   the ML service (avoids public internet, faster + free bandwidth).
   Format: `http://ml-service.railway.internal:5000`
   (Check the ML service's **Settings → Networking → Private Networking** for the exact hostname.)
3. **Frontend → `VITE_API_URL`**: Set to the backend's public URL + `/api`.
4. Redeploy both backend and frontend after updating variables.

---

## Step 7 — Run Database Migrations

After the PostgreSQL service is running:

1. In Railway, open the **backend** service.
2. Go to **Settings** → **Deploy** → use the **One-Off Command** or connect via the Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Log in
railway login

# Link to your project
railway link

# Run the schema against the Railway DB
railway run --service backend node -e "
const { Pool } = await import('pg');
// or just use psql:
"
```

Or connect directly with `psql` using the `DATABASE_URL` from the PostgreSQL service:

```bash
psql "<DATABASE_URL>" -f blueclue/database/schema.sql
psql "<DATABASE_URL>" -f blueclue/database/seed.sql
```

---

## Environment Variable Quick Reference

### Backend
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string from Railway |
| `JWT_SECRET` | ✅ | Strong random secret for JWT signing |
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Set to `3000` |
| `FRONTEND_URL` | ✅ | Frontend public URL (for CORS) |
| `AI_SERVICE_URL` | ✅ | ML service URL |
| `EMAIL_*` | ❌ | Optional email config |

### Frontend
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend public URL + `/api` |

### ML Service
| Variable | Required | Description |
|---|---|---|
| `ML_ENV` | ✅ | Set to `production` |
| `ML_WORKERS` | ❌ | Uvicorn workers (default 2) |
| `CONFIDENCE_THRESHOLD` | ❌ | Model confidence cutoff (default 0.5) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Frontend shows API errors | Check `VITE_API_URL` is correct and redeploy frontend |
| Backend can't reach ML service | Use the private Railway internal hostname |
| DB connection refused | Ensure `DATABASE_URL` is copied exactly from the PostgreSQL service |
| CORS errors | Set `FRONTEND_URL` in backend to the exact Railway frontend domain |
| ML models not loading | The `models/` directory is baked into the Docker image — make sure they're committed to git |
