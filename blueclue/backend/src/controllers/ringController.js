import RingRequest from '../models/RingRequest.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import TicketCollaborator from '../models/TicketCollaborator.js';
import Notification from '../models/Notification.js';
import TicketHistory from '../models/TicketHistory.js';
import { emitNotificationToUser } from '../services/socketService.js';
import { sendEmail } from '../services/emailService.js';

/**
 * Send a ring request to another technician for help
 * POST /api/tickets/:id/ring
 */
export const sendRingRequest = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { targetTechId, urgencyLevel = 'medium', message } = req.body;
    const requestingTechId = req.user.id;

    // Validate input
    if (!targetTechId) {
      return res.status(400).json({
        status: 'error',
        message: 'Target technician ID is required'
      });
    }

    if (!['low', 'medium', 'high'].includes(urgencyLevel)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid urgency level. Must be "low", "medium", or "high"'
      });
    }

    // Prevent self-ring
    if (targetTechId === requestingTechId) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot send ring request to yourself'
      });
    }

    // Get ticket
    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    // Check if requesting user is working on this ticket
    const primaryCollab = await TicketCollaborator.getPrimaryByTicketId(ticketId);
    const isAssigned = ticket.assigned_to === requestingTechId;
    const isPrimary = primaryCollab && primaryCollab.user_id === requestingTechId;
    const allCollaborators = await TicketCollaborator.getByTicketId(ticketId);
    const isCollaborator = allCollaborators.some(c => c.user_id === requestingTechId);

    if (!isAssigned && !isPrimary && !isCollaborator) {
      return res.status(403).json({
        status: 'error',
        message: 'You must be working on this ticket to request help'
      });
    }

    // Check rate limit
    const rateLimit = await RingRequest.checkRateLimit(requestingTechId);
    if (!rateLimit.canSend) {
      return res.status(429).json({
        status: 'error',
        message: rateLimit.message,
        reason: rateLimit.reason,
        nextAvailable: rateLimit.nextAvailable
      });
    }

    // Check if target tech exists and is a technician
    const targetTech = await User.getById(targetTechId);
    if (!targetTech) {
      return res.status(404).json({
        status: 'error',
        message: 'Target technician not found'
      });
    }

    const techRoles = ['technician', 'senior_technician', 'admin', 'management'];
    if (!techRoles.includes(targetTech.role)) {
      return res.status(400).json({
        status: 'error',
        message: 'Target user is not a technician'
      });
    }

    // Check if target tech is available (not in DND)
    const isAvailable = await RingRequest.isAvailable(targetTechId);
    if (!isAvailable) {
      return res.status(400).json({
        status: 'error',
        message: `${targetTech.first_name} ${targetTech.last_name} is currently in Do Not Disturb mode`
      });
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
  } catch (error) {
    console.error('Error sending ring request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send ring request',
      error: error.message
    });
  }
};

/**
 * Get incoming ring requests for the logged-in technician
 * GET /api/ring-requests
 */
export const getIncomingRingRequests = async (req, res) => {
  try {
    const techId = req.user.id;

    // Get pending ring requests
    const ringRequests = await RingRequest.getIncomingRequests(techId, false);

    // Timeout any expired requests (>5 minutes)
    await RingRequest.timeoutExpired(5);

    res.status(200).json({
      status: 'success',
      data: ringRequests
    });
  } catch (error) {
    console.error('Error fetching ring requests:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ring requests',
      error: error.message
    });
  }
};

/**
 * Respond to a ring request (accept or decline)
 * POST /api/ring-requests/:id/respond
 */
export const respondToRingRequest = async (req, res) => {
  try {
    const ringRequestId = parseInt(req.params.id);
    const { action } = req.body; // 'accept' or 'decline'
    const respondingTechId = req.user.id;

    // Validate action
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Must be "accept" or "decline"'
      });
    }

    // Get ring request
    const ringRequest = await RingRequest.getById(ringRequestId);
    if (!ringRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Ring request not found'
      });
    }

    // Verify the responding user is the target
    if (ringRequest.target_tech_id !== respondingTechId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to respond to this request'
      });
    }

    // Check if already responded
    if (ringRequest.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Ring request already ${ringRequest.status}`
      });
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
      } catch (error) {
        console.error('Error adding collaborator after accepting ring:', error);
        // Continue even if collaborator add fails
      }
    }

    // Get responding user info
    const respondingUser = await User.getById(respondingTechId);

    // Create notification for the requester
    const notification = await Notification.create({
      user_id: ringRequest.requesting_tech_id,
      type: 'ring_response',
      priority: 'medium',
      title: action === 'accept' ? '✅ Ring Request Accepted' : '❌ Ring Request Declined',
      message: `${respondingUser.first_name} ${respondingUser.last_name} ${action === 'accept' ? 'accepted' : 'declined'} your ring request for Ticket #${ringRequest.ticket_id}`,
      ticket_id: ringRequest.ticket_id,
      link: `/tickets/${ringRequest.ticket_id}`,
      metadata: {
        ring_request_id: ringRequestId,
        action: action,
        response_time: updatedRequest.response_time_seconds
      }
    });

    // Log to ticket history
    await TicketHistory.log(
      ringRequest.ticket_id,
      respondingTechId,
      action === 'accept' ? 'ring_request_accepted' : 'ring_request_declined',
      null,
      null,
      null,
      null,
      {
        ring_request_id: ringRequestId,
        requesting_tech_id: ringRequest.requesting_tech_id,
        requesting_tech_name: `${ringRequest.requester_first_name} ${ringRequest.requester_last_name}`,
        response_time_seconds: updatedRequest.response_time_seconds
      }
    );

    // Emit real-time WebSocket notification to requester
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, ringRequest.requesting_tech_id, notification);
    }

    // Send email notification to requester
    const requester = await User.getById(ringRequest.requesting_tech_id);
    await sendEmail(
      requester.email,
      `Ring Request ${action === 'accept' ? 'Accepted' : 'Declined'} - Ticket #${ringRequest.ticket_id}`,
      `
        <h2>Ring Request ${action === 'accept' ? 'Accepted ✅' : 'Declined ❌'}</h2>
        <p><strong>${respondingUser.first_name} ${respondingUser.last_name}</strong> has ${action === 'accept' ? 'accepted' : 'declined'} your ring request.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket:</strong> #${ringRequest.ticket_id} - ${ringRequest.ticket_subject}</p>
          <p><strong>Response Time:</strong> ${updatedRequest.response_time_seconds} seconds</p>
        </div>
        
        ${action === 'accept' 
          ? `<p>${respondingUser.first_name} has been added as an assisting technician and will help you with this ticket.</p>`
          : `<p>You can try ringing another technician if you still need help.</p>`
        }
        
        <p>
          <a href="${process.env.FRONTEND_URL}/tickets/${ringRequest.ticket_id}" 
             style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Ticket
          </a>
        </p>
      `,
      null,
      'ring_response',
      requester.id
    );

    res.status(200).json({
      status: 'success',
      message: `Ring request ${action}ed successfully`,
      data: {
        ringRequest: updatedRequest,
        addedAsCollaborator: action === 'accept'
      }
    });
  } catch (error) {
    console.error('Error responding to ring request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to respond to ring request',
      error: error.message
    });
  }
};

/**
 * Get ring request metrics for the logged-in technician
 * GET /api/ring-requests/metrics
 */
export const getRingMetrics = async (req, res) => {
  try {
    const techId = req.user.id;
    const metrics = await RingRequest.getMetrics(techId);

    res.status(200).json({
      status: 'success',
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching ring metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ring metrics',
      error: error.message
    });
  }
};

/**
 * Get ring request history for a ticket
 * GET /api/tickets/:id/ring-history
 */
export const getTicketRingHistory = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);

    // Verify ticket exists
    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    // Get ring history (last 24 hours)
    const ringHistory = await RingRequest.getByTicketId(ticketId, 24);

    res.status(200).json({
      status: 'success',
      data: ringHistory
    });
  } catch (error) {
    console.error('Error fetching ring history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ring history',
      error: error.message
    });
  }
};
