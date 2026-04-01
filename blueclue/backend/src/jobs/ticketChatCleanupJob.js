import cron from 'node-cron';
import pool from '../config/database.js';

/**
 * Delete ticket chats with no message activity for 3 weeks.
 * Checks the most recent message timestamp, or falls back to the chat's
 * requested_at if no messages were ever sent.
 * Runs daily at 4:00 AM.
 */
export function startTicketChatCleanupJob() {
  cron.schedule('0 4 * * *', async () => {
    try {
      // Find stale chats: last activity > 3 weeks ago
      const stale = await pool.query(
        `SELECT tc.id
         FROM ticket_chats tc
         LEFT JOIN LATERAL (
           SELECT MAX(created_at) AS last_msg
           FROM ticket_chat_messages
           WHERE chat_id = tc.id
         ) m ON true
         WHERE COALESCE(m.last_msg, tc.requested_at) < NOW() - INTERVAL '21 days'`
      );

      if (stale.rows.length === 0) return;

      const ids = stale.rows.map(r => r.id);

      // Delete messages first, then chats
      await pool.query(
        `DELETE FROM ticket_chat_messages WHERE chat_id = ANY($1)`,
        [ids]
      );
      const result = await pool.query(
        `DELETE FROM ticket_chats WHERE id = ANY($1)`,
        [ids]
      );

      console.log(`[TicketChatCleanup] Deleted ${result.rowCount} stale chat(s) (no activity for 3+ weeks)`);
    } catch (err) {
      console.error('[TicketChatCleanup] Error:', err);
    }
  });

  console.log('[TicketChatCleanup] Scheduled daily at 04:00 AM (deletes chats inactive for 3 weeks)');
}
