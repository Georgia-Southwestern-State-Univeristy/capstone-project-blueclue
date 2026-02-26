-- ============================================================================
-- Migration: Add response_time_seconds to ticket_update_requests
-- ============================================================================
-- Description: Adds response_time_seconds column to track how long it takes
--              technicians to respond to update requests
-- Date: 2026-02-26
-- Safe to run multiple times: Yes (uses IF NOT EXISTS checks)
-- ============================================================================

-- Add the response_time_seconds column (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_update_requests' 
        AND column_name = 'response_time_seconds'
    ) THEN
        ALTER TABLE ticket_update_requests
        ADD COLUMN response_time_seconds INTEGER;
        
        RAISE NOTICE 'Added response_time_seconds column';
    ELSE
        RAISE NOTICE 'Column response_time_seconds already exists, skipping';
    END IF;
END $$;

-- Add index for analytics queries (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_update_requests_response_time 
ON ticket_update_requests(response_time_seconds) 
WHERE response_time_seconds IS NOT NULL;

-- Backfill existing data - calculate response time for already-fulfilled requests
UPDATE ticket_update_requests
SET response_time_seconds = EXTRACT(EPOCH FROM (fulfilled_at - created_at))::INTEGER
WHERE status = 'fulfilled' 
  AND fulfilled_at IS NOT NULL 
  AND created_at IS NOT NULL
  AND response_time_seconds IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN ticket_update_requests.response_time_seconds IS 
'Time in seconds between request creation and fulfillment. Calculated as EXTRACT(EPOCH FROM (fulfilled_at - created_at))';

-- Report success
DO $$
DECLARE
    record_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO record_count 
    FROM ticket_update_requests 
    WHERE response_time_seconds IS NOT NULL;
    
    RAISE NOTICE 'Migration complete. % records have response_time_seconds calculated.', record_count;
END $$;

