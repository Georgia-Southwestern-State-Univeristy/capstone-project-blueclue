import TicketCollaborator from '../models/TicketCollaborator.js';
import Ticket from '../models/Ticket.js';
import Notification from '../models/Notification.js';
import TicketHistory from '../models/TicketHistory.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';
import { emitNotificationToUser } from '../services/socketService.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

/**
 * Add a collaborator to a ticket
 * POST /api/tickets/:id/collaborators
 */
export const addCollaborator = async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { userId, role = 'assisting', note } = req.body;
  const addedBy = req.user.id;

  // Validate input
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }

  if (!['primary', 'assisting'].includes(role)) {
    throw new BadRequestError('Invalid role. Must be "primary" or "assisting"');
  }

  // Get ticket
  const ticket = await Ticket.getById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Check permissions
  const userRole = req.user.role;
  const isManagement = ['admin', 'management'].includes(userRole);
  
  // Get primary collaborator
  const primaryCollab = await TicketCollaborator.getPrimaryByTicketId(ticketId);
  const isPrimary = primaryCollab && primaryCollab.user_id === addedBy;
  
  // Check if user is assigned to the ticket (they should also be primary, but check both)
  const isAssigned = ticket.assigned_to === addedBy;
  
  // Check if user can add collaborators
  // Allow: management, primary technician, or assigned technician
  if (!isManagement && !isPrimary && !isAssigned) {
    throw new ForbiddenError('Only the assigned technician, primary technician, or management can add collaborators');
  }

  // Prevent adding self as assisting if already primary
  if (userId === addedBy && role === 'assisting' && isPrimary) {
    throw new BadRequestError('You are already the primary technician on this ticket');
  }

  // Check if tech has category access
  const userToAdd = await User.getById(userId);
  if (!userToAdd) {
    throw new NotFoundError('User not found');
  }

  // Verify user is a technician
  const techRoles = ['technician', 'senior_technician', 'admin', 'management'];
  if (!techRoles.includes(userToAdd.role)) {
    throw new BadRequestError('Only technicians can be added as collaborators');
  }

    // Add collaborator
    const collaborator = await TicketCollaborator.add(ticketId, userId, role, addedBy, note);

    // Get user who added the collaborator
    const addedByUser = await User.getById(addedBy);

    // Log to ticket history
    await TicketHistory.log(
      ticketId,
      addedBy,
      'collaborator_added',
      {
        collaborator_id: userId,
        collaborator_name: `${userToAdd.first_name} ${userToAdd.last_name}`,
        role: role,
        note: note
      }
    );

    // Create notification for added technician
    const notificationMessage = role === 'primary'
      ? `You have been assigned as the primary technician for ticket #${ticketId}: ${ticket.subject}`
      : `You have been added as an assisting technician for ticket #${ticketId}: ${ticket.subject}`;

    const notification = await Notification.create({
      user_id: userId,
      type: 'assignment',
      message: notificationMessage,
      ticket_id: ticketId
    });

    // Emit real-time notification
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, userId, notification);
    }

    // Send email notification
    const emailSubject = role === 'primary'
      ? `Assigned as Primary Tech - Ticket #${ticketId}`
      : `Added as Collaborator - Ticket #${ticketId}`;

    let emailBody = `Hello ${userToAdd.first_name},\n\n`;
    emailBody += `You have been ${role === 'primary' ? 'assigned as the primary technician' : 'added as a collaborating technician'} for:\n\n`;
    emailBody += `Ticket #${ticketId}: ${ticket.subject}\n`;
    emailBody += `Priority: ${ticket.priority}\n`;
    emailBody += `Category: ${ticket.category}\n\n`;
    
    if (note) {
      emailBody += `Note from ${addedByUser.first_name} ${addedByUser.last_name}:\n${note}\n\n`;
    }
    
    emailBody += `View ticket: ${process.env.FRONTEND_URL}/tickets/${ticketId}\n\n`;
    emailBody += `Best regards,\nBlueClue Support Team`;

    try {
      await sendEmail(userToAdd.email, emailSubject, emailBody);
    } catch (emailError) {
      console.error('Failed to send collaboration email:', emailError);
    }

    // Emit ticket update to all users
    if (req.app.locals.io) {
      req.app.locals.io.emit('ticket_updated', {
        ticket_id: ticketId,
        collaborator_added: true
      });
    }

  res.status(201).json({
    status: 'success',
    message: 'Collaborator added successfully',
    data: {
      collaborator,
      ticket_id: ticketId
    }
  });
};

/**
 * Remove a collaborator from a ticket
 * DELETE /api/tickets/:id/collaborators/:userId
 */
export const removeCollaborator = async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const userIdToRemove = parseInt(req.params.userId);
  const removedBy = req.user.id;

  // Get ticket
  const ticket = await Ticket.getById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Check permissions
  const userRole = req.user.role;
  const isManagement = ['admin', 'management'].includes(userRole);
  
  // Get primary collaborator
  const primaryCollab = await TicketCollaborator.getPrimaryByTicketId(ticketId);
  const isPrimary = primaryCollab && primaryCollab.user_id === removedBy;
  
  // Check if user is assigned to the ticket
  const isAssigned = ticket.assigned_to === removedBy;
  
  // Check if user can remove collaborators
  // Allow: management, primary technician, or assigned technician
  if (!isManagement && !isPrimary && !isAssigned) {
    throw new ForbiddenError('Only the assigned technician, primary technician, or management can remove collaborators');
  }

  // Prevent removing primary tech (must transfer instead)
  const collaboratorToRemove = await TicketCollaborator.isCollaborator(ticketId, userIdToRemove);
  if (!collaboratorToRemove) {
    throw new NotFoundError('Collaborator not found');
  }

  if (collaboratorToRemove.role === 'primary') {
    throw new BadRequestError('Cannot remove primary technician. Transfer primary role first.');
  }

    // Remove collaborator
    await TicketCollaborator.remove(ticketId, userIdToRemove);

    // Get user who was removed
    const removedUser = await User.getById(userIdToRemove);

    // Log to ticket history
    await TicketHistory.log(
      ticketId,
      removedBy,
      'collaborator_removed',
      {
        collaborator_id: userIdToRemove,
        collaborator_name: removedUser ? `${removedUser.first_name} ${removedUser.last_name}` : 'Unknown'
      }
    );

    // Create notification for removed technician
    if (removedUser) {
      const notification = await Notification.create({
        user_id: userIdToRemove,
        type: 'assignment',
        message: `You have been removed from ticket #${ticketId}: ${ticket.subject}`,
        ticket_id: ticketId
      });

      // Emit real-time notification
      if (req.app.locals.io) {
        emitNotificationToUser(req.app.locals.io, userIdToRemove, notification);
      }
    }

    // Emit ticket update
    if (req.app.locals.io) {
      req.app.locals.io.emit('ticket_updated', {
        ticket_id: ticketId,
        collaborator_removed: true
      });
    }

  res.status(200).json({
    status: 'success',
    message: 'Collaborator removed successfully'
  });
};

/**
 * Transfer primary assignment to another technician
 * PATCH /api/tickets/:id/transfer
 */
export const transferPrimary = async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { newPrimaryUserId } = req.body;
  const transferredBy = req.user.id;

  // Validate input
  if (!newPrimaryUserId) {
    throw new BadRequestError('New primary user ID is required');
  }

  // Get ticket
  const ticket = await Ticket.getById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Check permissions
  const userRole = req.user.role;
  const isManagement = ['admin', 'management'].includes(userRole);
  
  // Get current primary collaborator
  const currentPrimary = await TicketCollaborator.getPrimaryByTicketId(ticketId);
  const isCurrentPrimary = currentPrimary && currentPrimary.user_id === transferredBy;
  
  // Check if user is assigned to the ticket
  const isAssigned = ticket.assigned_to === transferredBy;
  
  // Check if user can transfer
  // Allow: management, current primary technician, or assigned technician
  if (!isManagement && !isCurrentPrimary && !isAssigned) {
    throw new ForbiddenError('Only the assigned technician, current primary technician, or management can transfer primary assignment');
  }

  // Get new primary user
  const newPrimaryUser = await User.getById(newPrimaryUserId);
  if (!newPrimaryUser) {
    throw new NotFoundError('New primary user not found');
  }

  // Verify user is a technician
  const techRoles = ['technician', 'senior_technician', 'admin', 'management'];
  if (!techRoles.includes(newPrimaryUser.role)) {
    throw new BadRequestError('Only technicians can be assigned as primary');
  }

    // Transfer primary role
    const updatedCollaborators = await TicketCollaborator.transferPrimary(
      ticketId,
      newPrimaryUserId,
      transferredBy
    );

    // Get old primary user name
    let oldPrimaryName = 'Previous tech';
    if (currentPrimary) {
      const oldPrimaryUser = await User.getById(currentPrimary.user_id);
      if (oldPrimaryUser) {
        oldPrimaryName = `${oldPrimaryUser.first_name} ${oldPrimaryUser.last_name}`;
      }
    }

    // Log to ticket history
    await TicketHistory.log(
      ticketId,
      transferredBy,
      'primary_transferred',
      {
        old_primary_id: currentPrimary?.user_id,
        old_primary_name: oldPrimaryName,
        new_primary_id: newPrimaryUserId,
        new_primary_name: `${newPrimaryUser.first_name} ${newPrimaryUser.last_name}`
      }
    );

    // Notify new primary tech
    const newPrimaryNotification = await Notification.create({
      user_id: newPrimaryUserId,
      type: 'assignment',
      message: `You are now the primary technician for ticket #${ticketId}: ${ticket.subject}`,
      ticket_id: ticketId
    });

    // Notify old primary tech if different from transferredBy
    if (currentPrimary && currentPrimary.user_id !== transferredBy) {
      const oldPrimaryNotification = await Notification.create({
        user_id: currentPrimary.user_id,
        type: 'assignment',
        message: `Primary assignment for ticket #${ticketId} has been transferred to ${newPrimaryUser.first_name} ${newPrimaryUser.last_name}`,
        ticket_id: ticketId
      });

      if (req.app.locals.io) {
        emitNotificationToUser(req.app.locals.io, currentPrimary.user_id, oldPrimaryNotification);
      }
    }

    // Emit real-time notifications
    if (req.app.locals.io) {
      emitNotificationToUser(req.app.locals.io, newPrimaryUserId, newPrimaryNotification);
      
      // Emit ticket update
      req.app.locals.io.emit('ticket_updated', {
        ticket_id: ticketId,
        primary_transferred: true
      });
    }

    // Send email to new primary
    const emailSubject = `Primary Assignment - Ticket #${ticketId}`;
    let emailBody = `Hello ${newPrimaryUser.first_name},\n\n`;
    emailBody += `You are now the primary technician for:\n\n`;
    emailBody += `Ticket #${ticketId}: ${ticket.subject}\n`;
    emailBody += `Priority: ${ticket.priority}\n`;
    emailBody += `Category: ${ticket.category}\n\n`;
    emailBody += `View ticket: ${process.env.FRONTEND_URL}/tickets/${ticketId}\n\n`;
    emailBody += `Best regards,\nBlueClue Support Team`;

    try {
      await sendEmail(newPrimaryUser.email, emailSubject, emailBody);
    } catch (emailError) {
      console.error('Failed to send transfer email:', emailError);
    }

  res.status(200).json({
    status: 'success',
    message: 'Primary assignment transferred successfully',
    data: {
      collaborators: updatedCollaborators,
      ticket_id: ticketId
    }
  });
};

/**
 * Get collaborators for a ticket
 * GET /api/tickets/:id/collaborators
 */
export const getCollaborators = async (req, res) => {
  const ticketId = parseInt(req.params.id);

  // Get ticket to verify it exists
  const ticket = await Ticket.getById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Get collaborators
  const collaborators = await TicketCollaborator.getByTicketId(ticketId);

  res.status(200).json({
    status: 'success',
    data: {
      collaborators,
      count: collaborators.length
    }
  });
};

/**
 * Get technician workload
 * GET /api/users/:id/workload
 */
export const getTechnicianWorkload = async (req, res) => {
  const userId = parseInt(req.params.id);

  // Get workload
  const workload = await TicketCollaborator.getUserWorkload(userId);

  res.status(200).json({
    status: 'success',
    data: workload
  });
};
