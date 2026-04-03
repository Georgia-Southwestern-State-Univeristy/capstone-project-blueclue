/**
 * Custom Error Classes and Error Handling Middleware
 * Provides consistent error handling across all controllers
 */

/**
 * Base Application Error
 * All custom errors extend from this class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true; // Distinguishes operational errors from programming errors
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 * Use for validation errors and malformed requests
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, details);
  }
}

/**
 * Unauthorized Error (401)
 * Use for authentication failures
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, details);
  }
}

/**
 * Forbidden Error (403)
 * Use for authorization failures (authenticated but not permitted)
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, details);
  }
}

/**
 * Not Found Error (404)
 * Use when a resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, details);
  }
}

/**
 * Conflict Error (409)
 * Use for resource conflicts (e.g., duplicate entries)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, details);
  }
}

/**
 * Internal Server Error (500)
 * Use for unexpected errors
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, details);
  }
}

/**
 * Centralized Error Handling Middleware
 * This should be the last middleware registered in app.js
 * 
 * Usage in controllers:
 *   throw new BadRequestError('Invalid input');
 *   throw new NotFoundError('Ticket not found');
 *   throw new Error('Unexpected error'); // Will be converted to 500
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error('Error occurred:', {
    message: err.message,
    statusCode: err.statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Default to 500 if no statusCode is set
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Build response object
  const response = {
    status,
    message: err.message || 'Something went wrong'
  };

  // Include additional details if provided
  if (err.details) {
    response.details = err.details;
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(response);
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors
 * 
 * Usage:
 *   router.get('/tickets', asyncHandler(async (req, res) => {
 *     const tickets = await getTickets();
 *     res.json(tickets);
 *   }));
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found Handler
 * Catches all requests to undefined routes
 * Should be registered before the error handler
 */
export const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};
