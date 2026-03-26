# Search History Feature - Testing Checklist

## Acceptance Criteria Verification

### ✅ 1. Last 5 searches are stored per user (persistent, not session-only)
- **Database**: `search_history` table with user_id column
- **Backend**: Trigger `limit_search_history()` enforces 5-item limit per user/type
- **Storage**: PostgreSQL persistent storage (not session/localStorage)
- **Test**: Log in as user, perform 7 searches, verify only last 5 remain

### ✅ 2. When a search bar is focused, recent searches appear as a dropdown
- **Frontend**: SearchWithHistory component shows dropdown on focus
- **Implementation**: `handleInputFocus()` triggers dropdown if history exists
- **Condition**: Only shows if history.length > 0
- **Test**: Focus on search bar, verify dropdown appears with recent searches

### ✅ 3. Clicking a recent search populates and submits the search
- **Frontend**: `handleHistoryClick()` updates value and calls onSubmit
- **Behavior**: Populates input, saves to history, submits search
- **Test**: Click a history item, verify search executes immediately

### ✅ 4. Users can dismiss individual history items
- **Frontend**: X button on each history item (visible on hover)
- **Backend**: DELETE endpoint `/api/search-history/:id`
- **Security**: Only allows deletion of own items (checks user_id)
- **Test**: Hover over history item, click X, verify item is removed

### ✅ 5. Covers both the ticket search bar and the KB search bar
- **Ticket Search Bars**:
  - AvailableTickets.jsx (searchType="ticket")
  - MyAssignedTickets.jsx (searchType="ticket")
- **KB Search Bars**:
  - KnowledgeBaseWidget.jsx (searchType="knowledge_base")
  - FAQ.jsx (searchType="knowledge_base")
- **Test**: Perform searches in each location, verify separate histories

### ✅ 6. Search history is user-specific and not shared across accounts
- **Database**: Foreign key user_id references users(id) with CASCADE
- **Backend**: All queries filter by `req.user.id`
- **Security**: authenticateToken middleware required on all routes
- **Test**: Log in as User A, search "test". Log in as User B, verify history is empty

### ✅ 7. All UI components match existing CSS
- **Component**: Uses existing Tailwind classes from original search bars
- **Colors**: gray-800 bg, gray-600 borders, blue-500 focus rings
- **Typography**: text-sm for inputs, text-xs for dropdown items
- **Icons**: Consistent SVG icons (search, clock, X)
- **Test**: Visual inspection against original search bars

---

## Testing Instructions

### 1. Apply Database Migration
```powershell
# Local testing
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/blueclue"
psql $env:DATABASE_URL -f "blueclue/database/migrations/046_add_search_history.sql"

# Production (Railway)
psql "postgresql://postgres:wILIJFvLCmYWHJMmcJdCwZWAJwBlgCiG@caboose.proxy.rlwy.net:49258/railway" -f "blueclue/database/migrations/046_add_search_history.sql"
```

### 2. Restart Backend
```powershell
cd blueclue/backend
npm start
```

### 3. Manual Testing Checklist

#### Test 1: Ticket Search History
1. Log in as technician
2. Go to "Available Tickets"
3. Search for "printer"
4. Search for "password"
5. Search for "network"
6. Focus on search bar → Verify 3 searches appear in dropdown
7. Click "password" from dropdown → Verify search executes and input is populated
8. Hover over "printer" in dropdown → Click X → Verify it's removed
9. Search for "email", "wifi", "laptop" sequentially
10. Focus on search bar → Verify only last 5 searches appear

#### Test 2: KB Search History
1. Scroll to Knowledge Base widget on dashboard
2. Search for "setup"
3. Search for "configure"
4. Go to FAQ page
5. Focus on search bar → Verify "configure" and "setup" appear
6. Click "setup" → Verify redirected to search results

#### Test 3: User Isolation
1. Log out
2. Log in as different user (customer or different technician)
3. Focus on any search bar → Verify history is empty
4. Perform new search → Verify new history starts fresh

#### Test 4: Search Type Isolation
1. Log in as technician
2. Search "printer" in ticket search
3. Go to Knowledge Base
4. Focus on KB search → Verify "printer" does NOT appear
5. Search "troubleshooting" in KB
6. Go back to tickets
7. Focus on ticket search → Verify only "printer" appears, not "troubleshooting"

### 4. Backend API Testing

```powershell
# Get ticket search history
$token = "YOUR_JWT_TOKEN"
irm http://localhost:3000/api/search-history/ticket -Headers @{"Authorization"="Bearer $token"}

# Get KB search history
irm http://localhost:3000/api/search-history/knowledge_base -Headers @{"Authorization"="Bearer $token"}

# Add search to history
irm http://localhost:3000/api/search-history/ticket -Method POST -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} -Body '{"query":"test search"}'

# Delete history item (replace :id)
irm http://localhost:3000/api/search-history/1 -Method DELETE -Headers @{"Authorization"="Bearer $token"}
```

### 5. Error Scenarios

#### Scenario 1: Unauthenticated User
- **Test**: Call API without token
- **Expected**: 401 Unauthorized

#### Scenario 2: Empty Query
- **Test**: POST with empty/whitespace-only query
- **Expected**: 400 Bad Request

#### Scenario 3: Invalid Search Type
- **Test**: GET /api/search-history/invalid_type
- **Expected**: 400 Bad Request

#### Scenario 4: Delete Other User's History
- **Test**: User A tries to delete User B's history item
- **Expected**: 404 Not Found

---

## Known Issues / Edge Cases

1. **Duplicate Searches**: Handled by deleting existing entry before re-inserting (updates timestamp)
2. **Long Search Queries**: Dropdown may need text truncation (already implemented with `truncate` class)
3. **Offline Mode**: History won't load if API is down (silently fails, doesn't break UI)
4. **Multiple Tabs**: History updates on focus, so opening multiple tabs keeps them in sync

---

## Rollback Plan

If issues arise, rollback with:

```sql
BEGIN;
DROP TRIGGER IF EXISTS trigger_limit_search_history ON search_history;
DROP FUNCTION IF EXISTS limit_search_history();
DROP INDEX IF EXISTS idx_search_history_created_at;
DROP INDEX IF EXISTS idx_search_history_user_type_time;
DROP TABLE IF EXISTS search_history CASCADE;
COMMIT;
```

Then revert frontend changes:
```bash
git checkout main -- blueclue/frontend/src/components/SearchWithHistory.jsx
git checkout main -- blueclue/frontend/src/components/AvailableTickets.jsx
git checkout main -- blueclue/frontend/src/pages/MyAssignedTickets.jsx
git checkout main -- blueclue/frontend/src/components/KnowledgeBaseWidget.jsx
git checkout main -- blueclue/frontend/src/pages/FAQ.jsx
git checkout main -- blueclue/backend/src/routes/searchHistory.js
git checkout main -- blueclue/backend/src/controllers/searchHistoryController.js
git checkout main -- blueclue/backend/src/app.js
```
