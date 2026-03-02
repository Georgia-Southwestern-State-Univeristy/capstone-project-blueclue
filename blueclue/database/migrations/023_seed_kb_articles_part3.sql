-- ============================================================================
-- Migration 023: Seed Knowledge Base with Common Support Articles (Part 3 - Final)
-- ============================================================================
-- Description: Populates knowledge base with final 6 starter articles
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

    RAISE NOTICE 'Seeding knowledge base articles (Part 3 - Final) with admin user ID: %', admin_user_id;

    -- ========================================================================
    -- Article 10: Remote Access Setup
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Remote Access Setup Guide',
        'remote-access-setup-guide',
        'Network & Connectivity',
        '["remote access", "remote desktop", "rdp", "work from home"]'::jsonb,
        'intermediate',
        E'# Remote Access Setup Guide

## Overview
Remote access allows you to connect to your office computer from home or any location with internet access.

## Remote Access Methods

### Method 1: Remote Desktop (RDP)
**Best for:** Accessing your office desktop
- Full desktop experience
- Access all applications and files
- Requires VPN connection first

### Method 2: VPN + Cloud Apps
**Best for:** Accessing cloud-based tools
- Email (Office 365)
- SharePoint and OneDrive
- Teams and collaboration tools
- Web-based applications

### Method 3: Virtual Desktop Infrastructure (VDI)
**Best for:** Secure access to virtual desktops
- Browser-based access
- No VPN required
- Pre-configured work environment
- Available to approved users only

## Prerequisites

Before setting up remote access:
- ✅ Active BlueClue account
- ✅ Remote access approval from manager
- ✅ VPN access configured (see VPN Setup article)
- ✅ Multi-factor authentication enabled
- ✅ Home internet connection (minimum 10 Mbps)
- ✅ Windows PC, Mac, or tablet

## Remote Desktop Setup

### Step 1: Enable Remote Desktop (Office Computer)

**Windows 10/11:**
1. Right-click **Start** > **System**
2. Click **Remote Desktop** in left sidebar
3. Toggle **Enable Remote Desktop** to **On**
4. Note your computer name (e.g., "DESKTOP-ABC123")
5. Click **Confirm**

**Note:** Contact IT if you don''t have permission to enable Remote Desktop

### Step 2: Get Your Computer Name

#### Option A: IT Support
- Submit ticket requesting your computer name
- IT will provide within 1 business day

#### Option B: Self-Service (If Enabled)
1. Log into **BlueClue Portal**
2. Navigate to **My Devices**
3. Find your office computer
4. Copy the computer name

### Step 3: Install Remote Desktop Client

#### Windows
- **Built-in**: Use "Remote Desktop Connection" (mstsc.exe)
- No installation needed

#### macOS
1. Open **App Store**
2. Search for **"Microsoft Remote Desktop"**
3. Click **Get** > **Install**
4. Open application after installation

#### iOS/Android
1. Open **App Store** or **Google Play**
2. Search for **"Microsoft Remote Desktop"**
3. Install the app
4. Open app after installation

### Step 4: Configure RemoteDesktop Connection

#### Windows
1. Press **Windows + R**
2. Type: `mstsc.exe`
3. Click **OK**
4. Enter computer name: `your-computer.blueclue.local`
5. Click **Show Options**
6. Enter:
   - **User name**: BLUECLUE\\yourusername
   - **Computer**: your-computer.blueclue.local
7. Click **Save** to save settings
8. Click **Connect**

#### macOS
1. Open **Microsoft Remote Desktop**
2. Click **+** > **Add PC**
3. Enter:
   - **PC name**: your-computer.blueclue.local
   - **User account**: Add User Account
   - **User name**: BLUECLUE\\yourusername
   - **Password**: Your password (or choose "Ask when required")
4. Click **Add**
5. Double-click the connection to connect

### Step 5: Connect from Home

**Important:** You must connect to VPN first!

1. **Connect to VPN** (see VPN Setup article)
2. Wait for VPN to show "Connected"
3. Open **Remote Desktop** application
4. Select your saved connection
5. Click **Connect**
6. Enter credentials if prompted
7. Complete MFA verification
8. Wait for desktop to load

## Virtual Desktop (VDI) Access

### Accessing VDI Portal

1. Open web browser
2. Navigate to: **https://vdi.blueclue.com**
3. Click **"Launch Desktop"**
4. Enter credentials:
   - **Username**: your.email@blueclue.com
   - **Password**: Your BlueClue password
5. Complete MFA verification
6. Select virtual desktop from list
7. Desktop opens in browser window

### VDI vs Remote Desktop

| Feature | VDI | Remote Desktop |
|---------|-----|----------------|
| Requires VPN | No | Yes |
| Access Method | Browser | Desktop app |
| Performance | Good | Better |
| Setup Complexity | Easy | Moderate |
| Offline Access | No | No |
| File Transfer | Limited | Full |

## File Transfer Between Locations

### Option 1: OneDrive (Recommended)
1. Save files to **OneDrive** folder on office PC
2. Access from home via OneDrive.com
3. Automatic synchronization
4. 1 TB storage per user

### Option 2: SharePoint
1. Upload files to **SharePoint** team sites
2. Access from anywhere
3. Collaboration features included
4. Version history maintained

### Option 3: Remote Desktop Clipboard
1. Copy text/files on home computer
2. Paste into remote desktop session
3. Works for small files only
4. May be disabled for security

### Option 4: Email to Yourself
1. Email files to your work email
2. Download from work computer
3. Size limit: 25 MB per email
4. Use OneDrive for larger files

## Optimizing Remote Desktop Performance

### For Better Performance:

#### Home Network
- Use wired Ethernet instead of WiFi
- Close bandwidth-heavy applications (streaming, downloads)
- Minimum 10 Mbps download, 5 Mbps upload
- Connect router directly (avoid WiFi extenders)

#### Remote Desktop Settings

**Windows Remote Desktop:**
1. Click **Show Options**
2. Click **Display** tab
3. Reduce **Colors** to 16-bit
4. Reduce **Remote desktop size** to 1280x720
5. Click **Experience** tab
6. Select **Modem**  (or **Low-speed broadband**)
7. Uncheck visual effects
8. Click **Connect**

**Mac Remote Desktop:**
1. Right-click connection > **Edit**
2. Click **Display** tab
3. Reduce **Resolution**
4. Reduce **Colors** to 16-bit
5. Click **Session** tab
6. Disable **Themes** and **Visual Effects**
7. Click **Save**

### Applications to Close
- Streaming video (Netflix, YouTube)
- Large downloads/uploads
- Online gaming
- Video calls on home computer
- Cloud backups in progress

## Troubleshooting

### Cannot connect to VPN
- See VPN Connection Setup article
- Verify internet connection works
- Check VPN credentials
- Contact IT support

### Cannot connect to Remote Desktop

#### Error: "Remote Desktop can''t connect"
- Verify VPN is connected first
- Check computer name is correct
- Ensure office PC is powered on
- Verify Remote Desktop is enabled on office PC
- Contact IT to wake up computer remotely

#### Error: "Your credentials did not work"
- Verify username format: BLUECLUE\\username
- Check Caps Lock is off
- Ensure password is correct
- Try resetting password
- Contact IT for account verification

#### Error: "Remote Desktop disconnected"
- Check VPN connection status
- Verify internet connection is stable
- Reconnect to VPN
- Try connecting again
- Contact IT if repeated disconnections

### Slow performance
- Follow performance optimization steps above
- Reduce screen resolution
- Disable visual effects
- Close unnecessary applications on office PC
- Upgrade home internet if consistently slow

### Black screen after connecting
- Wait 30-60 seconds (may be loading)
- Press Ctrl+Alt+End to open Task Manager
- Log off and reconnect
- Contact IT if persists

### Office computer is off
- Submit ticket to IT to wake computer remotely
- Enable "Wake-on-LAN" for future access
- Consider leaving computer on (if approved)

## Remote Access Security

### Best Practices
- ✅ Always use VPN for Remote Desktop
- ✅ Lock computer when stepping away
- ✅ Log off when finished (don''t just disconnect)
- ✅ Keep home computer secure and updated
- ✅ Use secure WiFi networks only
- ✅ Enable MFA on all accounts
- ❌ Never share remote access credentials
- ❌ Don''t save passwords on public computers
- ❌ Avoid using public WiFi for remote access
- ❌ Don''t disable security features for convenience

### Logging Off Properly

**Windows Remote Desktop:**
1. Click **Start** on remote desktop
2. Click user icon > **Sign out**
3. Wait for "Disconnected" message
4. Close Remote Desktop window

**Do not just close the window** - this leaves session running

## Mobile Remote Access

### iOS Remote Desktop
1. Open **Microsoft Remote Desktop** app
2. Tap **+** > **Add PC**
3. Enter PC name
4. Tap connection to connect
5. Use touch gestures to navigate
6. Pinch to zoom
7. Two-finger tap for right-click

### Android Remote Desktop
1. Open **Microsoft Remote Desktop** app
2. Tap **+**
3. Select **Desktop**
4. Enter PC name
5. Tap connection to connect
6. Use touch gestures to navigate

**Note:** Mobile experience limited - best for quick access only

## Hours of Availability

### IT Support for Remote Access
- **Monday - Friday**: 7 AM - 7 PM
- **Saturday**: 9 AM - 5 PM
- **Sunday**: Closed
- **Holidays**: Limited support

### After-Hours Support
- Critical issues only: (555) 999-7328
- Self-service resources available 24/7
- Knowledge base articles
- Automated VPN reset

## Requesting Remote Access

### New Remote Access Request
1. Submit ticket: Category "Network & Connectivity"
2. Select: "Remote Access Request"
3. Provide:
   - Business justification
   - Frequency of remote work
   - Manager name
4. Await approval (1-2 business days)
5. IT will configure access
6. You''ll receive setup instructions

### Remote Access Types

**Standard Remote Access:**
- Business hours only
- VPN + Remote Desktop
- Email and cloud apps

**Extended Remote Access:**
- 24/7 VPN access
- Remote Desktop anytime
- Requires approval for business need

**Full-Time Remote Workers:**
- Company laptop shipped home
- 24/7 access to all resources
- VDI access provided
- Home office equipment (if approved)

## Alternative Remote Work Options

### Cloud-Based Work
Access without Remote Desktop:
- **Email**: Outlook.com
- **Files**: OneDrive, SharePoint
- **Communication**: Teams, Slack
- **Projects**: Web-based tools
- **Time Tracking**: Web portal

Works for many roles without Remote Desktop

## Need Help?

### Remote Access Support
- **Submit ticket**: Category "Network & Connectivity"
- **Call IT**: (555) 123-4567
- **Email**: support@blueclue.com
- **After hours**: (555) 999-7328 (emergencies only)

### Include in Support Request:
- Device type (Windows, Mac, mobile)
- Connection method (RDP, VDI)
- Error messages or screenshots
- Steps you''ve already tried
- VPN connection status',
        'Complete guide to setting up remote access including Remote Desktop, VPN, and VDI.',
        'Remote access setup for working from home. Includes RDP, VPN, VDI, troubleshooting, and security best practices.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 11: Browser Troubleshooting
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Browser Troubleshooting Guide (Clear Cache, Cookies & More)',
        'browser-troubleshooting-guide',
        'Software & Applications',
        '["browser", "chrome", "edge", "firefox", "cache", "cookies", "troubleshooting"]'::jsonb,
        'beginner',
        E'# Browser Troubleshooting Guide

## Overview
Common browser issues and how to fix them for Chrome, Edge, Firefox, and Safari.

## Common Browser Issues

- Pages not loading correctly
- Slow browser performance
- Error messages
- Login problems
- Missing images or styles
- Videos won''t play
- Forms not submitting
- Unexpected pop-ups

## Quick Fixes (Try These First)

### 1. Refresh the Page
- **Windows/Linux**: Press `Ctrl + F5` (hard refresh)
- **Mac**: Press `Cmd + Shift + R`
- This clears cached version and reloads from server

### 2. Check Internet Connection
- Open a different website (e.g., google.com)
- Run speed test: [speedtest.net](http://speedtest.net)
- Restart your router if needed
- Try wired connection instead of WiFi

### 3. Clear Browser Cache
- See detailed instructions below by browser
- Solves 70% of browser issues
- Safe to do - won''t delete bookmarks or passwords

### 4. Disable Extensions
- Extensions can interfere with websites
- Try browsing in Incognito/Private mode
- Disable extensions one by one to find culprit

### 5. Update Your Browser
- Outdated browsers cause compatibility issues
- Enable automatic updates
- Restart after updating

## Clear Cache & Cookies by Browser

### Google Chrome

#### Method 1: Keyboard Shortcut (Fastest)
1. Press `Ctrl + Shift + Delete` (Windows/Linux)
   Or `Cmd + Shift + Delete` (Mac)
2. Select **Time range**: Last 24 hours (or All time for major issues)
3. Check these boxes:
   - ☑ **Browsing history**
   - ☑ **Cookies and other site data**
   - ☑ **Cached images and files**
4. Click **Clear data**
5. Restart Chrome

#### Method 2: Settings Menu
1. Click **⋮** (three dots) > **Settings**
2. Click **Privacy and security** (left sidebar)
3. Click **Clear browsing data**
4. Follow steps above

### Microsoft Edge

#### Method 1: Keyboard Shortcut
1. Press `Ctrl + Shift + Delete` (Windows)
2. Select **Time range**: Last 24 hours (or All time)
3. Check:
   - ☑ **Browsing history**
   - ☑ **Cookies and other site data**
   - ☑ **Cached images and files**
4. Click **Clear now**
5. Restart Edge

#### Method 2: Settings Menu
1. Click **⋯** (three dots) > **Settings**
2. Click **Privacy, search, and services**
3. Under **Clear browsing data**, click **Choose what to clear**
4. Follow steps above

### Mozilla Firefox

#### Method 1: Keyboard Shortcut
1. Press `Ctrl + Shift + Delete` (Windows/Linux)
   Or `Cmd + Shift + Delete` (Mac)
2. Select **Time range**: Last Hour (or Everything)
3. Check:
   - ☑ **Browsing & Download History**
   - ☑ **Cookies**
   - ☑ **Cache**
4. Click **Clear Now**
5. Restart Firefox

#### Method 2: Settings Menu
1. Click **☰** (menu) > **Settings**
2. Click **Privacy & Security** (left sidebar)
3. Scroll to **Cookies and Site Data**
4. Click **Clear Data**
5. Check both options
6. Click **Clear**

### Safari (macOS)

#### Clear Cache
1. Open **Safari** > **Preferences**
2. Click **Advanced** tab
3. Check **Show Develop menu in menu bar**
4. Close Preferences
5. Click **Develop** > **Empty Caches**
6. Restart Safari

#### Clear Cookies and Data
1. **Safari** > **Preferences**
2. Click **Privacy** tab
3. Click **Manage Website Data**
4. Click **Remove All**
5. Click **Remove Now**
6. Restart Safari

#### Keyboard Shortcut
- Press `Option + Cmd + E` to empty caches

## Disable Browser Extensions

### Chrome
1. Click **⋮** > **Extensions** > **Manage Extensions**
2. Toggle off extensions one by one
3. Test if issue is resolved
4. Re-enable working extensions

**Or use Incognito Mode:**
- Press `Ctrl + Shift + N` (Windows)
- Press `Cmd + Shift + N` (Mac)
- Extensions disabled by default in Incognito

### Edge
1. Click **⋯** > **Extensions**
2. Toggle off extensions
3. Test website
4. Re-enable as needed

**Or use InPrivate Mode:**
- Press `Ctrl + Shift + N`

### Firefox
1. Click **☰** > **Add-ons and themes**
2. Click **Extensions**
3. Toggle off extensions
4. Test website

**Or use Private Window:**
- Press `Ctrl + Shift + P`

## Update Your Browser

### Chrome
1. Click **⋮** > **Help** > **About Google Chrome**
2. Chrome checks for updates automatically
3. Click **Relaunch** if update available
4. Chrome updates automatically by default

### Edge
1. Click **⋯** > **Help and feedback** > **About Microsoft Edge**
2. Edge checks and installs updates
3. Click **Restart** when prompted
4. Updates automatically via Windows Update

### Firefox
1. Click **☰** > **Help** > **About Firefox**
2. Firefox checks for updates
3. Click **Restart to update Firefox**
4. Enable auto-updates in Settings

### Safari
1. **App Store** > **Updates**
2. Safari updates with macOS
3. Install macOS updates regularly

## Reset Browser Settings

**Warning:** This resets settings to defaults. Bookmarks and passwords are preserved.

### Chrome
1. Click **⋮** > **Settings**
2. Click **Reset settings** (left sidebar)
3. Click **Restore settings to their original defaults**
4. Click **Reset settings**

### Edge
1. Click **⋯** > **Settings**
2. Click **Reset settings** (left sidebar)
3. Click **Restore settings to their default values**
4. Click **Reset**

### Firefox
1. Click **☰** > **Help** > **More troubleshooting information**
2. Click **Refresh Firefox**
3. Click **Refresh Firefox** to confirm
4. Click **Finish**

## Specific Issue Troubleshooting

### Pages Not Loading

1. Check internet connection
2. Try different website to verify connectivity
3. Clear cache and cookies
4. Disable VPN temporarily
5. Check firewall settings
6. Try different browser

### Slow Browser Performance

1. Close unnecessary tabs (limit to 10-15)
2. Clear cache and cookies
3. Disable unused extensions
4. Check Task Manager for high memory usage
5. Restart browser
6. Restart computer
7. Update browser

### Login Problems

1. Clear cookies for specific site
2. Check Caps Lock is off
3. Verify username/password
4. Reset password if forgotten
5. Try Incognito/Private mode
6. Disable password manager temporarily
7. Contact website support

### Videos Won''t Play

1. Update browser to latest version
2. Clear cache and cookies
3. Disable hardware acceleration:
   - **Chrome/Edge**: Settings > System > disable "Use hardware acceleration"
   - **Firefox**: Settings > General > Performance > uncheck "Use hardware acceleration"
4. Update graphics drivers
5. Try different browser

### Forms Not Submitting

1. Clear cache and cookies
2. Disable browser extensions
3. Ensure JavaScript is enabled
4. Try different browser
5. Check for browser console errors (F12)

### Certificate/Security Warnings

**Error: "Your connection is not private" (Chrome)**
**Error: "Warning: Potential Security Risk" (Firefox)**

1. Check your computer''s date and time (common cause)
2. Clear browser cache and cookies
3. Check if website is legitimate
4. Disable antivirus temporarily
5. Contact IT if accessing company websites

### Pop-up Issues

#### Enable Pop-ups for Specific Site
**Chrome:**
1. Click 🚫 icon in address bar
2. Select "Always allow pop-ups from [site]"
3. Click **Done**

**Firefox:**
1. Click 🔒 icon in address bar
2. Turn off **Block pop-up windows**

#### Block Unwanted Pop-ups
1. Install ad blocker (e.g., uBlock Origin)
2. Enable browser''s built-in pop-up blocker
3. Scan for malware with antivirus
4. Reset browser settings

## Developer Tools (For Advanced Troubleshooting)

### Open Developer Console
- Press `F12` (all browsers)
- Or right-click page > **Inspect**

### Check Console for Errors
1. Open Developer Tools
2. Click **Console** tab
3. Look for red error messages
4. Screenshot errors for IT support

### Network Tab
1. Open Developer Tools (F12)
2. Click **Network** tab
3. Refresh page (F5)
4. Look for failed requests (red entries)

## Browser Performance Tips

### Keep Browser Fast
- ✅ Close tabs you''re not using
- ✅ Clear cache weekly
- ✅ Disable unused extensions
- ✅ Keep browser updated
-✅ Use bookmarks instead of keeping tabs open
- ✅ Restart browser daily
- ❌ Don''t install too many extensions
- ❌ Avoid suspicious downloads
- ❌ Don''t ignore update notifications

## Recommended Browser Settings

### Enable Automatic Updates
All browsers should auto-update

### Enable Pop-up Blocker
Default enabled - only allow trusted sites

### Enable Safe Browsing
- Chrome/Edge: Settings > Privacy and security > Security
- Firefox: Settings > Privacy & Security > Security

### Manage Saved Passwords
- Use browser password manager or dedicated tool
- Enable sync to access across devices
- Use strong, unique passwords

## Switching Browsers

### Export Bookmarks

**Chrome:**
1. **⋮** > **Bookmarks** > **Bookmark manager**
2. **⋮** > **Export bookmarks**
3. Save HTML file

**Edge:**
1. **⋯** > **Favorites** > **⋯** > **Export favorites**

**Firefox:**
1. **☰** > **Library** > **Bookmarks** > **Show All Bookmarks**
2. **Import and Backup** > **Export Bookmarks to HTML**

### Import Bookmarks

Each browser has **Import** option in Settings > Bookmarks

## Company-Approved Browsers

### Supported Browsers
- ✅ **Google Chrome** (recommended)
- ✅ **Microsoft Edge**
- ✅ **Mozilla Firefox**
- ✅ **Safari** (macOS only)

### Not Supported
- ❌ Internet Explorer (deprecated)
- ❌ Opera
- ❌ Brave

**Note:** Use approved browsers for company applications

## When to Contact IT

Contact IT support if:
- Browser issues persist after troubleshooting
- Cannot access company websites
- Security warnings on internal sites
- Browser crashes repeatedly
- Need to install/update browser (restricted users)
- Suspect malware or security issue

### Include in Your Ticket:
- Browser name and version
- Website/application having issues
- Error messages (screenshots)
- Steps you''ve already tried
- When the issue started
- If issue occurs in other browsers

## Need Help?

**IT Support:**
- **Submit ticket**: Category "Software & Applications"
- **Call**: (555) 123-4567
- **Email**: support@blueclue.com

**Self-Service Resources:**
- Knowledge Base: Search for specific error messages
- Video tutorials: Available in training portal
- Quick reference guides: Download from IT portal',
        'Fix common browser issues including slow performance, cache problems, and page loading errors.',
        'Complete browser troubleshooting guide for Chrome, Edge, Firefox, Safari. Clear cache, cookies, fix loading issues.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    -- ========================================================================
    -- Article 12: Multi-Factor Authentication Setup
    -- ========================================================================
    INSERT INTO knowledge_articles (
        title, slug, category, tags, difficulty, content, excerpt, meta_description,
        is_public, is_published, published_at, created_by, created_at, updated_at, last_reviewed_at
    ) VALUES (
        'Multi-Factor Authentication (MFA) Setup',
        'multi-factor-authentication-setup',
        'Security & Compliance',
        '["mfa", "2fa", "security", "authentication", "authenticator"]'::jsonb,
        'beginner',
        E'# Multi-Factor Authentication (MFA) Setup

## Overview
Multi-Factor Authentication (MFA) adds an extra layer of security to your account by requiring two forms of verification:
1. **Something you know** (your password)
2. **Something you have** (your phone or security key)

## Why MFA is Required

**MFA is mandatory for all BlueClue accounts** because:
- ✅ Prevents 99.9% of automated attacks
- ✅ Protects against stolen passwords
- ✅ Secures company data
- ✅ Meets compliance requirements
- ✅ Safeguards client information

## MFA Methods

### Recommended Methods

1. **Authenticator App** (Recommended)
   - Microsoft Authenticator, Google Authenticator, Authy
   - Works offline
   - Most secure

2. **Push Notifications**
   - Microsoft Authenticator app
   - One-tap approval
   - Requires internet connection

3. **SMS Text Message**
   - Backup method only
   - Less secure than authenticator
   - Requires cell signal

4. **Phone Call**
   - Automated call to your phone
   - Backup method only

5. **Hardware Security Key** (Optional)
   - YubiKey or similar
   - Most secure option
   - Requires purchase and IT configuration

## Setting Up Authenticator App

### Step 1: Install Authenticator App

#### Recommended: Microsoft Authenticator

**iOS (iPhone/iPad):**
1. Open **App Store**
2. Search for **"Microsoft Authenticator"**
3. Tap **Get** > **Install**
4. Open app after installation

**Android:**
1. Open **Google Play Store**
2. Search for **"Microsoft Authenticator"**
3. Tap **Install**
4. Open app after installation

#### Alternatives:
- **Google Authenticator** (iOS/Android)
- **Authy** (iOS/Android, Windows, Mac)
- **Duo Mobile** (iOS/Android)

### Step 2: Enable MFA on Your Account

1. Log into **BlueClue Portal**: https://portal.blueclue.com
2. Click your **profile icon** (top right)
3. Select **Security Settings**
4. Click **"Enable Multi-Factor Authentication"**
5. Click **"Set up authenticator app"**

### Step 3: Scan QR Code

1. Open **Microsoft Authenticator** app
2. Tap **+** > **Work or school account**
3. Tap **Scan QR code**
4. Point camera at QR code on screen
5. Account is automatically added

**If you can''t scan:**
1. Tap **"Or enter code manually"**
2. Enter:
   - **Account name**: BlueClue
   - **Key**: (copy from screen)
3. Tap **Finish**

### Step 4: Verify Setup

1. App generates 6-digit code
2. Enter code on BlueClue portal
3. Click **Verify**
4. Setup complete when you see checkmark

### Step 5: Save Backup Codes

**Critical:** Save these codes in a secure location

1. Click **"Generate backup codes"**
2. Click **Download** or **Print**
3. Store in secure location (not on your phone)
4. Each code can be used once

**Where to store backup codes:**
- Password manager
- Secure note in locked drawer
- Encrypted file
- **Not:** Email, screenshots on phone, sticky note

## Setting Up SMS/Phone Verification

### Add Phone Number

1. Navigate to **Security Settings**
2. Click **"Add authentication method"**
3. Select **"Phone"**
4. Select country code
5. Enter mobile number
6. Choose **"Text me a code"** or **"Call me"**
7. Click **Send**
8. Enter verification code received
9. Click **Verify**

**Note:** SMS recommended as backup method only

## Using MFA at Login

### With Authenticator App

1. Enter **username** and **password**
2. Click **Sign in**
3. Open **Microsoft Authenticator** app
4. View 6-digit code for BlueClue
5. Enter code on login screen
6. Click **Verify**

**Tip:** Code changes every 30 seconds

### With Push Notification

1. Enter **username** and **password**
2. Click **Sign in**
3. Notification appears on your phone
4. Open **Microsoft Authenticator**
5. Review login details
6. Tap **Approve**
7. Logged in automatically

### With SMS

1. Enter **username** and **password**
2. Click **Sign in**
3. Select **"Text a code to my phone"**
4. Receive SMS with 6-digit code
5. Enter code
6. Click **Verify**

### With Backup Code

1. Enter **username** and **password**
2. Click **Sign in**
3. Click **"I can\'\'t use my authenticator right now"**
4. Select **"Use a backup code"**
5. Enter one of your backup codes
6. Click **Verify**

**Important:** Each backup code works only once

## Trusted Devices

### Save Device as Trusted

For your personal computer:
1. Check **"Don\'\'t ask again on this device"** at login
2. Won\'\'t need MFA for 90 days on this device
3. Still need password every time

**Only use on devices you control:**
- ✅ Your personal laptop at home
- ✅ Your office desktop
- ❌ Shared computers
- ❌ Public computers
- ❌ Friend\'s devices

## Managing MFA Methods

### View Configured Methods

1. **Security Settings** > **Multi-Factor Authentication**
2. See list of all configured methods:
   - Authenticator app
   - Phone numbers
   - Backup codes
   - Security keys

### Add Additional Method

1. Click **"Add method"**
2. Select method type
3. Follow setup instructions
4. Verify new method

### Remove Method

1. Find method in list
2. Click **"Remove"**
3. Confirm removal

**Note:** Cannot remove all methods - at least one required

### Change Default Method

1. Find preferred method
2. Click **"Make default"**
3. This method will be used first at login

## Troubleshooting

### Lost/Broken Phone

**If you have backup codes:**
1. Log in using backup code
2. Navigate to **Security Settings**
3. Remove old phone method
4. Add new phone/device

**If you don''t have backup codes:**
1. Contact IT Support immediately
2. Call: (555) 123-4567
3. Verify your identity (security questions)
4. IT will temporarily disable MFA
5. Log in and set up MFA on new device
6. Generate new backup codes

### Authenticator App Not Working

1. Check phone has correct time (auto time zone)
2. Ensure app is updated to latest version
3. Remove and re-add account in app
4. Use backup code to login
5. Reconfigure authenticator

### Not Receiving SMS Codes

1. Check phone has cell signal
2. Verify phone number is correct in settings
3. Check for carrier issues
4. Try "Call me" option instead
5. Use authenticator app or backup code
6. Update phone number if changed

### Codes Not Matching

1. Ensure phone time is correct (crucial!)
2. Settings > Date & Time > Set automatically
3. Wait for new code (codes change every 30 seconds)
4. Try backup code if available
5. Contact IT to reset MFA

### Locked Out of Account

1. Try using backup code
2. Call IT Support: (555) 123-4567
3. Verify identity with security questions
4. IT will reset MFA
5. Set up MFA again immediately

## MFA Best Practices

### Do:
- ✅ Use authenticator app as primary method
- ✅ Save backup codes securely
- ✅ Keep phone updated
- ✅ Add multiple MFA methods
- ✅ Review login activity regularly
- ✅ Mark trusted devices appropriately

### Don\'t:
- ❌ Share MFA codes with anyone (even IT)
- ❌ Approve push notifications you didn\'t initiate
- ❌ Save backup codes on phone
- ❌ Disable MFA
- ❌ Use only SMS as authentication method
- ❌ Ignore suspicious login notifications

## Security Tips

### Recognize Phishing

**Legitimate MFA prompts:**
- Occur when YOU are logging in
- Show details you recognize
- Come from official app

**Suspicious prompts:**
- You didn\'t try to log in
- Unexpected push notification
- Wrong location shown
- Middle of the night (if you\'re sleeping)

**If suspicious: DENY the request and contact IT**

### Report Unexpected Prompts

If you receive MFA prompt you didn\'t initiate:
1. **Deny** the authentication request
2. Change your password immediately
3. Contact IT Security: (555) 999-SECURITY
4. Submit security incident report

## Multiple Accounts

### Personal vs Work Accounts

Use separate authenticators:
- Work: Microsoft Authenticator
- Personal: Google Authenticator (or separate)

Or use folders/labels in app to organize

### Managing Multiple Work Accounts

Authenticator app can store multiple accounts:
- BlueClue Portal
- Office 365
- VPN
- Other company applications

All managed in one app with separate codes

## Hardware Security Keys (Advanced)

### Supported Keys
- YubiKey 5 Series
- Titan Security Key
- Other FIDO2-compliant keys

### Setup Process
1. Purchase approved security key
2. Submit ticket to IT for registration
3. IT will assist with setup
4. Insert key when prompted at login
5. Touch/press button on key to authenticate

**Benefits:**
- Most secure MFA method
- Works across multiple devices
- Phishing-resistant
- No batteries or connectivity needed

## MFA for Applications

Some company applications have separate MFA:
- Office 365 / Outlook
- VPN
- Remote Desktop
- Cloud applications

Usually uses same authenticator app

## International Travel

### Using MFA Abroad

**Authenticator app:**
- Works fine internationally
- No roaming charges
- Codes generated offline

**SMS:**
- May not work abroad
- International roaming required
- Use authenticator app instead

**Before travel:**
- Ensure authenticator app is set up
- Have backup codes saved
- Test login before departure
- Note IT support contact info

## Getting Help

### IT Support

**Phone:** (555) 123-4567
- Monday-Friday: 7 AM - 7 PM
- Saturday: 9 AM - 5 PM

**Emergency MFA Reset:** (555) 999-7328
- Available 24/7 for lockouts

### Self-Service

- Password reset: https://password.blueclue.com
- Security portal: https://security.blueclue.com
- Knowledge base: Search "MFA" for articles

### Common Questions

**Q: Is MFA optional?**
A: No, MFA is required for all accounts

**Q: Can I use the same app for personal accounts?**
A: Yes, most authenticator apps support multiple accounts

**Q: What if I don\'t have a smartphone?**
A: Contact IT for hardware token options

**Q: How often do I need to enter MFA codes?**
A: Every login, unless device is trusted (90-day limit)

## Need Help?

Submit ticket with:
- **Category**: Security & Compliance
- **Subject**: MFA Setup Help
- **Include**: Device type, specific error, what you\'ve tried

IT will respond within 4 hours during business hours',
        'Step-by-step guide to setting up Multi-Factor Authentication (MFA) for enhanced account security.',
        'Complete MFA setup guide for BlueClue accounts. Includes authenticator apps, SMS, troubleshooting, and security tips.',
        true,
        true,
        CURRENT_TIMESTAMP,
        admin_user_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) ON CONFLICT (slug) DO NOTHING;

    RAISE NOTICE 'Successfully seeded 3 knowledge base articles (Articles 10-12)';

END $$;
