# BlueClue AI Classification Service

Flask-based REST API for classifying IT support tickets using NLP.

## Features

- **Automatic Category Detection:** Technical, Billing, Account, Feature Request
- **Priority Classification:** High, Medium, Low
- **Keyword-based NLP:** Using spaCy for text processing
- **RESTful API:** JSON endpoints for easy integration

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
  "text": "My application keeps crashing when I login. This is urgent!"
}
```

**Response:**
```json
{
  "success": true,
  "input": "My application keeps crashing when I login. This is urgent!",
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

## Testing

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

### Categories
- **technical:** Bugs, crashes, errors, performance issues
- **billing:** Payments, refunds, subscriptions, charges
- **account:** Login, password, access, authentication
- **feature_request:** Enhancement suggestions, new features

### Priority Levels
- **high:** Urgent, critical, emergency keywords
- **medium:** General issues, problems requiring attention
- **low:** Questions, suggestions, non-urgent requests

### Confidence Score
- Based on keyword match count
- Range: 0.0 to 1.0
- Falls back to "general" category if no keywords match

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
const response = await fetch('http://localhost:5000/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: ticketDescription })
});

const result = await response.json();
console.log(result.classification);
```

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
