-- =====================================================================
-- Migration 046: Add Search History
-- =====================================================================
-- Purpose: Store user-specific search history for tickets and KB
-- Features:
--   - Persistent search history (last 5 searches per user per type)
--   - User-specific, not shared across accounts
--   - Supports both ticket and knowledge base searches
--   - Automatic timestamp tracking
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Create search_history table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  search_type VARCHAR(20) NOT NULL CHECK (search_type IN ('ticket', 'knowledge_base')),
  query TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure query is not empty
  CONSTRAINT non_empty_query CHECK (TRIM(query) <> '')
);

-- ---------------------------------------------------------------------
-- 2) Create indexes for performance
-- ---------------------------------------------------------------------
-- Index for fetching recent searches by user and type
CREATE INDEX idx_search_history_user_type_time 
ON search_history(user_id, search_type, created_at DESC);

-- Index for cleanup operations
CREATE INDEX idx_search_history_created_at 
ON search_history(created_at DESC);

-- ---------------------------------------------------------------------
-- 3) Create function to auto-limit history to last 5 per user/type
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION limit_search_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete older entries beyond the 5 most recent for this user+type
  DELETE FROM search_history
  WHERE user_id = NEW.user_id
    AND search_type = NEW.search_type
    AND id NOT IN (
      SELECT id 
      FROM search_history
      WHERE user_id = NEW.user_id 
        AND search_type = NEW.search_type
      ORDER BY created_at DESC
      LIMIT 5
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 4) Create trigger to enforce 5-item limit
-- ---------------------------------------------------------------------
CREATE TRIGGER trigger_limit_search_history
AFTER INSERT ON search_history
FOR EACH ROW
EXECUTE FUNCTION limit_search_history();

-- ---------------------------------------------------------------------
-- 5) Grant permissions
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON search_history TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE search_history_id_seq TO PUBLIC;

COMMIT;

-- =====================================================================
-- Rollback Instructions:
-- =====================================================================
-- To rollback this migration:
-- 
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_limit_search_history ON search_history;
-- DROP FUNCTION IF EXISTS limit_search_history();
-- DROP INDEX IF EXISTS idx_search_history_created_at;
-- DROP INDEX IF EXISTS idx_search_history_user_type_time;
-- DROP TABLE IF EXISTS search_history CASCADE;
-- COMMIT;
-- =====================================================================
