import UpdateRequest from '../models/UpdateRequest.js';
import Notification from '../models/Notification.js';
import TicketHistory from '../models/TicketHistory.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import { sendEmail } from '../services/emailService.js';
import { emitNotificationToUser } from '../services/socketService.js';

/**
 * Request a status update from a technician
 * POST /api/tickets/:id/request-update
 */
export const requestUpdate = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const requestedBy = req.user.id;
    const { assignedTo, message, deadline } = req.body;

    // Validate required fields
    if (!assignedTo || !deadline) {
      return res.status(400).json({
        status: 'error',
        message: 'assignedTo and deadline are required'
      });
    }

    // Verify user has management role
    if (req.user.role !== 'management') {
      return res.status(403).json({
        status: 'error',
        message: 'Only management can request updates'
      });
    }

    // Get ticket details
    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    // Get assignee details
    const assignee = await User.getById(assignedTo);
    if (!assignee) {
      return res.status(404).json({
        status: 'error',
        message: 'Assigned user not found'
      });
    }

    // Verify assignee is a technician
    if (assignee.role !== 'technician') {
      return res.status(400).json({
        status: 'error',
        message: 'Can only request updates from technicians'
      });
    }

    // Create update request
    const updateRequest = await UpdateRequest.create(
      ticketId,
      requestedBy,
      assignedTo,
      message,
      new Date(deadline)
    );

    // Create high-priority notification for tech
    const notification = await Notification.create({
      user_id: assignedTo,
      type: 'update_request',
      priority: 'high',
      title: '⚠️ Status Update Requested',
      message: `${req.user.firstName} ${req.user.lastName} has requested a status update on Ticket #${ticketId}`,
      ticket_id: ticketId,
      link: `/tickets/${ticketId}`,
      metadata: {
        update_request_id: updateRequest.id,
        deadline: deadline,
        message: message
      }
    });

    // Log to ticket history
    await TicketHistory.log(
      ticketId,
      requestedBy,
      'update_requested',
      null,
      null,
      null,
      null,
      {
        update_request_id: updateRequest.id,
        requested_by_name: `${req.user.firstName} ${req.user.lastName}`,
        assigned_to: assignedTo,
        assigned_to_name: `${assignee.first_name} ${assignee.last_name}`,
        deadline: deadline,
        message: message
      }
    );

    // Emit real-time notification
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, assignedTo, notification);
    }

    // Send email notification
    const deadlineDate = new Date(deadline);
    const timeUntilDeadline = Math.round((deadlineDate - Date.now()) / (1000 * 60 * 60));
    
    await sendEmail(
      assignee.email,
      `⚠️ Status Update Requested - Ticket #${ticketId}`,
      `
        <h2>Status Update Requested</h2>
        <p><strong>${req.user.firstName} ${req.user.lastName}</strong> has requested a status update from you.</p>
        
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0;"><strong>⏰ Deadline:</strong> ${deadlineDate.toLocaleString()}</p>
          <p style="margin: 5px 0 0 0;"><strong>Time Remaining:</strong> ${timeUntilDeadline} hours</p>
        </div>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket:</strong> #${ticketId} - ${ticket.subject}</p>
          ${message ? `<p><strong>Request:</strong> ${message}</p>` : ''}
        </div>
        
        <p>Please provide a status update before the deadline using the update request form in the ticket.</p>
        
        <p>
          <a href="${process.env.FRONTEND_URL}/tickets/${ticketId}" 
             style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Ticket & Respond
          </a>
        </p>
      `,
      null,
      'update_request',
      assignee.id
    );

    // Get full details for response
    const fullRequest = await UpdateRequest.getById(updateRequest.id);

    res.status(201).json({
      status: 'success',
      message: 'Update request sent successfully',
      data: {
        updateRequest: fullRequest,
        notification
      }
    });
  } catch (error) {
    console.error('Error requesting update:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to request update',
      error: error.message
    });
  }
};

/**
 * Get update requests for the logged-in user
 * GET /api/update-requests
 */
export const getUpdateRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, role } = req.query;

    let requests;

    if (req.user.role === 'technician') {
      // Techs see requests assigned to them
      if (status === 'pending') {
        requests = await UpdateRequest.getPendingForTech(userId);
      } else {
        requests = await UpdateRequest.getByTicketId(userId);
      }
    } else if (req.user.role === 'management') {
      // Management sees all pending requests or their requested ones
      if (role === 'all') {
        requests = await UpdateRequest.getAllPending();
      } else {
        // Get requests they created
        const allRequests = await UpdateRequest.getAllPending();
        requests = allRequests.filter(r => r.requested_by === userId);
      }
    } else {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { requests }
    });
  } catch (error) {
    console.error('Error fetching update requests:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch update requests',
      error: error.message
    });
  }
};

/**
 * Fulfill an update request
 * POST /api/update-requests/:id/fulfill
 */
export const fulfillUpdateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const fulfilledBy = req.user.id;
    const {
      responseText,
      isResolved,
      needsMoreTime,
      isBlocked,
      blockerDescription,
      estimatedCompletion
    } = req.body;

    // Validate required fields
    if (!responseText) {
      return res.status(400).json({
        status: 'error',
        message: 'Response text is required'
      });
    }

    // Get the update request
    const updateRequest = await UpdateRequest.getById(id);
    if (!updateRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Update request not found'
      });
    }

    // Verify the user is the assigned tech
    if (updateRequest.assigned_to !== fulfilledBy) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not assigned to this update request'
      });
    }

    // Verify not already fulfilled
    if (updateRequest.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Update request has already been fulfilled or cancelled'
      });
    }

    // Validate blocker description if blocked
    if (isBlocked && !blockerDescription) {
      return res.status(400).json({
        status: 'error',
        message: 'Blocker description is required when marking as blocked'
      });
    }

    // Fulfill the request
    const fulfilled = await UpdateRequest.fulfill(id, fulfilledBy, {
      responseText,
      isResolved: isResolved || false,
      needsMoreTime: needsMoreTime || false,
      isBlocked: isBlocked || false,
      blockerDescription,
      estimatedCompletion
    });

    // Create notification for requester
    const responseSummary = 
      isResolved ? '✅ Marked as Resolved' :
      isBlocked ? '🚫 Blocked' :
      needsMoreTime ? '⏰ Needs More Time' :
      '📝 Update Provided';

    const notification = await Notification.create({
      user_id: updateRequest.requested_by,
      type: 'update_fulfilled',
      priority: 'medium',
      title: `${responseSummary} - Update Request Fulfilled`,
      message: `${req.user.firstName} ${req.user.lastName} has responded to your update request on Ticket #${updateRequest.ticket_id}`,
      ticket_id: updateRequest.ticket_id,
      link: `/tickets/${updateRequest.ticket_id}`,
      metadata: {
        update_request_id: id,
        is_resolved: isResolved,
        is_blocked: isBlocked,
        needs_more_time: needsMoreTime
      }
    });

    // Log to ticket history
    await TicketHistory.log(
      updateRequest.ticket_id,
      fulfilledBy,
      'update_fulfilled',
      null,
      null,
      null,
      null,
      {
        update_request_id: id,
        fulfilled_by_name: `${req.user.firstName} ${req.user.lastName}`,
        response_text: responseText,
        is_resolved: isResolved,
        is_blocked: isBlocked,
        needs_more_time: needsMoreTime,
        blocker_description: blockerDescription,
        estimated_completion: estimatedCompletion
      }
    );

    // Emit real-time notification
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, updateRequest.requested_by, notification);
    }

    // Send email to requester
    const requester = await User.getById(updateRequest.requested_by);
    await sendEmail(
      requester.email,
      `${responseSummary} - Ticket #${updateRequest.ticket_id}`,
      `
        <h2>Update Request Fulfilled</h2>
        <p><strong>${req.user.firstName} ${req.user.lastName}</strong> has provided a status update.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket:</strong> #${updateRequest.ticket_id} - ${updateRequest.ticket_subject}</p>
          <p><strong>Status:</strong> ${responseSummary}</p>
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Update:</strong></p>
          <p>${responseText}</p>
          ${isBlocked ? `<p style="color: #d32f2f;"><strong>⚠️ Blocker:</strong> ${blockerDescription}</p>` : ''}
          ${estimatedCompletion ? `<p><strong>Estimated Completion:</strong> ${new Date(estimatedCompletion).toLocaleString()}</p>` : ''}
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL}/tickets/${updateRequest.ticket_id}" 
             style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Full Details
          </a>
        </p>
      `,
      null,
      'update_fulfilled',
      requester.id
    );

    // Get updated request details
    const updatedRequest = await UpdateRequest.getById(id);

    res.status(200).json({
      status: 'success',
      message: 'Update request fulfilled successfully',
      data: {
        updateRequest: updatedRequest,
        notification
      }
    });
  } catch (error) {
    console.error('Error fulfilling update request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fulfill update request',
      error: error.message
    });
  }
};

/**
 * Request deadline extension
 * POST /api/update-requests/:id/request-extension
 */
export const requestExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { newDeadline, reason } = req.body;

    if (!newDeadline) {
      return res.status(400).json({
        status: 'error',
        message: 'New deadline is required'
      });
    }

    const updateRequest = await UpdateRequest.getById(id);
    if (!updateRequest || updateRequest.assigned_to !== userId) {
      return res.status(404).json({
        status: 'error',
        message: 'Update request not found'
      });
    }

    const extended = await UpdateRequest.requestExtension(id, new Date(newDeadline));

    // Notify requester
    await Notification.create({
      user_id: updateRequest.requested_by,
      type: 'update_request',
      priority: 'medium',
      title: '⏰ Extension Requested',
      message: `${req.user.firstName} ${req.user.lastName} has requested a deadline extension for Ticket #${updateRequest.ticket_id}`,
      ticket_id: updateRequest.ticket_id,
      link: `/tickets/${updateRequest.ticket_id}`,
      metadata: {
        update_request_id: id,
        new_deadline: newDeadline,
        reason: reason
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Extension request sent',
      data: { updateRequest: extended }
    });
  } catch (error) {
    console.error('Error requesting extension:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to request extension',
      error: error.message
    });
  }
};

/**
 * Handle extension request (approve or deny)
 * POST /api/update-requests/:id/handle-extension
 */
export const handleExtensionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;

    // Verify user is management
    if (req.user.role !== 'management') {
      return res.status(403).json({
        status: 'error',
        message: 'Only management can approve/deny extension requests'
      });
    }

    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'approved field is required and must be boolean'
      });
    }

    const updateRequest = await UpdateRequest.getById(id);
    if (!updateRequest || !updateRequest.extension_requested) {
      return res.status(404).json({
        status: 'error',
        message: 'Update request with extension request not found'
      });
    }

    // Handle the extension
    const updated = await UpdateRequest.handleExtension(id, approved);

    // Notify the technician
    const notification = await Notification.create({
      user_id: updateRequest.assigned_to,
      type: 'update_request',
      priority: approved ? 'low' : 'medium',
      title: approved ? '✅ Extension Approved' : '❌ Extension Denied',
      message: approved
        ? `Your deadline extension request for Ticket #${updateRequest.ticket_id} has been approved by ${req.user.firstName} ${req.user.lastName}`
        : `Your deadline extension request for Ticket #${updateRequest.ticket_id} has been denied by ${req.user.firstName} ${req.user.lastName}`,
      ticket_id: updateRequest.ticket_id,
      link: `/tickets/${updateRequest.ticket_id}`
    });

    // Emit real-time notification
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, updateRequest.assigned_to, notification);
    }

    res.status(200).json({
      status: 'success',
      message: approved ? 'Extension approved' : 'Extension denied',
      data: { updateRequest: updated }
    });
  } catch (error) {
    console.error('Error handling extension request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to handle extension request',
      error: error.message
    });
  }
};

/**
 * Cancel an update request
 * DELETE /api/update-requests/:id
 */
export const cancelUpdateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const updateRequest = await UpdateRequest.getById(id);
    if (!updateRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Update request not found'
      });
    }

    // Only requester can cancel
    if (updateRequest.requested_by !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Only the requester can cancel this request'
      });
    }

    const cancelled = await UpdateRequest.cancel(id);

    // Notify assignee
    await Notification.create({
      user_id: updateRequest.assigned_to,
      type: 'update_request',
      priority: 'low',
      title: 'Update Request Cancelled',
      message: `The update request for Ticket #${updateRequest.ticket_id} has been cancelled`,
      ticket_id: updateRequest.ticket_id,
      metadata: {
        update_request_id: id
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Update request cancelled',
      data: { updateRequest: cancelled }
    });
  } catch (error) {
    console.error('Error cancelling update request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel update request',
      error: error.message
    });
  }
};

/**
 * Get technician statistics
 * GET /api/update-requests/stats/:techId
 */
export const getTechStats = async (req, res) => {
  try {
    const { techId } = req.params;
    const { days = 30 } = req.query;

    // Only management or the tech themselves can view stats
    if (req.user.role !== 'management' && req.user.id !== parseInt(techId)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    const stats = await UpdateRequest.getTechStats(techId, days);

    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching tech stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * Get response time analytics for all technicians
 * GET /api/update-requests/analytics/response-times?days=30
 */
export const getResponseTimeAnalytics = async (req, res) => {
  try {
    // Only allow management to view analytics
    if (req.user.role !== 'management') {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    const days = parseInt(req.query.days) || 30;
    const analytics = await UpdateRequest.getResponseTimeAnalytics(days);

    res.status(200).json({
      status: 'success',
      data: { 
        analytics,
        period_days: days
      }
    });
  } catch (error) {
    console.error('Error fetching response time analytics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};
