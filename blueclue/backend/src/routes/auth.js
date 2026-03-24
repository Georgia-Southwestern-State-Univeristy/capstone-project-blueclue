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
    getCurrentUser,
    verifyEmail,
    resendVerification,
    updateProfile,
    updateEmail
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { resendVerificationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * POST /api/auth/login
 * Login for technicians (username) or customers (email)
 * 
 * Technician login body:
 *   { username: "tnewc", password: "admin123" }
 * 
 * Customer login body:
 *   { email: "customer@example.com", password: "password123" }
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
 * GET /api/auth/verify-email/:token
 * Verify email address with token from email link
 * 
 * Params:
 *   token: Verification token (64-character hex string)
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * POST /api/auth/resend-verification
 * Resend verification email to unverified account
 * Rate limited: Max 3 requests per hour
 * 
 * Body:
 *   { email: "customer@example.com" }
 */
router.post('/resend-verification', resendVerificationLimiter, resendVerification);

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

/**
 * PUT /api/auth/profile
 * Update display name (first name / last name)
 * Requires: Bearer token in Authorization header
 *
 * Body:
 *   { firstName: "John", lastName: "Doe" }
 */
router.put('/profile', authenticateToken, updateProfile);

/**
 * PUT /api/auth/email
 * Update email address (requires current password)
 * Requires: Bearer token in Authorization header
 *
 * Body:
 *   { newEmail: "new@example.com", password: "current_password" }
 */
router.put('/email', authenticateToken, updateEmail);

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
