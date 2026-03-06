import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  sendMessage,
  getHistory,
  getConversations,
  submitFeedback,
  clearHistory,
  endConversation,
  createTicketFromChat,
  getLLMHealth,
  sendTechMessage,
  suggestArticlesEndpoint,
  trackSuggestionEvent,
  uploadChatFile,
  requestHandoff,
  claimHandoff,
  getPendingHandoffs,
  getChatAnalytics,
  sendHandoffReply,
  resolveHandoff,
  getHandoffHistory,
  getConversationSummary,
  submitConversationSurvey,
  getKnowledgeGaps,
  exportMyData,
} from '../controllers/chatController.js';

const router = express.Router();

// ── Existing routes ──────────────────────────────────────────────────────────
router.post('/message',       authenticateToken, sendMessage);
router.get('/history',        authenticateToken, getHistory);
router.get('/conversations',  authenticateToken, getConversations);
router.post('/feedback',      authenticateToken, submitFeedback);
router.post('/clear',         authenticateToken, clearHistory);
router.post('/end',           authenticateToken, endConversation);
router.post('/create-ticket', authenticateToken, createTicketFromChat);
router.get('/llm/health',     authenticateToken, getLLMHealth);

// ── Tech mode ────────────────────────────────────────────────────────────────
/** POST /api/chat/tech-message  – tech-facing message (private KB + slash commands) */
router.post('/tech-message',  authenticateToken, sendTechMessage);

// ── Proactive article suggestions (ticket prevention) ────────────────────────
/** POST /api/suggest-articles  – suggest KB articles from partial ticket text */
router.post('/suggest-articles',        authenticateToken, suggestArticlesEndpoint);
/** POST /api/suggest-articles/event    – track suggestion interaction */
router.post('/suggest-articles/event',  authenticateToken, trackSuggestionEvent);

// ── File / image upload ──────────────────────────────────────────────────────
/** POST /api/chat/upload  – upload image/file (base64 JSON, max 5 MB) */
router.post('/upload', authenticateToken, uploadChatFile);

// ── Human handoff ────────────────────────────────────────────────────────────
/** POST /api/chat/handoff         – customer requests human tech */
router.post('/handoff',                   authenticateToken, requestHandoff);
/** POST /api/chat/handoff/claim   – tech claims the handoff */
router.post('/handoff/claim',             authenticateToken, claimHandoff);
/** POST /api/chat/handoff/reply   – tech sends message in claimed chat */
router.post('/handoff/reply',             authenticateToken, sendHandoffReply);
/** POST /api/chat/handoff/resolve – tech closes the handoff chat */
router.post('/handoff/resolve',           authenticateToken, resolveHandoff);
/** GET  /api/chat/handoff/pending – list unclaimed handoff requests (tech only) */
router.get('/handoff/pending',            authenticateToken, getPendingHandoffs);
/** GET  /api/chat/handoff/:id/history – full message history (tech only) */
router.get('/handoff/:conversationId/history', authenticateToken, getHandoffHistory);

// ── Chat analytics (management/admin) ────────────────────────────────────────
/** GET /api/chat/analytics?period=30d */
router.get('/analytics', authenticateToken, getChatAnalytics);

// ── Knowledge gaps & NPS (management/admin) ──────────────────────────────────
/** GET /api/chat/analytics/knowledge-gaps?limit=20&resolved=false */
router.get('/analytics/knowledge-gaps', authenticateToken, getKnowledgeGaps);

// ── Conversation summary (for TicketFromChatModal) ─────────────────────
/** GET /api/chat/summary/:conversationId */
router.get('/summary/:conversationId', authenticateToken, getConversationSummary);

// ── End-of-conversation survey ───────────────────────────────────────────────
/** POST /api/chat/survey */
router.post('/survey', authenticateToken, submitConversationSurvey);

// ── GDPR data export ─────────────────────────────────────────────────────────
/** GET /api/chat/export-my-data */
router.get('/export-my-data', authenticateToken, exportMyData);

export default router;
