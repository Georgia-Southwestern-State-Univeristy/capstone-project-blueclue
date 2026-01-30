# AI Module Changelog

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
