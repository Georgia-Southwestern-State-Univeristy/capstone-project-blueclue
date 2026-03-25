// src/services/healthCheckService.js
/**
 * Health Check Service
 * ====================
 * Comprehensive health monitoring for all critical dependencies:
 * - PostgreSQL database
 * - AI/ML service (Python FastAPI)
 * - Email service (Mailgun SMTP)
 * - In-memory cache (always available)
 * 
 * Each check includes:
 * - Status: "ok" | "degraded" | "down"
 * - Latency in milliseconds
 * - Error details if applicable
 * 
 * Overall health aggregation:
 * - "ok": All dependencies are healthy
 * - "degraded": One or more dependencies are degraded/down but service can operate
 * - "down": Critical dependencies are down
 */

import pool from '../config/database.js';
import nodemailer from 'nodemailer';

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const CHECK_TIMEOUT_MS = 1500; // Individual check timeout (1.5s to stay under 2s total)

/**
 * Run a health check with timeout
 * @param {Function} checkFn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{status: string, latency_ms: number, error?: string}>}
 */
async function runCheckWithTimeout(checkFn, timeoutMs = CHECK_TIMEOUT_MS) {
    const startTime = Date.now();
    
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
        );
        
        await Promise.race([checkFn(), timeoutPromise]);
        
        return {
            status: 'ok',
            latency_ms: Date.now() - startTime
        };
    } catch (error) {
        return {
            status: 'down',
            latency_ms: Date.now() - startTime,
            error: error.message
        };
    }
}

/**
 * Check PostgreSQL database connectivity
 */
async function checkDatabase() {
    return runCheckWithTimeout(async () => {
        const result = await pool.query('SELECT 1 as healthy');
        if (!result.rows[0]?.healthy) {
            throw new Error('Database query returned unexpected result');
        }
    });
}

/**
 * Check AI/ML service availability
 */
async function checkAIService() {
    return runCheckWithTimeout(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
        
        try {
            const response = await fetch(`${AI_SERVICE_URL}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`AI service returned status ${response.status}`);
            }
            
            // Try to parse response to ensure service is truly healthy
            const data = await response.json();
            if (data.status !== 'healthy' && data.status !== 'ok') {
                throw new Error(`AI service reports unhealthy status: ${data.status}`);
            }
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                throw new Error('AI service request timed out');
            }
            throw error;
        }
    });
}

/**
 * Check Mailgun/SMTP email service connectivity
 */
async function checkEmailService() {
    return runCheckWithTimeout(async () => {
        // Create a transporter with current config
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT, 10) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        // Verify the connection configuration
        await transporter.verify();
    });
}

/**
 * Check in-memory cache status
 * (Always returns "ok" since cache is in-memory and always available)
 */
async function checkCache() {
    return {
        status: 'ok',
        latency_ms: 0,
        message: 'In-memory cache is always available'
    };
}

/**
 * Aggregate overall health status
 * @param {Object} checks - Object containing all check results
 * @returns {string} - "ok" | "degraded" | "down"
 */
function aggregateHealth(checks) {
    const statuses = Object.values(checks).map(check => check.status);
    
    // If all are ok, overall is ok
    if (statuses.every(s => s === 'ok')) {
        return 'ok';
    }
    
    // If database is down, service is down (critical dependency)
    if (checks.database?.status === 'down') {
        return 'down';
    }
    
    // If AI service is down but database is ok, service is degraded (can still function)
    if (checks.ai_service?.status === 'down') {
        return 'degraded';
    }
    
    // If email is down but others are ok, service is degraded
    if (checks.email?.status === 'down') {
        return 'degraded';
    }
    
    // Default to degraded if we have any issues
    return 'degraded';
}

/**
 * Run all health checks in parallel
 * @returns {Promise<Object>} - Complete health check results
 */
export async function runHealthChecks() {
    const startTime = Date.now();
    
    try {
        // Run all checks in parallel for faster response
        const [database, aiService, email, cache] = await Promise.all([
            checkDatabase(),
            checkAIService(),
            checkEmailService(),
            checkCache()
        ]);
        
        const checks = {
            database,
            ai_service: aiService,
            email,
            cache
        };
        
        const overallStatus = aggregateHealth(checks);
        const totalLatency = Date.now() - startTime;
        
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            total_latency_ms: totalLatency,
            checks
        };
    } catch (error) {
        // Unexpected error during health check
        return {
            status: 'down',
            timestamp: new Date().toISOString(),
            total_latency_ms: Date.now() - startTime,
            error: error.message,
            checks: {
                database: { status: 'down', latency_ms: 0, error: 'Health check failed' },
                ai_service: { status: 'down', latency_ms: 0, error: 'Health check failed' },
                email: { status: 'down', latency_ms: 0, error: 'Health check failed' },
                cache: { status: 'down', latency_ms: 0, error: 'Health check failed' }
            }
        };
    }
}

export default {
    runHealthChecks,
    checkDatabase,
    checkAIService,
    checkEmailService,
    checkCache
};
