// src/models/TicketComment.js
import pool from '../config/database.js';

class TicketComment {
    /**
     * Get all comments for a ticket (filtered by role)
     */
    static async getByTicketId(ticketId, userRole, userId) {
        const query = `
            SELECT 
                tc.id,
                tc.ticket_id,
                tc.user_id,
                tc.user_type,
                tc.content,
                tc.is_internal,
                tc.parent_comment_id,
                tc.created_at,
                tc.updated_at,
                tc.deleted_at,
                tc.reaction_count,
                u.first_name,
                u.last_name,
                u.email,
                u.role as role_name
            FROM ticket_comments tc
            JOIN users u ON tc.user_id = u.id
            WHERE tc.ticket_id = $1 
                AND tc.deleted_at IS NULL
                ${userRole === 'customer' ? 'AND tc.is_internal = false' : ''}
            ORDER BY tc.created_at ASC
        `;
        
        const result = await pool.query(query, [ticketId]);
        return result.rows;
    }

    /**
     * Create a new comment
     */
    static async create(commentData) {
        const { ticketId, userId, userType, content, isInternal, parentCommentId } = commentData;
        
        const query = `
            INSERT INTO ticket_comments 
                (ticket_id, user_id, user_type, content, is_internal, parent_comment_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            ticketId,
            userId,
            userType,
            content,
            isInternal || false,
            parentCommentId || null
        ]);
        
        return result.rows[0];
    }

    /**
     * Update a comment (only content and is_internal can be updated)
     */
    static async update(commentId, userId, updates) {
        const { content, isInternal } = updates;
        
        const query = `
            UPDATE ticket_comments
            SET 
                content = COALESCE($1, content),
                is_internal = COALESCE($2, is_internal),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 
                AND user_id = $4 
                AND deleted_at IS NULL
                AND created_at >= NOW() - INTERVAL '15 minutes'
            RETURNING *
        `;
        
        const result = await pool.query(query, [content, isInternal, commentId, userId]);
        return result.rows[0];
    }

    /**
     * Soft delete a comment
     */
    static async delete(commentId, userId, isManagement) {
        const query = `
            UPDATE ticket_comments
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 
                AND (user_id = $2 OR $3 = true)
                AND deleted_at IS NULL
            RETURNING *
        `;
        
        const result = await pool.query(query, [commentId, userId, isManagement]);
        return result.rows[0];
    }

    /**
     * Get a single comment by ID
     */
    static async getById(commentId) {
        const query = `
            SELECT 
                tc.*,
                u.first_name,
                u.last_name,
                u.email,
                u.role as role_name
            FROM ticket_comments tc
            JOIN users u ON tc.user_id = u.id
            WHERE tc.id = $1 AND tc.deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [commentId]);
        return result.rows[0];
    }

    /**
     * Add a reaction to a comment
     */
    static async addReaction(commentId, userId, emoji) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Insert reaction
            await client.query(
                `INSERT INTO comment_reactions (comment_id, user_id, emoji)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (comment_id, user_id, emoji) DO NOTHING`,
                [commentId, userId, emoji]
            );
            
            // Update reaction count cache
            await client.query(
                `UPDATE ticket_comments
                 SET reaction_count = (
                     SELECT jsonb_object_agg(emoji, count)
                     FROM (
                         SELECT emoji, COUNT(*)::int as count
                         FROM comment_reactions
                         WHERE comment_id = $1
                         GROUP BY emoji
                     ) counts
                 )
                 WHERE id = $1`,
                [commentId]
            );
            
            await client.query('COMMIT');
            
            // Return updated comment
            return await this.getById(commentId);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Remove a reaction from a comment
     */
    static async removeReaction(commentId, userId, emoji) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Delete reaction
            await client.query(
                `DELETE FROM comment_reactions
                 WHERE comment_id = $1 AND user_id = $2 AND emoji = $3`,
                [commentId, userId, emoji]
            );
            
            // Update reaction count cache
            await client.query(
                `UPDATE ticket_comments
                 SET reaction_count = (
                     SELECT COALESCE(jsonb_object_agg(emoji, count), '{}'::jsonb)
                     FROM (
                         SELECT emoji, COUNT(*)::int as count
                         FROM comment_reactions
                         WHERE comment_id = $1
                         GROUP BY emoji
                     ) counts
                 )
                 WHERE id = $1`,
                [commentId]
            );
            
            await client.query('COMMIT');
            
            // Return updated comment
            return await this.getById(commentId);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Search comments within a ticket
     */
    static async search(ticketId, searchTerm, userRole) {
        const query = `
            SELECT 
                tc.id,
                tc.ticket_id,
                tc.user_id,
                tc.user_type,
                tc.content,
                tc.is_internal,
                tc.created_at,
                u.first_name,
                u.last_name,
                u.role as role_name
            FROM ticket_comments tc
            JOIN users u ON tc.user_id = u.id
            WHERE tc.ticket_id = $1 
                AND tc.deleted_at IS NULL
                AND tc.content ILIKE $2
                ${userRole === 'customer' ? 'AND tc.is_internal = false' : ''}
            ORDER BY tc.created_at DESC
            LIMIT 50
        `;
        
        const result = await pool.query(query, [ticketId, `%${searchTerm}%`]);
        return result.rows;
    }
}

export default TicketComment;
