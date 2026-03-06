-- Migration 032: Full-text search index on tickets for /tickets slash command
-- =============================================================================

-- Add a tsvector search column to tickets for fast full-text search
-- (mirrors what knowledge_articles uses for its search_vector column)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Back-fill the column for existing rows
UPDATE tickets
   SET search_vector = to_tsvector('english',
         COALESCE(subject,     '') || ' ' ||
         COALESCE(description, '') || ' ' ||
         COALESCE(category::text, '')
       );

-- Trigger to keep the column in sync on INSERT / UPDATE
CREATE OR REPLACE FUNCTION tickets_tsvector_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.subject,     '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.category::text, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_tsvector_trigger ON tickets;
CREATE TRIGGER tickets_tsvector_trigger
  BEFORE INSERT OR UPDATE OF subject, description, category
  ON tickets
  FOR EACH ROW EXECUTE FUNCTION tickets_tsvector_update();

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_tickets_search_vector
  ON tickets USING gin(search_vector);

-- Separate index on status for the closed-ticket filter
CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON tickets (status);

-- Composite index used by tech-mode /tickets command
CREATE INDEX IF NOT EXISTS idx_tickets_status_resolved
  ON tickets (status, resolved_at DESC NULLS LAST)
  WHERE status IN ('closed', 'resolved');

-- Index for handoff history query (customer's past tickets)
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id_created
  ON tickets (customer_id, created_at DESC);
