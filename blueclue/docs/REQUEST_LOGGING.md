# Request Logging & Performance Analytics

## Overview

The request logging system provides comprehensive performance monitoring for all API endpoints. It automatically records request metadata, response times, and provides analytics dashboards for identifying slow endpoints and high-traffic areas.

## Features

✅ **Automatic Request Logging**
- Captures all API requests (except health checks)
- Records: endpoint, method, status code, response time, user, IP, user agent
- Minimal overhead (<1ms per request)
- Async database writes (non-blocking)

✅ **Sensitive Data Protection**
- Automatically redacts passwords, tokens, API keys, secrets
- Sanitizes query parameters before storage
- Never logs request/response bodies

✅ **Performance Analytics**
- Top 10 slowest endpoints
- Top 10 most called endpoints
- Error rate analysis
- Response time percentiles (median, P95, P99)
- Time series data (requests per day)

✅ **Smart Route Grouping**
- Normalizes dynamic routes: `/api/tickets/123` → `/api/tickets/:id`
- Groups similar requests for aggregate analysis
- Handles UUIDs, emails, and numeric IDs

## Database Schema

### `request_logs` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `endpoint` | VARCHAR(500) | Full request path |
| `method` | VARCHAR(10) | HTTP method (GET, POST, etc.) |
| `base_route` | VARCHAR(200) | Normalized route pattern |
| `status_code` | INTEGER | HTTP status code (100-599) |
| `response_time_ms` | INTEGER | Response time in milliseconds |
| `user_id` | INTEGER | Foreign key to users (nullable) |
| `ip_address` | INET | Client IP address |
| `user_agent` | TEXT | Browser/client info |
| `error_message` | TEXT | Error message for failed requests |
| `query_params` | JSONB | Sanitized query parameters |
| `timestamp` | TIMESTAMPTZ | Request timestamp |

**Indexes:**
- `idx_request_logs_response_time` - For slowest queries
- `idx_request_logs_base_route` - For endpoint grouping
- `idx_request_logs_timestamp` - For recent logs
- `idx_request_logs_route_time` - Composite for time-series
- `idx_request_logs_errors` - Filtered for error analysis
- `idx_request_logs_user_time` - User activity tracking

### `request_logs_analytics` Materialized View

Pre-computed analytics for fast dashboard queries:
- Total requests per endpoint
- Average, median, P95, P99 response times
- Error counts (4xx, 5xx)
- Last request timestamp
- Automatically refreshes (or manual via API)

## API Endpoints

All analytics endpoints require **admin authentication**.

### Get Slowest Endpoints
```http
GET /api/admin/analytics/requests/slowest?days=7
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "base_route": "/api/tickets/:id",
      "total_requests": 1523,
      "avg_response_time_ms": 245,
      "median": 180,
      "p95": 520,
      "p99": 780,
      "max_response_time_ms": 1200,
      "error_count": 12
    }
  ],
  "metadata": {
    "timeframe_days": 7,
    "generated_at": "2025-01-29T12:00:00Z"
  }
}
```

### Get Most Called Endpoints
```http
GET /api/admin/analytics/requests/most-called?days=7
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "base_route": "/api/notifications",
      "total_requests": 8432,
      "avg_response_time_ms": 45,
      "median": 38,
      "p95": 85,
      "error_count": 3,
      "last_request_at": "2025-01-29T11:58:32Z"
    }
  ]
}
```

### Get Error Analysis
```http
GET /api/admin/analytics/requests/errors?days=7
```

**Response:**
```json
{
  "success": true,
  "data": {
    "endpoints_with_errors": [
      {
        "base_route": "/api/tickets/:id",
        "total_requests": 1523,
        "error_count": 45,
        "error_rate_percent": 2.95
      }
    ],
    "error_breakdown_by_status": [
      { "status_code": 404, "count": 234, "avg_response_time_ms": 12 },
      { "status_code": 500, "count": 15, "avg_response_time_ms": 450 }
    ]
  }
}
```

### Get Performance Summary
```http
GET /api/admin/analytics/requests/summary?days=7
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_requests": 45321,
      "avg_response_time_ms": 78,
      "median_response_time_ms": 45,
      "p95_response_time_ms": 230,
      "p99_response_time_ms": 520,
      "error_count": 432,
      "server_error_count": 23,
      "unique_endpoints": 45,
      "unique_users": 234
    },
    "requests_per_day": [
      {
        "date": "2025-01-29",
        "request_count": 6543,
        "avg_response_time_ms": 82,
        "error_count": 54
      }
    ],
    "method_distribution": [
      { "method": "GET", "count": 32145, "avg_response_time_ms": 65 },
      { "method": "POST", "count": 8932, "avg_response_time_ms": 125 }
    ]
  }
}
```

### Get Endpoint Details
```http
GET /api/admin/analytics/requests/endpoint?base_route=/api/tickets/:id&days=7&limit=100
```

**Note:** The `base_route` is passed as a query parameter. URL encode special characters if needed.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "endpoint": "/api/tickets/789",
      "method": "GET",
      "status_code": 200,
      "response_time_ms": 145,
      "user_id": 42,
      "error_message": null,
      "timestamp": "2025-01-29T11:45:23Z"
    }
  ],
  "metadata": {
    "base_route": "/api/tickets/:id",
    "timeframe_days": 7,
    "total_results": 100
  }
}
```

### Refresh Analytics View
```http
POST /api/admin/analytics/requests/refresh
```

**Response:**
```json
{
  "success": true,
  "message": "Analytics view refreshed successfully",
  "refreshed_at": "2025-01-29T12:00:00Z"
}
```

## Installation

### 1. Apply Migration
```bash
# Local database
psql -U postgres -d blueclue -f blueclue/database/migrations/045_add_request_logs.sql

# Railway database
psql "postgresql://postgres:...@caboose.proxy.rlwy.net:49258/railway" -f blueclue/database/migrations/045_add_request_logs.sql
```

### 2. Verify Installation
```sql
-- Check table exists
SELECT COUNT(*) FROM request_logs;

-- Check indexes (should return 7)
SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'request_logs';

-- Check materialized view
SELECT * FROM request_logs_analytics;
```

### 3. Test Logging
```bash
# Start server
cd blueclue/backend
npm run dev

# Run performance test (in new terminal)
node test-request-logging.js
```

### 4. Verify Logs in Database
```sql
-- View recent logs
SELECT 
    endpoint,
    method,
    base_route,
    status_code,
    response_time_ms,
    timestamp
FROM request_logs
ORDER BY timestamp DESC
LIMIT 10;

-- Check sensitive data filtering
SELECT 
    endpoint,
    query_params
FROM request_logs
WHERE query_params::text LIKE '%REDACTED%';

-- View analytics
SELECT * FROM request_logs_analytics
ORDER BY p95 DESC;
```

## Configuration

### Environment Variables

```bash
# Disable request logging (default: enabled)
ENABLE_REQUEST_LOGGING=false
```

### Adjust Batch Settings

Edit `src/middleware/requestLogger.js`:

```javascript
const LOG_BATCH_SIZE = 100;           // Increase for high-volume
const LOG_FLUSH_INTERVAL_MS = 5000;   // Flush frequency
```

## Maintenance

### Data Retention

Current policy: **90 days** (documented in migration)

**Option 1: Manual Cleanup**
```sql
DELETE FROM request_logs 
WHERE timestamp < NOW() - INTERVAL '90 days';
```

**Option 2: Automated Job** (recommended)

Create `src/jobs/requestLogCleanupJob.js`:
```javascript
import cron from 'node-cron';
import pool from '../config/database.js';

export function startRequestLogCleanupJob() {
    // Run daily at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            const result = await pool.query(`
                DELETE FROM request_logs 
                WHERE timestamp < NOW() - INTERVAL '90 days'
            `);
            console.log(`Cleaned up ${result.rowCount} old request logs`);
        } catch (error) {
            console.error('Request log cleanup failed:', error);
        }
    });
}
```

### Refresh Analytics View

**Automatic (Recommended):**
Create scheduled job to refresh every 5 minutes:
```javascript
import cron from 'node-cron';

cron.schedule('*/5 * * * *', async () => {
    await pool.query('REFRESH MATERIALIZED VIEW request_logs_analytics');
});
```

**Manual:**
```bash
curl -X POST http://localhost:3000/api/admin/analytics/requests/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Performance Considerations

### Middleware Overhead
- Target: <1ms per request
- Achieved via async logging and batch inserts
- Database writes happen in background (non-blocking)

### Database Performance
- 7 specialized indexes for fast queries
- Materialized view for dashboard (no expensive aggregations)
- Partitioning ready (see migration comments for monthly partitions)

### Scaling Recommendations

**For high traffic (>1000 req/min):**
1. Increase `LOG_BATCH_SIZE` to 500
2. Consider table partitioning by month
3. Use read replicas for analytics queries
4. Implement log sampling (e.g., log 10% of requests)

**For large datasets (>10M rows):**
1. Enable monthly partitioning
2. Archive old partitions to cold storage
3. Use TimescaleDB for better time-series performance

## Troubleshooting

### Logs Not Appearing

1. Check middleware is loaded:
```bash
grep "requestLogger" blueclue/backend/src/app.js
```

2. Check database connection:
```sql
SELECT COUNT(*) FROM request_logs;
```

3. Check environment variable:
```bash
echo $ENABLE_REQUEST_LOGGING  # Should NOT be 'false'
```

### High Memory Usage

Increase flush frequency:
```javascript
const LOG_FLUSH_INTERVAL_MS = 2000; // Flush every 2 seconds
```

### Slow Analytics Queries

1. Refresh materialized view:
```bash
curl -X POST http://localhost:3000/api/admin/analytics/requests/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

2. Check index health:
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'request_logs'
ORDER BY idx_scan DESC;
```

## Security Notes

✅ **Sensitive Data Protection**
- Passwords, tokens, API keys automatically redacted
- Query parameters sanitized before storage
- Request/response bodies never logged

✅ **Access Control**
- All analytics endpoints require admin role
- Logs contain user_id for audit trails
- IP addresses logged for security analysis

⚠️ **Privacy Considerations**
- User agents and IPs are logged (GDPR implications)
- Consider anonymizing IPs after retention period
- Document data usage in privacy policy

## Acceptance Criteria

- [x] Request logging middleware records: endpoint, method, status code, response time, timestamp
- [x] Logs stored in `request_logs` table
- [x] Admin analytics endpoints: top 10 slowest, top 10 most called
- [x] Middleware overhead <1ms (achieved via async logging)
- [x] Sensitive data never logged (automatic filtering)

## Testing

Run the complete test suite:
```bash
cd blueclue/backend
node test-request-logging.js
```

Expected output:
```
✓ Performance test PASSED
  Average response time is acceptable
✓ Sensitive data filtering working
✓ Base route extraction working
```

## Future Enhancements

- [ ] Real-time dashboard with WebSocket updates
- [ ] Alerting for anomalies (e.g., sudden spike in errors)
- [ ] Export analytics to CSV/JSON
- [ ] Request correlation IDs for distributed tracing
- [ ] Integration with external monitoring (Datadog, New Relic)
- [ ] Sampling configuration (log X% of requests)
- [ ] Geo-location from IP addresses
