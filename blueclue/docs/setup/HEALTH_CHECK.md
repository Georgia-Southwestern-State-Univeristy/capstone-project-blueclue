# Health Check Endpoint - Railway Integration Guide

## Overview
The `/api/health` endpoint provides comprehensive monitoring of all critical dependencies in the BlueClue application.

## Endpoint Details
- **URL**: `GET /api/health`
- **Response Time**: < 2 seconds (typically 300-500ms)
- **HTTP Status Codes**:
  - `200 OK`: Overall health is "ok" or "degraded"
  - `503 Service Unavailable`: Overall health is "down"

## Response Format
```json
{
  "status": "ok" | "degraded" | "down",
  "timestamp": "2026-03-25T22:15:30.078Z",
  "total_latency_ms": 323,
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 12
    },
    "ai_service": {
      "status": "ok",
      "latency_ms": 45
    },
    "email": {
      "status": "ok",
      "latency_ms": 250
    },
    "cache": {
      "status": "ok",
      "latency_ms": 0,
      "message": "In-memory cache is always available"
    }
  }
}
```

## Health Status Logic

### Overall Status
- **ok**: All dependencies are healthy
- **degraded**: Some dependencies are down but service can still operate
  - AI service down: Service runs with rule-based fallback
  - Email service down: Emails are queued for retry
- **down**: Critical dependencies are unavailable
  - Database down: Service cannot operate

### Dependency Checks

#### 1. Database (PostgreSQL)
- **Check**: Executes `SELECT 1` query
- **Timeout**: 1500ms
- **Criticality**: CRITICAL - Service cannot operate without database
- **Status**:
  - `ok`: Database responds successfully
  - `down`: Database connection failed or query timed out

#### 2. AI Service (Python ML Service)
- **Check**: Calls `GET /health` on AI service
- **Timeout**: 1500ms
- **Criticality**: NON-CRITICAL - Service has rule-based fallback
- **Status**:
  - `ok`: AI service responds with healthy status
  - `down`: AI service unreachable or unhealthy

#### 3. Email Service (Mailgun SMTP)
- **Check**: Verifies SMTP connection using nodemailer
- **Timeout**: 1500ms
- **Criticality**: NON-CRITICAL - Emails are queued for retry
- **Status**:
  - `ok`: SMTP connection verified
  - `down`: SMTP connection failed or timed out

#### 4. Cache (In-Memory)
- **Check**: Always returns OK (in-memory, always available)
- **Timeout**: N/A
- **Criticality**: NON-CRITICAL
- **Status**: Always `ok`

## Railway Configuration

### 1. Health Check Settings
Configure Railway to monitor the health endpoint:

**Via Railway Dashboard**:
1. Go to your service in Railway dashboard
2. Navigate to "Settings" → "Health Checks"
3. Configure:
   - **Health Check Path**: `/api/health`
   - **Health Check Timeout**: 5 seconds
   - **Health Check Interval**: 30 seconds
   - **Health Check Unhealthy Threshold**: 3 consecutive failures

**Via railway.toml** (recommended):
```toml
[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 5
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[healthCheck]
path = "/api/health"
interval = 30
timeout = 5
unhealthyThreshold = 3
```

### 2. Environment Variables
Ensure these environment variables are set in Railway:

```bash
# Database (automatically provided by Railway PostgreSQL)
DATABASE_URL=postgresql://...

# AI Service (set to your Python service URL)
AI_SERVICE_URL=https://your-ai-service.railway.app

# Email Service (Mailgun/SMTP)
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@your-domain.com
EMAIL_PASS=your-mailgun-password

# Application
NODE_ENV=production
USE_EMAIL_QUEUE=true
```

### 3. Monitoring Best Practices

#### Alert on Sustained Degradation
The health check returns `200 OK` even when degraded to avoid unnecessary restarts. However, you should monitor for:
- **Sustained "degraded" status** for > 5 minutes
- **AI service down** consistently
- **Email service down** consistently

#### Expected Statuses by Environment

**Production (Railway)**:
- Expected: `status: "ok"` with all checks passing
- Acceptable: `status: "degraded"` with AI service down (temporary outages)
- Alert: `status: "degraded"` for > 5 minutes
- Critical: `status: "down"` (database failure)

**Development (Local)**:
- Expected: `status: "degraded"` with AI service down (if not running locally)
- Acceptable: `status: "ok"` if all services running locally

### 4. Validating Deployment

After deploying to Railway, validate the health check:

```bash
# Check health endpoint
curl https://your-app.railway.app/api/health | jq

# Expected response (successful deployment)
{
  "status": "ok",
  "timestamp": "2026-03-25T22:15:30.078Z",
  "total_latency_ms": 123,
  "checks": {
    "database": { "status": "ok", "latency_ms": 45 },
    "ai_service": { "status": "ok", "latency_ms": 67 },
    "email": { "status": "ok", "latency_ms": 89 },
    "cache": { "status": "ok", "latency_ms": 0 }
  }
}
```

### 5. Troubleshooting

#### Health Check Returns "down"
1. Check Railway logs: `railway logs`
2. Verify environment variables are set correctly
3. Check database connection: Test `DATABASE_URL` manually
4. Verify AI service is deployed and running
5. Test email credentials with nodemailer verify

#### Response Time > 2 seconds
1. Check database connection latency
2. Verify AI service response time
3. Test SMTP server latency
4. Consider increasing timeout values

#### Intermittent Failures
1. Check for database connection pooling issues
2. Verify network stability between services
3. Review Railway service logs for connection errors
4. Consider increasing unhealthy threshold to 5

## Testing

### Manual Testing
```bash
# Test local health check
node test-health-check.js

# Test Railway deployment
curl https://your-app.railway.app/api/health
```

### Automated Testing
The health check endpoint is automatically tested in the test suite:

```bash
npm test # Includes health check validation
```

## Acceptance Criteria Checklist

- [x] GET /api/health returns structured response
- [x] Checks database connectivity
- [x] Checks AI service reachability
- [x] Checks email service availability
- [x] Checks cache status
- [x] Each dependency reports status: "ok" | "degraded" | "down"
- [x] Each dependency reports latency_ms
- [x] Overall health is degraded or down if any dependency is not ok
- [x] Endpoint responds within 2 seconds even if dependency is slow
- [x] Ready for Railway health check integration

## Additional Resources
- Railway Health Check Documentation: https://docs.railway.app/deploy/healthchecks
- BlueClue Health Check Service: `src/services/healthCheckService.js`
- Health Check Test Script: `test-health-check.js`
