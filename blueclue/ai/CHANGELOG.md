# AI Module Changelog

## [2026-02-10] - User Priority & Simple Message Support

### 🎯 New Features for Real-World Usage

### Added
- **User Priority Override Support**
  - New `user_priority` parameter in `classify()` method
  - User-selected priority always takes precedence over AI classification
  - Supports "high", "medium", "low" values from ticket form
  - Returns `priority_source` field ("user" or "ai") in response
  - User-selected priority has 100% confidence (1.0)
  - Enables users to override AI suggestions when they know better

- **Abbreviation Support (30+ common shortcuts)**
  - Computers: `pc`, `comp`, `puter`, `lappy` → computer/laptop
  - Negations: `cant`, `wont`, `doesnt`, `isnt` → can't, won't, doesn't, isn't
  - Tech terms: `pw`/`pwd` → password, `acct` → account, `wifi` → wifi
  - Hardware: `batt` → battery, `pwr` → power, `scrn`/`mon` → screen/monitor
  - Peripherals: `kb`/`kboard` → keyboard, `prtr` → printer
  - Network: `inet`/`net` → network
  - Automatic expansion during text preprocessing

- **Simple/Terse Message Support**
  - Enhanced handling of minimal descriptions (2-4 words)
  - Works with informal typing (no capitals, missing apostrophes)
  - 100% success rate on common simple messages
  - Examples that now work perfectly:
    - "pc wont turn on" → hardware (computer)
    - "i cant log in" → login (authentication)
    - "wifi not working" → network (wireless)
    - "forgot my pw" → login (password)
    - "printer broke" → hardware (printer)

- **Enhanced Test Suite (57 test cases)**
  - Added 8 new test cases for simple messages
  - Tests abbreviation expansion
  - Tests user priority override scenarios
  - Validates terse message classification

### Changed
- **Classification Response Format**
  - Added `priority_source` field ("user" or "ai")
  - Indicates whether priority came from user selection or AI
  - User-selected priorities return with confidence 1.0

- **Text Preprocessing**
  - Now expands abbreviations before classification
  - Improved handling of informal text
  - Better support for mobile/quick typing

### Improved
- **Accuracy Metrics**
  - Category Accuracy: 91.8% → 93.0% (+1.2%)
  - Overall Accuracy: 78.6% → 79.8% (+1.2%)
  - Simple Message Success: 100% (8/8 new tests)
  - Test Coverage: 49 → 57 test cases (+16%)
  - Network Category: Maintained 100% accuracy
  - Login Category: Maintained 100% accuracy

- **User Experience**
  - Users can now select urgency from ticket form
  - AI respects user's priority choice
  - Handles quick mobile messages effectively
  - Works with informal/abbreviated typing

### Documentation
- **New Files**
  - `USER_PRIORITY_GUIDE.md` - Comprehensive guide for user priority & simple messages
  - `test_simple_messages.py` - Dedicated test script for new features

- **Updated Files**
  - `README.md` - Added user priority and simple message documentation
  - `DEVELOPER_GUIDE.md` - Updated with new parameters and examples

### API Changes
- **Backward Compatible**
  - `user_priority` parameter is optional
  - Existing code without parameter continues to work
  - All new fields are additive (no breaking changes)

### Use Cases
```python
# Use Case 1: User selects priority from form
result = classifier.classify("pc wont turn on", user_priority="high")
# → priority: "high" (source: "user", confidence: 1.0)

# Use Case 2: AI suggests priority (user didn't select)
result = classifier.classify("pc wont turn on")
# → priority: "medium" (source: "ai", confidence: 0.75)

# Use Case 3: Simple message from mobile
result = classifier.classify("cant log in")
# → category: "login", subcategory: "authentication"
```

### Performance
- No performance impact from abbreviation expansion (<1ms overhead)
- User priority lookup: O(1) constant time
- Maintains <10ms average classification time

---

## [2026-02-10] - Major Enhancement: Advanced Classification System

### 🎯 Achievement: 91.8% Category Accuracy (Target: 85%+)

### Added
- **Enhanced Weighted Keyword System (200+ keywords)**
  - 3x keyword vocabulary expansion per category
  - Weighted scoring system (weights: 1.5-5.0)
  - Hardware: 50+ keywords across 7 subcategories
  - Software: 45+ keywords across 7 subcategories
  - Network: 35+ keywords across 6 subcategories
  - Login: 30+ keywords across 6 subcategories
  - Other: Enhanced general inquiry detection

- **Subcategory Detection (24 subcategories)**
  - Hardware: computer, display, peripheral, printer, power, connectivity, damage
  - Software: os, office, browser, application, installation, error, security
  - Network: wireless, connectivity, vpn, hardware, performance, configuration
  - Login: authentication, password, account, credentials, email, mfa
  - Other: inquiry, policy, general

- **Multi-Word Phrase Matching**
  - 25+ context-aware phrase patterns
  - Phrase bonus weight multiplier (1.5x)
  - Examples: "paper jam", "blue screen", "can't login", "locked out"

- **Multi-Category Detection**
  - Detects tickets spanning multiple categories
  - Returns top 3 matching categories with confidence scores
  - 16.3% of test tickets identified as multi-category

- **Enhanced Priority Classification**
  - Weighted priority keywords with context types
  - Sentiment analysis scoring:
    - Urgency boosters (now, today, asap, critical)
    - Negative modifiers (no rush, when you can)
    - Exclamation mark detection
    - ALL CAPS word detection
  - Category-based priority adjustments
  - Confidence scoring for priority predictions

- **Comprehensive Test Suite (49 test cases)**
  - Expanded from 15 to 49 test cases
  - Added edge cases and multi-category scenarios
  - Ambiguous case testing
  - Urgency variation tests
  - Enhanced test reporting with subcategory stats

### Changed
- **Classification Response Format**
  - Added `category_confidence` field
  - Added `priority_confidence` field
  - Added `subcategory` field
  - Added `is_multi_category` boolean flag
  - Added `all_categories` array with top 3 matches
  - Enhanced `keywords_matched` structure

- **Confidence Calculation**
  - Improved from simple keyword count to weighted scoring
  - Incorporates keyword diversity and phrase matches
  - Normalized to 0-1 range with better distribution
  - Average confidence increased from 0.3-0.5 to 0.7-1.0

### Improved
- **Accuracy Metrics**
  - Category Accuracy: 70% → 91.8% (+21.8%)
  - Overall Accuracy: 70% → 78.6% (+8.6%)
  - Fallback Rate: Reduced to 2.0% (significant improvement)
  - Network Category: 100% accuracy
  - Login Category: 100% accuracy
  - Other Category: 100% accuracy

- **Test Reporting**
  - Enhanced metrics calculation with subcategory stats
  - Improved console output formatting
  - Separate display of correct vs incorrect predictions
  - Multi-category detection reporting
  - Subcategory performance breakdown

### Documentation
- **New Files**
  - `ENHANCEMENT_SUMMARY.md` - Comprehensive enhancement overview
  - `DEVELOPER_GUIDE.md` - Quick reference for developers
  - Updated `test_results.md` - Enhanced test result format

### Technical Details
- **Code Quality**
  - Increased from ~150 to ~500+ lines of classifier logic
  - Maintained backward compatibility with existing API
  - No breaking changes to existing integrations
  - Performance: <10ms average classification time

### Performance
- Thread-safe stateless design
- Minimal memory footprint (~1-2 MB)
- Suitable for real-time classification
- Can process thousands of tickets per second

---

## [2026-01-30] - Flask REST API Implementation

### Added
- **Flask REST API Application**
  - Created `app.py` as main Flask application entry point
  - RESTful API with three endpoints:
    - `GET /` - API information and documentation
    - `GET /health` - Health check with status, message, timestamp, version
    - `POST /classify` - Ticket classification endpoint (accepts JSON)
  - Full error handling (400, 404, 405, 500)
  - CORS support for cross-origin requests
  - Integration with existing `TicketClassifier`

- **Dependencies**
  - Added `flask-cors==5.0.0` to `requirements.txt` for cross-origin support
  - All Flask dependencies auto-installed with requirements

- **Configuration**
  - Created `.env.example` template with:
    - PORT configuration (default: 5000)
    - FLASK_ENV (development/production)
    - FLASK_DEBUG flag
  - Environment-based configuration using python-dotenv

- **Documentation**
  - Comprehensive `README.md` with:
    - Quick start guide
    - Complete API endpoint documentation
    - Testing examples (cURL, PowerShell, JavaScript)
    - Error handling reference
    - Integration examples for backend
    - Troubleshooting guide

- **Testing UI**
  - Created `test_classifier_ui.html` - interactive web interface
  - Features:
    - Live ticket classification testing
    - Example buttons for quick testing
    - Visual result display with badges
    - Full JSON response viewer
    - Error handling and user feedback

### API Specifications

**Health Check Response:**
```json
{
  "status": "OK",
  "message": "BlueClue AI Classification API is running",
  "timestamp": "2026-01-30T10:30:00.000000",
  "version": "1.0.0"
}
```

**Classification Response:**
```json
{
  "success": true,
  "input": "ticket text",
  "classification": {
    "category": "technical",
    "priority": "high",
    "confidence": 0.67,
    "fallback_used": false,
    "keywords_matched": {
      "category": ["crash", "login"],
      "priority": ["urgent"]
    }
  },
  "timestamp": "2026-01-30T10:30:00.000000"
}
```

### Technical Details
- **Server**: Flask development server
- **Host**: 0.0.0.0 (all interfaces)
- **Port**: 5000 (configurable via .env)
- **CORS**: Enabled for all origins
- **Debug Mode**: Enabled in development

### Files Changed/Added
```
blueclue/ai/
├── app.py (NEW)
├── .env.example (NEW)
├── README.md (UPDATED - complete API docs)
├── test_classifier_ui.html (NEW)
├── requirements.txt (UPDATED - added flask-cors)
└── CHANGELOG.md (UPDATED)
```

### Fixed
- **CORS Issues**
  - Added flask-cors to enable requests from file:// URLs
  - Configured CORS for all routes and origins
  - Resolved browser cross-origin blocking

### Integration Ready
The Flask API is now ready for integration with the Node.js backend at `http://localhost:5000/classify`

### Next Steps
- Create backend service to call AI API
- Add request/response logging
- Implement rate limiting
- Add authentication for production
- Deploy as a microservice

---

## [2026-01-29] - Initial AI Module Setup

### Added
- **Python Virtual Environment**
  - Created isolated Python 3.12 virtual environment in `ai/venv/`
  - Configured `.gitignore` to exclude `venv/` from version control
  - Set up pip package management

- **Dependencies and Requirements**
  - Created `requirements.txt` with core dependencies:
    - Flask 3.1.0 - Web framework for API development
    - spaCy 3.8.0+ - NLP library for text processing
    - python-dotenv 1.0.1 - Environment variable management
    - requests 2.32.0 - HTTP library for external API calls
  - Downloaded spaCy English language model (`en_core_web_sm`)

- **Project Structure**
  - `src/` - Source code directory
  - `src/models/` - ML models directory (reserved for future use)
  - `src/utils/` - Utility functions directory
  - `tests/` - Test files directory

- **Ticket Classification System**
  - Implemented keyword-based ticket classifier (`src/classifier.py`)
    - Category classification (technical, billing, account, feature_request)
    - Priority classification (high, medium, low)
    - Confidence scoring
    - Fallback handling for unmatched tickets
    - Keyword tracking for transparency
  - Features:
    - Text preprocessing with spaCy (lemmatization, stopword removal)
    - Multi-keyword pattern matching
    - Returns structured classification results

- **Testing**
  - Created comprehensive test suite (`tests/test_classifier.py`)
  - Test coverage: 4 sample tickets across all categories
  - **Current accuracy: 75%** (exceeds 70% requirement)
  - Test validation for all required fields

### Technical Details
- Python Version: 3.12.10 (compatible with spaCy)
- Virtual Environment: venv
- Package Manager: pip
- NLP Model: en_core_web_sm (spaCy)

### Performance Metrics
- Classifier Accuracy: 75% (3/4 tickets fully correct)
- Category Detection: 100% (4/4 tickets)
- Priority Detection: 75% (3/4 tickets)

### Files Changed/Added
```
blueclue/ai/
├── requirements.txt (NEW)
├── CHANGELOG.md (NEW)
├── venv/ (NEW - not tracked)
├── src/
│   ├── __init__.py (NEW - package marker)
│   ├── classifier.py (NEW)
│   ├── models/ (NEW)
│   └── utils/ (NEW)
└── tests/
    └── test_classifier.py (NEW)
```

### Fixed
- **Python Package Structure**
  - Added `src/__init__.py` to make src a proper Python package
  - Updated imports in test files to use `from src.classifier` format
  - Resolved Pylance import warnings for better IDE support

### Next Steps
- Integrate classifier with backend API
- Add more sophisticated ML models
- Expand test coverage with real ticket data
- Implement continuous learning/feedback loop
