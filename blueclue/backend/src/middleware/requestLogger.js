// src/middleware/requestLogger.js
/**
 * Request Logging Middleware
 * ===========================
 * Records API request metadata for performance monitoring and analytics.
 * 
 * Features:
 * - Minimal overhead (<1ms per request via async logging)
 * - Automatic response time calculation
 * - Sensitive data sanitization (passwords, tokens, secrets)
 * - Base route extraction for grouping similar endpoints
 * - Batch insert for high-volume scenarios
 * 
 * Logs:
 * - Endpoint path and HTTP method
 * - Response status code and time
 * - User context (if authenticated)
 * - Sanitized query parameters
 */

import pool from '../config/database.js';

// Configuration
const LOG_BATCH_SIZE = 100;           // Batch inserts for better performance
const LOG_FLUSH_INTERVAL_MS = 5000;   // Flush every 5 seconds
const ENABLE_LOGGING = process.env.ENABLE_REQUEST_LOGGING !== 'false'; // Default: enabled

// In-memory buffer for batch inserts
let logBuffer = [];
let flushTimer = null;

// Sensitive field patterns to sanitize
const SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /private[_-]?key/i,
    /session/i,
    /cookie/i
];

/**
 * Check if a field name contains sensitive data
 */
function isSensitiveField(fieldName) {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Sanitize query parameters - remove sensitive values
 */
function sanitizeQueryParams(query) {
    if (!query || Object.keys(query).length === 0) {
        return null;
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(query)) {
        if (isSensitiveField(key)) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

/**
 * Extract base route pattern for grouping
 * Examples:
 *   /api/tickets/123 -> /api/tickets/:id
 *   /api/users/456/profile -> /api/users/:id/profile
 */
function extractBaseRoute(path) {
    // Remove query string if present
    const pathOnly = path.split('?')[0];
    
    // Replace numeric IDs with :id
    let baseRoute = pathOnly.replace(/\/\d+/g, '/:id');
    
    // Replace UUIDs with :uuid
    baseRoute = baseRoute.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid');
    
    // Replace email addresses with :email
    baseRoute = baseRoute.replace(/\/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '/:email');
    
    return baseRoute;
}

/**
 * Flush log buffer to database
 */
async function flushLogBuffer() {
    if (logBuffer.length === 0) {
        return;
    }
    
    const logsToInsert = [...logBuffer];
    logBuffer = [];
    
    try {
        // Batch insert using VALUES
        const values = [];
        const params = [];
        let paramIndex = 1;
        
        for (const log of logsToInsert) {
            values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`);
            params.push(
                log.endpoint,
                log.method,
                log.base_route,
                log.status_code,
                log.response_time_ms,
                log.user_id,
                log.ip_address,
                log.user_agent,
                log.error_message,
                log.query_params ? JSON.stringify(log.query_params) : null
            );
            paramIndex += 10;
        }
        
        const query = `
            INSERT INTO request_logs (
                endpoint, method, base_route, status_code, response_time_ms,
                user_id, ip_address, user_agent, error_message, query_params
            ) VALUES ${values.join(', ')}
        `;
        
        await pool.query(query, params);
    } catch (error) {
        console.error('Failed to flush request logs:', error.message);
        // Don't throw - logging should never crash the app
    }
}

/**
 * Add log entry to buffer
 */
function bufferLog(logEntry) {
    logBuffer.push(logEntry);
    
    // Flush if buffer is full
    if (logBuffer.length >= LOG_BATCH_SIZE) {
        // Don't await - fire and forget
        flushLogBuffer().catch(err => {
            console.error('Error flushing logs:', err.message);
        });
    } else if (!flushTimer) {
        // Schedule periodic flush
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flushLogBuffer().catch(err => {
                console.error('Error flushing logs:', err.message);
            });
        }, LOG_FLUSH_INTERVAL_MS);
    }
}

/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
    // Skip logging if disabled
    if (!ENABLE_LOGGING) {
        return next();
    }
    
    // Skip health check endpoints to reduce noise
    if (req.path === '/api/health' || req.path === '/health') {
        return next();
    }
    
    // Record start time with high precision
    const startTime = process.hrtime.bigint();
    
    // Capture response
    const originalSend = res.send;
    const originalJson = res.json;
    
    let responseFinished = false;
    
    const logRequest = () => {
        if (responseFinished) return;
        responseFinished = true;
        
        // Calculate response time in milliseconds
        const endTime = process.hrtime.bigint();
        const responseTimeMs = Number((endTime - startTime) / 1000000n); // Convert nanoseconds to milliseconds
        
        // Extract user ID if authenticated
        const userId = req.user?.id || null;
        
        // Get client IP (handle proxy headers)
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
                       || req.headers['x-real-ip'] 
                       || req.ip 
                       || req.connection.remoteAddress;
        
        // Get user agent
        const userAgent = req.headers['user-agent'] || null;
        
        // Extract error message for failed requests
        let errorMessage = null;
        if (res.statusCode >= 400) {
            // Try to get error from response body if available
            errorMessage = res.locals.errorMessage || `HTTP ${res.statusCode}`;
        }
        
        // Sanitize query params
        const queryParams = sanitizeQueryParams(req.query);
        
        // Create log entry
        const logEntry = {
            endpoint: req.originalUrl || req.url,
            method: req.method,
            base_route: extractBaseRoute(req.path),
            status_code: res.statusCode,
            response_time_ms: responseTimeMs,
            user_id: userId,
            ip_address: ipAddress,
            user_agent: userAgent,
            error_message: errorMessage,
            query_params: queryParams
        };
        
        // Buffer log entry (async, non-blocking)
        bufferLog(logEntry);
    };
    
    // Intercept response methods
    res.send = function(data) {
        logRequest();
        return originalSend.call(this, data);
    };
    
    res.json = function(data) {
        logRequest();
        return originalJson.call(this, data);
    };
    
    // Also log on response finish (catch cases where send/json not called)
    res.on('finish', logRequest);
    
    // Continue to next middleware
    next();
}

/**
 * Graceful shutdown - flush remaining logs
 */
export async function shutdownRequestLogger() {
    console.log('Flushing remaining request logs...');
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    await flushLogBuffer();
    console.log('Request logger shutdown complete');
}

// Handle process termination
if (process.env.NODE_ENV !== 'test') {
    process.on('SIGTERM', shutdownRequestLogger);
    process.on('SIGINT', shutdownRequestLogger);
}

export default requestLogger;
