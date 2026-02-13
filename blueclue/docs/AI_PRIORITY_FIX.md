# AI Priority Classification Fix

## Issue
The AI classifier was giving too much weight to user-selected priority, essentially just echoing back whatever the user chose instead of making an independent assessment based on ticket content.

## Solution
Separated user priority selection from AI priority classification to ensure independent analysis.

## Changes Made

### 1. Database Schema (`database/schema.sql` & `database/add_priority_columns.sql`)
- Added `user_priority` column to store user's selected priority
- Added `ai_priority` column to store AI's independent classification
- Kept `priority` column as the final/active priority used for processing
- Added migration script to update existing databases

**Migration:**
```sql
psql -U your_user -d blueclue < database/add_priority_columns.sql
```

### 2. AI Classifier (`ai/src/classifier.py`)
- **Removed** `user_priority` parameter from `classify_priority()` method
- **Removed** `user_priority` parameter from `classify()` method  
- AI now classifies priority based **only** on ticket content:
  - Keyword analysis
  - Sentiment/urgency detection
  - Category context
  - Exclamation marks, caps, etc.
- Removed `priority_source` field from results

### 3. Backend API (`backend/src/`)

**Ticket Model (`models/Ticket.js`):**
- Added `user_priority` and `ai_priority` parameters to `create()` method
- Updated INSERT query to store both priorities separately

**Ticket Controller (`controllers/ticketController.js`):**
- Stores user-selected priority in `user_priority` column
- Stores AI-predicted priority in `ai_priority` column (when AI is successful)
- Final priority logic: `user_priority` → `ai_priority` → `'low'` (default)
- Response includes both priorities for transparency

### 4. Frontend (`frontend/src/pages/TechnicianDashboard.jsx`)
- Updated AI Classification card to show **both** priorities:
  - **User Priority**: What the client selected
  - **AI Priority**: What AI independently determined
- Added visual indicator when priorities don't match
- Shows "Priority mismatch detected" warning when user and AI disagree

## How It Works Now

### Ticket Creation Flow
1. User submits ticket with optional priority selection
2. Backend sends ticket text to AI service (without user priority)
3. AI analyzes content and predicts priority independently
4. Both priorities are stored:
   - `user_priority`: User's selection (if provided)
   - `ai_priority`: AI's prediction (if successful)
   - `priority`: Final active priority (user takes precedence)

### Example
**Scenario:** User selects "Low" priority but describes urgent issue

**Before Fix:**
```
User Selection: Low
AI Classification: Low (influenced by user)
Result: Ticket incorrectly marked as low priority
```

**After Fix:**
```
User Selection: Low → Stored in user_priority
AI Classification: High (based on content analysis) → Stored in ai_priority
Final Priority: Low (user choice honored)
Display: Shows both, warns about mismatch
```

## Testing

### Test the AI Independence
1. Create ticket with "Low" priority but use urgent language:
   ```
   Title: "URGENT: System completely down!"
   Description: "Everything is broken! Users can't log in. Need immediate help!"
   Priority: Low (user selected)
   ```

2. Check AI classification in response:
   ```json
   {
     "ai_classification": {
       "user_priority": "low",
       "ai_priority": "high",
       "final_priority": "low"
     }
   }
   ```

3. View in Technician Dashboard - should show:
   - User Priority: Low
   - AI Priority: High  
   - ⚠ Priority mismatch detected

### Verify AI Uses Only Content
Create tickets with different priority selections but same content:
- All should get the **same** `ai_priority`
- Only `user_priority` should differ

## Benefits

1. **Independent Analysis**: AI now makes unbiased assessments
2. **Transparency**: Both priorities are visible for comparison
3. **Analytics**: Can track user vs AI disagreements
4. **Training Data**: AI classifications can improve over time
5. **User Control**: User selection still takes precedence
6. **Oversight**: Technicians can see when users may have mis-prioritized

## Files Changed

- `blueclue/ai/src/classifier.py`
- `blueclue/backend/src/models/Ticket.js`
- `blueclue/backend/src/controllers/ticketController.js`
- `blueclue/frontend/src/pages/TechnicianDashboard.jsx`
- `blueclue/database/schema.sql`
- `blueclue/database/add_priority_columns.sql` (new)

## Next Steps

1. Run database migration
2. Restart AI service
3. Restart backend API
4. Test ticket creation
5. Monitor for priority mismatches to improve AI model
