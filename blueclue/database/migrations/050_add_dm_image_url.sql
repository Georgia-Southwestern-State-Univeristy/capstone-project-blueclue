-- Migration 050: Add image_url column to direct_messages
-- =====================================================
-- Date: 2026-03-30
-- Description: Adds image_url column so direct messages can include images.

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;
