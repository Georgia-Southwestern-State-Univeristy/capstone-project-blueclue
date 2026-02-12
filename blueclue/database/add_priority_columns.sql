-- ============================================================================
-- Migration: Add separate user_priority and ai_priority columns
-- ============================================================================
-- Description: Separates user-selected priority from AI-classified priority
--              to allow independent tracking of both values
-- Date: 2026-02-12
-- ============================================================================

-- Add new columns to tickets table
ALTER TABLE tickets 
ADD COLUMN user_priority ticket_priority,
ADD COLUMN ai_priority ticket_priority;

-- Migrate existing data: current priority becomes user_priority
UPDATE tickets 
SET user_priority = priority,
    ai_priority = CASE 
        WHEN ai_classified = true THEN priority
        ELSE NULL
    END;

-- Add comment to clarify column usage
COMMENT ON COLUMN tickets.user_priority IS 'Priority selected by the user when creating the ticket';
COMMENT ON COLUMN tickets.ai_priority IS 'Priority predicted by the AI classification system based on ticket content';
COMMENT ON COLUMN tickets.priority IS 'Final/active priority used for ticket processing (typically user_priority takes precedence)';

-- Optional: Set priority to user_priority as default behavior
UPDATE tickets SET priority = user_priority WHERE user_priority IS NOT NULL;

-- Create index for ai_priority for analytics queries
CREATE INDEX idx_tickets_ai_priority ON tickets(ai_priority) WHERE ai_priority IS NOT NULL;
CREATE INDEX idx_tickets_user_priority ON tickets(user_priority) WHERE user_priority IS NOT NULL;

-- Success message
SELECT 'Migration completed: user_priority and ai_priority columns added successfully' AS status;
