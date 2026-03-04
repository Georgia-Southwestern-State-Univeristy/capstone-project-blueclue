-- Migration 034: Add attachments support to tickets
-- Stores images as base64 data URLs in a JSONB array

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Index for quick lookup (e.g. tickets that have attachments)
CREATE INDEX IF NOT EXISTS idx_tickets_has_attachments
  ON tickets ((attachments != '[]'::jsonb));
