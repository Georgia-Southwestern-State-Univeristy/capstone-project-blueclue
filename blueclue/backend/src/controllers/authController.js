// ============================================================================
// Authentication Controller
// ============================================================================
// Handles login, registration, password changes, and logout

import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';

const SALT_ROUNDS = 10;

/**
 * Login - handles technicians (username), customers (email), and guests
 * POST /api/auth/login
 * 
 * Body (Technician):
 *   - username: string
 *   - password: string
 * 
 * Body (Customer):
 *   - email: string
 *   - password: string
 * 
 * Body (Guest):
 *   - email: string
 *   - fullName: string
 *   - isGuest: true
 */
export const login = async (req, res) => {
    try {
        const { username, email, password, fullName, isGuest } = req.body;

        // ========================================
        // GUEST LOGIN (no password required)
        // ========================================
        if (isGuest) {
            if (!email || !fullName) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and full name are required for guest access.'
                });
            }

            // Validate email format
            const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format.'
                });
            }

            // Generate guest session token
            const guestToken = generateToken({
                email,
                fullName,
                role: 'guest',
                isGuest: true
            });

            // Store guest session in database
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            await pool.query(
                `INSERT INTO guest_sessions (session_token, email, full_name, expires_at)
                 VALUES ($1, $2, $3, $4)`,
                [guestToken, email, fullName, expiresAt]
            );

            return res.status(200).json({
                success: true,
                message: 'Guest session created successfully.',
                token: guestToken,
                user: {
                    email,
                    fullName,
                    role: 'guest',
                    isGuest: true
                }
            });
        }

        // ========================================
        // TECHNICIAN LOGIN (username + password)
        // ========================================
        if (username) {
            console.log('🔐 Technician login attempt:', { username });
            
            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for technician login.'
                });
            }

            // Find technician by username (any technician level)
            const result = await pool.query(
                `SELECT id, email, username, password_hash, first_name, last_name, role, 
                        force_password_change, is_active 
                 FROM users 
                 WHERE username = $1 AND role IN ('technician', 'senior_technician', 'management')`,
                [username]
            );

            console.log('📊 Query result:', { found: result.rows.length > 0, username });

            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid username or password.'
                });
            }

            const user = result.rows[0];
            console.log('👤 User found:', { username: user.username, isActive: user.is_active });

            // Check if account is active
            if (!user.is_active) {
                return res.status(403).json({
                    success: false,
                    message: 'Account is disabled. Contact administrator.'
                });
            }

            // Verify password
            console.log('🔑 Comparing password...');
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            console.log('✓ Password match result:', passwordMatch);
            
            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid username or password.'
                });
            }

            // Update last login
            await pool.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Generate tokens
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

            // Store refresh token
            const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await pool.query(
                `INSERT INTO refresh_tokens (user_id, token, expires_at)
                 VALUES ($1, $2, $3)`,
                [user.id, refreshToken, refreshExpiresAt]
            );

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
                    forcePasswordChange: user.force_password_change
                }
            });
        }

        // ========================================
        // CUSTOMER LOGIN (email + password)
        // ========================================
        if (email) {
            console.log('🔐 Email login attempt:', { email });
            
            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for customer login.'
                });
            }

            // Find customer or admin by email
            const result = await pool.query(
                `SELECT id, email, password_hash, first_name, last_name, role, is_active 
                 FROM users 
                 WHERE email = $1 AND role IN ('customer', 'admin')`,
                [email]
            );

            console.log('📊 Query result:', { found: result.rows.length > 0, role: result.rows[0]?.role });

            if (result.rows.length === 0) {
                console.log('❌ User not found in database');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password.'
                });
            }

            const user = result.rows[0];

            // Check if account is active
            if (!user.is_active) {
                console.log('❌ Account is not active');
                return res.status(403).json({
                    success: false,
                    message: 'Account is disabled. Contact support.'
                });
            }

            // Verify password
            console.log('🔑 Comparing password...');
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            console.log('🔑 Password match result:', { passwordMatch });
            
            if (!passwordMatch) {
                console.log('❌ Password does not match');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password.'
                });
            }

            // Update last login
            await pool.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Generate tokens
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

            // Store refresh token
            const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await pool.query(
                `INSERT INTO refresh_tokens (user_id, token, expires_at)
                 VALUES ($1, $2, $3)`,
                [user.id, refreshToken, refreshExpiresAt]
            );

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
                    role: user.role
                }
            });
        }

        // No valid login method provided
        return res.status(400).json({
            success: false,
            message: 'Invalid login request. Provide username (technician), email (customer), or email + name (guest).'
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during login.'
        });
    }
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
    try {
        const { email, password, firstName, lastName, phone, company } = req.body;

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, first name, and last name are required.'
            });
        }

        // Validate email format
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format.'
            });
        }

        // Password strength validation (minimum 8 characters)
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long.'
            });
        }

        // Check if email already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered. Please login or use a different email.'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert new customer
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, phone, company, is_active)
             VALUES ($1, $2, $3, $4, 'customer', $5, $6, true)
             RETURNING id, email, first_name, last_name, role, phone, company, created_at`,
            [email, passwordHash, firstName, lastName, phone || null, company || null]
        );

        const newUser = result.rows[0];

        // Generate tokens
        const token = generateToken({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            firstName: newUser.first_name,
            lastName: newUser.last_name
        });

        const refreshToken = generateRefreshToken({
            id: newUser.id,
            role: newUser.role
        });

        // Store refresh token
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [newUser.id, refreshToken, refreshExpiresAt]
        );

        return res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            refreshToken,
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                phone: newUser.phone,
                company: newUser.company,
                createdAt: newUser.created_at
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during registration.'
        });
    }
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
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Validation
        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required.'
            });
        }

        // Password strength validation
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long.'
            });
        }

        // Get user data
        const result = await pool.query(
            `SELECT id, password_hash, force_password_change 
             FROM users 
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        const user = result.rows[0];

        // Verify current password (only if not forcing password change AND current password provided)
        if (!user.force_password_change) {
            // If not forcing password change, current password is required
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is required.'
                });
            }
            
            const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect.'
                });
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

    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during password change.'
        });
    }
};

/**
 * Logout - revoke refresh token
 * POST /api/auth/logout
 * Requires authentication
 */
export const logout = async (req, res) => {
    try {
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

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during logout.'
        });
    }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 * 
 * Body:
 *   - refreshToken: string
 */
export const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required.'
            });
        }

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired refresh token.'
            });
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
            return res.status(403).json({
                success: false,
                message: 'Refresh token is invalid or has been revoked.'
            });
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

    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during token refresh.'
        });
    }
};

/**
 * Get current user info
 * GET /api/auth/me
 * Requires authentication
 */
export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT id, email, username, first_name, last_name, role, phone, company, 
                    is_active, created_at, last_login, force_password_change
             FROM users 
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
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

    } catch (error) {
        console.error('Get current user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

export default {
    login,
    register,
    changePassword,
    logout,
    refreshAccessToken,
    getCurrentUser
};
