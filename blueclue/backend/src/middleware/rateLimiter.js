// ============================================================================
// Rate Limiting Middleware
// ============================================================================
// Simple in-memory rate limiter for specific endpoints
// In production, consider using Redis for distributed rate limiting

/**
 * Store for tracking request counts
 * Structure: { email: { count: number, resetTime: Date } }
 */
const rateLimitStore = new Map();

/**
 * Clean up expired entries every 10 minutes
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 10 * 60 * 1000);

/**
 * Rate limiter for resend verification emails
 * Limits to 3 requests per hour per email address
 */
export const resendVerificationLimiter = (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(); // Let the controller handle missing email
    }

    const key = `resend:${email.toLowerCase()}`;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 3;

    const record = rateLimitStore.get(key);

    // No record or expired - create new
    if (!record || now > record.resetTime) {
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs
        });
        return next();
    }

    // Check if limit exceeded
    if (record.count >= maxRequests) {
        const timeRemaining = Math.ceil((record.resetTime - now) / 1000 / 60); // minutes
        return res.status(429).json({
            success: false,
            message: `Too many resend requests. Please try again in ${timeRemaining} minute${timeRemaining !== 1 ? 's' : ''}.`,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: timeRemaining
        });
    }

    // Increment counter
    record.count++;
    rateLimitStore.set(key, record);

    next();
};

/**
 * Generic rate limiter factory
 * Creates a rate limiter with custom settings
 * 
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message when limit exceeded
 * @param {Function} options.keyGenerator - Function to generate rate limit key from request
 */
export const createRateLimiter = (options) => {
    const {
        windowMs = 60 * 60 * 1000, // 1 hour default
        max = 10,
        message = 'Too many requests. Please try again later.',
        keyGenerator = (req) => req.ip || 'unknown'
    } = options;

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        const record = rateLimitStore.get(key);

        // No record or expired - create new
        if (!record || now > record.resetTime) {
            rateLimitStore.set(key, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }

        // Check if limit exceeded
        if (record.count >= max) {
            const timeRemaining = Math.ceil((record.resetTime - now) / 1000 / 60);
            return res.status(429).json({
                success: false,
                message,
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: timeRemaining
            });
        }

        // Increment counter
        record.count++;
        rateLimitStore.set(key, record);

        next();
    };
};
