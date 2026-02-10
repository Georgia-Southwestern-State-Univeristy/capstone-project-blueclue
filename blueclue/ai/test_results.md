# BlueClue AI Classification Test Results

**Test Date:** February 10, 2026
**Total Tests:** 15

## Overall Metrics

- **Category Accuracy:** 93.3%
- **Priority Accuracy:** 73.3%
- **Overall Accuracy:** 83.3%
- **Average Confidence:** 0.64
- **Fallback Rate:** 0.0%

## Performance by Category

| Category | Tests | Correct | Accuracy |
|----------|-------|---------|----------|
| Hardware | 4 | 4 | 100.0% |
| Software | 3 | 3 | 100.0% |
| Network | 3 | 3 | 100.0% |
| Login | 3 | 2 | 66.7% |
| Other | 2 | 2 | 100.0% |

## Detailed Results

### Test 1: Hardware - Broken Screen (Urgent) ✅

**Description:** "My laptop screen is broken and I need help urgently"

- **Category:** Expected `hardware`, Got `hardware` ✅
- **Priority:** Expected `high`, Got `high` ✅
- **Confidence:** 1.00
- **Fallback:** No
- **Keywords Matched:** laptop, screen, broken

### Test 2: Hardware - Printer Issue ✅

**Description:** "The printer is not working properly"

- **Category:** Expected `hardware`, Got `hardware` ✅
- **Priority:** Expected `medium`, Got `medium` ✅
- **Confidence:** 0.33
- **Fallback:** No
- **Keywords Matched:** printer

### Test 3: Hardware - Keyboard ✅

**Description:** "My keyboard keys are stuck"

- **Category:** Expected `hardware`, Got `hardware` ✅
- **Priority:** Expected `low`, Got `low` ✅
- **Confidence:** 0.33
- **Fallback:** No
- **Keywords Matched:** keyboard

### Test 4: Hardware - Monitor ❌

**Description:** "Monitor display is flickering badly"

- **Category:** Expected `hardware`, Got `hardware` ✅
- **Priority:** Expected `medium`, Got `low` ❌
- **Confidence:** 0.67
- **Fallback:** No
- **Keywords Matched:** monitor, display

### Test 5: Software - Office Install ❌

**Description:** "Need Microsoft Office installed when you get a chance"

- **Category:** Expected `software`, Got `software` ✅
- **Priority:** Expected `low`, Got `medium` ❌
- **Confidence:** 1.00
- **Fallback:** No
- **Keywords Matched:** install, microsoft, office

### Test 6: Software - Excel Issue ❌

**Description:** "Can't open Excel files, need help"

- **Category:** Expected `software`, Got `software` ✅
- **Priority:** Expected `medium`, Got `high` ❌
- **Confidence:** 0.33
- **Fallback:** No
- **Keywords Matched:** excel

### Test 7: Software - App Crash ✅

**Description:** "Application keeps crashing immediately"

- **Category:** Expected `software`, Got `software` ✅
- **Priority:** Expected `high`, Got `high` ✅
- **Confidence:** 0.67
- **Fallback:** No
- **Keywords Matched:** application, app

### Test 8: Network - WiFi Disconnect ✅

**Description:** "The wifi keeps disconnecting"

- **Category:** Expected `network`, Got `network` ✅
- **Priority:** Expected `medium`, Got `medium` ✅
- **Confidence:** 0.67
- **Fallback:** No
- **Keywords Matched:** wifi, disconnect

### Test 9: Network - Slow Internet ✅

**Description:** "Internet connection is very slow"

- **Category:** Expected `network`, Got `network` ✅
- **Priority:** Expected `low`, Got `low` ✅
- **Confidence:** 0.67
- **Fallback:** No
- **Keywords Matched:** internet, connection

### Test 10: Network - VPN Emergency ✅

**Description:** "Can't connect to VPN urgently"

- **Category:** Expected `network`, Got `network` ✅
- **Priority:** Expected `high`, Got `high` ✅
- **Confidence:** 0.67
- **Fallback:** No
- **Keywords Matched:** vpn, can't connect

### Test 11: Login - Email Access ✅

**Description:** "I can't login to my email account"

- **Category:** Expected `login`, Got `login` ✅
- **Priority:** Expected `medium`, Got `medium` ✅
- **Confidence:** 1.00
- **Fallback:** No
- **Keywords Matched:** login, can't login, email account

### Test 12: Login - Password Reset ❌

**Description:** "Forgot my password, need to reset"

- **Category:** Expected `login`, Got `software` ❌
- **Priority:** Expected `medium`, Got `medium` ✅
- **Confidence:** 0.33
- **Fallback:** No
- **Keywords Matched:** word

### Test 13: Login - Locked Account ❌

**Description:** "Account is locked out, can't access anything"

- **Category:** Expected `login`, Got `login` ✅
- **Priority:** Expected `high`, Got `medium` ❌
- **Confidence:** 0.67
- **Fallback:** No
- **Keywords Matched:** access, locked out

### Test 14: Other - Policy Question ✅

**Description:** "General question about company policies"

- **Category:** Expected `other`, Got `other` ✅
- **Priority:** Expected `low`, Got `low` ✅
- **Confidence:** 1.00
- **Fallback:** No
- **Keywords Matched:** question, policies, general

### Test 15: Other - General Inquiry ✅

**Description:** "Just wondering about something"

- **Category:** Expected `other`, Got `other` ✅
- **Priority:** Expected `low`, Got `low` ✅
- **Confidence:** 0.33
- **Fallback:** No
- **Keywords Matched:** wondering

