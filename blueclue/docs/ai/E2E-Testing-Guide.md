# BlueClue AI Classification - Manual E2E Testing Guide

## Prerequisites

### Start All Services

1. **Start PostgreSQL Database**
   - Ensure PostgreSQL is running
   - Database: `blueclue_db`
   - Verify connection

2. **Start Backend Server**
   ```bash
   cd blueclue/backend
   npm run dev
   ```
   - Should be running on: `http://localhost:3000`
   - Wait for "Server running on port 3000" message

3. **Start AI Service**
   ```bash
   cd blueclue/ai
   python app.py
   ```
   - Should be running on: `http://localhost:5000`
   - Wait for "AI Classification Service running" message

4. **Start Frontend**
   ```bash
   cd blueclue/frontend
   npm run dev
   ```
   - Should be running on: `http://localhost:5173`
   - Wait for "ready in X ms" message

### Verify Services
- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/api/tickets
- AI health: http://localhost:5000/health

## Test Cases

### Test 1: Hardware - High Priority ⚙️

#### Input
Navigate to: `http://localhost:5173/customer-portal`

Fill in the form:
- **Name:** Test User 1
- **Email:** test1@blueclue.com
- **Subject:** Broken Laptop Screen
- **Description:** `My laptop screen is broken and I need help urgently`

#### Submit
Click "Submit Ticket" button

#### Expected Results
- ✅ Success message appears
- ✅ Form clears
- ✅ Ticket is created

#### Verify in Console (F12)
Open browser developer console before submitting to see API response:
```json
{
  "category": "hardware",
  "priority": "high",
  "confidence": 1.0,
  "ai_classified": true
}
```

#### Verify in Database
```sql
SELECT id, subject, category, priority, ai_confidence, ai_classified
FROM tickets
WHERE subject = 'Broken Laptop Screen';
```

Expected:
- category: `hardware`
- priority: `high`
- ai_confidence: `1.0` or higher
- ai_classified: `true`

#### Verify in Dashboard
1. Navigate to: `http://localhost:5173/technician-dashboard`
2. Find ticket "Broken Laptop Screen"
3. Check:
   - Category badge shows "Hardware"
   - Priority badge shows "High"
   - AI confidence indicator visible
   - "AI Classified" tag present

#### Document Results
```
✅ Test 1 PASSED
- Category: hardware (expected: hardware)
- Priority: high (expected: high)
- Confidence: 1.00
- Database updated: Yes
- Dashboard display: Correct
```

---

### Test 2: Login - Medium Priority 🔐

#### Input
- **Name:** Test User 2
- **Email:** test2@blueclue.com
- **Subject:** Email Login Issue
- **Description:** `I can't login to my email account`

#### Expected Results
- Category: `login`
- Priority: `medium`
- Confidence: ~1.0
- AI Classified: `true`

#### Verification Steps
1. ✅ Success message displayed
2. ✅ Console shows correct classification
3. ✅ Database entry correct
4. ✅ Dashboard shows login/medium

#### Document Results
```
✅ Test 2 PASSED
- Category: login (expected: login)
- Priority: medium (expected: medium)
- Confidence: 1.00
- Database updated: Yes
- Dashboard display: Correct
```

---

### Test 3: Network - Medium Priority 🌐

#### Input
- **Name:** Test User 3
- **Email:** test3@blueclue.com
- **Subject:** WiFi Connection Problems
- **Description:** `The wifi keeps disconnecting`

#### Expected Results
- Category: `network`
- Priority: `medium`
- Confidence: ~0.67
- AI Classified: `true`

#### Keywords Matched
- Category: wifi, disconnect
- Priority: keeps

#### Verification Steps
1. ✅ Success message displayed
2. ✅ Console shows network/medium
3. ✅ Database entry correct
4. ✅ Dashboard shows network category

#### Document Results
```
✅ Test 3 PASSED
- Category: network (expected: network)
- Priority: medium (expected: medium)
- Confidence: 0.67
- Database updated: Yes
- Dashboard display: Correct
```

---

### Test 4: Software - Low Priority 💻

#### Input
- **Name:** Test User 4
- **Email:** test4@blueclue.com
- **Subject:** Office Installation Request
- **Description:** `Need Microsoft Office installed when you get a chance`

#### Expected Results
- Category: `software`
- Priority: `low`
- Confidence: ~1.0
- AI Classified: `true`

#### Keywords Matched
- Category: install, microsoft, office
- Priority: when you get a chance

#### Verification Steps
1. ✅ Success message displayed
2. ✅ Console shows software/low
3. ✅ Database entry correct
4. ✅ Dashboard shows software category with low priority

#### Document Results
```
✅ Test 4 PASSED
- Category: software (expected: software)
- Priority: low (expected: low)
- Confidence: 1.00
- Database updated: Yes
- Dashboard display: Correct
```

---

### Test 5: Other - Low Priority ❓

#### Input
- **Name:** Test User 5
- **Email:** test5@blueclue.com
- **Subject:** General Question
- **Description:** `General question about company policies`

#### Expected Results
- Category: `other`
- Priority: `low`
- Confidence: ~1.0
- AI Classified: `true`

#### Keywords Matched
- Category: general, question, policies
- Priority: question

#### Verification Steps
1. ✅ Success message displayed
2. ✅ Console shows other/low
3. ✅ Database entry correct
4. ✅ Dashboard shows "Other" category

#### Document Results
```
✅ Test 5 PASSED
- Category: other (expected: other)
- Priority: low (expected: low)
- Confidence: 1.00
- Database updated: Yes
- Dashboard display: Correct
```

---

## Testing Checklist

### Before Testing
- [ ] All services are running
- [ ] Database is accessible
- [ ] Browser console is open (F12)
- [ ] Have test result template ready

### During Each Test
- [ ] Fill form with exact description
- [ ] Note timestamp of submission
- [ ] Check success message
- [ ] Capture console API response
- [ ] Verify database entry
- [ ] Check dashboard display
- [ ] Document results

### After All Tests
- [ ] Calculate overall accuracy
- [ ] Compile all results
- [ ] Check for patterns in misclassifications
- [ ] Note any system errors
- [ ] Update documentation

## Results Template

```markdown
## E2E Test Results - [Date]

### Overall Summary
- Total Tests: 5
- Passed: X/5
- Category Accuracy: X%
- Priority Accuracy: X%
- System Errors: X

### Individual Results

| Test | Description | Expected Cat | Got Cat | Expected Pri | Got Pri | Confidence | Status |
|------|-------------|--------------|---------|--------------|---------|------------|--------|
| 1 | Laptop broken urgently | hardware | ? | high | ? | ? | ? |
| 2 | Can't login to email | login | ? | medium | ? | ? | ? |
| 3 | WiFi disconnecting | network | ? | medium | ? | ? | ? |
| 4 | Install Office | software | ? | low | ? | ? | ? |
| 5 | Policy question | other | ? | low | ? | ? | ? |

### Notes
- Any issues encountered:
- Performance observations:
- Suggestions for improvement:
```

## Troubleshooting

### Issue: Backend Not Responding
**Check:**
- Is backend running? Check terminal
- Is PostgreSQL running?
- Check port 3000 not in use
- Verify `.env` configuration

**Fix:**
```bash
# Restart backend
cd blueclue/backend
npm run dev
```

### Issue: AI Service Not Responding
**Check:**
- Is AI service running? Check terminal
- Is port 5000 available?
- Check Python environment

**Fix:**
```bash
# Restart AI service
cd blueclue/ai
python app.py
```

### Issue: Frontend Not Loading
**Check:**
- Is frontend dev server running?
- Check port 5173 availability
- Verify VITE_API_URL in .env

**Fix:**
```bash
# Restart frontend
cd blueclue/frontend
npm run dev
```

### Issue: Database Connection Error
**Check:**
- PostgreSQL service running?
- Database exists?
- Credentials correct in backend/.env?

**Fix:**
```bash
# Check PostgreSQL status
# On Windows:
Get-Service -Name postgresql*

# Connect and verify database
psql -U postgres -d blueclue_db
```

### Issue: Classification Not Appearing
**Check:**
- AI service responding? Visit http://localhost:5000/health
- Backend forwarding to AI? Check backend logs
- Database saving results? Query tickets table

**Debug:**
- Open browser console (F12)
- Check Network tab for API calls
- Look for errors in backend/AI logs

## Advanced Verification

### Check AI Classification Table
```sql
SELECT * FROM ai_classifications
ORDER BY created_at DESC
LIMIT 5;
```

Expected columns:
- ticket_id
- category
- priority
- confidence
- keywords_matched

### Check Backend Logs
Look for log entries showing:
```
AI Classification received: { category: 'hardware', priority: 'high', ... }
```

### Test AI Service Directly
Use curl or Postman:
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "My laptop screen is broken and I need help urgently"}'
```

Expected response:
```json
{
  "category": "hardware",
  "confidence": 1.0,
  "fallback_used": false,
  "keywords_matched": {
    "category": ["laptop", "screen", "broken"],
    "priority": ["urgently", "need help", "broken"]
  },
  "priority": "high"
}
```

## Success Criteria

✅ **All 5 tests pass** with correct category and priority
✅ **Database entries** created successfully
✅ **Dashboard display** shows classifications correctly
✅ **No system errors** during testing
✅ **Average confidence** >= 0.60
✅ **Response time** < 2 seconds per ticket

## Reporting Results

### Create Summary Report
After completing all tests, document:
1. Overall pass/fail rate
2. Any misclassifications and why
3. System performance notes
4. Recommendations for improvements

### Share Results
- Update GitHub issue with test results
- Share test_results.md from automated tests
- Include screenshots of dashboard
- Note any bugs or issues found
