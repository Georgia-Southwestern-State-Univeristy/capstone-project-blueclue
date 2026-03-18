// ============================================================================
// Authentication Middleware
// ============================================================================
// JWT token verification and route protection

import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError, InternalServerError } from './errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'blueclue-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Verify JWT token from Authorization header
 * Adds user data to req.user if valid
 */
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return next(new UnauthorizedError('Access denied. No token provided.'));
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new UnauthorizedError('Invalid or expired token.'));
        }

        // Reject guest tokens (guest access has been removed)
        if (decoded.role === 'guest' || decoded.isGuest === true) {
            return next(new ForbiddenError('Guest access is no longer supported. Please create an account.'));
        }

        // Add user data to request
        req.user = decoded;
        next();
    });
};

/**
 * Require specific role(s) to access route
 * Must be used AFTER authenticateToken middleware
 * 
 * @param {string|string[]} roles - Required role(s) ('customer', 'technician', 'admin')
 */
export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required.'));
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`));
        }

        next();
    };
};

/**
 * Optional authentication - adds user to req if token exists
 * Does not block request if no token
 */
export const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (!err) {
                    req.user = decoded;
                }
            });
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Generate JWT token
 * 
 * @param {object} payload - User data to encode in token
 * @returns {string} JWT token
 */
export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
};

/**
 * Generate refresh token (longer expiration)
 * 
 * @param {object} payload - User data to encode in token
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d' // 7 days
    });
};

/**
 * Verify refresh token
 * 
 * @param {string} token - Refresh token to verify
 * @returns {object|null} Decoded token or null if invalid
 */
export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

export default {
    authenticateToken,
    requireRole,
    optionalAuth,
    generateToken,
    generateRefreshToken,
    verifyRefreshToken
};
