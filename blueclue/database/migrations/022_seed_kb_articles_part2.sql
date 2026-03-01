-- ============================================================================
-- Migration 022: Seed Knowledge Base with Common Support Articles (Part 2)
-- ============================================================================
-- Description: Populates knowledge base with remaining 9 starter articles
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

    RAISE NOTICE 'Seeding knowledge base articles (Part 2) with admin user ID: %', admin_user_id;

    -- ========================================================================
    -- Article 7: How to Change Your Account Settings
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'How to Change Your Account Settings',
        'how-to-change-account-settings',
        'Account Management',
        '["account", "settings", "profile", "preferences"]'::jsonb,
        'beginner',
        E'# How to Change Your Account Settings

## Overview
Customize your BlueClue account settings to personalize your experience and manage security preferences.

## Accessing Account Settings

1. Log into **BlueClue Portal**
2. Click your **profile icon** (top right corner)
3. Select **"Account Settings"** from dropdown menu

## Profile Information

### Update Personal Details

1. Navigate to **Profile** tab
2. Update fields:
   - **Display Name**
   - **Phone Number**
   - **Department**
   - **Job Title**
   - **Office Location**
3. Click **Save Changes**

### Profile Picture

1. Click **"Upload Photo"** or current photo
2. Select image file (JPG, PNG, max 5 MB)
3. Crop and adjust as needed
4. Click **Save**

**Recommended:** Professional headshot, 400x400 pixels minimum

## Security Settings

### Change Password

1. Navigate to **Security** tab
2. Click **"Change Password"**
3. Enter:
   - **Current Password**
   - **New Password**
   - **Confirm New Password**
4. Click **Update Password**

Password must meet requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Multi-Factor Authentication

1. Navigate to **Security** tab
2. Click **"Enable MFA"** or **"Configure MFA"**
3. Follow setup wizard (see MFA Setup article)

### Security Questions

1. Navigate to **Security** tab
2. Scroll to **Security Questions**
3. Select at least 3 questions
4. Provide answers
5. Click **Save**

**Tip:** Use memorable but not easily guessable answers

### Active Sessions

View and manage active login sessions:
1. Navigate to **Security** tab
2. Scroll to **Active Sessions**
3. Review list of devices/locations
4. Click **"Revoke"** on any suspicious sessions

## Notification Preferences

### Email Notifications

1. Navigate to **Notifications** tab
2. Configure email preferences:
   - ☑ Ticket updates
   - ☑ Assignment notifications
   - ☑ System announcements
   - ☑ Security alerts
   - ☐ Weekly digest
   - ☐ Marketing emails
3. Click **Save Preferences**

### In-App Notifications

1. Toggle notifications:
   - **Desktop notifications**: Enable/disable
   - **Sound alerts**: Enable/disable
   - **Badge counters**: Enable/disable
2. Set **Do Not Disturb** hours if desired
3. Click **Save**

### SMS/Text Notifications (Optional)

1. Navigate to **Notifications** tab
2. Click **"Add Phone Number"**
3. Enter mobile number
4. Enter verification code sent via SMS
5. Select notification triggers:
   - High-priority tickets only
   - All ticket updates
   - Security alerts
6. Click **Save**

## Display Preferences

### Theme Selection

1. Navigate to **Appearance** tab
2. Select theme:
   - **Dark Mode** (default)
   - **Light Mode**
   - **Auto** (system preference)
3. Changes apply immediately

### Dashboard Layout

1. Navigate to **Dashboard** tab
2. Drag and drop widgets to rearrange
3. Click **"Add Widget"** to add new widgets
4. Click **"Remove"** (X) on widgets to remove
5. Click **"Save Layout"**

### Time Zone

1. Navigate to **Preferences** tab
2. Select your time zone from dropdown
3. Toggle **"Auto-detect time zone"** if desired
4. Click **Save**

### Language Preferences

1. Navigate to **Preferences** tab
2. Select preferred language:
   - English (US)
   - English (UK)
   - Spanish
   - French
   - German
3. Click **Save**

**Note:** Not all content may be translated

## Privacy Settings

### Profile Visibility

1. Navigate to **Privacy** tab
2. Configure who can see your:
   - Profile picture
   - Phone number
   - Department
   - Office location
3. Options: **Everyone**, **Company Only**, **Team Only**, **Only Me**
4. Click **Save**

### Data Sharing

1. Navigate to **Privacy** tab
2. Review data sharing options:
   - ☑ Usage analytics
   - ☐ Product improvement
   - ☐ Third-party integrations
3. Click **Save Preferences**

## Integration Settings

### Connected Apps

Manage third-party app connections:
1. Navigate to **Integrations** tab
2. View connected applications
3. Click **"Authorize"** to add new apps
4. Click **"Revoke Access"** to disconnect apps

Common integrations:
- Slack
- Microsoft Teams
- Google Calendar
- Zoom

### API Access (Developers Only)

1. Navigate to **Developer** tab
2. Click **"Generate API Key"**
3. Copy and save key securely
4. Use key for API authentication

**Warning:** Never share your API key

## Accessibility Options

### Screen Reader Support

1. Navigate to **Accessibility** tab
2. Enable **Screen Reader Optimization**
3. Adjust verbosity level
4. Click **Save**

### Keyboard Navigation

1. Enable **Keyboard Shortcuts**
2. Click **"View Shortcut Reference"**
3. Customize shortcuts if desired

### Visual Adjustments

- **Text Size**: Small, Medium, Large, Extra Large
- **High Contrast Mode**: Enable for better visibility
- **Reduce Motion**: Minimize animations
- **Color Blind Mode**: Deuteranopia, Protanopia, Tritanopia

## Downloading Your Data

Request a copy of your account data:
1. Navigate to **Privacy** tab
2. Click **"Download My Data"**
3. Select data types to include
4. Click **Request Download**
5. Receive download link via email within 24 hours

## Deleting Your Account

**Warning:** Account deletion is permanent and cannot be undone.

1. Navigate to **Account** tab
2. Scroll to **Danger Zone**
3. Click **"Delete Account"**
4. Enter your password to confirm
5. Enter confirmation code sent to your email
6. Click **"Permanently Delete Account"**

**Note:** Contact IT if you cannot delete your account

## Troubleshooting

### Changes not saving

- Check for error messages
- Ensure all required fields are filled
- Check internet connection
- Clear browser cache
- Try different browser
- Contact IT support

### Cannot access settings

- Verify you''re logged in
- Check account permissions
- Try logging out and back in
- Clear cookies and cache
- Contact IT if problem persists

### Reset to defaults

1. Navigate to **Account** tab
2. Click **"Reset All Settings"**
3. Confirm action
4. Settings will revert to system defaults

## Mobile App Settings

Settings are synchronized across:
- Web portal
- Desktop application
- Mobile apps (iOS/Android)

Some settings are device-specific:
- Notification sounds
- Offline mode
- Cache settings

## Need Help?

Contact IT support if you:
- Cannot access account settings
- Need to change restricted settings
- Encounter errors when saving
- Have questions about privacy settings
- Need help with integrations',
        'Customize your BlueClue account settings including profile, security, notifications, and preferences.',
        'Complete guide to managing your BlueClue account settings. Includes profile, security, notifications, and privacy options.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 8: Reporting a Security Issue
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'How to Report a Security Issue',
        'how-to-report-security-issue',
        'Security & Compliance',
        '["security", "incident", "phishing", "malware", "breach"]'::jsonb,
        'beginner',
        E'# How to Report a Security Issue

## Overview
**Security is everyone''s responsibility.** Report any suspicious activity, security incidents, or concerns immediately.

## Types of Security Issues

### Phishing & Social Engineering
- Suspicious emails requesting credentials
- Unexpected email attachments
- Urgent requests for sensitive information
- Impersonation attempts
- Fake websites mimicking company sites

### Malware & Viruses
- Antivirus alerts
- Unusual system behavior
- Unexpected pop-ups
- Slow performance after opening files
- Files encrypted or inaccessible

### Lost or Stolen Devices
- Lost laptop, phone, or tablet
- Stolen equipment
- Misplaced access cards/tokens
- USB drives with company data

### Unauthorized Access
- Unknown logins to your account
- Suspicious activity in your account
- Compromised credentials
- Unauthorized persons in secure areas

### Data Breaches
- Accidental data exposure
- Unauthorized data access
- Data sent to wrong recipient
- Public disclosure of sensitive info

### Physical Security
- Unlocked doors in secure areas
- Unattended visitor without badge
- Tailgating into secure areas
- Found access badges or keys

## Immediate Actions

### For Urgent Security Incidents

**CALL IT SECURITY IMMEDIATELY**
- **Phone**: (555) 999-SECURITY (555-999-7328)
- **Available**: 24/7/365

### For Suspected Phishing

**DO NOT:**
- ❌ Click any links in the email
- ❌ Download attachments
- ❌ Reply to the sender
- ❌ Enter credentials anywhere
- ❌ Forward to other employees

**DO:**
1. ✅ Mark as phishing in email client
2. ✅ Forward to: security@blueclue.com
3. ✅ Delete the email
4. ✅ Report via security portal

### For Malware Detection

**DO NOT:**
- ❌ Ignore antivirus warnings
- ❌ Disable antivirus
- ❌ Continue using the device
- ❌ Connect USB drives to other devices

**DO:**
1. ✅ Disconnect from network (WiFi/Ethernet)
2. ✅ Call IT Security immediately
3. ✅ DO NOT turn off the computer
4. ✅ Note any error messages
5. ✅ Isolate the device

### For Lost/Stolen Devices

**Within 30 minutes of discovery:**
1. ✅ Call IT Security: (555) 999-7328
2. ✅ Report device details (make, model, serial)
3. ✅ Provide last known location
4. ✅ List sensitive data on device
5. ✅ IT will remotely wipe device if necessary

## Reporting Methods

### Method 1: Security Hotline (Urgent)
**Phone**: (555) 999-SECURITY (555-999-7328)
- Available 24/7
- For immediate threats
- English and Spanish support

### Method 2: BlueClue Security Portal
1. Navigate to: **https://security.blueclue.com**
2. Click **"Report Incident"**
3. Select incident type
4. Complete incident form
5. Submit immediately

### Method 3: Email
**Email**: security@blueclue.com
- Include "SECURITY INCIDENT" in subject
- Attach screenshots if relevant
- DO NOT include sensitive passwords

### Method 4: Support Ticket (Non-Urgent)
1. Log into **BlueClue Portal**
2. Create new ticket
3. Category: **Security & Compliance**
4. Priority: **High** (or Critical if urgent)
5. Describe the issue in detail

## What to Include in Your Report

### Essential Information
- **Your contact info**: Name, email, phone
- **Date & time**: When did you discover the issue?
- **Type of incident**: Phishing, malware, lost device, etc.
- **Description**: What happened? Be specific.
- **Impact**: What data/systems are affected?
- **Actions taken**: What have you done so far?

### Supporting Evidence
- Screenshots (DO NOT include passwords)
- Email headers (for phishing)
- Error messages
- Log files
- Names of other affected users

### For Phishing Reports
- Sender email address
- Email subject line
- Date/time received
- Links in email (DO NOT click them)
- Screenshot of full email

### For Lost/Stolen Devices
- Device type (laptop, phone, tablet)
- Make and model
- Serial number (if known)
- Last known location
- Date/time of loss
- Sensitive data on device
- Whether device is encrypted

## After Reporting

### What Happens Next?

1. **Immediate acknowledgment** (within 15 minutes for urgent)
2. **Incident number assigned** for tracking
3. **Security team investigates**
4. **Containment actions** taken if needed
5. **Regular updates** on investigation
6. **Final report** with findings and actions

### You May Be Asked To:
- Provide additional information
- Preserve evidence (don''t delete emails, files)
- Change your password
- Monitor account activity
- Attend security debriefing

### Confidentiality
All security reports are handled confidentially. Your report helps protect:
- Your colleagues
- Company data
- Client information
- Business operations

## Common Phishing Indicators

### Red Flags in Emails
- ⚠️ Urgent or threatening language
- ⚠️ Requests for passwords or credentials
- ⚠️ Unexpected attachments
- ⚠️ Spelling and grammar errors
- ⚠️ Generic greetings ("Dear User")
- ⚠️ Mismatched sender addresses
- ⚠️ Suspicious links (hover to preview)
- ⚠️ Requests to verify account information
- ⚠️ Too good to be true offers

### How to Verify Legitimacy
1. Check sender email carefully (not just display name)
2. Hover over links without clicking
3. Contact sender via known contact method
4. Look for company security indicators
5. When in doubt, report it

## Password Security

### If You Suspect Compromise
**Change immediately** if:
- You entered credentials on suspicious site
- You received "unusual login" notifications
- Your account shows strange activity
- You used same password on breached site

### How to Change Password
1. Go to **Account Settings** > **Security**
2. Click **"Change Password"**
3. Use a strong, unique password
4. Enable MFA if not already active

## Physical Security Concerns

### Reporting Physical Threats
- Unescorted visitors in secure areas
- Propped open security doors
- Found access badges/keys
- Suspicious individuals
- Physical tampering with equipment

**Report to:**
- Building Security: (555) 999-GUARD
- IT Security: (555) 999-7328

## Data Breach Response

### If You Accidentally Exposed Data
**Report immediately if you:**
- Emailed data to wrong recipient
- Posted sensitive info publicly
- Lost device with company data
- Shared credentials accidentally
- Uploaded data to personal cloud

### Do Not:
- ❌ Try to "fix it" yourself
- ❌ Hide the incident
- ❌ Wait to see if anyone notices
- ❌ Delete evidence

### Do:
- ✅ Report immediately
- ✅ Preserve all evidence
- ✅ Provide complete details
- ✅ Document what was exposed

## Recognition, Not Retaliation

**You will NOT be punished for:**
- Reporting security concerns
- Making honest mistakes
- Asking security questions
- Falling for a phishing attempt (if reported)

**We encourage:**
- Early reporting (better than late)
- Asking questions about suspicious items
- Reporting "false alarms" (better safe than sorry)
- Learning from incidents

## Security Awareness Resources

### Training & Education
- Annual security awareness training (mandatory)
- Monthly security newsletter
- Simulated phishing exercises
- Security awareness videos
- Lunch & learn sessions

### Stay Informed
- Security portal: https://security.blueclue.com
- Security bulletin board (break rooms)
- IT Security email updates
- Incident alerts (when relevant)

## Need Help?

### Urgent Security Issues (24/7)
**Phone**: (555) 999-SECURITY (555-999-7328)

### General Security Questions
- **Email**: security@blueclue.com
- **Security Portal**: https://security.blueclue.com
- **Submit Ticket**: Category "Security & Compliance"

### Additional Resources
- Security Policies: https://intranet.blueclue.com/security
- IT Security Team: security-team@blueclue.com
- Physical Security: (555) 999-GUARD

## Remember
**When in doubt, report it.** False alarms are better than missed incidents. Your vigilance helps protect everyone.',
        'Learn how to identify and report security incidents including phishing, malware, and data breaches.',
        'Complete guide to reporting security issues. Includes phishing detection, incident response, and emergency contacts.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 9: Hardware Request Process
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Hardware Request Process',
        'hardware-request-process',
        'Hardware & Devices',
        '["hardware", "equipment", "request", "laptop", "monitor"]'::jsonb,
        'beginner',
        E'# Hardware Request Process

## Overview
This guide covers how to request new hardware, replacements, upgrades, and accessories.

## Types of Hardware Requests

### New Equipment
- Laptop or desktop computer
- Monitor (additional or replacement)
- Keyboard and mouse
- Docking station
- Webcam and headset

### Replacements
- Broken or malfunctioning equipment
- End-of-life devices
- Damaged accessories
- Lost or stolen items

### Upgrades
- RAM expansion
- Storage upgrade (SSD)
- Better monitor
- Improved peripherals

### Accessories
- Laptop bag
- External hard drive
- USB hub
- Monitor stand
- Cable management

## Standard Equipment by Role

### All Employees
- Laptop (specification based on role)
- Monitor (if working in office)
- Keyboard and mouse
- Headset for calls

### Developers
- High-performance laptop
- Dual monitors (24" or larger)
- Ergonomic keyboard
- External SSD for backups

### Designers
- High-end laptop with dedicated GPU
- 27" 4K monitor (or dual monitors)
- Graphics tablet (if approved)
- Color-calibrated display

### Standard Office Workers
- Standard business laptop
- Single 24" monitor
- Standard keyboard/mouse
- Basic headset

## How to Submit a Request

### Step 1: Create Support Ticket

1. Log into **BlueClue Portal**
2. Click **"Submit New Ticket"**
3. Category: **Hardware & Devices**
4. Type: **Hardware Request**

### Step 2: Provide Required Information

#### For New Equipment
- **Item requested**: Specific model/type
- **Business justification**: Why you need it
- **Urgency**: When do you need it?
- **Budget approval**: Department/cost center
- **Delivery location**: Office address or home

#### For Replacements
- **Current equipment**: Make, model, serial number
- **Issue description**: What''s wrong with it?
- **Troubleshooting attempted**: What have you tried?
- **Impact on work**: How critical is it?
- **Asset tag number**: (if applicable)

#### For Upgrades
- **Current specifications**: Current RAM, storage, etc.
- **Requested upgrade**: What do you want upgraded?
- **Performance issues**: Why is upgrade needed?
- **Business justification**: How will it improve productivity?

### Step 3: Manager Approval

- Requests over $500 require manager approval
- Manager receives automatic notification
- Approval typically within 1-2 business days
- Budget availability is verified

### Step 4: IT Review

- IT evaluates technical requirements
- Checks for compatible alternatives
- Verifies stock availability
- May suggest cost-effective options

### Step 5: Procurement

If approved:
- Standard items: Ships within 3-5 business days
- Custom orders: 2-4 weeks
- Urgent requests: Expedited shipping available

## Approval Criteria

### Requests Typically Approved
- ✅ Broken/malfunctioning equipment
- ✅ End-of-life replacements (>4 years old)
- ✅ New hire equipment packages
- ✅ Role-specific requirements
- ✅ Ergonomic needs (with medical justification)
- ✅ Security upgrades

### Requests That May Be Denied
- ❌ Wants vs. needs (luxury items)
- ❌ Duplicate equipment without justification
- ❌ Excessive budget requests
- ❌ Non-standard equipment that can''t be supported
- ❌ Personal use items
- ❌ Equipment bought without approval

## Hardware Standards

### Approved Laptop Models

#### Standard Business
- **Dell Latitude 5440**
- **Lenovo ThinkPad T14**
- **HP EliteBook 840**

#### High Performance (Developers/Designers)
- **Dell Precision 5680**
- **Lenovo ThinkPad P1**
- **Apple MacBook Pro 16"** (Mac users only)

#### Executive
- **Dell XPS 13 Plus**
- **Lenovo ThinkPad X1 Carbon**
- **Apple MacBook Air M2**

### Monitor Standards
- **Standard**: Dell P2422H (24" 1080p)
- **Premium**: Dell P2723DE (27" 1440p)
- **Designer**: Dell UltraSharp U2723DE (27" 4K)

### Accessories
- **Keyboard**: Logitech K780 or equivalent
- **Mouse**: Logitech M720 or equivalent
- **Headset**: Jabra Evolve 40 or equivalent
- **Webcam**: Logitech C920 or equivalent
- **Docking Station**: Dell WD19TB or brand-specific

## Pricing and Budgets

### Typical Costs
- **Standard Laptop**: $800 - $1,200
- **High-Performance Laptop**: $1,500 - $2,500
- **Monitor (24")**: $200 - $300
- **Monitor (27" 4K)**: $400 - $600
- **Docking Station**: $150 - $250
- **Keyboard/Mouse Set**: $50 - $100
- **Headset**: $50 - $150

### Budget Approval Levels
- **Under $500**: IT approval only
- **$500 - $2,000**: Manager approval required
- **Over $2,000**: Director approval required
- **Over $5,000**: VP approval required

## Delivery and Setup

### Delivery Options

#### Office Delivery
- Standard delivery time: 3-5 business days
- Delivered to IT department
- You''ll receive email notification
- Pick up from IT office during business hours

#### Home Delivery (Remote Workers)
- Ships to home address via FedEx/UPS
- Tracking number provided
- Signature required
- 5-7 business days standard shipping
- Expedited shipping available for urgent needs

### Setup Assistance

**Included Setup Services:**
- Operating system installation
- Standard software deployment
- Security configuration
- Domain joining
- Email setup
- VPN configuration

**Scheduled Setup:**
1. IT will contact you to schedule
2. In-person or remote setup available
3. Allow 1-2 hours for complete setup
4. Training on new equipment if needed

## Return and Trade-In

### Returning Old Equipment

When receiving replacement:
1. **Back up your data** (IT can assist)
2. **Return old equipment within 5 business days**
3. **Use provided shipping label** (if remote)
4. **Bring to IT office** (if in office)

**Failure to return equipment:**
- Reminder notifications sent
- Manager notification after 10 days
- Potential deduction from final paycheck

### Equipment Trade-In
- Working equipment may have trade-in value
- Trade-in credit applied to department budget
- IT will evaluate condition and value

## Emergency Equipment

### Loaner Equipment

Temporary equipment available for:
- Broken primary device (while awaiting repair/replacement)
- Short-term projects requiring specialized hardware
- New hires (while permanent equipment ships)

**Loaner Policies:**
- Maximum loan period: 30 days
- Must sign loaner agreement
- Responsible for damage/loss
- Return within 1 business day of receiving replacement

### Same-Day Equipment (Urgent)

Available for critical situations:
- Business-critical system failure
- Executive urgent need
- Time-sensitive project deadline

**Requirements:**
- Director-level approval
- Clear business justification
- Limited to in-stock items
- May not be ideal configuration

## Troubleshooting Common Issues

### Request stuck in approval
- Check with your manager
- Verify budget availability
- Contact IT to check status
- Escalate if urgent

### Denied request
- Review denial reason in ticket
- Discuss alternatives with IT
- Provide additional justification
- Consider lower-cost alternatives

### Delayed delivery
- Check tracking number
- Contact shipping carrier
- Notify IT of delays
- Request loaner if critical

## Maintenance and Warranties

### Standard Warranty
- **Laptops**: 3-year manufacturer warranty
- **Monitors**: 3-year warranty
- **Accessories**: 1-year warranty

### Extended Warranty
- Available for purchase
- Accidental damage protection
- On-site next-business-day service
- Recommended for executive equipment

### Equipment Refresh Cycle
- **Laptops**: Replace every 4 years
- **Desktops**: Replace every 5 years
- **Monitors**: Replace every 6 years
- **Peripherals**: Replace as needed

## Bring Your Own Device (BYOD)

### BYOD Policy

**Approved for:**
- Personal smartphones/tablets
- Personal laptops (limited access)
- Smartwatches

**Requirements:**
- Must meet security standards
- MDM enrollment required
- Company reserves right to wipe
- No access to sensitive systems

**Not eligible for:**
- IT support for personal devices
- Reimbursement for personal equipment
- Company-provided accessories

## Asset Management

### Asset Tags
- All company equipment has asset tags
- Never remove asset tags
- Report missing/damaged tags to IT
- Required for warranty service

### Equipment Inventory
- Annual inventory audits
- Must report all company equipment
- Failure to report may result in charges
- Remote workers receive email survey

## Returning Equipment (Separation)

### When Leaving Company

**Required within 5 business days:**
- Return all company equipment
- Laptop, monitors, accessories
- Access badges and keys
- Company phone (if applicable)

**Shipping:**
- Pre-paid shipping label provided
- Pack securely
- Obtain tracking number
- Confirm delivery

**Failure to return:**
- Final paycheck may be withheld
- Replacement cost deducted
- Legal action for unreturned equipment

## Need Help?

### Hardware Questions
- **Submit ticket**: Category "Hardware & Devices"
- **Call IT**: (555) 123-4567
- **Email IT**: support@blueclue.com

### Urgent Hardware Issues
- **IT Hotline**: (555) 999-4357
- **Available**: Monday-Friday, 8 AM - 6 PM

### Request Status
- Check ticket status in portal
- Request updates via ticket comments
- Call IT for urgent status checks',
        'Complete guide to requesting new hardware, replacements, and upgrades through IT.',
        'Hardware request process including laptops, monitors, accessories. Includes approval workflow and timelines.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    RAISE NOTICE 'Successfully seeded 3 knowledge base articles (Articles 7-9)';

END $$;
