import cron from 'node-cron';
import pool from '../config/database.js';

/**
 * Delete direct messages older than 7 days.
 * Runs daily at 3:00 AM.
 */
export function startMessageCleanupJob() {
  // Every day at 03:00
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM direct_messages WHERE created_at < NOW() - INTERVAL '7 days'`
      );
      const count = result.rowCount;
      if (count > 0) {
        console.log(`[MessageCleanup] Deleted ${count} message(s) older than 7 days`);
      }
    } catch (err) {
      console.error('[MessageCleanup] Error:', err);
    }
  });

  console.log('[MessageCleanup] Scheduled daily at 03:00 AM (deletes messages older than 7 days)');
}
