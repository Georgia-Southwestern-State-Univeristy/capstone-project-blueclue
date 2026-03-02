-- Migration: Add AI Priority Influence Fields
-- Version: 002
-- Description: Adds fields to support AI-influenced priority system with override tracking
-- Date: 2026-02-22

BEGIN;

-- Add new fields to tickets table
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS ai_recommended_priority ticket_priority,
ADD COLUMN IF NOT EXISTS priority_overridden BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority_override_reason TEXT,
ADD COLUMN IF NOT EXISTS priority_calculation_method VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN tickets.ai_recommended_priority IS 'Original AI recommendation before any user override or weighted calculation';
COMMENT ON COLUMN tickets.priority_overridden IS 'True if user explicitly overrode AI recommendation';
COMMENT ON COLUMN tickets.priority_override_reason IS 'User-provided reason for overriding AI recommendation';
COMMENT ON COLUMN tickets.priority_calculation_method IS 'Method used to calculate final priority (ai_direct, weighted_average, user_override, etc.)';

-- Create priority_overrides table for analytics
CREATE TABLE IF NOT EXISTS priority_overrides (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Priority values
    user_priority ticket_priority NOT NULL,
    ai_recommended_priority ticket_priority NOT NULL,
    final_priority ticket_priority NOT NULL,
    
    -- AI information
    ai_confidence DECIMAL(3, 2),
    confidence_level VARCHAR(20), -- 'high', 'medium', 'low'
    
    -- Override details
    override_reason TEXT,
    significant_difference BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT priority_override_confidence_range CHECK (
        ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)
    )
);

-- Indexes for priority_overrides
CREATE INDEX idx_priority_overrides_ticket ON priority_overrides(ticket_id);
CREATE INDEX idx_priority_overrides_user ON priority_overrides(user_id);
CREATE INDEX idx_priority_overrides_created ON priority_overrides(created_at DESC);
CREATE INDEX idx_priority_overrides_confidence ON priority_overrides(confidence_level);
CREATE INDEX idx_priority_overrides_significant ON priority_overrides(significant_difference)
    WHERE significant_difference = true;

-- Create ai_configuration table for admin settings
CREATE TABLE IF NOT EXISTS ai_configuration (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default AI priority configuration
INSERT INTO ai_configuration (config_key, config_value, description)
VALUES 
    ('priority_weights', 
     '{"aiWeight": 0.7, "userWeight": 0.3, "highConfidenceThreshold": 0.8, "mediumConfidenceThreshold": 0.5, "enableAIPriority": true, "showWarningOnOverride": true}'::jsonb,
     'Configuration for AI-influenced priority calculation algorithm'),
    ('ai_analytics', 
     '{"trackOverrides": true, "trackAccuracy": true, "minimumSampleSize": 50}'::jsonb,
     'Configuration for AI analytics and tracking')
ON CONFLICT (config_key) DO NOTHING;

-- Create view for priority analytics
CREATE OR REPLACE VIEW v_priority_analytics AS
SELECT 
    po.confidence_level,
    po.significant_difference,
    COUNT(*) as override_count,
    AVG(po.ai_confidence) as avg_confidence,
    COUNT(CASE WHEN po.final_priority = po.ai_recommended_priority THEN 1 END) as ai_accepted,
    COUNT(CASE WHEN po.final_priority = po.user_priority THEN 1 END) as user_accepted,
    ARRAY_AGG(DISTINCT u.username) as users_who_overrode
FROM priority_overrides po
JOIN users u ON po.user_id = u.id
GROUP BY po.confidence_level, po.significant_difference;

-- Create view for AI accuracy tracking
CREATE OR REPLACE VIEW v_ai_priority_accuracy AS
SELECT 
    t.category,
    t.ai_recommended_priority,
    t.priority as final_priority,
    COUNT(*) as ticket_count,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) as avg_resolution_hours,
    AVG(t.ai_confidence) as avg_confidence,
    COUNT(CASE WHEN t.priority_overridden THEN 1 END) as overridden_count,
    ROUND(
        COUNT(CASE WHEN t.priority_overridden THEN 1 END)::NUMERIC / 
        COUNT(*)::NUMERIC * 100, 
        2
    ) as override_rate_percentage
FROM tickets t
WHERE t.ai_classified = true
  AND t.status IN ('resolved', 'closed')
GROUP BY t.category, t.ai_recommended_priority, t.priority
ORDER BY t.category, ticket_count DESC;

-- Add trigger to update updated_at on ai_configuration
CREATE OR REPLACE FUNCTION update_ai_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_configuration_timestamp
    BEFORE UPDATE ON ai_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_configuration_updated_at();

-- Note: Permissions are handled at the application level via user_role enum
-- No database-level role grants needed as this system uses application-level authorization

COMMIT;

-- Rollback script (save for reference)
-- BEGIN;
-- DROP VIEW IF EXISTS v_ai_priority_accuracy;
-- DROP VIEW IF EXISTS v_priority_analytics;
-- DROP TRIGGER IF EXISTS trigger_update_ai_configuration_timestamp ON ai_configuration;
-- DROP FUNCTION IF EXISTS update_ai_configuration_updated_at();
-- DROP TABLE IF EXISTS priority_overrides;
-- DROP TABLE IF EXISTS ai_configuration;
-- ALTER TABLE tickets DROP COLUMN IF EXISTS ai_recommended_priority;
-- ALTER TABLE tickets DROP COLUMN IF EXISTS priority_overridden;
-- ALTER TABLE tickets DROP COLUMN IF EXISTS priority_override_reason;
-- ALTER TABLE tickets DROP COLUMN IF EXISTS priority_calculation_method;
-- COMMIT;
