// src/routes/mlAdmin.js
// ML Admin routes – restricted to 'admin' and 'management' roles.

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { checkRole } from '../middleware/rbac.js';
import * as ctrl from '../controllers/mlAdminController.js';

const router = express.Router();

// All ML admin routes require authentication + admin or management role
router.use(authenticateToken);
router.use(checkRole('admin', 'management'));

// ── Dashboard ──────────────────────────────────────────────────────────────
/** GET /api/ml-admin/dashboard  – Full dashboard data in one call */
router.get('/dashboard', ctrl.getDashboard);

/** GET /api/ml-admin/health  – ML service + model health status */
router.get('/health', ctrl.getMLHealth);

// ── Explainability ─────────────────────────────────────────────────────────
/** POST /api/ml-admin/explain  – Why did the AI choose this prediction? */
router.post('/explain', ctrl.explainPrediction);

// ── Feedback / Overrides ───────────────────────────────────────────────────
/** POST /api/ml-admin/feedback  – Submit user accept/override decision */
router.post('/feedback', ctrl.submitFeedback);

/** GET /api/ml-admin/feedback  – View feedback entries */
router.get('/feedback', ctrl.getFeedback);

/** GET /api/ml-admin/feedback/override-rates  – 7-day per-category override rates */
router.get('/feedback/override-rates', ctrl.getOverrideRates);

// ── Drift Detection ────────────────────────────────────────────────────────
/** POST /api/ml-admin/drift/run  – Run drift detection for a model type */
router.post('/drift/run', ctrl.runDriftDetection);

/** GET /api/ml-admin/drift/reports  – List saved drift reports */
router.get('/drift/reports', ctrl.getDriftReports);

// ── Model Versions ─────────────────────────────────────────────────────────
/** GET /api/ml-admin/models/versions  – List registered model versions */
router.get('/models/versions', ctrl.getModelVersions);

/** GET /api/ml-admin/models/registry/history  – Deployment history */
router.get('/models/registry/history', ctrl.getRegistryHistory);

/** POST /api/ml-admin/models/deploy  – Deploy a specific version { model_type, version } */
router.post('/models/deploy', ctrl.deployModelVersion);

/** POST /api/ml-admin/models/rollback  – Roll back a model { model_type, target_version? } */
router.post('/models/rollback', ctrl.rollbackModel);

// ── Retraining Pipeline ────────────────────────────────────────────────────
/** POST /api/ml-admin/retrain  – Trigger retraining pipeline */
router.post('/retrain', ctrl.triggerRetraining);

/** GET /api/ml-admin/retrain/reports  – List past retraining runs */
router.get('/retrain/reports', ctrl.getRetrainingRuns);

// ── Predictions ────────────────────────────────────────────────────────────
/** GET /api/ml-admin/predictions/recent  – Recent AI classification records */
router.get('/predictions/recent', ctrl.getRecentPredictions);

/** GET /api/ml-admin/predictions/export  – Download prediction log as JSON */
router.get('/predictions/export', ctrl.exportPredictions);

export default router;
