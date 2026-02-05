-- Migration: Add ai_classifications table
-- Run this to add the AI classifications table without dropping existing data

-- ============================================================================
-- TABLE: ai_classifications
-- ============================================================================
-- Stores AI classification results for tickets

CREATE TABLE IF NOT EXISTS ai_classifications (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    predicted_category ticket_category NOT NULL,
    predicted_priority ticket_priority NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL,
    keywords_matched JSONB,
    fallback_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT ai_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT one_classification_per_ticket UNIQUE (ticket_id)
);

-- Indexes for ai_classifications
CREATE INDEX IF NOT EXISTS idx_ai_classifications_ticket ON ai_classifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_category ON ai_classifications(predicted_category);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_priority ON ai_classifications(predicted_priority);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_confidence ON ai_classifications(confidence);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_fallback ON ai_classifications(fallback_used);

-- GIN index for JSON keyword searching
CREATE INDEX IF NOT EXISTS idx_ai_classifications_keywords ON ai_classifications USING GIN (keywords_matched);

-- Success message
SELECT 'ai_classifications table created successfully' as message;
