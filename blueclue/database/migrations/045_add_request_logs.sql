-- Migration: Add Request Logs Table
-- Description: Create table for storing API request logs for performance monitoring and analytics
-- Author: BlueClue Team
-- Date: 2026-03-25

-- ============================================================================
-- REQUEST LOGS TABLE
-- ============================================================================
-- Stores HTTP request metadata for performance monitoring and capacity planning
-- Logs include endpoint, method, status, response time, and sanitized metadata

CREATE TABLE IF NOT EXISTS request_logs (
    id BIGSERIAL PRIMARY KEY,
    
    -- Request identification
    endpoint VARCHAR(500) NOT NULL,           -- Full endpoint path (e.g., /api/tickets/123)
    method VARCHAR(10) NOT NULL,              -- HTTP method (GET, POST, PUT, DELETE, etc.)
    base_route VARCHAR(200),                   -- Base route for grouping (e.g., /api/tickets/:id)
    
    -- Response metadata
    status_code INTEGER NOT NULL,              -- HTTP status code (200, 404, 500, etc.)
    response_time_ms INTEGER NOT NULL,         -- Response time in milliseconds
    
    -- User context (optional)
    user_id INTEGER,                           -- User who made the request (if authenticated)
    ip_address INET,                           -- Client IP address (for rate limiting analysis)
    user_agent TEXT,                           -- User agent string (browser/client info)
    
    -- Additional metadata
    error_message TEXT,                        -- Error message if status >= 400
    query_params JSONB,                        -- Sanitized query parameters
    
    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
    CONSTRAINT valid_status_code CHECK (status_code >= 100 AND status_code < 600),
    CONSTRAINT non_negative_response_time CHECK (response_time_ms >= 0),
    
    -- Foreign keys
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding slow endpoints (ORDER BY response_time_ms DESC)
CREATE INDEX idx_request_logs_response_time ON request_logs(response_time_ms DESC);

-- Index for endpoint usage analytics (GROUP BY base_route)
CREATE INDEX idx_request_logs_base_route ON request_logs(base_route);

-- Index for time-series queries (recent logs)
CREATE INDEX idx_request_logs_timestamp ON request_logs(timestamp DESC);

-- Composite index for endpoint performance over time
CREATE INDEX idx_request_logs_route_time ON request_logs(base_route, timestamp DESC);

-- Index for error analysis (WHERE status_code >= 400)
CREATE INDEX idx_request_logs_errors ON request_logs(status_code) WHERE status_code >= 400;

-- Index for user activity analysis
CREATE INDEX idx_request_logs_user_time ON request_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Partition table by month for better query performance and easier archival
-- (Optional: Can be implemented later as data grows)
-- CREATE TABLE request_logs_2026_03 PARTITION OF request_logs 
-- FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- ============================================================================
-- DATA RETENTION POLICY
-- ============================================================================

-- Comment describing retention policy (implement with scheduled job)
COMMENT ON TABLE request_logs IS 'API request logs for performance monitoring. Retention: 90 days. Archive older logs to cold storage.';

-- ============================================================================
-- MATERIALIZED VIEW FOR ANALYTICS (OPTIONAL - CREATE IF NEEDED)
-- ============================================================================

-- Pre-computed analytics for fast dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS request_logs_analytics AS
SELECT 
    base_route,
    COUNT(*) as total_requests,
    AVG(response_time_ms)::INTEGER as avg_response_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as median_response_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p95_response_time_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p99_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms,
    MIN(response_time_ms) as min_response_time_ms,
    COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
    COUNT(*) FILTER (WHERE status_code >= 500) as server_error_count,
    MAX(timestamp) as last_request_at
FROM request_logs
WHERE timestamp >= NOW() - INTERVAL '7 days'  -- Last 7 days only
GROUP BY base_route;

-- Index on materialized view for fast lookups
CREATE INDEX idx_request_analytics_avg_time ON request_logs_analytics(avg_response_time_ms DESC);
CREATE INDEX idx_request_analytics_total ON request_logs_analytics(total_requests DESC);

-- Refresh materialized view periodically (implement in scheduled job)
COMMENT ON MATERIALIZED VIEW request_logs_analytics IS 'Pre-computed request analytics. Refresh every 5 minutes via scheduled job.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant read access to all authenticated users for basic analytics
-- GRANT SELECT ON request_logs TO authenticated_users;

-- Grant admin full access for analytics and maintenance
-- GRANT ALL ON request_logs TO blueclue_admin;

-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'request_logs') THEN
        RAISE EXCEPTION 'Failed to create request_logs table';
    END IF;
    
    RAISE NOTICE 'Request logs table created successfully';
    RAISE NOTICE 'Indexes: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'request_logs');
    RAISE NOTICE 'Materialized view created: request_logs_analytics';
END $$;
