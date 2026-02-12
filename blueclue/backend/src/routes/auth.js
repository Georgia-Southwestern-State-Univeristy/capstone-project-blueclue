// ============================================================================
// Authentication Routes
// ============================================================================
// Handles all authentication endpoints

import express from 'express';
import {
    login,
    register,
    changePassword,
    logout,
    refreshAccessToken,
    getCurrentUser
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * POST /api/auth/login
 * Login for technicians (username), customers (email), or guests (email + name)
 * 
 * Technician login body:
 *   { username: "tnewc", password: "admin123" }
 * 
 * Customer login body:
 *   { email: "customer@example.com", password: "password123" }
 * 
 * Guest login body:
 *   { email: "guest@example.com", fullName: "John Doe", isGuest: true }
 */
router.post('/login', login);

/**
 * POST /api/auth/register
 * Register new customer account
 * 
 * Body:
 *   {
 *     email: "customer@example.com",
 *     password: "password123",
 *     firstName: "John",
 *     lastName: "Doe",
 *     phone: "555-0123" (optional),
 *     company: "Acme Corp" (optional)
 *   }
 */
router.post('/register', register);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * 
 * Body:
 *   { refreshToken: "..." }
 */
router.post('/refresh', refreshAccessToken);

// ============================================================================
// PROTECTED ROUTES (authentication required)
// ============================================================================

/**
 * GET /api/auth/me
 * Get current authenticated user information
 * Requires: Bearer token in Authorization header
 */
router.get('/me', authenticateToken, getCurrentUser);

/**
 * POST /api/auth/change-password
 * Change user password (or force password change for technicians)
 * Requires: Bearer token in Authorization header
 * 
 * Body:
 *   {
 *     currentPassword: "oldpassword" (optional for first-time change),
 *     newPassword: "newpassword123"
 *   }
 */
router.post('/change-password', authenticateToken, changePassword);

/**
 * POST /api/auth/logout
 * Logout and revoke refresh tokens
 * Requires: Bearer token in Authorization header
 */
router.post('/logout', authenticateToken, logout);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/auth/health
 * Check if auth service is running
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Authentication service is running.',
        timestamp: new Date().toISOString()
    });
});

export default router;
