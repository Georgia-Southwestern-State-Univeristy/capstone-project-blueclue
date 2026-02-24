// src/controllers/commentController.js
import TicketComment from '../models/TicketComment.js';
import Ticket from '../models/Ticket.js';
import Notification from '../models/Notification.js';
import TicketCollaborator from '../models/TicketCollaborator.js';
import pool from '../config/database.js';
import { sendCommentNotificationToTech, sendCommentNotificationToClient } from '../services/emailService.js';
import { emitNotificationToUser, emitUnreadCountToUser } from '../services/socketService.js';

/**
 * Get all comments for a ticket
 * GET /api/tickets/:ticketId/comments
 */
export const getCommentsByTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Verify user has access to this ticket
        const ticket = await Ticket.getById(ticketId);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Customer can only view their own tickets
        if (userRole === 'customer' && ticket.customer_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const comments = await TicketComment.getByTicketId(ticketId, userRole, userId);
        
        res.json({
            success: true,
            data: comments
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ 
            error: 'Failed to fetch comments',
            details: error.message 
        });
    }
};

/**
 * Create a new comment
 * POST /api/tickets/:ticketId/comments
 */
export const createComment = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { content, isInternal, parentCommentId } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Validation
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        if (content.length > 2000) {
            return res.status(400).json({ error: 'Comment cannot exceed 2000 characters' });
        }

        // Verify ticket exists
        const ticket = await Ticket.getById(ticketId);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Customer can only comment on their own tickets
        if (userRole === 'customer' && ticket.customer_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Only techs and management can create internal comments
        if (isInternal && userRole === 'customer') {
            return res.status(403).json({ error: 'Customers cannot create internal comments' });
        }

        // Verify parent comment exists if specified
        if (parentCommentId) {
            const parentComment = await TicketComment.getById(parentCommentId);
            if (!parentComment || parentComment.ticket_id !== parseInt(ticketId)) {
                return res.status(404).json({ error: 'Parent comment not found' });
            }
        }

        // Map user role to user_type enum
        let userType = 'client';
        if (userRole === 'technician' || userRole === 'senior_technician') {
            userType = 'tech';
        } else if (userRole === 'management') {
            userType = 'management';
        } else if (userRole === 'customer') {
            userType = 'client';
        }

        const comment = await TicketComment.create({
            ticketId,
            userId,
            userType,
            content: content.trim(),
            isInternal: isInternal || false,
            parentCommentId: parentCommentId || null
        });

        // Fetch full comment with user details for notifications
        const fullComment = await TicketComment.getById(comment.id);

        // Emit real-time event to all watching this ticket
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${ticketId}`).emit('new_comment', {
                ticketId,
                comment: fullComment
            });
        }

        // Create database notifications and emit WebSocket events
        setImmediate(async () => {
            try {
                const commenterName = `${fullComment.first_name} ${fullComment.last_name}`;
                let notificationTargetId = null;
                let notificationMessage = '';
                
                // Client commented -> Notify assigned tech
                if (userType === 'client' && ticket.assigned_to) {
                    notificationTargetId = ticket.assigned_to;
                    notificationMessage = `${commenterName} commented on ticket #${ticket.ticket_number}`;
                    
                    // Create database notification
                    const notification = await Notification.create({
                        user_id: notificationTargetId,
                        type: 'comment',
                        message: notificationMessage,
                        ticket_id: ticketId
                    });
                    
                    // Get unread count
                    const unreadCount = await Notification.getUnreadCountByUserId(notificationTargetId);
                    
                    // Emit WebSocket notification
                    if (io) {
                        emitNotificationToUser(io, notificationTargetId, notification);
                        emitUnreadCountToUser(io, notificationTargetId, unreadCount);
                    }
                    
                    // Send email notification to tech
                    const techResult = await pool.query(
                        'SELECT email, first_name, last_name FROM users WHERE id = $1',
                        [ticket.assigned_to]
                    );
                    
                    if (techResult.rows.length > 0) {
                        const tech = techResult.rows[0];
                        const techName = `${tech.first_name} ${tech.last_name}`;
                        
                        await sendCommentNotificationToTech(
                            tech.email,
                            techName,
                            commenterName,
                            ticket,
                            content.trim(),
                            ticket.assigned_to
                        );
                    }
                }
                
                // Tech/Management commented (non-internal) -> Notify client
                else if ((userType === 'tech' || userType === 'management') && !isInternal && ticket.customer_id) {
                    notificationTargetId = ticket.customer_id;
                    notificationMessage = `${commenterName} commented on your ticket #${ticket.ticket_number}`;
                    
                    // Create database notification
                    const notification = await Notification.create({
                        user_id: notificationTargetId,
                        type: 'comment',
                        message: notificationMessage,
                        ticket_id: ticketId
                    });
                    
                    // Get unread count
                    const unreadCount = await Notification.getUnreadCountByUserId(notificationTargetId);
                    
                    // Emit WebSocket notification
                    if (io) {
                        emitNotificationToUser(io, notificationTargetId, notification);
                        emitUnreadCountToUser(io, notificationTargetId, unreadCount);
                    }
                    
                    // Send email notification to client
                    const clientResult = await pool.query(
                        'SELECT email, first_name, last_name FROM users WHERE id = $1',
                        [ticket.customer_id]
                    );
                    
                    if (clientResult.rows.length > 0) {
                        const client = clientResult.rows[0];
                        const clientName = `${client.first_name} ${client.last_name}`;
                        
                        await sendCommentNotificationToClient(
                            client.email,
                            clientName,
                            commenterName,
                            ticket,
                            content.trim(),
                            ticket.customer_id
                        );
                    }
                }
                
                // Notify all collaborators (for internal comments or tech/management comments)
                if (isInternal || userType === 'tech' || userType === 'management') {
                    const collaborators = await TicketCollaborator.getByTicketId(ticketId);
                    
                    for (const collab of collaborators) {
                        // Don't notify the commenter themselves
                        if (collab.user_id === userId) continue;
                        
                        const collaboratorNotification = await Notification.create({
                            user_id: collab.user_id,
                            type: 'comment',
                            message: `${commenterName} commented on ticket #${ticket.ticket_number}`,
                            ticket_id: ticketId
                        });
                        
                        // Get unread count
                        const collabUnreadCount = await Notification.getUnreadCountByUserId(collab.user_id);
                        
                        // Emit WebSocket notification
                        if (io) {
                            emitNotificationToUser(io, collab.user_id, collaboratorNotification);
                            emitUnreadCountToUser(io, collab.user_id, collabUnreadCount);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to send comment notifications:', error);
                // Don't throw - notification failure shouldn't affect the response
            }
        });

        res.status(201).json({
            success: true,
            data: comment
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ 
            error: 'Failed to create comment',
            details: error.message 
        });
    }
};

/**
 * Update a comment
 * PATCH /api/comments/:commentId
 */
export const updateComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content, isInternal } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Validation
        if (content && content.length > 2000) {
            return res.status(400).json({ error: 'Comment cannot exceed 2000 characters' });
        }

        // Only techs and management can update is_internal flag
        if (isInternal !== undefined && userRole === 'customer') {
            return res.status(403).json({ error: 'Customers cannot modify internal comment status' });
        }

        const comment = await TicketComment.update(commentId, userId, {
            content: content?.trim(),
            isInternal
        });

        if (!comment) {
            return res.status(404).json({ 
                error: 'Comment not found or cannot be edited (only editable within 15 minutes)' 
            });
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${comment.ticket_id}`).emit('comment_updated', {
                ticketId: comment.ticket_id,
                comment
            });
        }

        res.json({
            success: true,
            data: comment
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ 
            error: 'Failed to update comment',
            details: error.message 
        });
    }
};

/**
 * Delete a comment
 * DELETE /api/comments/:commentId
 */
export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const isManagement = userRole === 'management' || userRole === 'manager';

        const comment = await TicketComment.delete(commentId, userId, isManagement);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${comment.ticket_id}`).emit('comment_deleted', {
                ticketId: comment.ticket_id,
                commentId
            });
        }

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ 
            error: 'Failed to delete comment',
            details: error.message 
        });
    }
};

/**
 * Add a reaction to a comment
 * POST /api/comments/:commentId/reactions
 */
export const addReaction = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { emoji } = req.body;
        const userId = req.user.id;

        // Validate emoji
        const allowedEmojis = ['👍', '❤️', '😊', '🎉', '✅', '👏'];
        if (!emoji || !allowedEmojis.includes(emoji)) {
            return res.status(400).json({ 
                error: 'Invalid emoji',
                allowedEmojis 
            });
        }

        const comment = await TicketComment.addReaction(commentId, userId, emoji);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${comment.ticket_id}`).emit('reaction_added', {
                ticketId: comment.ticket_id,
                commentId,
                emoji,
                userId,
                reactionCount: comment.reaction_count
            });
        }

        res.json({
            success: true,
            data: comment
        });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ 
            error: 'Failed to add reaction',
            details: error.message 
        });
    }
};

/**
 * Remove a reaction from a comment
 * DELETE /api/comments/:commentId/reactions/:emoji
 */
export const removeReaction = async (req, res) => {
    try {
        const { commentId, emoji } = req.params;
        const userId = req.user.id;

        const comment = await TicketComment.removeReaction(commentId, userId, emoji);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${comment.ticket_id}`).emit('reaction_removed', {
                ticketId: comment.ticket_id,
                commentId,
                emoji,
                userId,
                reactionCount: comment.reaction_count
            });
        }

        res.json({
            success: true,
            data: comment
        });
    } catch (error) {
        console.error('Error removing reaction:', error);
        res.status(500).json({ 
            error: 'Failed to remove reaction',
            details: error.message 
        });
    }
};

/**
 * Search comments in a ticket
 * GET /api/tickets/:ticketId/comments/search?q=searchTerm
 */
export const searchComments = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { q: searchTerm } = req.query;
        const userRole = req.user.role_name || req.user.role;

        if (!searchTerm || searchTerm.trim().length === 0) {
            return res.status(400).json({ error: 'Search term is required' });
        }

        const comments = await TicketComment.search(ticketId, searchTerm.trim(), userRole);

        res.json({
            success: true,
            data: comments
        });
    } catch (error) {
        console.error('Error searching comments:', error);
        res.status(500).json({ 
            error: 'Failed to search comments',
            details: error.message 
        });
    }
};
