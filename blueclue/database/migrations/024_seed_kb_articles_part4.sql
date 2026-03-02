-- ============================================================================
-- Migration 024: Seed Knowledge Base with Common Support Articles (Part 4 - Final Articles)
-- ============================================================================
-- Description: Populates knowledge base with final 3 starter articles
-- Date: 2026-02-26
-- Safe to run multiple times: Yes (uses ON CONFLICT to skip duplicates)
-- ============================================================================

DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    -- Get admin user ID for article authorship
    SELECT id INTO admin_user_id FROM users WHERE role IN ('admin', 'management') LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'No admin user found. Please create an admin user before seeding knowledge base.';
        RETURN;
    END IF;

    RAISE NOTICE 'Seeding knowledge base articles (Final 3 articles) with admin user ID: %', admin_user_id;

    -- ========================================================================
    -- Article 13: How to Escalate an Urgent Issue
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'How to Escalate an Urgent Issue',
        'how-to-escalate-urgent-issue',
        'Support & Services',
        '["escalation", "urgent", "critical", "priority", "emergency"]'::jsonb,
        'beginner',
        E'# How to Escalate an Urgent Issue

## Overview
Most issues are resolved through normal support channels, but some situations require immediate escalation to ensure rapid resolution.

## Issue Priority Levels

### Critical (P1) - Immediate Escalation
**Examples:**
- Complete system outage affecting entire company
- Security breach or data exposure
- Critical application down (payroll, customer-facing)
- Network outage affecting multiple locations
- Data loss or corruption
- Executive-level emergency

**Response time:** 15 minutes
**Resolution target:** 2-4 hours

### High (P2) - Escalate if Not Resolved in 4 Hours
**Examples:**
- Department-wide system issues
- Major application malfunction
- Multiple users affected
- VIP/Executive issues
- Customer-impacting problems
- Time-sensitive project blocker

**Response time:** 1 hour
**Resolution target:** 8-24 hours

### Medium (P3) - Normal Support Channel
**Examples:**
- Individual user issues
- Non-critical application problems
- Minor performance issues
- Software installation requests
- Password resets
- General how-to questions

**Response time:** 4 hours
**Resolution target:** 1-3 business days

### Low (P4) - Normal Support Channel
**Examples:**
- Feature requests
- General inquiries
- Documentation updates
- Enhancement suggestions
- Non-urgent requests

**Response time:** 24 hours
**Resolution target:** 1-2 weeks

## When to Escalate

### Escalate Immediately If:
- **Business-critical system is down**
- **Security incident or breach**
- **Multiple people/departments affected**
- **Revenue or customer service impacted**
- **Executive request**
- **Normal support not responding** (after 2 hours for high priority)
- **Issue getting worse over time**
- **Deadline at risk** (payroll, reports, customer deliverable)

### Do NOT Escalate If:
- Issue only affects you (unless time-critical)
- Already working with support (unless stalled)
- You want to skip the queue
- Issue is low priority
- You haven''t tried normal support first
- It''s a general question or how-to request

## Escalation Methods

### Critical Issues (P1) - Multiple Channels

#### 1. IT Emergency Hotline (Primary)
**Phone:** (555) 999-HELP (555-999-4357)
- **Available:** 24/7/365
- **For:** Critical outages, security incidents, emergencies only
- **Response:** Live person within 2 minutes

#### 2. Email Escalation
**Email:** emergency@blueclue.com
- Subject: **URGENT:** [Brief description]
- Include: Impact, affected systems, number of users
- **Response:** 15 minutes

#### 3. Submit Critical Ticket
1. Portal: https://portal.blueclue.com
2. Category: **Emergency/Critical**
3. Priority: **Critical (P1)**
4. Describe impact and urgency
5. **Auto-escalates** to on-call engineer

#### 4. Management Escalation
If IT not responding:
- **IT Director**: it-director@blueclue.com
- **CTO**: cto@blueclue.com (for major incidents only)

### High Priority Issues (P2)

#### 1. Submit High Priority Ticket
1. Portal: https://portal.blueclue.com
2. Priority: **High (P2)**
3. Detailed description of issue
4. Business impact explanation
5. **Response:** Within 1 hour

#### 2. Call IT Help Desk
**Phone:** (555) 123-4567
- **Available:** Monday-Friday, 7 AM - 7 PM
- Mention ticket number
- Explain business impact
- Request escalation if needed

#### 3. Email Your Manager
If affecting multiple team members:
- Copy your manager on ticket
- Manager can escalate to IT management
- Provides visibility to leadership

## How to Escalate an Existing Ticket

### Step 1: Update Your Ticket

1. Log into **BlueClue Portal**
2. Go to **My Tickets**
3. Open the ticket
4. Click **"Add Comment"**
5. Write:
   ```
   ESCALATION REQUEST
   
   Reason for escalation: [Be specific]
   Business impact: [Revenue loss, customers affected, deadline, etc.]
   Time sensitivity: [When you need this resolved]
   Workaround tried: [What you\'ve attempted]
   Additional users affected: [If applicable]
   ```
6. Change priority if appropriate
7. Click **"Request Escalation"**

### Step 2: Call IT Support

After updating ticket:
1. Call IT Help Desk: (555) 123-4567
2. Provide **ticket number**
3. Explain **why escalation is needed**
4. Describe **business impact**
5. Note time provided escalation request

### Step 3: Follow Escalation Chain

If still not resolved:

**Level 1:** Technician (initial assignment)
↓ Not resolved in expected timeframe
**Level 2:** Senior Technician / Specialist
↓ Still not resolved
**Level 3:** Team Lead / Manager
↓ Critical or complex issues
**Level 4:** IT Director
↓ Major incidents only
**Level 5:** CTO / Executive Team

## Escalation Email Template

### For Critical Issues

```
To: emergency@blueclue.com
Subject: URGENT: [Brief Description] - [Your Department]

CRITICAL ISSUE REPORT

Ticket Number: [If applicable]
Reported By: [Your Name]
Department: [Your Department]
Contact: [Your Phone]
Time Discovered: [Exact time]

ISSUE DESCRIPTION:
[Clear, specific description of the problem]

BUSINESS IMPACT:
- Number of users affected: [Number]
- Systems/Applications down: [List]
- Revenue impact: [If applicable]
- Customer impact: [If applicable]
- Work stoppage: [Yes/No]

URGENCY:
[Why this needs immediate attention]

STEPS TAKEN:
1. [What you\'ve tried]
2. [Troubleshooting attempted]
3. [Normal support contacted? When?]

REQUESTED ACTION:
[What you need IT to do]

Thank you,
[Your Name]
[Contact Information]
```

### For High Priority Issues

```
To: support@blueclue.com
CC: [Your manager]
Subject: HIGH PRIORITY: [Issue Description] - Ticket #[Number]

Escalating ticket #[Number] to high priority.

REASON FOR ESCALATION:
[Clear business justification]

CURRENT STATUS:
- Ticket opened: [Date/Time]
- Last update: [When]
- Current state: [Status]

BUSINESS IMPACT:
[How this affects work/revenue/customers]

TIMELINE:
Need resolution by: [Date/Time]
Reason for deadline: [Why]

Thank you,
[Your Name]
```

## Escalation Best Practices

### Provide Clear Information

**Include:**
- Ticket number (if exists)
- Exact error messages (screenshots)
- What you were doing when issue occurred
- Number of users affected
- Business impact (revenue, customers, deadlines)
- Troubleshooting already attempted
- Your contact information
- Best time to reach you

**Avoid:**
- Vague descriptions ("it\'s broken")
- Exaggerating severity
- Blame or angry language
- Demanding specific person/solution
- Threatening escalation before giving IT time to respond

### Communication Tips

**DO:**
- Be specific and factual
- Explain business impact clearly
- Remain professional and calm
- Provide context (deadlines, dependencies)
- Document everything
- Response when IT requests information
- Keep ticket updated

**DON\'T:**
- Escalate to multiple managers simultaneously
- Bypass normal process without valid reason
- Exaggerate priority to skip queue
- Escalate without attempting troubleshooting
- Make IT issues personal
- Threaten or pressure support staff

## After-Hours Emergency Escalation

### 24/7 Emergency Support

**Phone:** (555) 999-HELP (555-999-4357)

**Available for:**
- Critical system outages
- Security incidents
- Data loss emergencies
- Executive urgent needs
- Customer-facing system failures

**Response Protocol:**
1. On-call engineer answers or calls back within 2 minutes
2. Issue assessment and triage
3. Escalation to specialists if needed
4. Regular updates every 30 minutes for critical issues
5. Resolution or workaround provided
6. Follow-up ticket created for business hours

### Nights and Weekends

**Coverage:**
- **Friday 7 PM - Monday 7 AM**: On-call engineer
- **Holidays**: Skeleton crew for emergencies
- **Regular business hours**: Full support team

**Response Times:**
- **Critical (P1)**: 15 minutes
- **High (P2)**: 2 hours (may wait until Monday for non-emergency)
- **Medium/Low (P3/P4)**: Next business day

## Escalation Scenarios

### Scenario 1: Payroll System Down (Friday Afternoon)

**Issue:** Payroll application crashed before pay run
**Deadline:** Must process by 5 PM for direct deposits
**Impact:** 500 employees won\'t get paid on time

**Escalation Path:**
1. Call emergency hotline: (555) 999-4357
2. Create critical (P1) ticket
3. Email: emergency@blueclue.com
4. Notify HR Director and IT Director
5. Document error messages and symptoms
6. Have access credentials ready for support

### Scenario 2: Email Down for Entire Department

**Issue:** Sales team (30 people) cannot access email
**Impact:** Can\'t respond to customer inquiries, losing sales
**Timeline:** Morning outage, now 2 hours with no service

**Escalation Path:**
1. High priority (P2) ticket if not already created
2. Call IT help desk: (555) 123-4567
3. Manager emails IT management
4. Request status update every hour
5. If not resolved in 4 hours, escalate to critical

### Scenario 3: Individual Laptop Won\'t Boot

**Issue:** Your laptop won\'t start, important presentation in 3 hours
**Impact:** You only, but time-sensitive client presentation

**Escalation Path:**
1. Call IT help desk: (555) 123-4567
2. Explain time sensitivity (presentation deadline)
3. Request loaner laptop immediately
4. Ask IT to transfer presentation files
5. DON\'T escalate to emergency line (not system-wide)

## Special Escalation Scenarios

### Executive Requests

**VIP/Executive Support:**
- Dedicated support queue
- Faster response times
- Direct line: (555) 123-EXEC
- Executive Support Team

**If you\'re helping executive:**
1. Create ticket on their behalf
2. Mark as "Executive Request"
3. Include executive\'s name
4. Provide your contact info as liaison

### Customer-Facing Issues

**When customers are affected:**
1. Escalate to high (P2) or critical (P1)
2. Quantify customer impact (number affected)
3. Include revenue impact if known
4. Loop in Customer Support management
5. Request hourly updates
6. Prepare customer communication

### Security Incidents

**Always escalate immediately:**
- **Security Hotline:** (555) 999-SECURITY
- **Email:** security@blueclue.com
- **Do NOT use regular support channels**
- See "Reporting a Security Issue" article

## Escalation Metrics

### What IT Tracks

- **First response time**: Time until first IT contact
- **Resolution time**: Time to fix or workaround
- **Escalation rate**: How often tickets escalate
- **Customer satisfaction**: Your feedback after resolution

### Your Responsibility

- Respond promptly when IT requests information
- Test proposed solutions
- Confirm when issue is resolved
- Provide feedback on support quality

## After Escalation

### Issue Resolved

1. **Confirm resolution** in ticket
2. **Test thoroughly** before closing
3. **Provide feedback** on support experience
4. **Thank the support team** (they\'re people too!)
5. **Document** what happened for future reference

### Issue Not Resolved

1. **Request status update** if no progress
2. **Escalate higher** if stalled
3. **Involve management** if business-critical
4. **Document everything** for accountability
5. **Ask for workaround** while working on fix

## Escalation Abuse

### Inappropriate Escalations

**Will result in:**
- Ticket re-prioritized to appropriate level
- Coaching from management
- Delayed support for future escalations
- Formal warning (repeat offenders)

**Examples of abuse:**
- Escalating every minor issue
- Demanding specific technician
- Bypassing queue without justification
- Falsely claiming issues are critical
- Being rude or threatening

## Need Help?

### Normal Support (M-F, 7 AM - 7 PM)
- **Phone:** (555) 123-4567
- **Email:** support@blueclue.com
- **Portal:** https://portal.blueclue.com

### After-Hours Emergency (24/7)
- **Phone:** (555) 999-HELP (4357)
- **Email:** emergency@blueclue.com

### Security Issues (24/7)
- **Phone:** (555) 999-SECURITY (7328)
- **Email:** security@blueclue.com

### Questions About Escalation Process
- **Email:** support-management@blueclue.com
- **Knowledge Base:** Search "escalation policy"

## Remember

**Escalation is for urgency, not impatience.**

Most issues are resolved through normal support channels. Use escalation when:
- Business operations genuinely at risk
- Large number of people affected
- Security or safety concerns
- Normal process has failed

Your IT support team is here to help. Clear communication and appropriate escalation ensure everyone gets the help they need quickly.',
        'Learn when and how to escalate urgent IT issues for faster resolution.',
        'Complete guide to escalating IT issues. Includes priority levels, escalation paths, contact information, and best practices.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 14: Business Hours and Support Availability
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Business Hours and Support Availability',
        'business-hours-support-availability',
        'Support & Services',
        '["business hours", "support hours", "availability", "contact", "schedule"]'::jsonb,
        'beginner',
        E'# Business Hours and Support Availability

## IT Support Hours

### Standard Support (Help Desk)

**Monday - Friday**
- **7:00 AM - 7:00 PM** Central Time
- Full support team available
- All issue types handled
- Phone, email, portal, and chat support

**Saturday**
- **9:00 AM - 5:00 PM** Central Time
- Reduced staff (2-3 technicians)
- Priority and urgent issues only
- Phone and email support
- No on-site support

**Sunday**
- **Closed** (Emergency line only)
- Call emergency number for critical issues

**Holidays**
- **Closed** for major holidays (see list below)
- Emergency support available 24/7
- Next business day for non-critical issues

### Emergency Support (24/7)

**Available:** Every day, all hours
**Phone:** (555) 999-HELP (555-999-4357)
**Email:** emergency@blueclue.com

**For critical issues only:**
- System-wide outages
- Security incidents
- Data loss emergencies
- Critical application failures
- Executive urgent needs

**Response time:** 15 minutes

## Contact Information

### IT Help Desk (Primary Contact)

**Phone:** (555) 123-4567
- Press 1: Technical support
- Press 2: Password reset
- Press 3: Hardware issues
- Press 4: Software/application support
- Press 5: Network/connectivity
- Press 9: Speak to operator

**Email:** support@blueclue.com
**Portal:** https://portal.blueclue.com
**Chat:** Available in portal during business hours

**Location:** Building A, 2nd Floor, Room 205

**Walk-in hours:**
- Monday-Friday: 8:00 AM - 5:00 PM
- Please bring your laptop for hardware issues

### Emergency & Security

**24/7 Emergency Hotline:** (555) 999-HELP (555-999-4357)
**Security Hotline:** (555) 999-SECURITY (555-999-7328)
**Email:** emergency@blueclue.com
**Security Email:** security@blueclue.com

### Specialized Support Teams

**Network Team**
- Email: network@blueclue.com
- Available: Monday-Friday, 8 AM - 6 PM
- For: VPN, WiFi, network infrastructure

**Server & Infrastructure Team**
- Email: infrastructure@blueclue.com
- Available: Monday-Friday, 7 AM - 7 PM
- 24/7 on-call for critical issues

**Application Support Team**
- Email: app-support@blueclue.com
- Available: Monday-Friday, 8 AM - 6 PM
- For: Business applications, software issues

**Security Team**
- Email: security@blueclue.com
- Available: 24/7 for incidents
- Monday-Friday 9 AM - 5 PM for consultations

### Department-Specific Support

**Executive Support**
- Phone: (555) 123-EXEC (555-123-3932)
- Email: exec-support@blueclue.com
- Priority queue for C-level and VPs
- Monday-Friday: 7 AM - 7 PM

**Developer Tools & DevOps**
- Email: devops@blueclue.com
- Slack: #devops-support
- Available: Monday-Friday, 8 AM - 6 PM
- On-call for production issues

**Audio/Visual Support**
- Phone: (555) 123-4567 ext. 2300
- Email: av-support@blueclue.com
- For: Conference rooms, presentations, video equipment
- Monday-Friday: 7 AM - 6 PM

## Response Time Expectations

### Standard Support Hours

| Priority | First Response | Resolution Target |
|----------|----------------|-------------------|
| Critical (P1) | 15 minutes | 2-4 hours |
| High (P2) | 1 hour | 8-24 hours |
| Medium (P3) | 4 hours | 1-3 business days |
| Low (P4) | 24 hours | 1-2 weeks |

### After-Hours & Weekends

| Priority | First Response | Resolution Target |
|----------|----------------|-------------------|
| Critical (P1) | 15 minutes | 4-8 hours |
| High (P2) | 2 hours | Next business day |
| Medium (P3) | Next business day | 2-5 business days |
| Low (P4) | Next business day | 2-3 weeks |

**Note:** Complex issues may take longer. You''ll receive regular updates.

## Holiday Schedule

### Company Holidays (IT Support Closed)

**2026 Holidays:**
- **January 1** - New Year''s Day
- **January 20** - Martin Luther King Jr. Day
- **February 17** - Presidents'' Day
- **May 26** - Memorial Day
- **July 3** - Independence Day (observed)
- **July 4** - Independence Day
- **September 7** - Labor Day
- **November 26** - Thanksgiving Day
- **November 27** - Day After Thanksgiving
- **December 24** - Christmas Eve (half day, close at noon)
- **December 25** - Christmas Day
- **December 31** - New Year''s Eve (half day, close at noon)

**Emergency support available on all holidays**

### Holiday Support Coverage

**Holiday Schedule:**
- Help Desk: Closed
- Emergency line: Open 24/7
- Email monitoring: Every 2 hours
- On-call engineer: Available for critical issues

**Before holidays:**
- Submit non-urgent requests 2-3 days in advance
- Plan for extended response times
- Download critical files to local device
- Save emergency contact numbers

## Service Level Agreements (SLAs)

### Uptime Commitments

**Core Systems:** 99.9% uptime
- Email: 99.9%
- File servers: 99.5%
- Internet: 99.9%
- VPN: 99.5%
- Business applications: 99%

**Planned Maintenance:**
- Scheduled during maintenance windows
- Advanced notice (7 days minimum)
- Typically Saturday nights or Sundays
- Critical systems: 30 days notice

### Maintenance Windows

**Regular Maintenance:**
- **Day:** Every 2nd and 4th Saturday
- **Time:** 10:00 PM - 6:00 AM Sunday
- **Impact:** Possible system unavailability
- **Notification:** Email sent Tuesday before

**Emergency Maintenance:**
- Performed as needed for security/critical fixes
- Minimum 24-hour notice when possible
- May occur during business hours for critical issues

## How to Contact IT Support

### Method 1: Self-Service Portal (Recommended)

**Portal:** https://portal.blueclue.com

**Benefits:**
- 24/7 ticket submission
- Track ticket status
- Upload screenshots/files
- View knowledge base
- Check system status
- Fastest for documentation

**How to submit:**
1. Log in with credentials
2. Click "Submit New Ticket"
3. Select category
4. Describe issue
5. Attach files if needed
6. Click "Submit"

**You''ll receive:**
- Immediate confirmation email
- Ticket number for tracking
- Expected response time
- Updates via email

### Method 2: Phone Call (Fastest for Urgent)

**Phone:** (555) 123-4567

**Best for:**
- Urgent issues
- Need immediate assistance
- Cannot access computer/portal
- Prefer verbal explanation

**Tips for faster service:**
- Have ticket number ready (if exists)
- Note error messages
- Be at your computer if possible
- Have asset tag number available

**Average wait time:**
- Morning (7-9 AM): 2-5 minutes
- Midday (11 AM - 2 PM): 5-10 minutes
- Afternoon (3-5 PM): 2-5 minutes
- Late day (5-7 PM): 1-2 minutes

### Method 3: Email

**Email:** support@blueclue.com

**Best for:**
- Non-urgent issues
- Detailed explanations needed
- Attaching files/screenshots
- After-hours submission

**Response time:** Within 4 hours during business hours

**Email should include:**
- Clear subject line
- Detailed description
- Error messages (copy/paste)
- What you were doing
- What you''ve tried
- Your contact info

### Method 4: Walk-In Support

**Location:** Building A, 2nd Floor, Room 205
**Hours:** Monday-Friday, 8 AM - 5 PM

**Best for:**
- Hardware issues (bring device)
- Need hands-on help
- Quick questions
- Software installations (if on-site)

**What to bring:**
- Your laptop (for hardware/software issues)
- Asset tag number
- Ticket number (if you have one)

**Services available:**
- Password resets
- Software installations
- Hardware diagnostics
- Quick troubleshooting
- Loaner equipment pickup

**Wait times:**
- Usually 5-15 minutes
- Longer for complex issues
- Schedule appointment for guaranteed time

### Method 5: Live Chat

**Available:** Portal & Intranet during business hours
**Hours:** Monday-Friday, 8 AM - 6 PM

**Best for:**
- Quick questions
- How-to inquiries
- Simple troubleshooting
- Checking ticket status

**Not ideal for:**
- Complex technical issues
- Requiring screen sharing
- Detailed explanations

## Special Services

### New Hire Onboarding

**Equipment Setup:**
- Submit ticket 3 business days before start date
- IT prepares laptop, credentials, accounts
- Equipment ready on day 1
- Orientation session scheduled

**Contact:** onboarding@blueclue.com

### VIP/Executive Support

**Dedicated Team:**
- Phone: (555) 123-EXEC
- Email: exec-support@blueclue.com
- Priority response
- After-hours support available

**Eligible:** C-level, VPs, Board members

### Training Sessions

**Available:**
- New software training
- Security awareness
- Best practices workshops
- One-on-one coaching

**Schedule:**
- Monthly group sessions (see calendar)
- Request private session: training@blueclue.com

**Topics:**
- Office 365
- Security best practices
- VPN and remote access
- Collaboration tools
- Time management with technology

### Vendor/Contractor Support

**Guest Support:**
- Limited support for non-employees
- Must be sponsored by employee
- Basic access only (WiFi, email)
- Submit via employee account

**Contact:** Sponsor employee submits ticket on behalf

## After-Hours & Weekend Support

### What''s Available

**24/7 Emergency Line:** (555) 999-HELP
- Critical outages
- Security incidents
- Data emergencies

**Self-Service (24/7):**
- Knowledge base articles
- Password reset (automated)
- System status page
- Ticket submission (portal)

**Weekend Support (Sat 9 AM - 5 PM):**
- Phone support
- Priority/urgent issues
- Remote assistance
- Email response (slower)

### What''s NOT Available After-Hours

- On-site support
- Hardware installations
- Software installations (most cases)
- Non-urgent requests
- "How-to" questions
- Training
- Low-priority issues

**These will be scheduled for next business day**

## International Offices

### Time Zone Support

**Headquarters (Central Time):**
- Primary support team
- Full services available

**East Coast Office (Eastern Time):**
- Local support: 8 AM - 6 PM ET
- After hours: Escalated to HQ

**West Coast Office (Pacific Time):**
- Local support: 8 AM - 5 PM PT
- After hours: Escalated to HQ

**European Office (CET):**
- Local support: 9 AM - 5 PM CET
- After hours: Escalated to HQ
- English language support

**Asia-Pacific Office (JST):**
- Local support: 9 AM - 6 PM JST
- English and Japanese support
- After hours: Next business day

## System Status & Outages

### Check System Status

**Status Page:** https://status.blueclue.com

**Shows:**
- Current system status (all major systems)
- Planned maintenance schedules
- Ongoing incidents
- Historical uptime data

**Notifications:**
- Subscribe to updates via email/SMS
- Get alerts for outages
- Maintenance notifications

### Reporting Outages

If system is down:
1. Check status page first
2. Verify your internet connection
3. If not listed, report via:
   - Phone: (555) 123-4567
   - Emergency: (555) 999-4357 (if critical)

## Feedback & Complaints

### Provide Feedback

After ticket resolution:
- Survey sent automatically
- 5-star rating system
- Comment box for details

**Your feedback helps us improve!**

### Escalate Complaints

Unsatisfied with support?
1. Request supervisor callback in ticket
2. Email: support-management@blueclue.com
3. Call and ask for Team Lead
4. Provide ticket number and specific concerns

**We take all complaints seriously and investigate thoroughly.**

## Tips for Faster Support

### Before Contacting Support

1. **Try rebooting** (fixes 30% of issues)
2. **Check knowledge base** for known solutions
3. **Verify internet connection**
4. **Note error messages** (screenshot if possible)
5. **Try basic troubleshooting**

### When Contacting Support

1. **Have info ready:**
   - Computer name/asset tag
   - Operating system
   - Error messages
   - What you were doing
   - What you''ve tried

2. **Be specific:**
   - "Email isn''t working"
   - "Can''t send emails, receive error: Connection timeout"

3. **Describe impact:**
   - Affects just you or multiple people?
   - Blocking work or inconvenient?
   - Deadline approaching?

4. **Provide access:**
   - Be available for callbacks
   - Allow remote access if requested
   - Test proposed solutions

## Resources

### Self-Help Resources

**Knowledge Base:** https://kb.blueclue.com
- 200+ articles
- How-to guides
- Troubleshooting steps
- Video tutorials

**Training Portal:** https://training.blueclue.com
- Video courses
- Interactive tutorials
- Certification programs

**FAQ:** https://faq.blueclue.com
- Most common questions
- Quick answers

### Quick Reference

**Download:** IT Support Quick Reference Card
- Laminated card with key phone numbers
- Available at IT office
- PDF: https://intranet.blueclue.com/it-reference

## Contact IT Support

**Standard Support (M-F 7 AM - 7 PM):**
📞 **(555) 123-4567**
📧 **support@blueclue.com**
🌐 **https://portal.blueclue.com**

**Emergency Support (24/7):**
📞 **(555) 999-HELP**
📧 **emergency@blueclue.com**

**Security (24/7):**
📞 **(555) 999-SECURITY**
📧 **security@blueclue.com**',
        'Complete information about IT support business hours, contact methods, and service availability.',
        'IT support hours and availability. Includes contact information, SLAs, holiday schedule, and response times.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 15: Common Error Codes and Fixes
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Common Error Codes and Quick Fixes',
        'common-error-codes-quick-fixes',
        'Troubleshooting',
        '["errors", "error codes", "troubleshooting", "fixes", "solutions"]'::jsonb,
        'intermediate',
        E'# Common Error Codes and Quick Fixes

## Overview
This reference guide covers the most common error codes you may encounter and their quick solutions.

## Windows Error Codes

### Error 0x80070005: Access Denied

**What it means:** You don''t have permission to access a file, folder, or registry key.

**Quick fixes:**
1. Run program as administrator:
   - Right-click program > **Run as administrator**
2. Check file permissions:
   - Right-click file > **Properties** > **Security** tab
   - Ensure your user account has permissions
3. Take ownership of file:
   - Contact IT if you need to take ownership
4. Disable antivirus temporarily to test

**Contact IT if:** Permission issues on network drives or shared folders

### Error 0x80004005: Unspecified Error

**What it means:** Generic error, often related to Windows Update, file extraction, or virtual machines.

**Quick fixes:**
1. Restart computer
2. Run Windows Update troubleshooter:
   - Settings > Update & Security > Troubleshoot
3. Clear Windows Update cache:
   - Stop Windows Update service
   - Delete C:\\Windows\\SoftwareDistribution contents
   - Restart Windows Update service
4. Check disk for errors:
   - Open Command Prompt as admin
   - Run: `chkdsk C: /f /r`
   - Restart computer

**Contact IT if:** Error persists or you''re uncomfortable running commands

### Error 0x80070057: Parameter is Incorrect

**What it means:** Usually occurs during Windows Update or backup operations.

**Quick fixes:**
1. Run Windows Update troubleshooter
2. Reset Windows Update components:
   - Submit IT ticket for assistance
3. Check disk space (need at least 10% free)
4. Run DISM tool:
   ```
   DISM /Online /Cleanup-Image /RestoreHealth
   ```

**Contact IT if:** Related to backups or updates

### 0xC000021A: Fatal System Error

**What it means:** Critical system process failed. Blue screen error.

**Quick fixes:**
1. Boot into Safe Mode
2. Run System Restore
3. Run startup repair
4. Check for disk errors

**Contact IT immediately:** This is a serious error requiring professional help

## Network Error Codes

### Error 651: Modem Reported an Error

**What it means:** Network adapter issue, usually with VPN or broadband connections.

**Quick fixes:**
1. Restart router/modem
2. Restart computer
3. Disable and re-enable network adapter:
   - Device Manager > Network adapters
   - Right-click adapter > Disable
   - Wait 10 seconds > Enable
4. Update network adapter driver
5. Recreate VPN connection

**Contact IT if:** VPN connection repeatedly fails

### DNS\_PROBE\_FINISHED\_NXDOMAIN

**What it means:** Browser can''t find the website''s DNS address.

**Quick fixes:**
1. Check internet connection
2. Try different website to verify connectivity
3. Clear browser cache and cookies
4. Flush DNS cache:
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`
5. Change DNS servers:
   - Use 8.8.8.8 and 8.8.4.4 (Google DNS)
   - Or contact IT for company DNS servers
6. Restart router

**Contact IT if:** Only company websites affected

### ERR\_CONNECTION\_TIMED\_OUT

**What it means:** Browser can''t establish connection to website.

**Quick fixes:**
1. Check internet connection
2. Disable VPN temporarily
3. Clear browser cache
4. Disable browser extensions
5. Try different browser
6. Check firewall settings
7. Reset TCP/IP:
   ```
   netsh int ip reset
   netsh winsock reset
   ```
8. Restart computer

**Contact IT if:** Occurs on company network consistently

### Error 720: No PPP Connection Available

**What it means:** VPN connection issue, usually network adapter related.

**Quick fixes:**
1. Restart computer
2. Remove and recreate VPN connection
3. Reset network settings:
   ```
   netsh winsock reset
   netsh int ip reset
   ```
4. Disable IPv6 temporarily
5. Update network adapter drivers

**Contact IT:** For assistance recreating VPN connection

## Email Error Codes

### 550: Mailbox Unavailable

**What it means:** Email address doesn''t exist or is rejecting messages.

**Quick fixes:**
1. Verify recipient email address is correct
2. Check for typos
3. Confirm recipient account is active
4. Try email address from known working source
5. Contact recipient via alternate method

**Contact IT if:** Error when emailing coworkers

### 552: Mailbox Full

**What it means:** Recipient''s mailbox has exceeded storage limit.

**Quick fixes:**
1. Contact recipient via alternate method (phone, Teams)
2. Send smaller email (remove attachments)
3. Send files via OneDrive link instead of attachment

**If your mailbox is full:**
1. Delete old emails (especially with large attachments)
2. Empty Deleted Items folder
3. Archive important emails to local folder
4. Contact IT to increase quota if needed

### 554: Transaction Failed

**What it means:** Email rejected by server, often due to spam filters or policy violations.

**Quick fixes:**
1. Remove links that might look like spam
2. Avoid spam trigger words (free, guarantee, act now)
3. Remove large attachments
4. Ensure proper email formatting
5. Check if domain is blacklisted

**Contact IT if:** Legitimate emails consistently rejected

### 0x800CCC0E: Cannot Connect to Server

**What it means:** Outlook can''t connect to mail server.

**Quick fixes:**
1. Check internet connection
2. Check if VPN is required and connected
3. Restart Outlook
4. Test connection in Outlook:
   - File > Account Settings > Test Account Settings
5. Verify server settings are correct
6. Check firewall/antivirus blocking Outlook
7. Create new Outlook profile

**Contact IT if:** Connection worked previously

### Authentication Failed (0x8004010F)

**What it means:** Email credentials are incorrect or expired.

**Quick fixes:**
1. Update saved password in Outlook
2. Remove and re-add email account
3. Reset email password
4. Verify MFA is configured correctly
5. Clear credential cache:
   - Control Panel > Credential Manager
   - Remove saved credentials for email

**Contact IT if:** Password reset doesn''t resolve issue

## Office 365 Error Codes

### Error 30015-11 (45)

**What it means:** Office installation or update failed.

**Quick fixes:**
1. Uninstall Office completely
2. Use Microsoft Support and Recovery Assistant
3. Download fresh Office installer from portal.office.com
4. Reinstall Office
5. Run as administrator during install

**Contact IT if:** Installation repeatedly fails

### Product Activation Failed

**What it means:** Office license validation failed.

**Quick fixes:**
1. Sign out and sign back into Office
2. Click "Sign in to activate"
3. Use work account (not personal Microsoft account)
4. Check internet connection
5. Verify Office 365 license assigned in admin portal

**Contact IT if:** License activation keeps failing

### Unlicensed Product

**What it means:** Office license expired or not detected.

**Quick fixes:**
1. Open any Office app
2. Click "Sign in"
3. Use company email address
4. Complete MFA if prompted
5. Office should activate automatically

**Contact IT if:** Still showing unlicensed after sign-in

## VPN Error Codes

### Error 800: Unable to Establish Connection

**What it means:** VPN client can''t reach VPN server.

**Quick fixes:**
1. Check internet connection
2. Verify VPN server address is correct
3. Check if firewall blocking VPN
4. Try different network (mobile hotspot)
5. Restart VPN client
6. Restart computer

**Contact IT if:** VPN stopped working without changes

### Error 619: Cannot Connect to Remote Computer

**What it means:** VPN connection blocked, often firewall related.

**Quick fixes:**
1. Temporary disable antivirus/firewall to test
2. Check Windows Firewall allows VPN
3. Restart VPN client as administrator
4. Verify VPN ports not blocked on router
5. Try different VPN protocol (if available)

**Contact IT:** For firewall configuration assistance

### Error 806: VPN Connection Between Computer and Server Could Not Be Established

**What it means:** GRE protocol blocked (common on public WiFi).

**Quick fixes:**
1. Try different network
2. Use mobile hotspot
3. Connect to company VPN using different protocol
4. Check router firewall settings

**Contact IT:** For alternate VPN configuration

## Application Errors

### "Application was Unable to Start Correctly (0xc000007b)"

**What it means:** Missing or corrupted .NET Framework or C++ redistributables.

**Quick fixes:**
1. Run application as administrator
2. Install latest .NET Framework
3. Install Visual C++ Redistributables (both x86 and x64)
4. Reinstall the application
5. Run Windows Update

**Contact IT if:** Need administrator rights to install frameworks

### "MSVCP140.dll is Missing"

**What it means:** Microsoft Visual C++ 2015 Redistributable missing.

**Quick fixes:**
1. Download and install Visual C++ 2015 Redistributable:
   - Both x86 (32-bit) and x64 (64-bit) versions
2. Restart computer
3. Launch application again

**Contact IT:** To install redistributables if you lack permissions

### "The Program Can''t Start Because VCRUNTIME140.dll is Missing"

**What it means:** Same as MSVCP140.dll missing.

**Quick fixes:**
1. Install Visual C++ 2015-2019 Redistributable
2. Restart computer

**Contact IT:** For installation assistance

## Blue Screen of Death (BSOD) Errors

### CRITICAL\_PROCESS\_DIED

**What it means:** Critical system process stopped working.

**Quick fixes:**
1. Restart computer
2. Run Windows Memory Diagnostic
3. Check for Windows updates
4. Update drivers (especially graphics)
5. Run System File Checker:
   ```
   sfc /scannow
   ```

**Contact IT if:** BSOD occurs repeatedly

### DRIVER\_IRQL\_NOT\_LESS\_OR\_EQUAL

**What it means:** Driver accessed memory incorrectly.

**Quick fixes:**
1. Note which driver is mentioned in error
2. Update that driver
3. If recent driver update, roll back driver
4. Run Windows Update
5. Check for BIOS update

**Contact IT immediately:** For driver and BIOS updates

### PAGE\_FAULT\_IN\_NONPAGED\_AREA

**What it means:** Hardware or driver issue, possibly RAM.

**Quick fixes:**
1. Run Windows Memory Diagnostic:
   - Search "Windows Memory Diagnostic"
   - Run test
2. Update all drivers
3. Run check disk utility
4. Test RAM with MemTest86 (advanced)

**Contact IT:** May indicate failing hardware

## File System Errors

### "The File or Directory is Corrupted and Unreadable"

**What it means:** File system corruption on drive.

**Quick fixes:**
1. Run Check Disk:
   ```
   chkdsk X: /f /r
   ```
   (Replace X: with your drive letter)
2. Restart computer to run scan
3. Use data recovery software if needed
4. Restore from backup if available

**Contact IT if:** On network drives or need data recovery

### "Access is Denied" (File/Folder)

**What it means:** Insufficient permissions to access file.

**Quick fixes:**
1. Check if file is open in another program
2. Run program as administrator
3. Check file isn''t marked read-only
4. Verify you have permissions
5. Try copying to different location

**Contact IT if:** Need permissions granted

### "The Disk is Write-Protected"

**What it means:** Drive/USB configured as read-only.

**Quick fixes:**
1. Check USB drive for physical write-protect switch
2. Check drive properties (uncheck "read-only")
3. Use Diskpart to remove write protection:
   ```
   diskpart
   list disk
   select disk # (number of USB)
   attributes disk clear readonly
   ```
4. Format drive (if no data needed)

**Contact IT if:** Company -issued encrypted USB drive

## General Troubleshooting Steps

### For ANY Error

1. **Note the exact error message**
   - Screenshot if possible
   - Copy error codes/numbers

2. **Try basic fixes:**
   - Restart the application
   - Restart computer
   - Check internet connection
   - Update software
   - Clear cache/temp files

3. **Search knowledge base:**
   - https://kb.blueclue.com
   - Search by error code
   - Check for known issues

4. **Contact IT Support:**
   - Provide error code
   - Explain what you were doing
   - List troubleshooting steps tried
   - Include screenshots

## Error Code Reference Table

| Error Code | Common Cause | Quick Fix |
|------------|--------------|-----------|
| 0x80070005 | Access denied | Run as administrator |
| 0x80004005 | Generic error | Restart, run updates |
| 0x80070057 | Bad parameter | Check disk space, run troubleshooter |
| 404 | Page not found | Check URL, clear cache |
| 500 | Server error | Wait and retry, contact IT |
| 503 | Service unavailable | Wait and retry, check status page |
| 550 | Email rejected | Verify recipient address |
| DNS error | Can''t find server | Flush DNS, check connection |
| 651 | VPN/modem error | Restart network adapter |
| 720 | VPN connection | Recreate VPN, update drivers |
| 800 | VPN can''t connect | Check firewall, verify server |
| 0xc000007b | Missing framework | Install .NET/C++ redistributables |

## When to Contact IT

**Contact IT if:**
- Error persists after basic troubleshooting
- Error prevents you from working
- Error message mentions hardware failure
- You''re uncomfortable running advanced commands
- Error affects multiple people
- Error on company systems/applications
- You need administrator rights
- Data loss is at risk

**Emergency IT:** (555) 999-HELP (555-999-4357)
**Standard IT:** (555) 123-4567
**Email:** support@blueclue.com
**Portal:** https://portal.blueclue.com

## Need More Help?

**Knowledge Base:** Search for specific error codes
**Video Tutorials:** https://training.blueclue.com
**Live Chat:** Available in portal during business hours
**Submit Ticket:** Include error code, screenshots, steps tried',
        'Quick reference guide for common error codes and their solutions across Windows, network, email, and applications.',
        'Comprehensive error code reference with quick fixes. Includes Windows, network, email, VPN, Office 365, and application errors.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    RAISE NOTICE 'Successfully seeded final 3 knowledge base articles (Articles 13-15)';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'KNOWLEDGE BASE SEEDING COMPLETE!';
    RAISE NOTICE 'Total articles created: 15';
    RAISE NOTICE 'All articles are published and publicly visible';
    RAISE NOTICE 'Categories: Account Management, Network & Connectivity, Software & Applications,';
    RAISE NOTICE '            Hardware & Devices, Security & Compliance, Support & Services, Troubleshooting';
    RAISE NOTICE '================================================================================';

END $$;
