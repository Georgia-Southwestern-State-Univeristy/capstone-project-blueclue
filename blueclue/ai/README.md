# BlueClue AI Classification Service

Flask-based REST API for classifying IT support tickets using enhanced NLP with weighted keywords, subcategories, and user priority support.

## Features

- ✨ **Enhanced Category Detection:** Hardware, Software, Network, Login, Other
- 🎯 **Priority Classification:** High, Medium, Low (AI-suggested or user-selected)
- 🏷️ **Subcategory Detection:** 24 granular subcategories for precise routing
- 🔤 **Abbreviation Support:** Handles "pc", "wifi", "cant", "pw" and 30+ more
- 📊 **Multi-Category Detection:** Identifies tickets spanning multiple areas
- 🤖 **Weighted Keyword Matching:** 200+ keywords with context-aware scoring
- 💬 **Simple Message Support:** Works with terse messages like "pc wont turn on"
- 👤 **User Priority Override:** Respects user-selected urgency levels
- 📈 **93% Category Accuracy:** Extensively tested and optimized
- 🔌 **RESTful API:** JSON endpoints for easy integration

## Quick Start

### 1. Setup Virtual Environment

```bash
# From blueclue/ai directory
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env if needed (default PORT=5000)
```

### 4. Run the Server

```bash
python app.py
```

Server will start at `http://localhost:5000`

## API Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "message": "BlueClue AI Classification API is running",
  "timestamp": "2026-01-30T10:30:00.000000",
  "version": "1.0.0"
}
```

### Root Information
```http
GET /
```

**Response:**
```json
{
  "name": "BlueClue AI Classification API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "classify": "/classify (POST)"
  }
}
```

### Classify Ticket
```http
POST /classify
Content-Type: application/json

{
  "text": "My laptop screen is broken and I need help urgently",
  "priority": "high"  // Optional: user-selected priority
}
```

**Response:**
```json
{
  "success": true,
  "input": "My laptop screen is broken and I need help urgently",
  "classification": {
    "category": "hardware",
    "subcategory": "damage",
    "priority": "high",
    "priority_source": "user",
    "confidence": 0.91,
    "category_confidence": 0.89,
    "priority_confidence": 1.0,
    "fallback_used": false,
    "is_multi_category": false,
    "all_categories": [
      {
        "category": "hardware",
        "score": 13.5,
        "confidence": 0.89,
        "subcategory": "damage"
      }
    ],
    "keywords_matched": {
      "category": ["laptop", "screen", "broken"],
      "priority": ["urgently", "need help"]
    }
  },
  "timestamp": "2026-02-10T10:30:00.000000"
}
```

**Simple Message Example:**
```http
POST /classify
Content-Type: application/json

{
  "text": "pc wont turn on"
}
```

**Response:**
```json
{
  "classification": {
    "category": "hardware",
    "subcategory": "computer",
    "priority": "medium",
    "priority_source": "ai",
    "confidence": 1.0,
    "keywords_matched": {
      "category": ["computer", "pc", "won't turn on"],
      "priority": ["not working"]
    }
  }
}
```

## Testing

### Run Accuracy Tests
```bash
# Full accuracy test suite (57 test cases)
python test_accuracy.py

# Test simple messages and user priority
python test_simple_messages.py
```

**Expected Results:**
- Category Accuracy: 93%+
- Overall Accuracy: 79%+
- Simple Message Success: 100%

### Run Unit Tests
```bash
cd tests
python test_classifier.py
```

### Test API with cURL

**Health Check:**
```bash
curl http://localhost:5000/health
```

**Classify Ticket:**
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "I forgot my password"}'
```

**With User Priority:**
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "wifi not working", "priority": "high"}'
```

### Test with PowerShell

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get

# Classify ticket
$body = @{
    text = "My account was charged twice"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/classify" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## Project Structure

```
ai/
├── app.py              # Flask application entry point
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variables template
├── .env                # Local config (not committed)
├── src/
│   ├── __init__.py
│   ├── classifier.py   # TicketClassifier class
│   ├── models/         # Future: ML models
│   └── utils/          # Helper functions
└── tests/
    └── test_classifier.py
```

## Classification Logic

### Categories & Subcategories

#### Hardware (18 subcategories)
**Subcategories:** computer, display, peripheral, printer, power, connectivity, damage, general  
**Keywords:** laptop, screen, monitor, keyboard, mouse, printer, battery, cable, usb, broken, damaged  
**Examples:** "laptop screen broken", "printer won't print", "battery not charging"

#### Software (12 subcategories)
**Subcategories:** os, office, browser, application, installation, error, security  
**Keywords:** windows, office, excel, word, outlook, chrome, crash, freezing, blue screen, virus  
**Examples:** "excel keeps crashing", "windows update failed", "outlook not responding"

#### Network (11 subcategories)
**Subcategories:** wireless, connectivity, vpn, hardware, performance, configuration  
**Keywords:** wifi, internet, connection, vpn, router, slow internet, can't connect  
**Examples:** "wifi not working", "vpn keeps dropping", "slow internet connection"

#### Login (8 subcategories)
**Subcategories:** authentication, password, account, credentials, email, mfa  
**Keywords:** login, password, locked out, forgot password, can't login, mfa, access denied  
**Examples:** "can't login", "forgot my password", "account locked out"

#### Other (4 subcategories)
**Subcategories:** inquiry, policy, general  
**Keywords:** question, policy, inquiry, information, general  
**Examples:** "question about company policy", "general inquiry"

### Priority Levels

#### High Priority
- **Keywords:** urgent, critical, emergency, asap, production down, can't work
- **Sentiment:** Multiple exclamation marks, ALL CAPS words
- **Context:** Login + "locked out", Hardware + "broken"
- **User Override:** User selects "high" priority
- **Examples:** "URGENT laptop broken", "production server down"

#### Medium Priority
- **Keywords:** issue, problem, not working, can't, unable, help needed
- **Default:** Most standard issues without urgency indicators
- **Examples:** "printer not working", "software won't open"

#### Low Priority
- **Keywords:** question, when you get a chance, no rush, sometime, curious
- **Modifiers:** "not urgent", "low priority"
- **Examples:** "question about settings when you get a chance"

### User Priority Override
When users select priority from the ticket form:
- User's choice **always takes precedence** over AI classification
- Confidence set to 1.0 for user-selected priority
- `priority_source` field indicates "user" vs "ai"

### Abbreviation Expansion
Common shortcuts automatically expanded:
- **Computers:** pc → computer, comp → computer, lappy → laptop
- **Tech:** pw/pwd → password, wifi → wifi, acct → account
- **Negations:** cant → can't, wont → won't, doesnt → doesn't
- **Hardware:** kb → keyboard, mon → monitor, batt → battery

### Confidence Score
- **Range:** 0.0 to 1.0
- **Category:** Based on weighted keyword scores (200+ keywords)
- **Priority:** Based on keyword weights and sentiment analysis
- **Overall:** Weighted average (60% category + 40% priority)
- **Fallback:** Triggers at 2% rate when no keywords match

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `FLASK_ENV` | `development` | Environment mode |
| `FLASK_DEBUG` | `True` | Enable debug mode |

## Error Handling

### 400 Bad Request
- Missing `text` field
- Invalid JSON format

### 404 Not Found
- Invalid endpoint

### 405 Method Not Allowed
- Wrong HTTP method

### 500 Internal Server Error
- Classification processing error

## Development

### Adding New Keywords

Edit `src/classifier.py`:

```python
self.category_keywords = {
    "technical": ["error", "bug", "crash", ...],
    # Add more keywords here
}
```

### Improving Classification

1. Update keyword lists in classifier
2. Add more sophisticated NLP preprocessing
3. Train a machine learning model (future enhancement)

## Integration with Backend

The Node.js backend can call this service:

```javascript
// Basic classification
const response = await fetch('http://localhost:5000/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text: ticketDescription 
  })
});

// With user-selected priority
const response = await fetch('http://localhost:5000/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text: ticketDescription,
    priority: userSelectedPriority  // "high", "medium", or "low"
  })
});

const result = await response.json();
console.log(result.classification);

// Access enhanced fields
const {
  category,           // "hardware", "software", "network", "login", "other"
  subcategory,        // e.g., "printer", "vpn", "authentication"
  priority,           // "high", "medium", "low"
  priority_source,    // "user" or "ai"
  confidence,         // Overall confidence (0-1)
  is_multi_category,  // Boolean
  all_categories      // Array of matching categories
} = result.classification;
```

## Enhanced Features (Feb 2026)

### 1. User Priority Support
Users can now select their own urgency level from the ticket form. When provided, the user's choice **always takes precedence** over AI classification:

```javascript
// User submits ticket with urgency selection
const ticket = {
  description: "My computer won't start",
  urgency: "high"  // User's choice from dropdown
};

// AI respects user's selection
const result = await classifyTicket(ticket.description, ticket.urgency);
// result.priority = "high"
// result.priority_source = "user"
// result.priority_confidence = 1.0
```

### 2. Simple Message Support
The classifier now handles terse, informal messages perfectly:

| Input | Category | Subcategory |
|-------|----------|-------------|
| "pc wont turn on" | hardware | computer |
| "i cant log in" | login | authentication |
| "wifi not working" | network | wireless |
| "forgot my pw" | login | password |
| "printer broke" | hardware | printer |

**All abbreviations are automatically expanded** (pc → computer, pw → password, etc.)

### 3. Multi-Category Detection
Some tickets span multiple areas. The classifier now identifies this:

```json
{
  "is_multi_category": true,
  "all_categories": [
    { "category": "network", "confidence": 0.90, "subcategory": "wireless" },
    { "category": "hardware", "confidence": 0.75, "subcategory": "power" }
  ]
}
```

**Use Case:** "Laptop won't connect to wifi and battery is dead" → Hardware + Network

## Documentation

- 📖 **[ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md)** - Complete enhancement overview and results
- 👨‍💻 **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Quick reference for developers
- 👤 **[USER_PRIORITY_GUIDE.md](USER_PRIORITY_GUIDE.md)** - User priority & simple messages guide
- 📝 **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes
- 🧪 **[test_results.md](test_results.md)** - Latest test results

## Performance Metrics

| Metric | Value |
|--------|-------|
| **Category Accuracy** | 93.0% |
| **Overall Accuracy** | 79.8% |
| **Simple Message Success** | 100% |
| **Network Category** | 100% |
| **Login Category** | 100% |
| **Fallback Rate** | 1.8% |
| **Multi-Category Detection** | 15.8% |
| **Test Coverage** | 57 test cases |

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env file
PORT=5001
```

### Module Not Found
```bash
# Ensure venv is activated
.\venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt
```

### spaCy Model Missing
```bash
python -m spacy download en_core_web_sm
```

## License

Part of the BlueClue project - see main repository for license details.
