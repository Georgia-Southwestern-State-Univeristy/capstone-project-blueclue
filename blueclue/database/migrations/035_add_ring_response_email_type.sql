-- Migration 035: Add ring_response to valid_email_type constraint
-- The ring request acceptance email uses type 'ring_response' which was
-- not included in the original constraint, causing email logging to fail.

ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS valid_email_type;

ALTER TABLE email_logs
ADD CONSTRAINT valid_email_type CHECK (email_type IN (
    'verification',
    'welcome',
    'ticket-created',
    'ticket-status-changed',
    'ticket-assigned',
    'password-reset',
    'ring_response',
    'unknown'
));

COMMENT ON CONSTRAINT valid_email_type ON email_logs IS
    'Allowed email type values — ring_response added in migration 035';
