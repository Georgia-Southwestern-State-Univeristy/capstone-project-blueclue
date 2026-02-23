// ============================================================================
// Authentication Middleware
// ============================================================================
// JWT token verification and route protection

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'blueclue-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Verify JWT token from Authorization header
 * Adds user data to req.user if valid
 */
export const authenticateToken = (req, res, next) => {
    try {
        // Get token from Authorization header (Bearer token)
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Verify token
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or expired token.'
                });
            }

            // Reject guest tokens (guest access has been removed)
            if (decoded.role === 'guest' || decoded.isGuest === true) {
                return res.status(403).json({
                    success: false,
                    message: 'Guest access is no longer supported. Please create an account.'
                });
            }

            // Add user data to request
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication.'
        });
    }
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
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
            });
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
