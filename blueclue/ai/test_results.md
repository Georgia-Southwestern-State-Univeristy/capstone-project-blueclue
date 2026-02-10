# BlueClue AI Classification Test Results (Enhanced)

**Test Date:** February 10, 2026
**Total Tests:** 57

## Overall Metrics

- **Category Accuracy:** 93.0%
- **Priority Accuracy:** 66.7%
- **Overall Accuracy:** 79.8%
- **Average Confidence:** 0.80
- **Average Category Confidence:** 0.79
- **Average Priority Confidence:** 0.81
- **Fallback Rate:** 1.8%
- **Multi-Category Detection Rate:** 15.8%

## Performance by Category

| Category | Tests | Correct | Category Accuracy | Priority Accuracy |
|----------|-------|---------|-------------------|-------------------|
| Hardware | 18 | 15 | 83.3% | 66.7% |
| Software | 12 | 11 | 91.7% | 58.3% |
| Network | 12 | 12 | 100.0% | 75.0% |
| Login | 11 | 11 | 100.0% | 72.7% |
| Other | 4 | 4 | 100.0% | 50.0% |

## Performance by Subcategory

| Subcategory | Tests | Correct | Accuracy |
|-------------|-------|---------|----------|
| connectivity | 8 | 7 | 87.5% |
| printer | 5 | 4 | 80.0% |
| damage | 3 | 3 | 100.0% |
| display | 3 | 3 | 100.0% |
| office | 3 | 3 | 100.0% |
| error | 3 | 3 | 100.0% |
| authentication | 3 | 3 | 100.0% |
| password | 3 | 3 | 100.0% |
| account | 3 | 3 | 100.0% |
| wireless | 3 | 2 | 66.7% |
| general | 3 | 2 | 66.7% |
| vpn | 2 | 2 | 100.0% |
| os | 2 | 2 | 100.0% |
| computer | 2 | 2 | 100.0% |
| peripheral | 1 | 1 | 100.0% |
| policy | 1 | 1 | 100.0% |
| inquiry | 1 | 1 | 100.0% |
| power | 1 | 1 | 100.0% |
| application | 1 | 1 | 100.0% |
| browser | 1 | 1 | 100.0% |
| security | 1 | 1 | 100.0% |
| performance | 1 | 1 | 100.0% |
| configuration | 1 | 1 | 100.0% |
| mfa | 1 | 1 | 100.0% |
| credentials | 1 | 1 | 100.0% |

## Failed Tests (21 failures)

### Hardware - Keyboard

**Description:** "My keyboard keys are stuck"

- **Category ✅:** Expected `hardware`, Got `hardware`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 0.36
- **Subcategory:** peripheral
- **Keywords Matched:** keyboard

### Network - Slow Internet

**Description:** "Internet connection is very slow"

- **Category ✅:** Expected `network`, Got `network`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 0.60
- **Subcategory:** connectivity
- **Keywords Matched:** internet, connection

### Login - Locked Account

**Description:** "Account is locked out, can't access anything"

- **Category ✅:** Expected `login`, Got `login`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 0.84
- **Subcategory:** account
- **Keywords Matched:** locked out, can't access, access

### Hardware - Power Issue

**Description:** "Battery not charging, power adapter might be defective"

- **Category ✅:** Expected `hardware`, Got `hardware`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 0.80
- **Subcategory:** power
- **Keywords Matched:** battery, power, charging, power adapter, not charging, defective

### Hardware - Wireless Mouse

**Description:** "Mouse keeps disconnecting from wireless receiver"

- **Category ❌:** Expected `hardware`, Got `network`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 1.00
- **Subcategory:** connectivity
- **Keywords Matched:** wireless, disconnect, disconnecting, keeps disconnecting

### Software - Excel Crashing

**Description:** "Excel keeps crashing when opening large files"

- **Category ✅:** Expected `software`, Got `software`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 1.00
- **Subcategory:** error
- **Keywords Matched:** excel, crash, crashing

### Software - Outlook Frozen

**Description:** "Outlook won't open, says not responding"

- **Category ✅:** Expected `software`, Got `software`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 1.00
- **Subcategory:** error
- **Keywords Matched:** outlook, not responding, won't open

### Software - Browser Performance

**Description:** "Browser running slow, need help optimizing Chrome"

- **Category ✅:** Expected `software`, Got `software`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 0.99
- **Subcategory:** browser
- **Keywords Matched:** chrome, browser, running slow

### Software - Update Failure

**Description:** "Windows update failed, system won't restart properly"

- **Category ✅:** Expected `software`, Got `software`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 0.92
- **Subcategory:** os
- **Keywords Matched:** windows, windows update, update

### Software - Security Software

**Description:** "Antivirus keeps blocking legitimate applications"

- **Category ✅:** Expected `software`, Got `software`
- **Priority ❌:** Expected `medium`, Got `high`
- **Confidence:** 0.84
- **Subcategory:** security
- **Keywords Matched:** application, app, antivirus, virus

### Network - Bandwidth/Buffering

**Description:** "Internet is buffering constantly, very slow bandwidth"

- **Category ✅:** Expected `network`, Got `network`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 1.00
- **Subcategory:** performance
- **Keywords Matched:** internet, bandwidth, buffering

### Network - Remote Access Down

**Description:** "Remote access not working, can't connect to office network"

- **Category ✅:** Expected `network`, Got `network`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 1.00
- **Subcategory:** connectivity
- **Keywords Matched:** network, can't connect, remote access

### Login - Expired Password Email

**Description:** "Can't login to email account, password expired"

- **Category ✅:** Expected `login`, Got `login`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 1.00
- **Subcategory:** authentication
- **Multi-category detected:** login, software
- **Keywords Matched:** login, can't login, password, password expired, email account

### Login - MFA Issue

**Description:** "Multi-factor authentication not sending verification code"

- **Category ✅:** Expected `login`, Got `login`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 0.80
- **Subcategory:** mfa
- **Keywords Matched:** authentication, multi-factor, verification code

### Edge - Multi-issue Hardware/Network

**Description:** "Laptop won't connect to wifi and battery is dead"

- **Category ❌:** Expected `hardware`, Got `network`
- **Priority ❌:** Expected `high`, Got `medium`
- **Confidence:** 0.90
- **Subcategory:** wireless
- **Multi-category detected:** network, hardware
- **Keywords Matched:** wifi, won't connect

### Edge - Software/Hardware Mix

**Description:** "Printer software won't install on new computer"

- **Category ❌:** Expected `software`, Got `hardware`
- **Priority ✅:** Expected `medium`, Got `medium`
- **Confidence:** 0.95
- **Subcategory:** printer
- **Multi-category detected:** hardware, software
- **Keywords Matched:** computer, printer, print

### Edge - Vague Description

**Description:** "Something is wrong but I'm not sure what"

- **Category ✅:** Expected `other`, Got `other`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 0.38
- **Subcategory:** general

### Edge - Generic Request

**Description:** "Need help with IT stuff"

- **Category ✅:** Expected `other`, Got `other`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 0.46
- **Subcategory:** general
- **Keywords Matched:** help

### Urgency - Multiple High Priority Keywords

**Description:** "Production server down EMERGENCY critical help needed NOW"

- **Category ❌:** Expected `hardware`, Got `other`
- **Priority ✅:** Expected `high`, Got `high`
- **Confidence:** 0.41
- **Subcategory:** general
- **Keywords Matched:** help

### Simple - Computer Slow (abbreviation)

**Description:** "comp is slow"

- **Category ✅:** Expected `hardware`, Got `hardware`
- **Priority ❌:** Expected `low`, Got `medium`
- **Confidence:** 0.39
- **Subcategory:** computer
- **Keywords Matched:** computer

### Simple - Screen Broken

**Description:** "screen broken"

- **Category ✅:** Expected `hardware`, Got `hardware`
- **Priority ❌:** Expected `medium`, Got `high`
- **Confidence:** 0.83
- **Subcategory:** damage
- **Keywords Matched:** screen, broken

