-- ============================================================================
-- Migration 021: Seed Knowledge Base with Common Support Articles
-- ============================================================================
-- Description: Populates knowledge base with 15 starter articles covering
--              common IT support topics
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

    RAISE NOTICE 'Seeding knowledge base articles with admin user ID: %', admin_user_id;

    -- ========================================================================
    -- Article 1: How to Reset Your Password
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'How to Reset Your Password',
        'how-to-reset-your-password',
        'Account Management',
        '["password", "security", "login", "account"]'::jsonb,
        'beginner',
        E'# How to Reset Your Password

## Overview
If you''ve forgotten your password or need to reset it for security reasons, follow this step-by-step guide.

## Self-Service Password Reset

### Step 1: Navigate to Login Page
1. Go to the BlueClue login page
2. Click on **"Forgot Password?"** link below the login button

### Step 2: Enter Your Email
1. Enter your registered email address
2. Click **"Send Reset Link"**
3. Check your email inbox (and spam folder)

### Step 3: Reset Your Password
1. Click the reset link in the email (valid for 1 hour)
2. Enter your new password
3. Confirm your new password
4. Click **"Reset Password"**

## Password Requirements
Your new password must meet these criteria:
- At least 8 characters long
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character (!@#$%^&*)

## Troubleshooting

### Didn''t receive the email?
- Check your spam/junk folder
- Verify you entered the correct email address
- Wait 5 minutes and try again
- Contact IT support if issues persist

### Reset link expired?
- Password reset links expire after 1 hour
- Request a new reset link
- Complete the reset process promptly

## Need Help?
If you cannot reset your password using the self-service method, please:
- Submit a ticket through the customer portal
- Call the IT help desk during business hours
- Include your username and registered email address

## Security Tips
- Never share your password with anyone
- Use a unique password for your BlueClue account
- Consider using a password manager
- Change your password every 90 days
- Enable multi-factor authentication for additional security',
        'Learn how to reset your password using the self-service portal or get help from IT support.',
        'Step-by-step guide to reset your BlueClue account password. Includes troubleshooting tips and security best practices.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 2: How to Connect to WiFi
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'How to Connect to WiFi',
        'how-to-connect-to-wifi',
        'Network & Connectivity',
        '["wifi", "wireless", "network", "connectivity"]'::jsonb,
        'beginner',
        E'# How to Connect to WiFi

## Available WiFi Networks

### Corporate Network: BlueClue-Secure
- **SSID**: BlueClue-Secure
- **Security**: WPA2-Enterprise
- **Authentication**: Use your BlueClue credentials
- **Recommended for**: Employees and secure work tasks

### Guest Network: BlueClue-Guest
- **SSID**: BlueClue-Guest
- **Security**: Password-protected
- **Password**: Available from IT or front desk
- **Recommended for**: Visitors and personal devices

## Windows 10/11 Connection Instructions

1. Click the **WiFi icon** in the system tray (bottom right)
2. Select **BlueClue-Secure** from the network list
3. Click **Connect**
4. Enter your credentials:
   - **Username**: your.email@company.com
   - **Password**: Your BlueClue account password
5. Click **OK**

## macOS Connection Instructions

1. Click the **WiFi icon** in the menu bar (top right)
2. Select **BlueClue-Secure** from the list
3. Enter your credentials:
   - **Username**: your.email@company.com
   - **Password**: Your BlueClue account password
4. Click **Join**

## iOS/Android Connection Instructions

1. Open **Settings** > **WiFi**
2. Select **BlueClue-Secure**
3. Enter your credentials
4. Tap **Join** or **Connect**
5. Trust the network certificate if prompted

## Troubleshooting

### Cannot see BlueClue-Secure network?
- Ensure WiFi is enabled on your device
- Move closer to a wireless access point
- Restart your device
- Contact IT if the network is still not visible

### Authentication failed?
- Verify you''re using the correct credentials
- Ensure Caps Lock is off
- Try resetting your password
- Contact IT support for account verification

### Connected but no internet?
- Disconnect and reconnect to the network
- Forget the network and reconnect
- Restart your device
- Run network troubleshooter (Windows)
- Contact IT support

## WiFi Coverage Areas
WiFi is available in:
- All office floors and conference rooms
- Break rooms and common areas
- Parking garage (levels 1-3)
- Outdoor courtyard

Limited or no coverage:
- Basement storage areas
- Some elevator shafts
- Remote parking lots

## Need Help?
Submit a ticket or contact IT support with:
- Your device type (Windows, Mac, phone, etc.)
- The error message you''re receiving
- Your current location in the building',
        'Instructions for connecting to corporate WiFi on Windows, Mac, and mobile devices.',
        'Complete guide to connecting to BlueClue WiFi networks. Includes troubleshooting for common connection issues.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 3: How to Request Software Installation
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'How to Request Software Installation',
        'how-to-request-software-installation',
        'Software & Applications',
        '["software", "installation", "applications", "requests"]'::jsonb,
        'beginner',
        E'# How to Request Software Installation

## Overview
All software installations must be requested through IT to ensure security, licensing compliance, and compatibility.

## Before You Request

### Check If Already Installed
Many applications are already available:
- Check **Start Menu** > **All Apps** (Windows)
- Check **Applications** folder (Mac)
- Contact IT to verify software availability

### Approved Software List
Common pre-approved software:
- Microsoft Office 365 Suite
- Google Chrome, Mozilla Firefox
- Adobe Acrobat Reader
- Zoom, Microsoft Teams
- Slack
- Visual Studio Code
- Git
- FileZilla
- Notepad++

## How to Submit a Request

### Step 1: Create a Ticket
1. Log into the **BlueClue Customer Portal**
2. Click **"Submit New Ticket"**
3. Select category: **Software & Applications**
4. Set priority based on urgency

### Step 2: Provide Required Information
Include in your ticket:
- **Software name** and version number
- **Purpose/business justification** for the software
- **Alternative software** you''ve considered
- **Number of licenses** needed
- **Installation deadline** (if applicable)
- **Department/cost center** for licensing costs

### Step 3: Wait for Approval
- IT will review your request within **1-2 business days**
- Manager approval may be required
- Licensing cost approval may be needed
- Security review for new software

### Step 4: Schedule Installation
Once approved:
- IT will contact you to schedule installation
- Installation typically takes **30-60 minutes**
- You may need to be present or provide device access
- Restart may be required

## Installation Timeline

| Priority | Review Time | Installation Time |
|----------|-------------|-------------------|
| High | 4-8 hours | Same day if approved |
| Medium | 1-2 days | 2-3 days after approval |
| Low | 3-5 days | Within 1 week of approval |

## Software Licensing

### Licensed Software
- Costs vary by application
- May require department budget approval
- Annual renewal costs apply
- License compliance is mandatory

### Free/Open Source Software
- Faster approval process
- Security review still required
- Must comply with company policies

## Common Approval Criteria
Software must be:
- ✅ Necessary for job duties
- ✅ Compatible with company systems
- ✅ Secure and regularly updated
- ✅ Properly licensed
- ✅ Approved by IT security

Software may be denied if:
- ❌ Free alternatives exist
- ❌ Security risks identified
- ❌ Incompatible with company systems
- ❌ Excessive licensing costs
- ❌ Not business-related

## Self-Service Options

### Software Center (Windows)
Some software can be installed via Software Center:
1. Open **Software Center** from Start Menu
2. Browse **Applications** tab
3. Click **Install** on approved software
4. Wait for automatic installation

### Self-Service Portal (Mac)
1. Open **Self Service** application
2. Browse available software
3. Click **Install** on approved items

## Troubleshooting

### Request denied?
- Review the denial reason in ticket response
- Discuss business need with your manager
- Explore approved alternatives
- Escalate if critical for job duties

### Installation failed?
- Check ticket for IT notes
- Ensure adequate disk space
- Close other applications
- Restart and retry
- Contact IT if issues persist

## Need Help?
Contact IT support if you need:
- Help identifying the right software
- Clarification on approval process
- Installation assistance
- Training on new software',
        'Learn how to request new software installations through IT support.',
        'Complete guide to requesting software installation. Includes approval process, timelines, and self-service options.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 4: Printer Troubleshooting Guide
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Printer Troubleshooting Guide',
        'printer-troubleshooting-guide',
        'Hardware & Devices',
        '["printer", "printing", "troubleshooting", "hardware"]'::jsonb,
        'intermediate',
        E'# Printer Troubleshooting Guide

## Quick Fixes (Try These First)

1. **Check printer display** for error messages
2. **Verify printer is online** and not paused
3. **Check paper** - ensure tray has paper and no jams
4. **Check toner/ink levels**
5. **Restart print job** - cancel and resend
6. **Restart printer** - power off, wait 30 seconds, power on

## Common Issues and Solutions

### Printer Not Found / Offline

#### Windows
1. Open **Settings** > **Devices** > **Printers & scanners**
2. Find your printer and click **Manage**
3. Click **"Use printer online"** if available
4. If still offline, remove and re-add the printer

#### macOS
1. Open **System Preferences** > **Printers & Scanners**
2. Select your printer
3. Click **Open Print Queue**
4. Click **Resume** if paused

### Paper Jams

1. **Turn off** the printer
2. **Open all access doors** and trays
3. **Gently pull** jammed paper in the direction of paper path
4. **Check all areas**: input tray, output tray, duplex unit
5. **Remove torn pieces** carefully
6. **Close all doors** and turn printer back on

**Prevention Tips:**
- Use appropriate paper weight (20-24 lb)
- Don''t overfill paper trays
- Fan paper before loading
- Store paper in dry environment

### Print Quality Issues

#### Faded Prints
- Check toner/ink levels
- Run printer cleaning cycle
- Replace toner cartridge
- Check print settings (not in draft mode)

#### Streaks or Lines
- Run cleaning cycle
- Check for debris on drum or rollers
- Replace toner cartridge
- Contact IT for professional cleaning

#### Smudged Prints
- Allow toner to dry properly
- Check fuser unit (may need replacement)
- Use correct paper type
- Submit IT ticket for service

### Print Job Stuck in Queue

#### Windows
1. Open **Settings** > **Devices** > **Printers & scanners**
2. Select printer > **Open queue**
3. Click **Printer** menu > **Cancel All Documents**
4. If stuck, restart **Print Spooler** service:
   - Open **Services** (services.msc)
   - Find **Print Spooler**
   - Right-click > **Restart**

#### macOS
1. Open **System Preferences** > **Printers & Scanners**
2. Select printer > **Open Print Queue**
3. Select stuck jobs and click **Delete** (X)
4. If stuck, reset printer:
   - Click **Reset Printing System**
   - Re-add printer

### Wrong Printer Selected
1. Open your document
2. **File** > **Print**
3. Select correct printer from dropdown
4. Set as **default** to prevent future issues

## Company Printer Locations

### Floor 1
- **Printer-1A**: Main lobby (B&W + Color)
- **Printer-1B**: Conference room 101 (Color only)

### Floor 2  
- **Printer-2A**: East wing (B&W + Color)
- **Printer-2B**: West wing (B&W only)
- **Printer-2C**: Break room (B&W only)

### Floor 3
- **Printer-3A**: IT Department (B&W + Color)
- **Printer-3B**: Executive area (Color only)

## Printing Best Practices

- **Print preview** before sending large jobs
- **Duplex printing** (double-sided) when possible
- **Black & white** for internal documents
- **Pickup promptly** to prevent loss
- **Secure printing** for confidential documents

## Secure/Confidential Printing

For sensitive documents:
1. Select **"Secure Print"** or **"Hold for Release"**
2. Enter a PIN code
3. Walk to printer
4. Enter PIN on printer display
5. Select your job to print
6. Document prints immediately

## Toner/Ink Replacement

**Do not replace cartridges yourself**
- Low toner warning: Submit ticket when below 20%
- Empty cartridge: Contact IT immediately
- IT will replace cartridges within 4 hours

## Error Code Reference

| Code | Meaning | Solution |
|------|---------|----------|
| E1 | Paper jam | Clear jam as described above |
| E2 | Low toner | Replace cartridge |
| E3 | Door open | Close all covers/doors |
| E4 | Paper tray empty | Add paper |
| E5 | Service required | Contact IT immediately |

## When to Contact IT

Submit a ticket if:
- ❌ Printer completely unresponsive
- ❌ Repeated paper jams
- ❌ Print quality doesn''t improve after troubleshooting
- ❌ Error codes you don''t recognize
- ❌ Unusual noises or smells
- ❌ Need toner/ink replacement
- ❌ Need to add new printer

**For immediate assistance**, call IT help desk during business hours.

## Remote Printing
Print from home/remote:
1. Email document to: print@blueclue.com
2. In subject line: Printer name (e.g., "Printer-2A")
3. Document will print within 15 minutes
4. Pickup next business day',
        'Comprehensive troubleshooting guide for common printer issues and solutions.',
        'Fix common printer problems including paper jams, offline printers, print quality issues, and stuck print queues.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 5: VPN Connection Setup
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'VPN Connection Setup',
        'vpn-connection-setup',
        'Network & Connectivity',
        '["vpn", "remote access", "security", "network"]'::jsonb,
        'intermediate',
        E'# VPN Connection Setup

## Overview
The Virtual Private Network (VPN) allows secure remote access to company resources from any location.

## Who Needs VPN?
Use VPN when:
- ✅ Working from home or remote location
- ✅ Accessing internal company resources
- ✅ Using public WiFi networks
- ✅ Connecting from unsecured networks

## Before You Start

### Prerequisites
- Active BlueClue account
- VPN access approval from your manager
- Stable internet connection
- VPN software installed (or follow installation steps below)

### VPN Software: Cisco AnyConnect
We use **Cisco AnyConnect** for all VPN connections.

## Installation Instructions

### Windows Installation

1. Download installer:
   - Open ticket to request VPN access
   - IT will provide download link
   - Or download from: \\\\fileserver\\software\\vpn

2. Run **AnyConnect-Windows.exe**
3. Follow installation wizard
4. Restart computer when prompted

### macOS Installation

1. Download installer from IT
2. Open **AnyConnect-macOS.dmg**
3. Run installer package
4. Enter admin password when prompted
5. Restart computer

### Mobile (iOS/Android)

1. Download **Cisco AnyConnect** from App Store/Google Play
2. Install application
3. Open app when installation completes

## Connecting to VPN

### Windows/Mac

1. Open **Cisco AnyConnect**
2. Enter VPN address: **vpn.blueclue.com**
3. Click **Connect**
4. Enter credentials:
   - **Username**: your.email@company.com
   - **Password**: Your BlueClue password
5. Enter **MFA code** from authenticator app
6. Click **OK**
7. Wait for "Connected" status

### Mobile

1. Open **Cisco AnyConnect** app
2. Tap **Add Connection**
3. Enter:
   - **Description**: BlueClue VPN
   - **Server Address**: vpn.blueclue.com
4. Tap **Done**
5. Tap **BlueClue VPN** to connect
6. Enter credentials and MFA code
7. Tap **Connect**

## Disconnecting from VPN

### Windows/Mac
1. Open **Cisco AnyConnect**
2. Click **Disconnect**

### Mobile
1. Open **Cisco AnyConnect**
2. Tap **Disconnect**

**Important**: Always disconnect VPN when finished to free up connection slots.

## Troubleshooting

### Cannot connect to vpn.blueclue.com

- Verify internet connection is working
- Ensure you typed the address correctly
- Clear VPN settings and re-enter
- Restart VPN client
- Contact IT if problem persists

### Authentication Failed

- Verify Caps Lock is off
- Check username format: your.email@company.com
- Ensure password is correct
- Verify MFA code is current (codes expire every 30 seconds)
- Reset password if forgotten
- Contact IT to verify account status

### Connected but cannot access resources

- Verify VPN shows "Connected" status
- Try disconnecting and reconnecting
- Restart computer
- Verify you have permissions for the resource
- Contact IT support

### VPN keeps disconnecting

- Check internet connection stability
- Move closer to WiFi router
- Switch to wired connection if possible
- Disable power saving features
- Update VPN client software
- Contact IT if issues persist

### Slow VPN performance

Expected behavior:
- Some slowdown is normal with VPN
- Download speeds: 20-50 Mbps typical
- Upload speeds: 5-10 Mbps typical

Optimization tips:
- Close unnecessary applications
- Disconnect from VPN when not needed
- Use wired connection instead of WiFi
- Connect during off-peak hours if possible

## VPN Best Practices

- ✅ **Connect only when needed** (accessing company resources)
- ✅ **Disconnect when done** (frees up resources)
- ✅ **Keep software updated** (install updates promptly)
- ✅ **Use secure networks** (avoid public WiFi when possible)
- ✅ **Enable MFA** (required for security)
- ❌ **Don''t share credentials** (your access only)
- ❌ **Don''t stay connected 24/7** (impacts performance)
- ❌ **Don''t use for personal browsing** (company resources only)

## What You Can Access Via VPN

- File servers and shared drives
- Internal websites and applications
- Email (if not using cloud email)
- Database servers
- Remote desktop connections
- Internal development environments

## VPN Access Hours

- **Standard users**: 24/7 access
- **Contractors**: Business hours only (8 AM - 6 PM)
- **Temporary access**: As specified in approval

## Security Requirements

- MFA (Multi-Factor Authentication) **required**
- Antivirus software must be up-to-date
- Operating system must be patched
- VPN will disconnect if security requirements not met

## Getting VPN Access

New to VPN?
1. Submit ticket to IT support
2. Provide business justification
3. Await manager approval
4. IT will provision access within 1 business day
5. You''ll receive setup instructions via email

## Need Help?

Contact IT support:
- **Submit ticket**: Include VPN error messages
- **Call help desk**: For urgent connection issues
- **Include in ticket**:
  - Operating system and version
  - Error messages or screenshots
  - When the issue started
  - What you''ve tried already',
        'Step-by-step guide to installing and using VPN for secure remote access.',
        'Complete VPN setup guide for Cisco AnyConnect. Includes installation, connection, troubleshooting, and best practices.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 6: Email Configuration Guide
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Email Configuration Guide (Outlook, Gmail, Mobile)',
        'email-configuration-guide',
        'Software & Applications',
        '["email", "outlook", "gmail", "configuration", "setup"]'::jsonb,
        'intermediate',
        E'# Email Configuration Guide

## Overview
BlueClue uses **Microsoft 365** for corporate email. You can access email via:
- Outlook desktop application (recommended)
- Web browser (Outlook Web Access)
- Mobile devices (iOS/Android)
- Third-party clients (Gmail, Apple Mail, etc.)

## Outlook Desktop Configuration

### Windows

1. Open **Microsoft Outlook**
2. Click **File** > **Add Account**
3. Enter your email: **yourname@blueclue.com**
4. Click **Connect**
5. Enter password when prompted
6. Complete MFA verification if required
7. Click **Done**

**Outlook automatically configures** Office 365 settings.

### macOS

1. Open **Microsoft Outlook**
2. Click **Tools** > **Accounts**
3. Click **+** (Add Account)
4. Enter email: **yourname@blueclue.com**
5. Click **Continue**
6. Enter password
7. Complete MFA verification
8. Click **Add Account**

## Web Access (OWA)

### Accessing Email via Browser

1. Navigate to: **https://outlook.office.com**
2. Sign in with:
   - Email: **yourname@blueclue.com**
   - Password: Your BlueClue password
3. Complete MFA verification
4. Access your email from any device

**Supported Browsers:**
- Microsoft Edge (recommended)
- Google Chrome
- Mozilla Firefox
- Safari

## Mobile Configuration

### iOS (iPhone/iPad)

#### Using Outlook App (Recommended)
1. Download **Microsoft Outlook** from App Store
2. Open app and tap **Get Started**
3. Enter email: **yourname@blueclue.com**
4. Tap **Add Account**
5. Enter password
6. Complete MFA verification
7. Configure notification preferences

#### Using Native Mail App
1. Open **Settings** > **Mail** > **Accounts**
2. Tap **Add Account** > **Microsoft Exchange**
3. Enter email: **yourname@blueclue.com**
4. Tap **Next**
5. Enter password
6. Tap **Next** > **Sign In**
7. Complete MFA verification
8. Toggle **Mail** on
9. Tap **Save**

### Android

#### Using Outlook App (Recommended)
1. Download **Microsoft Outlook** from Google Play
2. Open app and tap **Get Started**
3. Enter email: **yourname@blueclue.com**
4. Tap **Continue**
5. Enter password
6. Complete MFA verification
7. Configure notification preferences

#### Using Gmail App
1. Open **Gmail** app
2. Tap **Menu** > **Settings**
3. Tap **Add account**
4. Select **Outlook, Hotmail, and Live**
5. Enter email: **yourname@blueclue.com**
6. Tap **Next**
7. Enter password
8. Complete setup wizard

## Third-Party Email Clients

### Apple Mail (macOS)

1. Open **Mail** application
2. Click **Mail** > **Add Account**
3. Select **Microsoft Exchange**
4. Enter:
   - **Name**: Your full name
   - **Email**: yourname@blueclue.com
   - **Password**: Your BlueClue password
5. Click **Sign In**
6. Complete MFA verification
7. Select apps to sync (Mail, Contacts, Calendars)
8. Click **Done**

### Thunderbird

1. Open **Thunderbird**
2. Click **Menu** > **New** > **Existing Mail Account**
3. Enter:
   - **Your name**: Full name
   - **Email address**: yourname@blueclue.com
   - **Password**: Your password
4. Click **Continue**
5. Select **IMAP** (recommended)
6. Click **Done**

## Manual Configuration Settings

If automatic setup fails, use these settings:

### IMAP Settings (Recommended)
- **Incoming Server**: outlook.office365.com
- **Port**: 993
- **Encryption**: SSL/TLS
- **Username**: yourname@blueclue.com
- **Password**: Your BlueClue password

### POP3 Settings
- **Incoming Server**: outlook.office365.com
- **Port**: 995
- **Encryption**: SSL/TLS
- **Username**: yourname@blueclue.com
- **Password**: Your BlueClue password

### SMTP Settings (Outgoing)
- **Outgoing Server**: smtp.office365.com
- **Port**: 587
- **Encryption**: STARTTLS
- **Authentication**: Required
- **Username**: yourname@blueclue.com
- **Password**: Your BlueClue password

## Email Signature Setup

### Outlook Desktop

1. Click **File** > **Options**
2. Click **Mail** > **Signatures**
3. Click **New**
4. Enter signature name
5. Type your signature:
   ```
   [Your Name]
   [Job Title]
   [Department]
   BlueClue Corporation
   Phone: [Your Extension]
   Email: yourname@blueclue.com
   ```
6. Click **OK**

### Outlook Web Access

1. Click **Settings** (gear icon)
2. Search for **Email signature**
3. Toggle **Include signature in messages**
4. Compose your signature
5. Click **Save**

## Troubleshooting

### Cannot send/receive email

- Verify internet connection
- Check email quota (max 50 GB)
- Ensure account is not locked
- Verify password is correct
- Check if MFA is enabled and configured
- Contact IT if issues persist

### Emails going to spam/junk

**For your sent emails:**
- Avoid spam trigger words
- Don''t send mass emails without approval
- Include proper signatures

**For emails you''re receiving:**
- Check **Junk Email** folder
- Right-click sender > **Never Block Sender**
- Add to **Safe Senders** list

### Password prompts repeatedly

- Clear saved credentials
- Remove and re-add account
- Update to latest app version
- Check if password recently changed
- Enable Modern Authentication

### Sync issues on mobile

- Check internet connection
- Force close and reopen app
- Remove and re-add account
- Update app to latest version
- Check storage space on device

### Attachments won''t send

- Check attachment size (max 25 MB)
- For larger files, use OneDrive sharing
- Check file type (some types blocked for security)
- Ensure file is not corrupted

## Email Best Practices

- ✅ Check email regularly (at least twice daily)
- ✅ Use descriptive subject lines
- ✅ Keep inbox organized with folders
- ✅ Enable out-of-office when away
- ✅ Use BCC for mass emails
- ✅ Double-check recipients before sending
- ❌ Don''t send sensitive data without encryption
- ❌ Don''t share your password
- ❌ Don''t click suspicious links
- ❌ Don''t respond to phishing attempts

## Out of Office Setup

### Outlook Desktop
1. Click **File** > **Automatic Replies**
2. Select **Send automatic replies**
3. Set date range (optional)
4. Compose message
5. Click **OK**

### Outlook Web Access
1. Click **Settings** > **Automatic replies**
2. Toggle **Turn on automatic replies**
3. Set date range
4. Compose message
5. Click **Save**

## Need Help?

Contact IT support:
- **Submit ticket**: Include error messages
- **Call help desk**: For urgent email issues
- **Include in ticket**:
  - Email client and version
  - Device type (PC, Mac, mobile)
  - Error messages or screenshots
  - When the issue started',
        'Configure your BlueClue email on Outlook, web browsers, mobile devices, and third-party clients.',
        'Complete email configuration guide for Microsoft 365. Includes Outlook, mobile, webmail, and troubleshooting.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    RAISE NOTICE 'Successfully seeded 6 knowledge base articles (Articles 1-6)';

END $$;
