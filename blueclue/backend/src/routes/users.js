// src/routes/users.js
import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { getTechnicianWorkload } from '../controllers/collaboratorController.js';

const router = express.Router();

/**
 * GET /api/users/technicians
 * Get list of all active technicians
 * Used for populating assignment dropdowns
 */
router.get('/technicians', authenticateToken, async (req, res) => {
    try {
        const technicians = await User.getTechnicians();
        
        res.status(200).json({
            status: 'success',
            count: technicians.length,
            data: technicians
        });
    } catch (error) {
        console.error('Get technicians error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve technicians',
            error: error.message
        });
    }
});

/**
 * GET /api/users/:id/workload
 * Get workload statistics for a technician
 * Shows how many tickets they're assigned to (primary and assisting)
 */
router.get('/:id/workload', authenticateToken, getTechnicianWorkload);

export default router;
