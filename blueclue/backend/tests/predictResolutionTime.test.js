// ============================================================================
// Predict Resolution Time – Route Tests
// ============================================================================
// Tests for GET /api/tickets/:id/predict-resolution-time
//
// Run with: npm test  (or npx vitest run tests/predictResolutionTime.test.js)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock the database pool ───────────────────────────────────────────────────
vi.mock('../src/config/database.js', () => ({
    default: { query: vi.fn() },
}));

// ─── Mock the AI service ──────────────────────────────────────────────────────
vi.mock('../src/services/aiService.js', () => ({
    predictResolutionTime: vi.fn(),
    classifyTicketWithFallback: vi.fn(),
    default: {},
}));

// ─── Mock auth + RBAC middleware so routes execute without a real JWT ─────────
vi.mock('../src/middleware/auth.js', () => ({
    authenticateToken: (_req, _res, next) => next(),
    optionalAuth:      (_req, _res, next) => next(),
}));

vi.mock('../src/middleware/rbac.js', () => ({
    checkRole:      () => (_req, _res, next) => next(),
    checkPrivilege: () => (_req, _res, next) => next(),
}));

// ─── Mock all ticket-controller and collaborator-controller imports ────────────
// (The route imports them but we only test the inline prediction handler)
vi.mock('../src/controllers/ticketController.js', () => ({
    createTicket:             vi.fn(),
    getAllTickets:             vi.fn(),
    getMyAssignedTickets:     vi.fn(),
    getAvailableTickets:      vi.fn(),
    requestTicketAssignment:  vi.fn(),
    getTicketById:            vi.fn(),
    updateTicket:             vi.fn(),
    deleteTicket:             vi.fn(),
    restoreTicket:            vi.fn(),
    getDeletedTickets:        vi.fn(),
    updateTicketStatus:       vi.fn(),
    bulkAssignTickets:        vi.fn(),
    assignTicket:             vi.fn(),
    reassignTicket:           vi.fn(),
    getTicketHistory:         vi.fn(),
    cancelTicket:             vi.fn(),
    reopenTicket:             vi.fn(),
    overrideCategory:         vi.fn(),
}));

vi.mock('../src/controllers/collaboratorController.js', () => ({
    addCollaborator:        vi.fn(),
    removeCollaborator:     vi.fn(),
    transferPrimary:        vi.fn(),
    getCollaborators:       vi.fn(),
    getTechnicianWorkload:  vi.fn(),
}));

import express from 'express';
import request from 'supertest';
import pool from '../src/config/database.js';
import { predictResolutionTime } from '../src/services/aiService.js';
import ticketsRouter from '../src/routes/tickets.js';

// ─── Build a minimal Express app that mounts the tickets router ───────────────
const app = express();
app.use(express.json());
app.use('/api/tickets', ticketsRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Shared test data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TICKET_ROW = {
    description:          'Cannot connect to the VPN after system update.',
    subject:              'VPN not working',
    category:             'network',
    priority:             'high',
    created_at:           '2026-04-02T09:00:00Z',
    assigned_to:          42,
    ai_confidence:        0.87,
    reopen_count:         0,
    technician_workload:  '3',   // DB returns strings for aggregates
};

const MOCK_PREDICTION = {
    estimated_hours:  8,
    confidence_range: { lower_hours: 5.6, upper_hours: 10.4 },
    uncertainty_label: '5 hours – 10 hours',
    model_version:    'v2_20260402',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/tickets/:id/predict-resolution-time', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Happy path ───────────────────────────────────────────────────────────

    describe('success cases', () => {
        it('returns 200 with estimated_hours, confidence_range, and uncertainty_label', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            predictResolutionTime.mockResolvedValueOnce(MOCK_PREDICTION);

            const res = await request(app).get('/api/tickets/123/predict-resolution-time');

            expect(res.status).toBe(200);
            expect(res.body.ticket_id).toBe('123');
            expect(res.body.estimated_hours).toBe(8);
            expect(res.body.confidence_range).toEqual({ lower_hours: 5.6, upper_hours: 10.4 });
            expect(res.body.uncertainty_label).toBe('5 hours – 10 hours');
            expect(res.body.model_version).toBe('v2_20260402');
        });

        it('includes technician_workload as a parsed integer', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            predictResolutionTime.mockResolvedValueOnce(MOCK_PREDICTION);

            const res = await request(app).get('/api/tickets/99/predict-resolution-time');

            expect(res.status).toBe(200);
            expect(res.body.technician_workload).toBe(3);  // parsed from '3'
        });

        it('falls back to computed label when AI service omits uncertainty_label', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            const predWithoutLabel = {
                estimated_hours:  6,
                confidence_range: { lower_hours: 4.2, upper_hours: 7.8 },
                model_version:    'v2_20260402',
                // uncertainty_label intentionally absent
            };
            predictResolutionTime.mockResolvedValueOnce(predWithoutLabel);

            const res = await request(app).get('/api/tickets/55/predict-resolution-time');

            expect(res.status).toBe(200);
            // A fallback label should still be present and non-empty
            expect(typeof res.body.uncertainty_label).toBe('string');
            expect(res.body.uncertainty_label.length).toBeGreaterThan(0);
        });

        it('calls predictResolutionTime with ticket description, subject, category and priority', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            predictResolutionTime.mockResolvedValueOnce(MOCK_PREDICTION);

            await request(app).get('/api/tickets/10/predict-resolution-time');

            expect(predictResolutionTime).toHaveBeenCalledWith(
                MOCK_TICKET_ROW.description,
                MOCK_TICKET_ROW.subject,
                MOCK_TICKET_ROW.category,
                MOCK_TICKET_ROW.priority
            );
        });

        it('uses parameterized query with the ticket id', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            predictResolutionTime.mockResolvedValueOnce(MOCK_PREDICTION);

            await request(app).get('/api/tickets/777/predict-resolution-time');

            const [_sql, params] = pool.query.mock.calls[0];
            expect(params).toEqual(['777']);
        });
    });

    // ── Error cases ──────────────────────────────────────────────────────────

    describe('error cases', () => {
        it('returns 404 when ticket is not found', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/tickets/999/predict-resolution-time');

            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found/i);
            expect(predictResolutionTime).not.toHaveBeenCalled();
        });

        it('returns 503 when AI service returns null', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            predictResolutionTime.mockResolvedValueOnce(null);

            const res = await request(app).get('/api/tickets/200/predict-resolution-time');

            expect(res.status).toBe(503);
            expect(res.body.error).toMatch(/unavailable/i);
        });

        it('returns 500 when pool.query throws', async () => {
            pool.query.mockRejectedValueOnce(new Error('DB connection lost'));

            const res = await request(app).get('/api/tickets/300/predict-resolution-time');

            expect(res.status).toBe(500);
            expect(res.body.error).toBeTruthy();
        });

        it('returns 500 when predictResolutionTime throws', async () => {
            pool.query.mockResolvedValueOnce({ rows: [MOCK_TICKET_ROW] });
            predictResolutionTime.mockRejectedValueOnce(new Error('AI timeout'));

            const res = await request(app).get('/api/tickets/400/predict-resolution-time');

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('AI timeout');
        });
    });

    // ── Technician-workload coercion ──────────────────────────────────────────

    describe('technician_workload parsing', () => {
        it('parses a string workload to integer 0 when null', async () => {
            const rowWithNullWorkload = { ...MOCK_TICKET_ROW, technician_workload: null };
            pool.query.mockResolvedValueOnce({ rows: [rowWithNullWorkload] });
            predictResolutionTime.mockResolvedValueOnce(MOCK_PREDICTION);

            const res = await request(app).get('/api/tickets/500/predict-resolution-time');

            expect(res.status).toBe(200);
            expect(res.body.technician_workload).toBe(0);
        });

        it('handles workload as a numeric string correctly', async () => {
            const rowWithHighWorkload = { ...MOCK_TICKET_ROW, technician_workload: '15' };
            pool.query.mockResolvedValueOnce({ rows: [rowWithHighWorkload] });
            predictResolutionTime.mockResolvedValueOnce(MOCK_PREDICTION);

            const res = await request(app).get('/api/tickets/501/predict-resolution-time');

            expect(res.status).toBe(200);
            expect(res.body.technician_workload).toBe(15);
        });
    });
});
