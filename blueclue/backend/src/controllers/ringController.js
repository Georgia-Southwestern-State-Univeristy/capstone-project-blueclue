import RingRequest from '../models/RingRequest.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import TicketCollaborator from '../models/TicketCollaborator.js';
import Notification from '../models/Notification.js';
import TicketHistory from '../models/TicketHistory.js';
import { emitNotificationToUser, emitEventToUser } from '../services/socketService.js';
import { sendEmail } from '../services/emailService.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler.js';

/**
 * Send a ring request to another technician for help
 * POST /api/tickets/:id/ring
 */
export const sendRingRequest = async (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { targetTechId, urgencyLevel = 'medium', message } = req.body;
    const requestingTechId = req.user.id;

    // Validate input
    if (!targetTechId) {
      throw new BadRequestError('Target technician ID is required');
    }

    if (!['low', 'medium', 'high'].includes(urgencyLevel)) {
      throw new BadRequestError('Invalid urgency level. Must be "low", "medium", or "high"');
    }

    // Prevent self-ring
    if (targetTechId === requestingTechId) {
      throw new BadRequestError('Cannot send ring request to yourself');
    }

    // Get ticket
    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Check if requesting user is working on this ticket
    const primaryCollab = await TicketCollaborator.getPrimaryByTicketId(ticketId);
    const isAssigned = ticket.assigned_to === requestingTechId;
    const isPrimary = primaryCollab && primaryCollab.user_id === requestingTechId;
    const allCollaborators = await TicketCollaborator.getByTicketId(ticketId);
    const isCollaborator = allCollaborators.some(c => c.user_id === requestingTechId);

    if (!isAssigned && !isPrimary && !isCollaborator) {
      throw new ForbiddenError('You must be working on this ticket to request help');
    }

    // Check rate limit
    const rateLimit = await RingRequest.checkRateLimit(requestingTechId);
    if (!rateLimit.canSend) {
      throw new AppError(rateLimit.message, 429, { reason: rateLimit.reason, nextAvailable: rateLimit.nextAvailable });
    }

    // Check if target tech exists and is a technician
    const targetTech = await User.getById(targetTechId);
    if (!targetTech) {
      throw new NotFoundError('Target technician not found');
    }

    const techRoles = ['technician', 'senior_technician', 'admin', 'management'];
    if (!techRoles.includes(targetTech.role)) {
      throw new BadRequestError('Target user is not a technician');
    }

    // Check if target tech is available (not in DND)
    const isAvailable = await RingRequest.isAvailable(targetTechId);
    if (!isAvailable) {
      throw new BadRequestError(`${targetTech.first_name} ${targetTech.last_name} is currently in Do Not Disturb mode`);
    }

    // Create ring request
    const ringRequest = await RingRequest.create(
      ticketId,
      requestingTechId,
      targetTechId,
      urgencyLevel,
      message
    );

    // Record for rate limiting
    await RingRequest.recordRequest(requestingTechId);

    // Get requesting user info
    const requestingUser = await User.getById(requestingTechId);

    // Create high-priority notification
    const notification = await Notification.create({
      user_id: targetTechId,
      type: 'ring_request',
      priority: urgencyLevel === 'high' ? 'high' : 'medium',
      title: '🔔 Ring for Help Request',
      message: `${requestingUser.first_name} ${requestingUser.last_name} needs help with Ticket #${ticketId}`,
      ticket_id: ticketId,
      link: `/tickets/${ticketId}`,
      metadata: {
        ring_request_id: ringRequest.id,
        urgency_level: urgencyLevel,
        requesting_tech_id: requestingTechId,
        user_message: message
      }
    });

    // Log to ticket history
    await TicketHistory.log(
      ticketId,
      requestingTechId,
      'ring_request_sent',
      null,
      null,
      null,
      null,
      {
        target_tech_id: targetTechId,
        target_tech_name: `${targetTech.first_name} ${targetTech.last_name}`,
        urgency_level: urgencyLevel,
        message: message
      }
    );

    // Emit real-time WebSocket notification
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, targetTechId, notification);
      // Also emit a dedicated ring_request event so the widget updates instantly
      emitEventToUser(req.app.locals.io, targetTechId, 'ring_request', {
        id: ringRequest.id,
        ticket_id: ticketId,
        ticket_subject: ticket.subject,
        requester_first_name: requestingUser.first_name,
        requester_last_name: requestingUser.last_name,
        urgency_level: urgencyLevel,
        message,
        created_at: ringRequest.created_at,
      });
    }

    // Send email notification if enabled
    if (targetTech.ring_sound_enabled) {
      await sendEmail(
        targetTech.email,
        `🔔 Ring for Help - Ticket #${ticketId}`,
        `
          <h2>Ring for Help Request</h2>
          <p><strong>${requestingUser.first_name} ${requestingUser.last_name}</strong> is requesting your help on a ticket.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Ticket:</strong> #${ticketId} - ${ticket.subject}</p>
            <p><strong>Urgency:</strong> <span style="color: ${urgencyLevel === 'high' ? '#d32f2f' : urgencyLevel === 'medium' ? '#f57c00' : '#388e3c'};">${urgencyLevel.toUpperCase()}</span></p>
            ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          </div>
          
          <p>
            <a href="${process.env.FRONTEND_URL}/tickets/${ticketId}" 
               style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Ticket & Respond
            </a>
          </p>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This request will auto-expire in 5 minutes if not responded to.
          </p>
        `,
        null,
        'ring_request',
        targetTech.id
      );
    }

    // Calculate next available time (10 min cooldown)
    const nextAvailable = new Date(Date.now() + 10 * 60 * 1000);

    res.status(201).json({
      status: 'success',
      message: 'Ring request sent successfully',
      data: {
        ringRequest: {
          id: ringRequest.id,
          ticketId: ticketId,
          targetTechId: targetTechId,
          urgencyLevel: urgencyLevel,
          status: 'pending',
          createdAt: ringRequest.created_at
        },
        cooldown: {
          nextAvailable: nextAvailable,
          cooldownMinutes: 10
        }
      }
    });
};

/**
 * Get incoming ring requests for the logged-in technician
 * GET /api/ring-requests
 */
export const getIncomingRingRequests = async (req, res) => {
    const techId = req.user.id;

    // Get pending ring requests
    const ringRequests = await RingRequest.getIncomingRequests(techId, false);

    // Timeout any expired requests (>5 minutes)
    await RingRequest.timeoutExpired(5);

    res.status(200).json({
      status: 'success',
      data: ringRequests
    });
};

/**
 * Respond to a ring request (accept or decline)
 * POST /api/ring-requests/:id/respond
 */
export const respondToRingRequest = async (req, res) => {
    const ringRequestId = parseInt(req.params.id);
    const { action } = req.body; // 'accept' or 'decline'
    const respondingTechId = req.user.id;

    // Validate action
    if (!['accept', 'decline'].includes(action)) {
      throw new BadRequestError('Invalid action. Must be "accept" or "decline"');
    }

    // Get ring request
    const ringRequest = await RingRequest.getById(ringRequestId);
    if (!ringRequest) {
      throw new NotFoundError('Ring request not found');
    }

    // Verify the responding user is the target
    if (ringRequest.target_tech_id !== respondingTechId) {
      throw new ForbiddenError('You are not authorized to respond to this request');
    }

    // Check if already responded
    if (ringRequest.status !== 'pending') {
      throw new BadRequestError(`Ring request already ${ringRequest.status}`);
    }

    // Update status
    const status = action === 'accept' ? 'accepted' : 'declined';
    const updatedRequest = await RingRequest.respond(ringRequestId, status);

    // If accepted, add as collaborator
    if (action === 'accept') {
      try {
        // Check if not already a collaborator
        const existingCollab = await TicketCollaborator.isCollaborator(
          ringRequest.ticket_id,
          respondingTechId
        );

        if (!existingCollab) {
          await TicketCollaborator.add(
            ringRequest.ticket_id,
            respondingTechId,
            'assisting',
            respondingTechId,
            `Accepted ring request from ${ringRequest.requester_first_name} ${ringRequest.requester_last_name}`
          );
        }
      } catch (_) { /* non-fatal: collaborator sync failure doesn't block ring response */ }
    }

    res.status(200).json({
      status: 'success',
      message: `Ring request ${status}`,
      data: updatedRequest
    });
};

/**
 * Get ring request metrics for the logged-in technician
 * GET /api/ring-requests/metrics
 */
export const getRingMetrics = async (req, res) => {
    const techId = req.user.id;
    const metrics = await RingRequest.getMetrics(techId);

    res.status(200).json({
      status: 'success',
      data: metrics
    });
};

/**
 * Get ring request history for a ticket
 * GET /api/tickets/:id/ring-history
 */
export const getTicketRingHistory = async (req, res) => {
    const ticketId = parseInt(req.params.id);

    // Verify ticket exists
    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Get ring history (last 24 hours)
    const ringHistory = await RingRequest.getByTicketId(ticketId, 24);

    res.status(200).json({
      status: 'success',
      data: ringHistory
    });
};
