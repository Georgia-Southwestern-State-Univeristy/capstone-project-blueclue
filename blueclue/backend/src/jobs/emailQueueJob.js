// ============================================================================
// Email Queue Processing Job
// ============================================================================
// CRON job that runs every minute to process pending emails from the queue
// Handles retries with exponential backoff and dead letter management

import cron from 'node-cron';
import { processEmailQueue } from '../services/emailService.js';
import EmailQueue from '../models/EmailQueue.js';

/**
 * Main job function - processes email queue
 * Called by node-cron every minute
 */
const processEmailQueueJob = async () => {
    const jobStart = Date.now();
    console.log('\n========================================');
    console.log('📬 Email Queue Job Started');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('========================================');

    try {
        // Get queue statistics before processing
        const statsBefore = await EmailQueue.getStats();
        console.log('📊 Queue Stats (Before):');
        console.log(`   Pending: ${statsBefore.pending}`);
        console.log(`   Processing: ${statsBefore.processing}`);
        console.log(`   Completed: ${statsBefore.completed}`);
        console.log(`   Dead Letter: ${statsBefore.dead_letter}`);
        console.log(`   Total: ${statsBefore.total}`);

        // Process up to 50 emails per run (adjust based on your needs)
        const batchSize = parseInt(process.env.EMAIL_QUEUE_BATCH_SIZE || '50');
        const result = await processEmailQueue(batchSize);

        // Get updated statistics
        const statsAfter = await EmailQueue.getStats();

        // Log results
        const duration = Date.now() - jobStart;
        console.log('\n✅ Email Queue Job Complete');
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Processed: ${result.processed}`);
        console.log(`   Succeeded: ${result.succeeded}`);
        console.log(`   Failed: ${result.failed}`);
        console.log('📊 Queue Stats (After):');
        console.log(`   Pending: ${statsAfter.pending}`);
        console.log(`   Processing: ${statsAfter.processing}`);
        console.log(`   Completed: ${statsAfter.completed}`);
        console.log(`   Dead Letter: ${statsAfter.dead_letter}`);
        console.log('========================================\n');

        // Alert if dead letter queue is growing
        if (statsAfter.dead_letter > statsBefore.dead_letter) {
            const newDeadLetters = statsAfter.dead_letter - statsBefore.dead_letter;
            console.warn(`⚠️  ${newDeadLetters} new dead letter email(s) - manual investigation required`);
            
            // Optional: Send alert to admins about dead letters
            // await alertAdminsAboutDeadLetters(newDeadLetters);
        }

        return result;

    } catch (error) {
        console.error('❌ Email Queue Job Error:', error.message);
        console.error('   Stack:', error.stack);
        console.log('========================================\n');
        
        // Don't throw - we want the job to continue running
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Optional: Alert admins about dead letter emails
 * @param {number} count - Number of new dead letters
 */
const alertAdminsAboutDeadLetters = async (count) => {
    // Implementation: Send notification to admin dashboard or email
    // Could use the notification system or direct email to admins
    console.log(`TODO: Alert admins about ${count} dead letter emails`);
};

/**
 * Cleanup job - runs daily to archive old completed emails
 * Keeps the queue table from growing too large
 */
const cleanupCompletedEmailsJob = async () => {
    console.log('\n========================================');
    console.log('🗑️  Email Queue Cleanup Job Started');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('========================================');

    try {
        // Delete completed emails older than 30 days (configurable)
        const daysToKeep = parseInt(process.env.EMAIL_QUEUE_RETENTION_DAYS || '30');
        const deletedCount = await EmailQueue.cleanupCompleted(daysToKeep);

        console.log(`✅ Cleanup complete: ${deletedCount} old emails archived`);
        console.log('========================================\n');

        return {
            success: true,
            deletedCount
        };

    } catch (error) {
        console.error('❌ Email Queue Cleanup Error:', error.message);
        console.log('========================================\n');
        
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Start email queue processing job
 * Runs every minute in production, every 30 seconds in development
 */
export const startEmailQueueJob = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isQueueEnabled = process.env.USE_EMAIL_QUEUE === 'true' || isProduction;

    if (!isQueueEnabled) {
        console.log('📬 Email Queue Job: DISABLED (USE_EMAIL_QUEUE=false)');
        return;
    }

    // Process queue every minute (production) or every 30 seconds (development)
    const schedule = isProduction ? '* * * * *' : '*/30 * * * * *';
    const scheduleDescription = isProduction ? 'every minute' : 'every 30 seconds';

    console.log(`📬 Email Queue Job: ENABLED (${scheduleDescription})`);

    cron.schedule(schedule, async () => {
        await processEmailQueueJob();
    });

    // Cleanup job runs daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
        await cleanupCompletedEmailsJob();
    });

    console.log('🗑️  Email Queue Cleanup Job: ENABLED (daily at 3:00 AM)');

    // Run immediately on startup to clear any backlog
    if (isProduction) {
        console.log('📬 Running initial email queue processing...');
        setTimeout(processEmailQueueJob, 5000); // 5 second delay to let system initialize
    }
};

export {
    processEmailQueueJob,
    cleanupCompletedEmailsJob
};

export default startEmailQueueJob;
