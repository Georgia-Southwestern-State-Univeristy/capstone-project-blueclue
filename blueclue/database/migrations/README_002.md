# Migration 002: AI Priority Influence System

## Overview
This migration adds comprehensive support for AI-influenced priority calculations, including override tracking, analytics, and admin configuration.

## Changes

### Tables Modified
#### `tickets`
- **ai_recommended_priority**: Original AI recommendation (ticket_priority)
- **priority_overridden**: Boolean flag indicating user override
- **priority_override_reason**: Text field for override justification
- **priority_calculation_method**: Method used for final priority

### New Tables

#### `priority_overrides`
Tracks every instance where a user's priority selection differs from AI recommendation.

**Fields:**
- ticket_id, user_id (references)
- user_priority, ai_recommended_priority, final_priority
- ai_confidence, confidence_level
- override_reason, significant_difference
- created_at

**Purpose:** Analytics and training data for improving AI model.

#### `ai_configuration`
Stores admin-configurable AI settings.

**Fields:**
- config_key (unique)
- config_value (JSONB)
- description
- updated_by, created_at, updated_at

**Default Configuration:**
```json
{
  "aiWeight": 0.7,
  "userWeight": 0.3,
  "highConfidenceThreshold": 0.8,
  "mediumConfidenceThreshold": 0.5,
  "enableAIPriority": true,
  "showWarningOnOverride": true
}
```

### Views

#### `v_priority_analytics`
Aggregates override statistics by confidence level and significance.

**Metrics:**
- Override count by confidence level
- AI acceptance rate vs user acceptance rate
- Users who frequently override

#### `v_ai_priority_accuracy`
Tracks AI performance per category and priority.

**Metrics:**
- Average resolution time per priority
- Override rate percentage
- Confidence correlation with accuracy

## Running the Migration

```powershell
# From blueclue/database directory
psql -U postgres -d blueclue -f migrations/002_add_ai_priority_influence.sql
```

## Verification

After running migration, verify:

```sql
-- Check new columns exist
\d tickets

-- Check new tables
\dt priority_overrides
\dt ai_configuration

-- Check views
\dv v_priority_analytics
\dv v_ai_priority_accuracy

-- Verify default configuration
SELECT * FROM ai_configuration;
```

## Rollback

If needed, rollback using the commented script at the end of the migration file.

## Dependencies

- Requires base schema (tickets table, ticket_priority type)
- Requires users table
- Compatible with existing AI classification fields

## Impact

- **Breaking Changes:** None
- **New Fields:** All nullable or have defaults
- **Performance:** Minimal impact, indexes added for analytics queries
- **Backward Compatibility:** Existing ticket creation continues to work

## Next Steps

After migration:
1. Update backend services to use new fields
2. Deploy PriorityService for weighted calculations
3. Create UI components for AI recommendation display
4. Add admin panel for configuration management
