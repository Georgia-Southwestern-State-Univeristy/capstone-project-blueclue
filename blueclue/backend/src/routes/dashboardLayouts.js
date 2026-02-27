// src/routes/dashboardLayouts.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getActiveLayout,
  saveActiveLayout,
  deleteActiveLayout,
  getSavedLayouts,
  createSavedLayout,
  renameSavedLayout,
  deleteSavedLayout
} from '../controllers/dashboardLayoutController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Active layout (auto-saved) ─────────────────────────────────
router.get('/',       getActiveLayout);     // GET  /api/dashboard-layouts?type=management
router.put('/',       saveActiveLayout);    // PUT  /api/dashboard-layouts
router.delete('/',    deleteActiveLayout);  // DEL  /api/dashboard-layouts?type=management

// ─── Named saved layouts ────────────────────────────────────────
router.get('/saved',      getSavedLayouts);     // GET    /api/dashboard-layouts/saved?type=management
router.post('/saved',     createSavedLayout);   // POST   /api/dashboard-layouts/saved
router.patch('/saved/:id', renameSavedLayout);  // PATCH  /api/dashboard-layouts/saved/:id
router.delete('/saved/:id', deleteSavedLayout); // DELETE /api/dashboard-layouts/saved/:id

export default router;
