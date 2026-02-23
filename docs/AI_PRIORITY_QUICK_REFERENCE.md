# AI Priority Influence - Quick Reference

## For Developers

### Running Database Migration
```powershell
cd blueclue\database
psql -U postgres -d blueclue -f migrations\002_add_ai_priority_influence.sql
```

### Testing Priority Service
```powershell
node test-priority-service.js
```

### Key Files
- **Backend**:
  - `src/services/priorityService.js` - Core algorithm
  - `src/controllers/ticketController.js` - Updated ticket creation
  - `src/models/PriorityOverride.js` - Override tracking model
  - `src/models/AIConfiguration.js` - Configuration model
  - `src/controllers/analyticsController.js` - Analytics endpoints
  - `src/controllers/configController.js` - Configuration endpoints

- **Frontend**:
  - `src/components/PriorityRecommendation.jsx` - AI recommendation display
  - `src/components/PriorityWarningModal.jsx` - Override warning
  - `src/components/TicketFormEnhanced.jsx` - Enhanced ticket form
  - `src/components/AIPriorityConfigPanel.jsx` - Admin configuration

- **Database**:
  - `migrations/002_add_ai_priority_influence.sql` - Schema changes

## For Users

### Creating a Ticket
1. Fill in title and description
2. Wait for AI recommendation (appears after typing)
3. **Option A**: Leave priority blank → AI decides
4. **Option B**: Select priority → Weighted calculation
5. If AI strongly disagrees, you'll see a warning

### Priority Levels
- 🔴 **Critical** - System down, blocking all work
- 🟠 **High** - Major impact, needs urgent attention
- 🟡 **Medium** - Normal issue, moderate impact
- 🟢 **Low** - Minor issue, can wait

### Understanding AI Confidence
- **High (≥80%)**: AI is very confident, trust its recommendation
- **Medium (50-79%)**: AI has reasonable confidence
- **Low (<50%)**: AI uncertain, your judgment is important

## For Administrators

### Accessing Configuration
1. Login as management or admin
2. Navigate to Management Dashboard
3. Open "AI Priority Configuration"

### Recommended Settings

**Conservative (Trust users more)**:
```json
{
  "aiWeight": 0.5,
  "userWeight": 0.5,
  "highConfidenceThreshold": 0.9,
  "showWarningOnOverride": false
}
```

**Balanced (Default)**:
```json
{
  "aiWeight": 0.7,
  "userWeight": 0.3,
  "highConfidenceThreshold": 0.8,
  "showWarningOnOverride": true
}
```

**Aggressive (Trust AI more)**:
```json
{
  "aiWeight": 0.9,
  "userWeight": 0.1,
  "highConfidenceThreshold": 0.7,
  "showWarningOnOverride": true
}
```

### Monitoring

**Key Metrics to Watch**:
- **Override Rate**: Should be <30%. Higher means users don't trust AI
- **AI Acceptance Rate**: Should be >60%. Lower means AI inaccurate
- **High Confidence Overrides**: Investigate if >10%
- **Average Confidence**: Should trend upward as AI improves

**Red Flags**:
- Override rate suddenly spikes → AI model may be degraded
- Specific user overriding frequently → May need training
- Category-specific low accuracy → May need model retraining for that category

### Troubleshooting

**AI recommendations not showing**:
- Check `enableAIPriority` is `true`
- Verify AI service is running (port 5000)
- Check browser console for errors

**Warnings too frequent**:
- Increase `highConfidenceThreshold` to 0.85 or 0.9
- Or disable with `showWarningOnOverride: false`

**Users ignoring AI**:
- Review analytics to identify patterns
- Provide training on AI system
- Consider adjusting weights if AI consistently wrong

## API Quick Reference

### Analytics
```bash
# Get overview
GET /api/analytics/ai-priority

# Get performance metrics
GET /api/analytics/ai-performance?category=hardware&startDate=2026-01-01

# Get category insights
GET /api/analytics/category-insights
```

### Configuration
```bash
# Get all configurations
GET /api/config/ai

# Get priority weights
GET /api/config/ai/priority_weights

# Update priority weights
PUT /api/config/ai/priority-weights
Content-Type: application/json
{
  "aiWeight": 0.8,
  "userWeight": 0.2
}

# Reset to defaults
POST /api/config/ai/priority_weights/reset
```

## Decision Flow Chart

```
User creates ticket
       ↓
User selects priority?
   ↙        ↘
 NO          YES
   ↓          ↓
Use AI    AI Confidence?
directly     ↙    ↓    ↘
         LOW   MED  HIGH
          ↓     ↓     ↓
       User  Weight  Differs?
       Only   Avg   ↙    ↘
                  NO    YES
                   ↓     ↓
                Weight  Show
                 Avg   Warning
```

## Common Scenarios

### Scenario: IT Manager wants to increase AI influence
**Solution**:
1. Verify AI accuracy is good (>70%)
2. Increase `aiWeight` to 0.8
3. Decrease `userWeight` to 0.2
4. Monitor override rate

### Scenario: Users complain about warnings
**Solution**:
1. Review analytics - are warnings justified?
2. If yes, keep warnings, educate users
3. If no, increase `highConfidenceThreshold` or disable

### Scenario: AI consistently wrong for specific category
**Solution**:
1. Check category insights analytics
2. If <60% accuracy, consider disabling AI for that category
3. Report to AI team for model retraining
4. Consider category-specific weights (future feature)

## Support Contacts

- **Technical Issues**: Check logs in `blueclue/backend/logs/`
- **AI Model Issues**: Review AI service logs
- **Database Issues**: Check PostgreSQL logs
- **Feature Requests**: Submit to project board

---
Last Updated: 2026-02-22
Version: 2.0.0
