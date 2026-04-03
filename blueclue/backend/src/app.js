//src app.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pool from './config/database.js';
import ticketRoutes from './routes/tickets.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import privilegeRoutes from './routes/privileges.js';
import categoryRoutes from './routes/categories.js';
import roleRoutes from './routes/roles.js';
import auditRoutes from './routes/audit.js';
import notificationRoutes from './routes/notifications.js';
import devRoutes from './routes/dev.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import analyticsRoutes from './routes/analytics.js';
import configRoutes from './routes/config.js';
import assignmentRequestRoutes from './routes/assignmentRequests.js';
import commentRoutes from './routes/commentRoutes.js';
import ringRoutes from './routes/ring.js';
import updateRequestRoutes from './routes/updateRequestRoutes.js';
import dashboardLayoutRoutes from './routes/dashboardLayouts.js';
import widgetRoutes from './routes/widgets.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.js';
import templateRoutes from './routes/templates.js';
import themeRoutes from './routes/themes.js';
import chatRoutes from './routes/chat.js';
import mlAdminRoutes from './routes/mlAdmin.js';
import requestLogsRoutes from './routes/requestLogs.js';
import searchHistoryRoutes from './routes/searchHistory.js';
import messageRoutes from './routes/messages.js';
import ticketChatRoutes from './routes/ticketChat.js';
import { initializeSocketHandlers } from './services/socketService.js';
import { startUpdateRequestReminderJob } from './jobs/updateRequestReminders.js';
import { startChatQualityJob } from './jobs/chatQualityJob.js';
import { errorHandler, notFoundHandler, InternalServerError } from './middleware/errorHandler.js';
import { startAlertDetectionJob } from './jobs/alertDetectionJob.js';
import { startEmailQueueJob } from './jobs/emailQueueJob.js';
import { startMessageCleanupJob } from './jobs/messageCleanupJob.js';
import { startTicketChatCleanupJob } from './jobs/ticketChatCleanupJob.js';
import { startDriftMonitorJob } from './jobs/driftMonitorJob.js';
import { requestLogger } from './middleware/requestLogger.js';
import { runHealthChecks } from './services/healthCheckService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO handlers
initializeSocketHandlers(io);

// Start scheduled jobs
startUpdateRequestReminderJob(io);
startChatQualityJob();
startAlertDetectionJob();
startEmailQueueJob();
startMessageCleanupJob();
startTicketChatCleanupJob();
startDriftMonitorJob();  // Daily drift detection + automated alerting

// Make io accessible to routes/controllers
app.set('io', io);
app.locals.io = io;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
    origin: (origin, callback) => {
        const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(u => u.trim());
        // Allow requests with no origin (e.g. mobile, Postman) and configured origins
        if (!origin || allowed.includes(origin) || origin.endsWith('.railway.app')) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked: ${origin}`));
        }
    },
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // For parsing Mailgun webhook form data
app.use(cookieParser());

// Request logging middleware (must be after body parsers, before routes)
app.use(requestLogger);

// ── Static file serving (chat uploads) ──────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(path.join(uploadsDir, 'chat'), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'dm'), { recursive: true });
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api', commentRoutes); // Comment routes (includes /api/comments and /api/tickets/:id/comments)
app.use('/api/users', userRoutes);
app.use('/api/privileges', privilegeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks', webhookRoutes); // Webhook endpoints for inbound email
app.use('/api/analytics', analyticsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/assignment-requests', assignmentRequestRoutes);
app.use('/api', ringRoutes); // Ring for Help routes
app.use('/api', updateRequestRoutes); // Ticket Update Request routes
app.use('/api/dashboard-layouts', dashboardLayoutRoutes); // Dashboard layout persistence
app.use('/api/widgets', widgetRoutes); // Widget RBAC and validation
app.use('/api/knowledge-base', knowledgeBaseRoutes); // Knowledge base management
app.use('/api/templates', templateRoutes); // Ticket templates
app.use('/api/admin/analytics/requests', requestLogsRoutes); // Request logs analytics (admin-only)
app.use('/api/themes', themeRoutes); // User theme preferences
app.use('/api/chat', chatRoutes); // Chat bot routes
app.use('/api/ml-admin', mlAdminRoutes); // ML Admin – monitoring, explainability, versioning
app.use('/api/search-history', searchHistoryRoutes); // User search history
app.use('/api/messages', messageRoutes); // Direct messages between users
app.use('/api/tickets', ticketChatRoutes); // Ticket chat between client and tech
app.use('/api/dev', devRoutes);
app.use('/api/admin', adminRoutes);

//test route 
app.get('/', (req, res) => {
    res.send('Welcome to BlueClue Backend!');
});

/**
 * Comprehensive Health Check Endpoint
 * ====================================
 * Checks all critical dependencies:
 * - PostgreSQL database
 * - AI/ML service
 * - Email service (Mailgun/SMTP)
 * - In-memory cache
 * 
 * Returns structured health status with latency metrics.
 * Responds within 2 seconds even if dependencies are slow.
 * 
 * Response format:
 * {
 *   status: "ok" | "degraded" | "down",
 *   timestamp: ISO 8601 timestamp,
 *   total_latency_ms: number,
 *   checks: {
 *     database: { status: "ok", latency_ms: number },
 *     ai_service: { status: "ok", latency_ms: number },
 *     email: { status: "ok", latency_ms: number },
 *     cache: { status: "ok", latency_ms: number }
 *   }
 * }
 */
app.get('/api/health', async (req, res) => {
    try {
        const healthStatus = await runHealthChecks();
        
        // Return appropriate HTTP status code based on overall health
        const statusCode = healthStatus.status === 'ok' ? 200 : 
                          healthStatus.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(healthStatus);
    } catch (error) {
        // Unexpected error in health check
        res.status(503).json({
            status: 'down',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            message: error.message
        });
    }
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        // Test basic query
        const result = await pool.query('SELECT NOW() as current_time');
        
        // Get counts from database
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const ticketCount = await pool.query('SELECT COUNT(*) FROM tickets');
        const categoryCount = await pool.query('SELECT COUNT(*) FROM categories');
        
        res.status(200).json({
            status: 'success',
            message: 'Database connection is working!',
            database: {
                connected: true,
                timestamp: result.rows[0].current_time,
                tables: {
                    users: parseInt(userCount.rows[0].count),
                    tickets: parseInt(ticketCount.rows[0].count),
                    categories: parseInt(categoryCount.rows[0].count)
                }
            }
        });
    } catch (err) {
        console.error('Database test error:', err);
        throw new InternalServerError('Database connection failed');
    }
});

// 404 Handler - must be after all other routes
app.use(notFoundHandler);

// Error Handler - must be the last middleware
app.use(errorHandler);

httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server is ready on ws://localhost:${PORT}`);
});