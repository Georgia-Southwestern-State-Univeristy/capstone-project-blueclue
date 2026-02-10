# BlueClue AI Classification - MVP Results

## Test Results (Feb 10, 2026)
- **Total tickets tested:** 15
- **Category accuracy:** 93.3%
- **Priority accuracy:** 73.3%
- **Overall accuracy:** 83.3%
- **Average confidence:** 0.64
- **Fallback rate:** 0.0%

## Performance by Category
| Category | Tests | Correct | Accuracy |
|----------|-------|---------|----------|
| Hardware | 4 | 4 | 100% |
| Software | 3 | 3 | 100% |
| Network | 3 | 3 | 100% |
| Login | 3 | 2 | 66.7% |
| Other | 2 | 2 | 100% |

## How It Works (Demo Explanation)
1. **Customer submits ticket** with description
2. **Backend sends description** to AI service (`http://localhost:5000/classify`)
3. **AI scans for keywords** in the description:
   - "laptop", "screen" → hardware
   - "wifi", "disconnect" → network
   - "login", "password" → login
   - "install", "microsoft office" → software
   - "urgent", "ASAP" → high priority
4. **AI calculates confidence** based on keyword matches:
   - 1 keyword match = 0.33 confidence
   - 2 keyword matches = 0.67 confidence
   - 3+ keyword matches = 1.00 confidence
5. **If confidence < 30%**, falls back to "other" category
6. **Backend saves ticket** with AI classification to PostgreSQL
7. **Technician sees** suggested category/priority in dashboard

## System Architecture
```
Customer Form (React)
       ↓
   Backend API (Node.js)
       ↓
   AI Service (Python/Flask)
       ↓
   Classifier (keyword-based)
       ↓
   Returns: {category, priority, confidence}
       ↓
   PostgreSQL Database
       ↓
   Technician Dashboard
```

## Example Classifications

### ✅ Successful Classifications

**Test 1: Hardware - Urgent**
- Input: "My laptop screen is broken and I need help urgently"
- Category: hardware ✓ (matched: laptop, screen, broken)
- Priority: high ✓ (matched: urgently, need help, broken)
- Confidence: 1.00

**Test 8: Network - WiFi**
- Input: "The wifi keeps disconnecting"
- Category: network ✓ (matched: wifi, disconnect)
- Priority: medium ✓ (matched: keeps)
- Confidence: 0.67

**Test 11: Login - Email**
- Input: "I can't login to my email account"
- Category: login ✓ (matched: login, can't login, email account)
- Priority: medium ✓ (matched: can't)
- Confidence: 1.00

### ⚠️ Known Misclassifications

**Test 12: Password Reset**
- Input: "Forgot my password, need to reset"
- Expected: login
- Got: software (matched "word" from "password")
- Issue: Partial keyword matching needs improvement

**Test 13: Priority Misjudgment**
- Input: "Account is locked out, can't access anything"
- Category: login ✓
- Priority: Expected high, Got medium
- Issue: No "urgent" keyword detected

## Known Limitations
- **Cannot detect sarcasm or tone** - relies purely on keywords
- **Struggles with very short descriptions** (< 10 words) - fewer keywords to match
- **May misclassify when categories overlap** - e.g., "password" contains "word" (software keyword)
- **Keywords only** - no context understanding or semantic analysis yet
- **Priority detection is sensitive** - requires explicit urgency keywords
- **Partial word matching** - "password" incorrectly matches "word"

## Future Improvements

### Phase 2: TF-IDF Classification (Week 4-5)
- Replace keyword matching with TF-IDF vectorization
- Train on historical ticket data
- Improved accuracy for ambiguous cases
- Better handling of context

### Phase 3: OpenAI Embeddings (Week 6-7)
- Implement semantic understanding using OpenAI API
- Understand context beyond keywords
- Handle sarcasm and tone
- Learn from technician corrections

### Phase 4: Continuous Learning
- Capture technician corrections
- Retrain model periodically
- A/B testing for new models
- Performance monitoring dashboard

## Technical Details

### Classifier Implementation
- **Language:** Python 3.x
- **Framework:** Flask (REST API)
- **Port:** 5000
- **Endpoint:** POST `/classify`
- **Input:** `{"text": "ticket description"}`
- **Output:** `{"category": "hardware", "priority": "high", "confidence": 0.85, "fallback_used": false}`

### Category Keywords
- **Hardware:** laptop, computer, screen, monitor, keyboard, mouse, printer, device, broken, damaged, display
- **Software:** application, app, program, install, update, microsoft, office, windows, excel, word
- **Network:** wifi, internet, connection, network, vpn, router, disconnect, connectivity
- **Login:** login, password, access, username, authentication, locked out, reset password, credentials
- **Other:** question, policy, general, inquiry, information, guidance, wondering

### Priority Keywords
- **High:** urgent, urgently, critical, emergency, asap, immediately, production, down, broken, can't work
- **Medium:** issue, problem, help, need, soon, can't, unable, not working, keeps, won't
- **Low:** question, when you get a chance, wondering, general, policy, information, sometime

## Running Tests

### Automated Test Script
```bash
cd blueclue/ai
python test_accuracy.py
```

### Test Output
- Console: Detailed results with ✓/✗ indicators
- File: `test_results.md` with full metrics

### Acceptance Criteria
- ✅ Overall accuracy >= 70% (achieved 83.3%)
- ✅ Category accuracy >= 80% (achieved 93.3%)
- ✅ No fallback usage on clear categories (achieved 0%)
- ✅ Average confidence >= 0.50 (achieved 0.64)

## Demo Talking Points
1. **Show the form** - Simple customer ticket submission
2. **Submit a test ticket** - "My laptop screen is broken and I need help urgently"
3. **Show AI classification** - Explain keyword matching in real-time
4. **Show confidence score** - Explain how confidence is calculated
5. **Show technician dashboard** - Display suggested category/priority
6. **Explain benefits** - Faster routing, consistent categorization, reduced manual work
7. **Acknowledge limitations** - Keyword-based, will improve with ML
8. **Future roadmap** - TF-IDF, OpenAI embeddings, continuous learning
