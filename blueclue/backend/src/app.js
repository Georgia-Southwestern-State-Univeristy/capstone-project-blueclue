//src app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import pool from './config/database.js';
import ticketRoutes from './routes/tickets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// API Routes
app.use('/api/tickets', ticketRoutes);

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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});