# AI-Influenced Priority System - Complete Implementation Guide

## Overview

This feature implements a sophisticated AI-influenced priority system that balances AI recommendations with user selections, providing intelligent ticket prioritization while respecting user expertise.

## Architecture

### Backend Components

#### 1. Priority Service (`src/services/priorityService.js`)
**Purpose**: Core algorithm for weighted priority calculation

**Key Functions**:
- `calculateFinalPriority()` - Main weighted algorithm
- `getConfidenceLevel()` - Categorizes AI confidence
- `prioritiesDifferSignificantly()` - Detects major priority differences
- `explainPriorityDecision()` - Generates human-readable explanations

**Algorithm**:
```javascript
// If no user selection → Use AI directly
// If high AI confidence + significant difference → Show warning
// If medium confidence → Weighted average
// If low confidence → Trust user selection

weightedValue = (userValue * userWeight) + (aiValue * aiWeight * confidence)
```

#### 2. Database Schema (`migrations/002_add_ai_priority_influence.sql`)

**New Tables**:
- `priority_overrides` - Tracks every override for analytics
- `ai_configuration` - Stores admin-configurable settings

**New Ticket Fields**:
- `ai_recommended_priority` - Original AI recommendation
- `priority_overridden` - Boolean flag
- `priority_override_reason` - User justification
- `priority_calculation_method` - Algorithm used

**Views**:
- `v_priority_analytics` - Override statistics
- `v_ai_priority_accuracy` - Performance metrics by category

#### 3. Models
- `PriorityOverride.js` - Override data management
- `AIConfiguration.js` - Configuration CRUD operations

#### 4. Controllers
- `analyticsController.js` - Analytics endpoints
- `configController.js` - Admin configuration endpoints
- `ticketController.js` - Updated ticket creation logic

#### 5. Routes
- `/api/analytics/*` - Analytics endpoints
- `/api/config/ai/*` - Configuration management

### Frontend Components

#### 1. PriorityRecommendation (`components/PriorityRecommendation.jsx`)
**Purpose**: Display AI recommendation with confidence visualization

**Features**:
- Color-coded confidence levels (high/medium/low)
- Expandable explanation
- Accept/reject actions
- Compact mode for smaller displays

**Usage**:
```jsx
<PriorityRecommendation
  aiPriority="high"
  aiConfidence={0.85}
  userPriority="medium"
  onAccept={handleAccept}
  onReject={handleReject}
/>
```

#### 2. PriorityWarningModal (`components/PriorityWarningModal.jsx`)
**Purpose**: Show when user overrides high-confidence AI

**Features**:
- Side-by-side comparison
- Optional override reason input
- Clear action buttons
- Dismissable

#### 3. TicketFormEnhanced (`components/TicketFormEnhanced.jsx`)
**Purpose**: Enhanced ticket form with AI integration

**Features**:
- Debounced AI preview (1 second delay)
- Real-time AI recommendations
- Priority conflict detection
- Automatic warning modal triggering

#### 4. AIPriorityConfigPanel (`components/AIPriorityConfigPanel.jsx`)
**Purpose**: Admin configuration interface

**Features**:
- Master enable/disable switch
- Weight sliders (AI vs User)
- Confidence threshold configuration
- Real-time analytics display
- Reset to defaults

## Configuration

### Default Settings
```json
{
  "aiWeight": 0.7,              // 70% AI influence
  "userWeight": 0.3,            // 30% user influence
  "highConfidenceThreshold": 0.8,
  "mediumConfidenceThreshold": 0.5,
  "enableAIPriority": true,
  "showWarningOnOverride": true
}
```

### Adjusting Configuration

**Via Admin Panel**:
1. Navigate to Management Dashboard
2. Open "AI Priority Configuration"
3. Adjust sliders as needed
4. Save configuration

**Via API**:
```javascript
PUT /api/config/ai/priority-weights
{
  "aiWeight": 0.8,
  "userWeight": 0.2,
  "highConfidenceThreshold": 0.85,
  "mediumConfidenceThreshold": 0.6
}
```

## User Flow

### Scenario 1: No User Priority Selection
1. User creates ticket (title + description)
2. AI classifies automatically
3. **Final priority = AI recommendation**
4. No warnings shown

### Scenario 2: User Selects Priority (Low Confidence)
1. User selects "High" priority
2. AI recommends "Medium" with 45% confidence
3. **Final priority = User selection ("High")**
4. No warnings (low AI confidence)

### Scenario 3: User Overrides High-Confidence AI
1. User selects "Low" priority
2. AI recommends "Critical" with 92% confidence
3. **Warning modal appears**
4. Options:
   - Accept AI → Ticket created with "Critical"
   - Override → Prompt for reason, use "Low"
   - Cancel → Return to form

### Scenario 4: Weighted Average (Medium Confidence)
1. User selects "Medium" priority
2. AI recommends "High" with 70% confidence
3. **Weighted calculation**:
   ```
   User: Medium = 2
   AI: High = 3
   Weighted = (2 * 0.3) + (3 * 0.7 * 0.7) = 2.07
   Final = Medium (rounded)
   ```

## Analytics

### Key Metrics

**Override Statistics**:
- Total overrides
- AI acceptance rate
- User acceptance rate
- High-confidence overrides

**Performance Metrics**:
- Priority accuracy percentage
- Override rate by category
- Average resolution time by confidence
- User override frequency

### Accessing Analytics

**Via API**:
```javascript
GET /api/analytics/ai-priority
GET /api/analytics/ai-performance?category=hardware
GET /api/analytics/category-insights
```

**Via Dashboard**:
Navigate to Management Dashboard → AI Analytics

## Testing

### Priority Service Tests
```javascript
// Test weighted calculation
const result = calculateFinalPriority({
  userPriority: 'medium',
  aiPriority: 'high',
  aiConfidence: 0.7,
  config: DEFAULT_CONFIG
});
// result.finalPriority should be calculated correctly
```

### Integration Tests
```javascript
// Test ticket creation with AI priority
POST /api/tickets
{
  "subject": "Urgent: Server down",
  "description": "Production server is not responding",
  "priority": "medium"  // User selects medium
}
// Expect: Warning if AI confidence high and recommends critical
```

## Deployment Checklist

- [ ] Run database migration: `002_add_ai_priority_influence.sql`
- [ ] Verify new tables exist: `priority_overrides`, `ai_configuration`
- [ ] Update backend dependencies (if any new packages added)
- [ ] Update frontend dependencies
- [ ] Configure default AI weights in database
- [ ] Test ticket creation flow
- [ ] Test admin configuration panel
- [ ] Verify analytics endpoints
- [ ] Load test with concurrent requests
- [ ] Train management on new features

## API Reference

### Analytics Endpoints

#### GET /api/analytics/ai-priority
Returns comprehensive overview of AI priority system performance.

**Response**:
```json
{
  "status": "success",
  "data": {
    "overview": {
      "total_overrides": 150,
      "avg_confidence": 0.72,
      "acceptance_rate": 68.5
    },
    "by_confidence": [...],
    "accuracy_by_category": [...],
    "user_overrides": [...],
    "trend_30_days": [...]
  }
}
```

#### GET /api/analytics/ai-performance
Get detailed performance metrics.

**Query Parameters**:
- `category` (optional) - Filter by category
- `startDate` (optional) - Start date filter
- `endDate` (optional) - End date filter

### Configuration Endpoints

#### GET /api/config/ai/priority_weights
Get current priority weights configuration.

#### PUT /api/config/ai/priority-weights
Update priority weights configuration.

**Body**:
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

#### POST /api/config/ai/:key/reset
Reset configuration to defaults.

## Troubleshooting

### Issue: Warnings Not Showing
**Check**:
1. `showWarningOnOverride` is `true` in configuration
2. AI confidence is >= `highConfidenceThreshold`
3. Priority difference is > 1 level

### Issue: AI Recommendation Always Used
**Check**:
1. User is actually selecting a priority (not leaving blank)
2. `aiWeight` configuration is not too high
3. Check browser console for errors

### Issue: Analytics Not Loading
**Check**:
1. User has management/admin role
2. Database views were created successfully
3. Sufficient sample size (minimum 5 tickets per category)

## Future Enhancements

### Potential Improvements
1. **Machine Learning Feedback Loop**: Use override data to retrain AI model
2. **A/B Testing**: Test different weight configurations with user groups
3. **Smart Defaults**: Adjust weights automatically based on accuracy
4. **User-Specific Weights**: Different weights per user based on historical accuracy
5. **Category-Specific Weights**: Different AI influence per ticket category
6. **Confidence Decay**: Reduce confidence over time for stale models
7. **Explanation Generation**: Use AI to explain why it recommended priority

### Monitoring Recommendations
- Set up alerts for high override rates (>30%)
- Monitor AI confidence trends
- Track resolution time correlation with priority accuracy
- Identify users with frequent overrides for training

## Version History

- **v2.0.0** - Initial AI priority influence implementation
- **v2.1.0** (Planned) - Machine learning feedback loop
- **v2.2.0** (Planned) - Category-specific weights

## Support

For issues or questions:
- Check logs: `blueclue/backend/logs/`
- Database queries: Reference migration file comments
- Component props: See PropTypes in component files

## License

Internal use only - BlueClue Ticketing System
