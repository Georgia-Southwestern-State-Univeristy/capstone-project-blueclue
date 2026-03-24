// ============================================================================
// Authentication Controller
// ============================================================================
// Handles login, registration, password changes, and logout

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/database.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { sendWelcomeEmail, sendVerificationEmail } from '../services/emailService.js';
import { 
    AppError,
    BadRequestError, 
    UnauthorizedError, 
    ForbiddenError,
    NotFoundError,
    ConflictError,
    InternalServerError
} from '../middleware/errorHandler.js';

const SALT_ROUNDS = 10;

/**
 * Log a login attempt to the audit trail
 * @param {Object} params - Login attempt details
 * @param {number|null} params.userId - User ID (null if user not found)
 * @param {string|null} params.username - Username attempted
 * @param {string|null} params.email - Email attempted
 * @param {string} params.attemptType - 'username' or 'email'
 * @param {boolean} params.success - Whether login succeeded
 * @param {string|null} params.failureReason - Reason for failure
 * @param {Object} params.req - Express request object for IP/user agent
 * @param {string|null} params.sessionId - Session ID for successful logins
 */
async function logLoginAttempt({ userId, username, email, attemptType, success, failureReason, req, sessionId = null }) {
    try {
        const ipAddress = req.ip || req.connection.remoteAddress || null;
        const userAgent = req.headers['user-agent'] || null;

        await pool.query(
            `INSERT INTO login_attempts 
             (user_id, username, email, attempt_type, success, failure_reason, ip_address, user_agent, session_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [userId, username, email, attemptType, success, failureReason, ipAddress, userAgent, sessionId]
        );
    } catch (error) {
        // Non-critical - log but don't fail the login process
        console.error('❌ Failed to log login attempt:', error.message);
    }
}

/**
 * Login - handles technicians (username) and customers (email)
 * POST /api/auth/login
 * 
 * Body (Technician):
 *   - username: string
 *   - password: string
 * 
 * Body (Customer):
 *   - email: string
 *   - password: string
 */
export const login = async (req, res) => {
    const { username, email, password } = req.body;

    if (username) {
        console.log('🔐 Technician login attempt:', { username });

        if (!password) {
            throw new BadRequestError('Password is required for technician login.');
        }

        const result = await pool.query(
            `SELECT id, email, username, password_hash, first_name, last_name, role,
                    force_password_change, is_active, phone, company
             FROM users
             WHERE username = $1 AND role IN ('technician', 'senior_technician', 'management')`,
            [username]
        );

        if (result.rows.length === 0) {
            await logLoginAttempt({
                userId: null,
                username,
                email: null,
                attemptType: 'username',
                success: false,
                failureReason: 'account_not_found',
                req
            });
            throw new UnauthorizedError('Invalid username or password.');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            await logLoginAttempt({
                userId: user.id,
                username,
                email: user.email,
                attemptType: 'username',
                success: false,
                failureReason: 'account_disabled',
                req
            });
            throw new ForbiddenError('Account is disabled. Contact administrator.');
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            await logLoginAttempt({
                userId: user.id,
                username,
                email: user.email,
                attemptType: 'username',
                success: false,
                failureReason: 'invalid_credentials',
                req
            });
            throw new UnauthorizedError('Invalid username or password.');
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
        });

        const refreshToken = generateRefreshToken({
            id: user.id,
            role: user.role
        });

        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, refreshToken, refreshExpiresAt]
        );

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        await logLoginAttempt({
            userId: user.id,
            username,
            email: user.email,
            attemptType: 'username',
            success: true,
            failureReason: null,
            req,
            sessionId: refreshToken
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                phone: user.phone,
                company: user.company,
                forcePasswordChange: user.force_password_change
            }
        });
    }

    if (email) {
        console.log('🔐 Email login attempt:', { email });

        if (!password) {
            throw new BadRequestError('Password is required for customer login.');
        }

        const result = await pool.query(
            `SELECT id, email, password_hash, first_name, last_name, role, is_active, email_verified, phone, company
             FROM users
             WHERE LOWER(email) = LOWER($1) AND role IN ('customer', 'admin', 'management')`,
            [email]
        );

        if (result.rows.length === 0) {
            await logLoginAttempt({
                userId: null,
                username: null,
                email,
                attemptType: 'email',
                success: false,
                failureReason: 'account_not_found',
                req
            });
            throw new UnauthorizedError('Invalid email or password.');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            await logLoginAttempt({
                userId: user.id,
                username: null,
                email,
                attemptType: 'email',
                success: false,
                failureReason: 'account_disabled',
                req
            });
            throw new ForbiddenError('Account is disabled. Contact support.');
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            await logLoginAttempt({
                userId: user.id,
                username: null,
                email,
                attemptType: 'email',
                success: false,
                failureReason: 'invalid_credentials',
                req
            });
            throw new UnauthorizedError('Invalid email or password.');
        }

        if (user.role === 'customer' && !user.email_verified) {
            await logLoginAttempt({
                userId: user.id,
                username: null,
                email,
                attemptType: 'email',
                success: false,
                failureReason: 'email_not_verified',
                req
            });
            throw new ForbiddenError('Please verify your email address before logging in. Check your inbox for the verification link.');
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
        });

        const refreshToken = generateRefreshToken({
            id: user.id,
            role: user.role
        });

        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, refreshToken, refreshExpiresAt]
        );

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        await logLoginAttempt({
            userId: user.id,
            username: null,
            email,
            attemptType: 'email',
            success: true,
            failureReason: null,
            req,
            sessionId: refreshToken
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                phone: user.phone,
                company: user.company,
            }
        });
    }

    throw new BadRequestError('Invalid login request. Provide username (technician) or email (customer).');
};

/**
 * Register new customer account
 * POST /api/auth/register
 * 
 * Body:
 *   - email: string
 *   - password: string
 *   - firstName: string
 *   - lastName: string
 *   - phone: string (optional)
 *   - company: string (optional)
 */
export const register = async (req, res) => {
    const { email, password, firstName, lastName, phone, company } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
        throw new BadRequestError('Email, password, first name, and last name are required.');
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
        throw new BadRequestError('Invalid email format.');
    }

    // Password strength validation (minimum 8 characters)
    if (password.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters long.');
    }

    // Check if email already exists (case-insensitive)
    const existingUser = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
    );

    if (existingUser.rows.length > 0) {
        throw new ConflictError('Email already registered. Please login or use a different email.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate email verification token (32 bytes = 64 character hex string)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Token expires in 24 hours
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert new customer with unverified email
    const result = await pool.query(
        `INSERT INTO users (
            email, password_hash, first_name, last_name, role, phone, company, 
            is_active, email_verified, email_verification_token, email_verification_expires
         )
         VALUES ($1, $2, $3, $4, 'customer', $5, $6, true, false, $7, $8)
         RETURNING id, email, first_name, last_name, role, phone, company, created_at`,
        [email, passwordHash, firstName, lastName, phone || null, company || null, verificationToken, verificationExpires]
    );

    const newUser = result.rows[0];

    // Send verification email
    try {
        await sendVerificationEmail(
            newUser.email,
            newUser.first_name,
            verificationToken,
            newUser.id
        );
    } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue anyway - user can request resend
    }

    return res.status(201).json({
        success: true,
        message: 'Account created successfully! Please check your email to verify your account.',
        requiresVerification: true,
        user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            emailVerified: false
        }
    });
};

/**
 * Change password (for technicians forcing password change or users updating password)
 * POST /api/auth/change-password
 * Requires authentication
 * 
 * Body:
 *   - currentPassword: string (optional for first-time password change)
 *   - newPassword: string
 */
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validation
    if (!newPassword) {
        throw new BadRequestError('New password is required.');
    }

    // Password strength validation
    if (newPassword.length < 8) {
        throw new BadRequestError('New password must be at least 8 characters long.');
    }

    // Get user data
    const result = await pool.query(
        `SELECT id, password_hash, force_password_change 
         FROM users 
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found.');
    }

    const user = result.rows[0];

    // Check if new password is the same as current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
        throw new BadRequestError('New password must be different from your current password.');
    }

    // Verify current password (only if not forcing password change AND current password provided)
    if (!user.force_password_change) {
        // If not forcing password change, current password is required
        if (!currentPassword) {
            throw new BadRequestError('Current password is required.');
        }
        
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordMatch) {
            throw new UnauthorizedError('Current password is incorrect.');
        }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and clear force_password_change flag
    await pool.query(
        `UPDATE users 
         SET password_hash = $1, force_password_change = false, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newPasswordHash, userId]
    );

    // Revoke all existing refresh tokens for security
    await pool.query(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
        [userId]
    );

    return res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
    });
};

/**
 * Logout - revoke refresh token
 * POST /api/auth/logout
 * Requires authentication
 */
export const logout = async (req, res) => {
    const userId = req.user.id;

    // Revoke all refresh tokens for this user
    await pool.query(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
        [userId]
    );

    return res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
    });
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 * 
 * Body:
 *   - refreshToken: string
 */
export const refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new BadRequestError('Refresh token is required.');
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        throw new ForbiddenError('Invalid or expired refresh token.');
    }

    // Check if token exists and is not revoked
    const result = await pool.query(
        `SELECT rt.id, rt.is_revoked, u.id, u.email, u.username, u.first_name, u.last_name, u.role
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.token = $1 AND rt.is_revoked = false AND rt.expires_at > CURRENT_TIMESTAMP`,
        [refreshToken]
    );

    if (result.rows.length === 0) {
        throw new ForbiddenError('Refresh token is invalid or has been revoked.');
    }

    const user = result.rows[0];

    // Generate new access token
    const newToken = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
    });

    return res.status(200).json({
        success: true,
        message: 'Access token refreshed successfully.',
        token: newToken
    });
};

/**
 * Get current user info
 * GET /api/auth/me
 * Requires authentication
 */
export const getCurrentUser = async (req, res) => {
    const userId = req.user.id;

    const result = await pool.query(
        `SELECT id, email, username, first_name, last_name, role, phone, company, 
                is_active, created_at, last_login, force_password_change
         FROM users 
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found.');
    }

    const user = result.rows[0];

    return res.status(200).json({
        success: true,
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            phone: user.phone,
            company: user.company,
            isActive: user.is_active,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            forcePasswordChange: user.force_password_change
        }
    });
};

/**
 * Verify email address with token
 * GET /api/auth/verify-email/:token
 * Public route
 */
export const verifyEmail = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        throw new BadRequestError('Verification token is required.');
    }

    // Find user with this verification token
    const result = await pool.query(
        `SELECT id, email, first_name, last_name, email_verified, 
                email_verification_token, email_verification_expires
         FROM users
         WHERE email_verification_token = $1`,
        [token]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Invalid or expired verification token.');
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
        return res.status(200).json({
            success: true,
            message: 'Email is already verified. You can now login.',
            code: 'ALREADY_VERIFIED'
        });
    }

    // Check if token is expired
    if (new Date() > new Date(user.email_verification_expires)) {
        throw new AppError('Verification token has expired. Please request a new one.', 410, { code: 'TOKEN_EXPIRED' });
    }

    // Mark email as verified and clear verification token
    await pool.query(
        `UPDATE users 
         SET email_verified = true,
             email_verification_token = NULL,
             email_verification_expires = NULL
         WHERE id = $1`,
        [user.id]
    );

    // Send welcome email now that they're verified
    try {
        await sendWelcomeEmail(user.email, user.first_name, null, user.id);
    } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Continue anyway - verification succeeded
    }

    return res.status(200).json({
        success: true,
        message: 'Email verified successfully! You can now login.',
        code: 'VERIFIED'
    });
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 * Public route
 * Body: { email: "user@example.com" }
 */
export const resendVerification = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new BadRequestError('Email is required.');
    }

    // Find user by email (case-insensitive)
    const result = await pool.query(
        `SELECT id, email, first_name, email_verified, email_verification_token
         FROM users
         WHERE LOWER(email) = LOWER($1)`,
        [email]
    );

    if (result.rows.length === 0) {
        // Don't reveal if email exists or not (security)
        return res.status(200).json({
            success: true,
            message: 'If an unverified account exists with this email, a verification email has been sent.'
        });
    }

    const user = result.rows[0];

    // If already verified, don't send anything but return success
    if (user.email_verified) {
        return res.status(200).json({
            success: true,
            message: 'If an unverified account exists with this email, a verification email has been sent.'
        });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update user with new token
    await pool.query(
        `UPDATE users
         SET email_verification_token = $1,
             email_verification_expires = $2
         WHERE id = $3`,
        [verificationToken, verificationExpires, user.id]
    );

    // Send verification email
    try {
        await sendVerificationEmail(
            user.email,
            user.first_name,
            verificationToken,
            user.id
        );
    } catch (emailError) {
        console.error('Failed to resend verification email:', emailError);
        throw new InternalServerError('Failed to send verification email. Please try again later.');
    }

    return res.status(200).json({
        success: true,
        message: 'If an unverified account exists with this email, a verification email has been sent.'
    });
};

/**
 * Update profile (display name)
 * PUT /api/auth/profile
 *
 * Body:
 *   { firstName: "John", lastName: "Doe" }
 */
export const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName, phone, company } = req.body;

    if (!firstName || !lastName) {
        throw new BadRequestError('First name and last name are required');
    }
    if (firstName.length > 100 || lastName.length > 100) {
        throw new BadRequestError('Name must be 100 characters or less');
    }
    if (phone && !/^\+?[0-9\s\-\(\)]+$/.test(phone)) {
        throw new BadRequestError('Invalid phone number format');
    }
    if (phone && phone.length > 20) {
        throw new BadRequestError('Phone number must be 20 characters or less');
    }
    if (company && company.length > 255) {
        throw new BadRequestError('Company must be 255 characters or less');
    }

    const updated = await pool.query(
        `UPDATE users
         SET first_name = $2, last_name = $3, phone = $4, company = $5, updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, first_name, last_name, username, role, phone, company`,
        [userId, firstName.trim(), lastName.trim(), phone?.trim() || null, company?.trim() || null]
    );

    if (updated.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    const user = updated.rows[0];

    // Issue a fresh token so the JWT payload stays in sync
    const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
    });

    return res.json({
        success: true,
        message: 'Profile updated successfully',
        token,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username,
            role: user.role,
            phone: user.phone,
            company: user.company,
        },
    });
};

/**
 * Update email address (requires current password for security)
 * PUT /api/auth/email
 *
 * Body:
 *   { newEmail: "new@example.com", password: "current_password" }
 */
export const updateEmail = async (req, res) => {
    const userId = req.user.id;
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
        throw new BadRequestError('New email and current password are required');
    }

    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(newEmail)) {
        throw new BadRequestError('Invalid email format');
    }

    // Verify current password
    const userResult = await pool.query(
        'SELECT id, password_hash, email, first_name, last_name, username, role FROM users WHERE id = $1',
        [userId]
    );
    if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
    }
    const user = userResult.rows[0];

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
        throw new UnauthorizedError('Incorrect password');
    }

    // Check if new email is already taken
    const existing = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
        [newEmail, userId]
    );
    if (existing.rows.length > 0) {
        throw new ConflictError('Email is already in use');
    }

    // Update email
    const updated = await pool.query(
        `UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1
         RETURNING id, email, first_name, last_name, username, role`,
        [userId, newEmail.trim().toLowerCase()]
    );
    const updatedUser = updated.rows[0];

    // Issue a fresh token with the new email
    const token = generateToken({
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
    });

    return res.json({
        success: true,
        message: 'Email updated successfully',
        token,
        user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.first_name,
            lastName: updatedUser.last_name,
            username: updatedUser.username,
            role: updatedUser.role,
        },
    });
};

export default {
    login,
    register,
    changePassword,
    logout,
    refreshAccessToken,
    getCurrentUser,
    verifyEmail,
    resendVerification
};
