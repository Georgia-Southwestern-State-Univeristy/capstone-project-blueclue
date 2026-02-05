// src/controllers/ticketController.js
import Ticket from '../models/Ticket.js';
import AIClassification from '../models/AIClassification.js';
import { classifyTicketWithFallback } from '../services/aiService.js';

/**
 * Create a new ticket
 * POST /api/tickets
 */
export const createTicket = async (req, res) => {
    try {
        const { subject, description, customer_id, priority, category } = req.body;

        // Validation
        if (!subject || subject.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Subject is required'
            });
        }

        if (!description || description.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Description is required'
            });
        }

        if (!customer_id) {
            return res.status(400).json({
                status: 'error',
                message: 'customer_id (user ID) is required'
            });
        }

        // Combine subject and description for AI classification
        const ticketText = `${subject.trim()}. ${description.trim()}`;

        // Get AI classification with fallback to manual or default values
        const aiResult = await classifyTicketWithFallback(ticketText, {
            category: category || 'general',
            priority: priority || 'low'
        });

        // Use AI classification if available, otherwise use provided or default values
        const finalCategory = category || aiResult.category;
        const finalPriority = priority || aiResult.priority;

        // Create ticket with AI classification metadata
        const ticket = await Ticket.create({
            subject: subject.trim(),
            description: description.trim(),
            customer_id,
            priority: finalPriority,
            category: finalCategory,
            ai_classified: aiResult.aiClassified,
            ai_confidence: aiResult.confidence,
            ai_fallback_used: aiResult.fallbackUsed,
            ai_keywords_matched: aiResult.aiClassified ? {
                category_keywords: aiResult.category_keywords || [],
                priority_keywords: aiResult.priority_keywords || []
            } : null
        });

        // Save AI classification to ai_classifications table
        if (aiResult.aiClassified) {
            await AIClassification.create({
                ticket_id: ticket.id,
                predicted_category: aiResult.category,
                predicted_priority: aiResult.priority,
                confidence: aiResult.confidence,
                keywords_matched: {
                    category_keywords: aiResult.category_keywords || [],
                    priority_keywords: aiResult.priority_keywords || []
                },
                fallback_used: aiResult.fallbackUsed
            });
        }

        // Add AI classification info to response
        const response = {
            status: 'success',
            message: 'Ticket created successfully',
            data: ticket,
            ai_classification: {
                used: aiResult.aiClassified,
                confidence: aiResult.confidence,
                fallback_used: aiResult.fallbackUsed,
                category: finalCategory,
                priority: finalPriority
            }
        };

        // Include warning if AI service failed
        if (!aiResult.aiClassified && aiResult.error) {
            response.ai_classification.warning = `AI service unavailable: ${aiResult.error}`;
        }

        res.status(201).json(response);

    } catch (error) {
        console.error('Create ticket error:', error);
        
        if (error.code === '23503') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID or category'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to create ticket',
            error: error.message
        });
    }
};

/**
 * Get all tickets
 * GET /api/tickets
 */
export const getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.getAll();

        res.status(200).json({
            status: 'success',
            count: tickets.length,
            data: tickets
        });

    } catch (error) {
        console.error('Get all tickets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve tickets',
            error: error.message
        });
    }
};

/**
 * Get a single ticket by ID
 * GET /api/tickets/:id
 */
export const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        const ticket = await Ticket.getById(parseInt(id));

        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: ticket
        });

    } catch (error) {
        console.error('Get ticket by ID error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve ticket',
            error: error.message
        });
    }
};

/**
 * Update a ticket
 * PUT /api/tickets/:id
 */
export const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No fields to update'
            });
        }

        if (updates.subject !== undefined && updates.subject.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Subject cannot be empty'
            });
        }

        if (updates.description !== undefined && updates.description.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Description cannot be empty'
            });
        }

        if (updates.subject) updates.subject = updates.subject.trim();
        if (updates.description) updates.description = updates.description.trim();

        const ticket = await Ticket.update(parseInt(id), updates);

        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Ticket updated successfully',
            data: ticket
        });

    } catch (error) {
        console.error('Update ticket error:', error);

        if (error.code === '23503') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category'
            });
        }

        if (error.message === 'No valid fields to update') {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to update ticket',
            error: error.message
        });
    }
};

/**
 * Delete a ticket (soft delete)
 * DELETE /api/tickets/:id
 */
export const deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        const ticket = await Ticket.delete(parseInt(id));

        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Ticket deleted successfully',
            data: ticket
        });

    } catch (error) {
        console.error('Delete ticket error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete ticket',
            error: error.message
        });
    }
};
