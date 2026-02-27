// src/routes/themes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getThemePreferences,
  updateThemePreferences,
  saveTheme,
  deleteSavedTheme,
  renameSavedTheme,
} from '../controllers/themeController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Active theme preferences ───────────────────────────────────
router.get('/',  getThemePreferences);    // GET  /api/themes
router.put('/',  updateThemePreferences); // PUT  /api/themes

// ─── Named saved themes ────────────────────────────────────────
router.post('/saved',       saveTheme);        // POST   /api/themes/saved
router.delete('/saved/:id', deleteSavedTheme); // DELETE /api/themes/saved/:id
router.patch('/saved/:id',  renameSavedTheme); // PATCH  /api/themes/saved/:id

export default router;
