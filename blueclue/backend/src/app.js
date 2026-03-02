//src app.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
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
import knowledgeBaseRoutes from './routes/knowledgeBase.js';
import templateRoutes from './routes/templates.js';
import themeRoutes from './routes/themes.js';
import chatRoutes from './routes/chat.js';
import { initializeSocketHandlers } from './services/socketService.js';
import { startUpdateRequestReminderJob } from './jobs/updateRequestReminders.js';

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

// Make io accessible to routes/controllers
app.set('io', io);
app.locals.io = io;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing Mailgun webhook form data
app.use(cookieParser());

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
app.use('/api/knowledge-base', knowledgeBaseRoutes); // Knowledge base management
app.use('/api/templates', templateRoutes); // Ticket templates
app.use('/api/themes', themeRoutes); // User theme preferences
app.use('/api/chat', chatRoutes); // Chat bot routes
app.use('/api/dev', devRoutes);
app.use('/api/admin', adminRoutes);

//test route 
app.get('/', (req, res) => {
    res.send('Welcome to BlueClue Backend!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "BlueClue API is running"
    });
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
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: err.message
        });
    }
});

httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server is ready on ws://localhost:${PORT}`);
});