// ============================================================================
// Alert Detection Background Job
// ============================================================================
// Runs periodic checks for suspicious activity and updates audit health

import cron from 'node-cron';
import { runAlertDetection, updateAuditLogHealth } from '../services/alertDetectionService.js';

/**
 * Start the alert detection background job
 * Runs every 2 minutes to check for suspicious patterns
 */
export function startAlertDetectionJob() {
    console.log('🚀 Starting alert detection background job (runs every 2 minutes)...');

    // Run alert detection every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
        try {
            await runAlertDetection();
        } catch (error) {
            console.error('❌ Error in alert detection job:', error);
        }
    });

    // Update audit log health every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            await updateAuditLogHealth();
        } catch (error) {
            console.error('❌ Error updating audit log health:', error);
        }
    });

    console.log('✅ Alert detection background job started');
}

/**
 * Run alert detection immediately (for manual testing)
 */
export async function runManualDetection() {
    console.log('🔍 Running manual alert detection...');
    try {
        await runAlertDetection();
        await updateAuditLogHealth();
        console.log('✅ Manual detection completed');
    } catch (error) {
        console.error('❌ Error in manual detection:', error);
        throw error;
    }
}

export default {
    startAlertDetectionJob,
    runManualDetection
};
