import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import TicketChat from '../models/TicketChat.js';
import Notification from '../models/Notification.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * POST /api/tickets/:ticketId/chat/request
 * Client requests a chat with the assigned technician
 */
router.post('/:ticketId/chat/request', authenticateToken, async (req, res) => {
    try {
        const ticketId = parseInt(req.params.ticketId, 10);
        const clientId = req.user.id;

        // Get ticket to verify ownership and find assigned tech
        const ticketResult = await pool.query(
            'SELECT id, assigned_to, customer_id, subject FROM tickets WHERE id = $1',
            [ticketId]
        );
        const ticket = ticketResult.rows[0];
        if (!ticket) {
            return res.status(404).json({ status: 'error', message: 'Ticket not found' });
        }
        if (ticket.customer_id !== clientId) {
            return res.status(403).json({ status: 'error', message: 'Only the ticket owner can request a chat' });
        }
        if (!ticket.assigned_to) {
            return res.status(400).json({ status: 'error', message: 'No technician assigned to this ticket' });
        }

        // Check for existing active chat
        const existing = await TicketChat.getByTicketId(ticketId);
        if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
            return res.status(409).json({ status: 'error', message: 'A chat session already exists for this ticket', data: existing });
        }

        const chat = await TicketChat.requestChat(ticketId, clientId, ticket.assigned_to);

        // Notify the assigned tech
        await Notification.create({
            user_id: ticket.assigned_to,
            type: 'ticket_chat_request',
            message: `Chat requested on ticket #${ticketId}: ${ticket.subject}`,
            ticket_id: ticketId,
            metadata: { chat_id: chat.id, client_id: clientId }
        });

        res.status(201).json({ status: 'success', data: chat });
    } catch (error) {
        console.error('Request ticket chat error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to request chat' });
    }
});

/**
 * GET /api/tickets/:ticketId/chat
 * Get chat session for a ticket (client or tech)
 */
router.get('/:ticketId/chat', authenticateToken, async (req, res) => {
    try {
        const ticketId = parseInt(req.params.ticketId, 10);
        const chat = await TicketChat.getByTicketId(ticketId);

        if (!chat) {
            return res.json({ status: 'success', data: null });
        }

        // Only participants can view
        if (chat.client_id !== req.user.id && chat.tech_id !== req.user.id) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }

        res.json({ status: 'success', data: chat });
    } catch (error) {
        console.error('Get ticket chat error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to get chat' });
    }
});

/**
 * POST /api/tickets/:ticketId/chat/:chatId/accept
 * Tech accepts a chat request
 */
router.post('/:ticketId/chat/:chatId/accept', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);
        const techId = req.user.id;

        const chat = await TicketChat.acceptChat(chatId, techId);
        if (!chat) {
            return res.status(404).json({ status: 'error', message: 'Chat request not found or already responded' });
        }

        // Notify the client
        await Notification.create({
            user_id: chat.client_id,
            type: 'ticket_chat_accepted',
            message: `Your chat request on ticket #${chat.ticket_id} has been accepted`,
            ticket_id: chat.ticket_id,
            metadata: { chat_id: chat.id }
        });

        res.json({ status: 'success', data: chat });
    } catch (error) {
        console.error('Accept ticket chat error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to accept chat' });
    }
});

/**
 * POST /api/tickets/:ticketId/chat/:chatId/decline
 * Tech declines a chat request
 */
router.post('/:ticketId/chat/:chatId/decline', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);
        const techId = req.user.id;

        const chat = await TicketChat.declineChat(chatId, techId);
        if (!chat) {
            return res.status(404).json({ status: 'error', message: 'Chat request not found or already responded' });
        }

        res.json({ status: 'success', data: chat });
    } catch (error) {
        console.error('Decline ticket chat error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to decline chat' });
    }
});

/**
 * POST /api/tickets/:ticketId/chat/:chatId/close
 * Either participant can close the chat
 */
router.post('/:ticketId/chat/:chatId/close', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);

        // Verify participant
        const chatResult = await pool.query(
            'SELECT * FROM ticket_chats WHERE id = $1',
            [chatId]
        );
        const chatRow = chatResult.rows[0];
        if (!chatRow || (chatRow.client_id !== req.user.id && chatRow.tech_id !== req.user.id)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }

        const chat = await TicketChat.closeChat(chatId);
        if (!chat) {
            return res.status(400).json({ status: 'error', message: 'Chat is not active' });
        }

        res.json({ status: 'success', data: chat });
    } catch (error) {
        console.error('Close ticket chat error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to close chat' });
    }
});

/**
 * GET /api/tickets/:ticketId/chat/:chatId/messages
 * Get messages for a chat
 */
router.get('/:ticketId/chat/:chatId/messages', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);
        const { limit, before } = req.query;

        const messages = await TicketChat.getMessages(chatId, req.user.id, {
            limit: limit ? parseInt(limit, 10) : 100,
            before
        });

        res.json({ status: 'success', data: messages });
    } catch (error) {
        console.error('Get ticket chat messages error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to get messages' });
    }
});

/**
 * POST /api/tickets/:ticketId/chat/:chatId/messages
 * Send a message in the chat
 */
router.post('/:ticketId/chat/:chatId/messages', authenticateToken, async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId, 10);
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ status: 'error', message: 'Message is required' });
        }
        if (message.length > 5000) {
            return res.status(400).json({ status: 'error', message: 'Message too long (max 5000 characters)' });
        }

        const msg = await TicketChat.sendMessage(chatId, req.user.id, message.trim());
        if (!msg) {
            return res.status(403).json({ status: 'error', message: 'Chat is not active or you are not a participant' });
        }

        // Notify the other participant
        const chatResult = await pool.query(
            'SELECT tc.client_id, tc.tech_id, tc.ticket_id, t.subject FROM ticket_chats tc JOIN tickets t ON t.id = tc.ticket_id WHERE tc.id = $1',
            [chatId]
        );
        const chat = chatResult.rows[0];
        if (chat) {
            const recipientId = req.user.id === chat.client_id ? chat.tech_id : chat.client_id;
            await Notification.create({
                user_id: recipientId,
                type: 'ticket_chat_message',
                message: `New chat message on ticket #${chat.ticket_id}: ${chat.subject}`,
                ticket_id: chat.ticket_id,
                metadata: { chat_id: chatId }
            });
        }

        res.status(201).json({ status: 'success', data: msg });
    } catch (error) {
        console.error('Send ticket chat message error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send message' });
    }
});

export default router;
