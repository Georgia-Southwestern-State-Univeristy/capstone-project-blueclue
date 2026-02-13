# Testing AI Priority Classification

## Quick Test (via Python script)

```bash
cd c:\BlueClue\capstone-project-blueclue\capstone-project-blueclue\blueclue\ai
python test_priority.py
```

This will run 15 test cases and show you exactly what the AI classifier does.

## Test via Web UI

The ticket form now defaults to **"Let AI determine priority"**. When submitting tickets:

### HIGH PRIORITY Tests
Submit tickets with these descriptions to test HIGH priority classification:

1. **"URGENT: My computer crashed and I cannot work at all!"**
   - Should classify as HIGH due to: URGENT, crashed, cannot work

2. **"EMERGENCY - Production server is down, need help ASAP"**
   - Should classify as HIGH due to: EMERGENCY, production, down, ASAP

3. **"Critical issue: System completely broken and blocking all work"**
   - Should classify as HIGH due to: critical, completely broken, blocking

4. **"Locked out of my account and I have a deadline today"**
   - Should classify as HIGH due to: locked out, deadline today

### MEDIUM PRIORITY Tests
Submit tickets with these descriptions to test MEDIUM priority classification:

1. **"Having trouble with my printer, it won't print documents"**
   - Should classify as MEDIUM due to: trouble, won't print

2. **"My mouse keeps disconnecting and I need help fixing it"**
   - Should classify as MEDIUM due to: keeps disconnecting, need help

3. **"Issue with email - attachments not working properly"**
   - Should classify as MEDIUM due to: issue, not working

4. **"Screen is flickering and it's getting hard to see"**
   - Should classify as MEDIUM (default when no keywords match)

### LOW PRIORITY Tests
Submit tickets with these descriptions to test LOW priority classification:

1. **"Just wondering if we can get a new keyboard when possible"**
   - Should classify as LOW due to: wondering, when possible

2. **"Question about software installation policy, no rush"**
   - Should classify as LOW due to: question, no rush

3. **"I'm curious about upgrading my monitor sometime"**
   - Should classify as LOW due to: curious, sometime

4. **"Information request about backup procedures when you get a chance"**
   - Should classify as LOW due to: information, when you get a chance

## How to Check Results

After submitting a ticket:

1. Go to the Technician Dashboard (All Tickets page)
2. Look for the **AI Classification** section in the ticket card
3. Check for:
   - **User Priority**: What you selected in the form (or "None" if you left it as "Let AI determine")
   - **AI Priority**: What the AI suggested
   - **Final Priority**: The badge color at the top of the card

## Why Was Everything "Medium"?

The form previously defaulted to `priority: 'medium'`, which meant every ticket had a user-selected priority that overrode the AI. 

Now it defaults to empty (`"Let AI determine priority"`), so the AI classification will be used unless the user explicitly selects a priority.

## Priority Logic

```
Final Priority = User Selection > AI Suggestion > "low" (fallback)
```

If user selects a priority → use that
Else if AI classifies successfully → use AI suggestion  
Else → default to "low"

## Keywords That Trigger Each Priority

### HIGH Priority Keywords
- **Urgency**: urgent, urgently, critical, emergency, ASAP, immediately, right now
- **Impact**: production, down, can't work, cannot work, blocking, system down, server down
- **Severity**: completely broken, not working at all, major issue, serious problem

### MEDIUM Priority Keywords
- **Issues**: issue, problem, trouble, difficulty
- **Functionality**: not working, won't work, can't, unable, doesn't work
- **Timing**: need, help, soon, today
- **Frequency**: keeps, repeatedly, constantly, always, disconnecting

### LOW Priority Keywords
- **Inquiries**: question, wondering, curious, interested
- **Timing**: when you get a chance, when possible, sometime, eventually, no rush, not urgent
- **General**: general, policy, information, guidance

## Example Test Session

```bash
# Run the automated test
python test_priority.py

# Then test via web:
# 1. Login as a customer
# 2. Create a ticket with: "URGENT laptop broken ASAP"
# 3. Leave priority as "Let AI determine priority"
# 4. Submit and check the AI Classification box
# 5. Should show: AI Priority = HIGH
```

## Troubleshooting

**Q: AI still showing medium for everything?**
- Check that you're leaving the priority dropdown as "Let AI determine priority"
- If you select a specific priority, that will override the AI

**Q: How do I see what keywords were matched?**
- Check the ticket details in the database, or
- Look at the AI Classification section on the dashboard which shows matched keywords

**Q: Can I force the AI to suggest a certain priority?**
- Yes, use the test keywords above
- For example, adding "URGENT" and "ASAP" to any description will usually trigger HIGH priority
