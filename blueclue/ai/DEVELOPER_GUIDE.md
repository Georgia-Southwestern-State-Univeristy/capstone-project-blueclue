# BlueClue Enhanced Classifier - Developer Quick Reference

## Overview
The enhanced classifier provides weighted keyword matching, subcategory detection, multi-category support, and sentiment-based priority classification.

---

## Classification Response Format

### Basic Response
```python
{
    "category": "hardware",              # Primary category
    "priority": "high",                  # Priority level
    "confidence": 0.91,                  # Overall confidence (0-1)
    "category_confidence": 0.89,         # Category-specific confidence
    "priority_confidence": 0.93,         # Priority-specific confidence
    "subcategory": "damage",             # Specific subcategory
    "fallback_used": False,              # Whether fallback was triggered
    "is_multi_category": True,           # Multiple categories detected
    "all_categories": [...],             # Top 3 matching categories
    "keywords_matched": {
        "category": [...],               # Keywords that matched category
        "priority": [...]                # Keywords that matched priority
    }
}
```

### Multi-Category Detection
When `is_multi_category` is True, check `all_categories`:
```python
"all_categories": [
    {
        "category": "network",
        "score": 12.5,
        "confidence": 0.90,
        "keywords": ["wifi", "can't connect", "disconnecting"],
        "subcategory": "wireless"
    },
    {
        "category": "hardware",
        "score": 8.0,
        "confidence": 0.75,
        "keywords": ["laptop", "battery"],
        "subcategory": "power"
    }
]
```

---

## Categories & Subcategories

### Hardware
**Subcategories:** computer, display, peripheral, printer, power, connectivity, damage, general

**Common Keywords:**
- **Computer:** laptop, computer, desktop, pc, workstation
- **Display:** screen, monitor, flickering, black screen
- **Peripheral:** keyboard, mouse, trackpad, keys stuck
- **Printer:** printer, paper jam, won't print, print queue
- **Power:** battery, charger, won't turn on, won't boot
- **Damage:** broken, damaged, cracked, water damage

### Software
**Subcategories:** os, office, browser, application, installation, error, security

**Common Keywords:**
- **OS:** windows, system update, blue screen, BSOD
- **Office:** excel, word, outlook, teams, office 365
- **Browser:** chrome, firefox, edge, safari
- **Error:** crash, crashing, freezing, not responding
- **Security:** antivirus, firewall, virus, malware

### Network
**Subcategories:** wireless, connectivity, vpn, hardware, performance, configuration

**Common Keywords:**
- **Wireless:** wifi, wireless, wifi password
- **Connectivity:** internet, connection, no internet, can't connect
- **VPN:** vpn, remote access, can't connect to vpn
- **Performance:** slow internet, bandwidth, buffering

### Login
**Subcategories:** authentication, password, account, credentials, email, mfa

**Common Keywords:**
- **Authentication:** login, sign in, can't login, login failed
- **Password:** password, forgot password, reset password
- **Account:** locked out, account locked, access denied
- **MFA:** mfa, 2fa, two-factor, verification code

### Other
**Subcategories:** inquiry, policy, general

**Common Keywords:** question, policy, inquiry, information, guidance

---

## Priority Levels

### High Priority
**Triggers:**
- Keywords: urgent, critical, emergency, asap, production down
- Sentiment: Multiple urgency boosters, exclamation marks
- Context: Login + "locked out", Hardware + "broken"

**Weight:** 5.0 for critical keywords

### Medium Priority
**Triggers:**
- Keywords: issue, problem, not working, can't, unable
- Sentiment: Neutral or single urgency indicator
- Context: Most standard issues default here

**Weight:** 3.0 for standard keywords

### Low Priority
**Triggers:**
- Keywords: question, when you get a chance, no rush
- Sentiment: Explicit low-priority modifiers
- Context: General inquiries, policy questions

**Weight:** 2.0 for low-priority keywords

---

## Usage Examples

### Example 1: Simple Hardware Issue
```python
from src.classifier import TicketClassifier

classifier = TicketClassifier(use_spacy=False)
result = classifier.classify("My laptop screen is broken")

# Result:
# category: "hardware"
# subcategory: "damage"
# priority: "medium" or "high" (depends on context)
# confidence: ~0.85
```

### Example 2: Multi-Category Detection
```python
result = classifier.classify("Laptop won't connect to wifi and battery is dead")

# Result:
# category: "network" or "hardware" (highest score wins)
# is_multi_category: True
# all_categories: [{"category": "network", ...}, {"category": "hardware", ...}]
```

### Example 3: Priority with Sentiment
```python
result = classifier.classify("VPN not working URGENT need access NOW")

# Result:
# category: "network"
# subcategory: "vpn"
# priority: "high" (urgency keywords + sentiment boost)
# priority_confidence: ~0.95
```

### Example 4: Low Priority
```python
result = classifier.classify("Question about printer setup when you get a chance")

# Result:
# category: "hardware"
# subcategory: "printer"
# priority: "low" ("when you get a chance" modifier)
```

---

## Confidence Interpretation

| Confidence Range | Interpretation | Action |
|------------------|----------------|--------|
| 0.8 - 1.0 | High confidence | Accept classification |
| 0.5 - 0.79 | Medium confidence | Classification likely correct |
| 0.3 - 0.49 | Low confidence | Consider manual review |
| < 0.3 | Very low confidence | Fallback triggered, needs review |

---

## Best Practices

### 1. Handle Multi-Category Tickets
```python
if result["is_multi_category"]:
    # Show user all matching categories
    primary = result["category"]
    secondary = result["all_categories"][1]["category"] if len(result["all_categories"]) > 1 else None
    # Allow user to select or combine
```

### 2. Use Subcategories for Routing
```python
if result["category"] == "hardware":
    if result["subcategory"] == "printer":
        assign_to_printer_specialist()
    elif result["subcategory"] == "damage":
        assign_to_hardware_repair()
```

### 3. Prioritize Based on Confidence
```python
if result["priority"] == "high" and result["priority_confidence"] > 0.8:
    escalate_immediately()
elif result["priority_confidence"] < 0.5:
    # Ask user to confirm priority
    prompt_priority_confirmation()
```

### 4. Handle Fallback Cases
```python
if result["fallback_used"]:
    # Prompt user for more details
    request_additional_information()
    # Or assign to triage team
    assign_to_triage()
```

---

## Testing

Run accuracy tests:
```bash
python test_accuracy.py
```

Expected results:
- Category Accuracy: 90%+
- Overall Accuracy: 75%+
- Fallback Rate: <5%

---

## Performance Considerations

### Memory Usage
- Classifier loads ~200 weighted keywords + phrases
- Minimal memory footprint (~1-2 MB)

### Speed
- Average classification time: <10ms
- No external API calls
- Suitable for real-time classification

### Scalability
- Stateless classifier (thread-safe)
- Can process thousands of tickets per second
- Consider caching for repeated classifications

---

## Troubleshooting

### Issue: Low Confidence Scores
**Cause:** Vague or ambiguous ticket descriptions  
**Solution:** Prompt users for more specific details

### Issue: Wrong Category Detection
**Cause:** Multi-category ticket or competing strong signals  
**Solution:** Check `is_multi_category` and review `all_categories`

### Issue: Priority Always Medium
**Cause:** Lack of explicit urgency indicators  
**Solution:** Encourage users to specify urgency in ticket description

### Issue: Fallback to "Other"
**Cause:** No matching keywords found  
**Solution:** Expand keyword vocabulary or prompt for clarification

---

## Future Enhancements (Roadmap)

### Short-term
- [ ] Adjust priority thresholds (reduce "medium" over-classification)
- [ ] Add disambiguation rules for common edge cases
- [ ] Enhanced sentiment analysis

### Medium-term
- [ ] Context window analysis
- [ ] Historical learning from corrections
- [ ] User feedback integration

### Long-term
- [ ] Hybrid ML + keyword approach
- [ ] Advanced NLP with dependency parsing
- [ ] Entity recognition for better context

---

## API Integration

### Backend Integration Example
```javascript
// Node.js backend integration
const { spawn } = require('child_process');

async function classifyTicket(description) {
    return new Promise((resolve, reject) => {
        const python = spawn('python', ['classify.py', description]);
        let result = '';
        
        python.stdout.on('data', (data) => {
            result += data.toString();
        });
        
        python.on('close', (code) => {
            if (code === 0) {
                resolve(JSON.parse(result));
            } else {
                reject(new Error('Classification failed'));
            }
        });
    });
}
```

---

## Support & Documentation

- **Main Documentation:** [README.md](README.md)
- **Test Results:** [test_results.md](test_results.md)
- **Enhancement Summary:** [ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md)
- **Original Changelog:** [CHANGELOG.md](CHANGELOG.md)

**Contact:** BlueClue Development Team
