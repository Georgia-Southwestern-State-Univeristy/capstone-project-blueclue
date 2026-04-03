import cron from 'node-cron';
import UpdateRequest from '../models/UpdateRequest.js';
import Notification from '../models/Notification.js';

/**
 * Job to send reminder notifications to technicians at 50% of update request deadline
 * Runs every 15 minutes
 */
export function startUpdateRequestReminderJob(io) {
  console.log('🔔 Update Request Reminder Job: Starting...');
  
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('🔔 Update Request Reminder Job: Checking for reminders...');
      
      const requestsNeedingReminder = await UpdateRequest.getRequestsNeedingReminder();
      
      if (requestsNeedingReminder.length === 0) {
        console.log('🔔 Update Request Reminder Job: No reminders needed');
        return;
      }

      console.log(`🔔 Update Request Reminder Job: Sending ${requestsNeedingReminder.length} reminders`);

      for (const request of requestsNeedingReminder) {
        try {
          // Create notification for the assigned technician
          const notification = await Notification.create({
            user_id: request.assigned_to,
            type: 'update_request_reminder',
            message: `You have a pending update request for Ticket #${request.ticket_id} from ${request.requester_first_name} ${request.requester_last_name}. Deadline: ${new Date(request.deadline).toLocaleString()}`,
            ticket_id: request.ticket_id,
            metadata: {
              ticketId: request.ticket_id,
              updateRequestId: request.id,
              deadline: request.deadline,
              requesterName: `${request.requester_first_name} ${request.requester_last_name}`
            }
          });

          // Emit real-time notification via Socket.IO
          if (io) {
            io.to(`user_${request.assigned_to}`).emit('notification', {
              id: notification.id,
              type: 'update_request_reminder',
              title: 'Update Request Reminder',
              message: notification.message,
              ticket_id: request.ticket_id,
              update_request_id: request.id,
              created_at: notification.created_at
            });
          }

          // Mark as reminded
          await UpdateRequest.markAsReminded(request.id);

          console.log(`✅ Reminder sent to user ${request.assigned_to} for update request ${request.id}`);
        } catch (error) {
          console.error(`❌ Failed to send reminder for update request ${request.id}:`, error.message);
        }
      }

      console.log('🔔 Update Request Reminder Job: Completed successfully');
    } catch (error) {
      console.error('❌ Update Request Reminder Job failed:', error);
    }
  });

  console.log('🔔 Update Request Reminder Job: Scheduled (runs every 15 minutes)');
}
