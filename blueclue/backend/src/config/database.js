import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

// Support both a full DATABASE_URL connection string (Railway/Heroku style)
// and individual DB_* variables (local development style).
const poolConfig = process.env.DATABASE_URL
    ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
          user: process.env.DB_USER || 'postgres',
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'blueclue',
          password: process.env.DB_PASSWORD,
          port: parseInt(process.env.DB_PORT || '5432'),
      };

// Create PostgreSQL connection pool
const pool = new Pool({
    ...poolConfig,
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 120000, // Close idle clients after 2 minutes (outlasts the 60s notification poll)
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test database connection on startup
pool.on('connect', () => {
    console.log('✓ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('✗ Unexpected database error:', err);
    process.exit(-1);
});

// Test connection immediately
const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✓ Database connection test passed:', result.rows[0].now);
        client.release();
    } catch (err) {
        console.error('✗ Database connection failed:', err.message);
        console.error('  Check your DATABASE_URL in .env file');
    }
};

// Run connection test
testConnection();

export default pool;
