// ============================================================================
// Guest User Cleanup Script
// ============================================================================
// Purpose: Remove inactive guest users with no tickets older than 30 days
// Usage: node scripts/cleanup-guest-users.js [--dry-run] [--days=30]
// Schedule: Run daily via cron/task scheduler

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const daysArg = args.find(arg => arg.startsWith('--days='));
const daysOld = daysArg ? parseInt(daysArg.split('=')[1]) : 30;

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'blueclue',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

/**
 * Cleanup guest users with no tickets older than specified days
 */
async function cleanupGuestUsers() {
    const client = await pool.connect();
    
    try {
        console.log('='.repeat(70));
        console.log('Guest User Cleanup Script');
        console.log('='.repeat(70));
        console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
        console.log(`Cleaning up guest users older than ${daysOld} days with no tickets`);
        console.log('='.repeat(70));
        console.log('');

        await client.query('BEGIN');

        // Find guest users to delete
        const findQuery = `
            SELECT 
                u.id,
                u.email,
                u.username,
                u.created_at,
                COUNT(t.id) as ticket_count
            FROM users u
            LEFT JOIN tickets t ON t.customer_id = u.id
            WHERE u.is_guest = true
                AND u.created_at < NOW() - INTERVAL '${daysOld} days'
            GROUP BY u.id, u.email, u.username, u.created_at
            HAVING COUNT(t.id) = 0
            ORDER BY u.created_at DESC
        `;

        const result = await client.query(findQuery);
        const guestUsers = result.rows;

        console.log(`Found ${guestUsers.length} inactive guest user(s) to delete:\n`);

        if (guestUsers.length === 0) {
            console.log('✓ No guest users to clean up');
            await client.query('ROLLBACK');
            return;
        }

        // Display users to be deleted
        guestUsers.forEach((user, index) => {
            const age = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
            console.log(`${index + 1}. ${user.email}`);
            console.log(`   ID: ${user.id}, Age: ${age} days, Tickets: ${user.ticket_count}`);
        });

        console.log('');

        if (isDryRun) {
            console.log('✓ DRY RUN: No changes made');
            await client.query('ROLLBACK');
            return;
        }

        // Delete guest sessions for these users
        const deleteSessionsQuery = `
            DELETE FROM guest_sessions 
            WHERE email IN (
                SELECT email FROM users 
                WHERE id = ANY($1::int[])
            )
        `;
        const userIds = guestUsers.map(u => u.id);
        const sessionsResult = await client.query(deleteSessionsQuery, [userIds]);
        console.log(`✓ Deleted ${sessionsResult.rowCount} guest session(s)`);

        // Delete the guest users
        const deleteUsersQuery = `
            DELETE FROM users 
            WHERE id = ANY($1::int[])
            RETURNING id, email
        `;
        const usersResult = await client.query(deleteUsersQuery, [userIds]);
        console.log(`✓ Deleted ${usersResult.rowCount} guest user(s)`);

        await client.query('COMMIT');

        console.log('');
        console.log('='.repeat(70));
        console.log('✓ Cleanup completed successfully');
        console.log('='.repeat(70));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('');
        console.error('✗ Error during cleanup:');
        console.error(error.message);
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * Display statistics about guest users
 */
async function displayStats() {
    const client = await pool.connect();
    
    try {
        // Total guest users
        const totalQuery = 'SELECT COUNT(*) as count FROM users WHERE is_guest = true';
        const totalResult = await client.query(totalQuery);
        const totalGuests = parseInt(totalResult.rows[0].count);

        // Guest users with tickets
        const withTicketsQuery = `
            SELECT COUNT(DISTINCT u.id) as count 
            FROM users u
            INNER JOIN tickets t ON t.customer_id = u.id
            WHERE u.is_guest = true
        `;
        const withTicketsResult = await client.query(withTicketsQuery);
        const guestsWithTickets = parseInt(withTicketsResult.rows[0].count);

        // Guest users without tickets
        const withoutTickets = totalGuests - guestsWithTickets;

        // Old guest users (>30 days)
        const oldQuery = `
            SELECT COUNT(*) as count 
            FROM users 
            WHERE is_guest = true 
                AND created_at < NOW() - INTERVAL '${daysOld} days'
        `;
        const oldResult = await client.query(oldQuery);
        const oldGuests = parseInt(oldResult.rows[0].count);

        console.log('\nGuest User Statistics:');
        console.log('-'.repeat(40));
        console.log(`Total guest users:           ${totalGuests}`);
        console.log(`  - With tickets:            ${guestsWithTickets}`);
        console.log(`  - Without tickets:         ${withoutTickets}`);
        console.log(`  - Older than ${daysOld} days:     ${oldGuests}`);
        console.log('-'.repeat(40));

    } finally {
        client.release();
    }
}

// Run the script
(async () => {
    try {
        await displayStats();
        await cleanupGuestUsers();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
