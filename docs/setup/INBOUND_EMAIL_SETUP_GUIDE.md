# Inbound Email Setup Guide - Email-to-Ticket Feature

> **🚀 Quick Start**: If you just want to get it working ASAP, skip to [Practical Step-by-Step Setup (Windows)](#practical-step-by-step-setup-windows) for exact commands that worked in testing!

## Overview

This guide explains how to set up the **email-to-ticket** feature that allows users to submit support tickets by sending emails to a dedicated address (e.g., `support@blueclue.com`).

When a user sends an email to your support address:
1. Mailgun receives the email and parses it
2. Mailgun sends the parsed data to your webhook endpoint
3. BlueClue creates a ticket from the email content
4. The system automatically classifies the ticket using AI
5. A confirmation email is sent back to the user
6. If the sender is new, a guest account is automatically created

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Mailgun Setup](#mailgun-setup)
3. [DNS Configuration](#dns-configuration)
4. [Webhook Configuration](#webhook-configuration)
5. **[Practical Step-by-Step Setup (Windows)](#practical-step-by-step-setup-windows)** ⭐ **Start here for quick setup!**
6. [Backend Configuration](#backend-configuration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up inbound email, you need:

- **Mailgun Account** (free tier available - 5,000 emails/month)
- **Domain name** (or use Mailgun sandbox for testing)
- **Access to DNS records** (for custom domain setup)
- **Backend server** accessible from the internet (for webhooks)

### Why Mailgun?

- ✅ **Free tier** available (perfect for capstone/demo)
- ✅ **Easy webhook integration** - receives parsed emails as JSON/form data
- ✅ **Automatic email parsing** - handles HTML, plain text, attachments
- ✅ **Reliable delivery** - enterprise-grade email infrastructure
- ✅ **Good documentation** - clear guides and examples

---

## Mailgun Setup

### Step 1: Create Mailgun Account

1. Go to [https://www.mailgun.com](https://www.mailgun.com)
2. Click **Sign Up** (free tier available)
3. Verify your email address
4. Complete account setup

### Step 2: Add Your Domain (or Use Sandbox)

#### Option A: Use Sandbox Domain (Quick Test)

For testing/demo purposes, use Mailgun's sandbox domain:

1. Go to **Sending** > **Domains** in Mailgun dashboard
2. You'll see a sandbox domain like: `sandboxXXXXX.mailgun.org`
3. Note: Sandbox domains can **only send to authorized recipients**
4. Add your test email address to authorized recipients:
   - Go to **Sending** > **Domains** > Click your sandbox domain
   - Scroll to **Authorized Recipients**
   - Click **Add Recipient** and enter your email
   - Verify the confirmation email

#### Option B: Add Your Own Domain (Production)

For production use with a custom domain (e.g., `support@blueclue.com`):

1. Go to **Sending** > **Domains**
2. Click **Add New Domain**
3. Enter your domain (e.g., `blueclue.com`)
4. Follow DNS configuration steps (see next section)

---

## DNS Configuration

### Required DNS Records

To receive emails via Mailgun, add these DNS records to your domain:

#### MX Records (Mail Exchange)

These tell email servers where to deliver emails sent to your domain:

```
Type: MX
Host: @ (or your subdomain, e.g., support)
Value: mxa.mailgun.org
Priority: 10

Type: MX
Host: @ (or your subdomain)
Value: mxb.mailgun.org
Priority: 10
```

#### TXT Records (for spam protection and verification)

**SPF Record** (Sender Policy Framework):
```
Type: TXT
Host: @
Value: v=spf1 include:mailgun.org ~all
```

**DKIM Record** (Domain Keys Identified Mail):
```
Type: TXT
Host: mg._domainkey
Value: [provided by Mailgun - copy from dashboard]
```

### Where to Add DNS Records

- **GoDaddy**: DNS Management > Add Record
- **Namecheap**: Advanced DNS > Add New Record
- **Cloudflare**: DNS > Add Record
- **Route 53** (AWS): Hosted Zones > Create Record

### DNS Propagation

- DNS changes can take **15 minutes to 48 hours** to propagate
- Check propagation: [https://dnschecker.org](https://dnschecker.org)
- Mailgun will show verification status in dashboard

---

## Webhook Configuration

### Step 1: Set Up Backend URL for Development

For local development, your backend needs to be accessible from the internet:

#### Using ngrok (Recommended for Development)

1. **Install ngrok**: Download from [https://ngrok.com](https://ngrok.com)
2. **Start your backend**:
   - PowerShell: `cd blueclue/backend; node src/app.js`
   - Bash/Unix: `cd blueclue/backend && node src/app.js`
3. **Start ngrok tunnel** (in a new terminal):
   ```bash
   ngrok http 3000
   ```
4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
5. Keep this URL handy - you'll need it in the next step

> **Note**: Free ngrok URLs change each time you restart. For persistent URLs, upgrade to ngrok paid plan or use production hosting.

### Step 2: Configure Inbound Routing

1. Go to **Receiving** > **Routes** in Mailgun dashboard (or **Sending** > **Routes**)
2. Click **Create Route**

**Route Configuration:**

```
Priority: 1
Description: Support ticket creation from email
Expression: match_recipient("support@yourdomain.com")
Actions: forward("https://your-backend-url.com/api/webhooks/inbound-email")
```

**Important:**
- Replace `support@yourdomain.com` with your support email address (can use your sandbox domain like `test@sandboxXXXXX.mailgun.org`)
- Replace `https://your-backend-url.com` with your ngrok URL (e.g., `https://abc123.ngrok.io/api/webhooks/inbound-email`)
- Click **Create Route** to save

### Step 3: Get Webhook Signing Key

**IMPORTANT**: You must create at least one webhook/route before the signing key is available.

1. After creating your route (Step 2), go to **Settings** > **Webhooks** in the sidebar
2. Select your **domain** (sandbox or custom domain) from the dropdown at the top
3. Look for **Domain level** webhooks section
4. Scroll to **HTTP webhook signing key**
5. Copy the signing key (looks like `key-1234567890abcdef`)
6. Save this for the next step (needed in `.env` file)

> **Note**: Use the **domain-level** signing key, not the account-level key. Each domain has its own signing key.

> **Note**: Use the **domain-level** signing key, not the account-level key. Each domain has its own signing key.

---

## Practical Step-by-Step Setup (Windows)

This section documents the **exact steps that worked** in testing, saving you troubleshooting time.

### Part 1: Setup ngrok (5 minutes)

**Why ngrok?** Your backend runs on `localhost:3000`, which Mailgun can't reach. ngrok creates a public tunnel to your local server.

#### Step 1: Download and Extract ngrok

1. **Download**: Go to [https://ngrok.com/download](https://ngrok.com/download)
2. **Select**: Windows (64-bit) version
3. **Save**: Download `ngrok-v3-stable-windows-amd64.zip` to your Downloads folder

**PowerShell Commands:**
```powershell
# Navigate to Downloads and extract
cd $env:USERPROFILE\Downloads
Expand-Archive -Path "ngrok-v3-stable-windows-amd64.zip" -DestinationPath "." -Force
```

#### Step 2: Create ngrok Account and Get Auth Token

1. **Sign up**: Go to [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. **Verify email**: Check your inbox and verify
3. **Get auth token**: Dashboard will show your auth token (looks like `3A2qa5vx6k4Gn7tqF2cX0...`)
4. **Copy it**: You'll need this in the next step

#### Step 3: Configure ngrok with Your Auth Token

```powershell
# Still in Downloads folder
.\ngrok.exe config add-authtoken YOUR_AUTH_TOKEN_HERE
```

**Example:**
```powershell
.\ngrok.exe config add-authtoken 3A2qa5vx6k4Gn7tqF2cX0HkRGls_2VW3CRZQESE99ikfK3gVc
```

**Success message:**
```
Authtoken saved to configuration file: C:\Users\YourName\.ngrok2\ngrok.yml
```

#### Step 4: Start ngrok Tunnel

**IMPORTANT**: Start your backend FIRST, then start ngrok.

**Terminal 1 - Start Backend:**
```powershell
cd "C:\Users\clayt\Desktop\Spring 26\Capstone\capstone-project-blueclue\blueclue\backend"
node src/app.js
```

**Terminal 2 - Start ngrok:**
```powershell
cd $env:USERPROFILE\Downloads
.\ngrok.exe http 3000
```

**What you'll see:**
```
ngrok                                                               
                                                                    
Session Status                online                                
Account                       Clayton McGough (Plan: Free)         
Version                       3.36.1                                
Region                        United States (us)                    
Latency                       -                                     
Web Interface                 http://127.0.0.1:4040                 
Forwarding                    https://abc123def456.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

#### Step 5: Copy Your Public URL

**COPY THIS URL** - You'll need it for Mailgun in the next section:
```
https://abc123def456.ngrok-free.app
```

**Important Notes:**
- ⚠️ **Free URL changes** every time you restart ngrok
- ✅ Keep this terminal open - closing it stops the tunnel
- 🌐 Open `http://127.0.0.1:4040` to see webhook logs in real-time
- 💡 Pro tip: For development, pin this URL - you'll check it often for debugging

---

### Part 2: Setup Mailgun Sandbox (10 minutes)

**Why Sandbox?** Perfect for testing - free, no DNS setup needed, works immediately.

#### Step 1: Create Mailgun Account

1. Go to [https://www.mailgun.com](https://www.mailgun.com)
2. Click **Sign Up** → Choose free tier
3. Verify your email address
4. Complete the form (company info, etc.)

#### Step 2: Find Your Sandbox Domain

1. **Login** to Mailgun dashboard
2. **Navigate**: Click **Sending** in left sidebar → **Domains**
3. **Look for**: Domain name starting with `sandbox` (e.g., `sandbox1234567890abcdef.mailgun.org`)
4. **Copy this** - you'll need it

**Example sandbox domain:**
```
sandbox9a8b7c6d5e4f3a2b1c0d9e8f.mailgun.org
```

#### Step 3: Add Authorized Recipient (CRITICAL!)

Sandbox domains can ONLY send to authorized recipients. Skip this = no emails received!

1. **Click** your sandbox domain in the Domains list
2. **Scroll** to **Authorized Recipients** section
3. **Click** "Add Recipient"
4. **Enter** your personal email (e.g., `claytonmcgough@gmail.com`)
5. **Check inbox** - Mailgun sends verification email
6. **Click** the verification link in email
7. **Confirm** - Status should show "Verified" ✅

#### Step 4: Create Inbound Route

**THE MOST IMPORTANT PART** - Getting this wrong = no webhooks received!

1. **Navigate**: **Sending** → **Routes** (top of left sidebar)
2. **Click**: "Create Route" button

**Fill in the form:**

**Priority:**
```
1
```

**Filter Expression (CRITICAL - Use Wildcard!):**
```
match_recipient("*@sandbox9a8b7c6d5e4f3a2b1c0d9e8f.mailgun.org")
```

**⚠️ COMMON MISTAKE:**
```
match_recipient("youremail@gmail.com")  ❌ WRONG!
```

**Why?** `match_recipient()` matches the **TO address** (where email is sent), NOT the FROM address (who sent it).

Correct logic:
- **Email TO**: `anything@sandbox123.mailgun.org` ← This is what the route matches
- **Email FROM**: `youremail@gmail.com` ← This is the sender (ignored by route)
- **Wildcard `*`**: Matches ANY address at your sandbox domain

**Actions:**

Replace with YOUR ngrok URL from Part 1:
```
forward("https://abc123def456.ngrok-free.app/api/webhooks/inbound-email")
```

**Full example:**
```
forward("https://unschematised-semireflexively-marsha.ngrok-free.app/api/webhooks/inbound-email")
```

**Description (optional):**
```
Forward inbound emails to BlueClue webhook for ticket creation
```

3. **Click** "Create Route"
4. **Verify** - Route should appear in list with Priority 1

#### Step 5: Get Webhook Signing Key

**You MUST create the route first** - signing key isn't available until you have webhooks configured!

1. **Navigate**: **Settings** → **Webhooks** in left sidebar
2. **Select domain**: Click dropdown at top, choose your sandbox domain
3. **Scroll down**: Look for "HTTP webhook signing"key" section (usually near bottom)
4. **Copy the key**: Looks like `66e8915b6668db0f8328198ba636578f` (32 hex characters)

**IMPORTANT:** Use the **domain-level** key (shown when domain is selected), not account-level!

**Save this key** - you'll add it to `.env` in next section.

---

### Part 3: Configure Backend (3 minutes)

#### Step 1: Update .env File

Open `blueclue/backend/.env` and add/update these variables:

```env
# ===== Mailgun Webhook Configuration =====
MAILGUN_WEBHOOK_SIGNING_KEY=66e8915b6668db0f8328198ba636578f

# ===== Email Configuration =====
NODE_ENV=production   # MUST be "production" for real email sending
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password  # Generate this from Google Account settings
EMAIL_FROM=BlueClue Support <your-gmail@gmail.com>
```

**Gmail App Password Setup** (if you haven't done this):
1. Go to [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required)
3. Search for "App passwords"
4. Generate password for "Mail" → Copy it
5. Use this password (NOT your regular Gmail password)

#### Step 2: Kill Any Existing Backend Process

**PowerShell:**
```powershell
# Kill any process on port 3000
$port = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port) { Stop-Process -Id $port -Force }
```

#### Step 3: Start Backend in Production Mode

```powershell
cd "C:\Users\clayt\Desktop\Spring 26\Capstone\capstone-project-blueclue\blueclue\backend"
node src/app.js
```

**Success output:**
```
Server is running on http://localhost:3000
Database connected successfully
WebSocket server is ready
```

#### Step 4: Verify Webhook Endpoint

In a **new terminal:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/health"
```

**Expected response:**
```json
{
  "status": "success",
  "message": "Webhook endpoint is operational",
  "timestamp": "2026-02-22T23:36:43.762Z",
  "endpoints": {
    "inbound_email": {
      "method": "POST",
      "path": "/api/webhooks/inbound-email",
      "description": "Receives parsed email data from Mailgun"
    }
  }
}
```

---

### Part 4: Testing (5 minutes)

#### Step 1: Send Test Email

**From your Gmail** (the one you authorized in Mailgun):

- **To**: `anything@sandbox9a8b7c6d5e4f3a2b1c0d9e8f.mailgun.org` (your sandbox domain)
- **Subject**: `Computer won't turn on`
- **Body**: `Hi, I need help. My computer won't turn on when I press the power button.`

**Example addresses that work:**
```
support@sandbox123.mailgun.org
help@sandbox123.mailgun.org
test@sandbox123.mailgun.org
whatever@sandbox123.mailgun.org
```

**Send the email!**

#### Step 2: Check ngrok Logs

1. Open **http://127.0.0.1:4040** in browser
2. You should see:
   - **POST** request to `/api/webhooks/inbound-email`
   - **Status**: `200 OK`
   - **Timestamp**: Just now

**What to look for:**
```
POST /api/webhooks/inbound-email    200 OK
```

#### Step 3: Check Backend Console

Look at your backend terminal - you should see:
```
📧 Received inbound email webhook
📧 Sender: claytonmcgough@gmail.com
📧 Subject: Computer won't turn on
✅ Ticket #28 created from email
✅ Ticket confirmation email sent to claytonmcgough@gmail.com
```

#### Step 4: Check Your Email Inbox

You should receive a **confirmation email** within 30 seconds:

**Subject:** `✅ Ticket #TICK-2026-00028 Received: Computer won't turn on`

**Body:**
```
Hello,

Your support ticket has been received and assigned ticket number TICK-2026-00028.

Subject: Computer won't turn on
Priority: Low
Status: Open

Our team will review your request and respond shortly.

Best regards,
BlueClue Support Team
```

#### Step 5: Verify in Database

**PowerShell:**
```powershell
$env:PGPASSWORD="YourPassword"
psql -U postgres -d blueclue -c "SELECT id, ticket_number, subject, status, priority, created_at FROM tickets ORDER BY created_at DESC LIMIT 1;"
```

**Expected output:**
```
 id |  ticket_number  |       subject         | status | priority |         created_at
----+-----------------+-----------------------+--------+----------+----------------------------
 28 | TICK-2026-00028 | Computer won't turn on| open   | low      | 2026-02-22 18:42:26.969245
```

#### Step 6: Test Priority Detection (Optional)

Send another email with **urgent keywords**:

- **To**: `support@sandbox123.mailgun.org`
- **Subject**: `URGENT: System is DOWN!`
- **Body**: `This is CRITICAL - our entire system crashed and we need immediate help!`

**Check database:**
```powershell
psql -U postgres -d blueclue -c "SELECT id, subject, priority, ai_priority FROM tickets ORDER BY created_at DESC LIMIT 1;"
```

**Expected:** `ai_priority` should be `high` or `urgent` based on keywords.

---

### Troubleshooting Common Issues

#### ❌ "No webhook received" (ngrok shows no requests)

**Check**:
1. Is your Mailgun route expression using wildcard? → `match_recipient("*@sandbox123.mailgun.org")`
2. Did you send TO the sandbox domain? (not FROM it)
3. Is ngrok still running? Check `http://127.0.0.1:4040`
4. Is the forward URL in Mailgun route correct? (copy-paste from ngrok)

#### ❌ "Email sent but no confirmation received"

**Check**:
1. Is `NODE_ENV=production` in `.env`?
2. Is `EMAIL_PASS` your **app password** (not regular Gmail password)?
3. Check backend logs for error messages
4. Check spam folder

#### ❌ "Webhook signature invalid"

**Check**:
1. Is `MAILGUN_WEBHOOK_SIGNING_KEY` in `.env` exactly matching Mailgun dashboard?
2. Did you copy the **domain-level** key (not account-level)?
3. Restart backend after changing `.env`

#### ❌ "Ticket created but no email"

Your sender email might not be linked to a customer record:

**Quick fix:**
```sql
-- Find the ticket
SELECT * FROM tickets WHERE subject LIKE '%Computer%';

-- Check if customer exists
SELECT * FROM customers WHERE email = 'yoursemail@gmail.com';
```

The system should auto-create guest accounts, but verify customer record was created.

---

### What You Should Have Now

✅ **ngrok running** - Terminal shows "Forwarding https://abc123.ngrok-free.app -> http://localhost:3000"  
✅ **Backend running** - Terminal shows "Server is running on http://localhost:3000"  
✅ **Mailgun configured** - Route created with wildcard expression, webhook signing key in `.env`  
✅ **Test successful** - Email created ticket, confirmation sent, verified in database  

**Next steps:**
- Test with different priority keywords (urgent, critical, emergency)
- Test replying to confirmation email (thread tracking)
- Test from different email addresses
- Move to production with custom domain

---

## Backend Configuration

### Step 1: Update Environment Variables

Edit `blueclue/backend/.env`:

```env
# Add Mailgun webhook signing key (from Mailgun dashboard)
MAILGUN_WEBHOOK_SIGNING_KEY=key-1234567890abcdef

# Ensure these are configured for email confirmations
NODE_ENV=production  # Or development for testing
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
```

### Step 2: Restart Backend

```bash
cd blueclue/backend
node src/app.js
```

You should see:
```
Server is running on http://localhost:3000
WebSocket server is ready
```

### Step 3: Verify Webhook Endpoint

Test the webhook endpoint is accessible:

```bash
curl http://localhost:3000/api/webhooks/health
```

Expected response:
```json
{
  "status": "success",
  "message": "Webhook endpoint is operational",
  "endpoints": {
    "inbound_email": {
      "method": "POST",
      "path": "/api/webhooks/inbound-email"
    }
  }
}
```

---

## Testing

### Option 1: Test with Development Endpoint

Use the built-in test endpoint (development mode only):

```bash
curl -X POST http://localhost:3000/api/webhooks/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "test@example.com",
    "subject": "My printer is not working",
    "body": "I need help with my Canon printer. It shows paper jam error but there is no paper stuck."
  }'
```

Expected response:
```json
{
  "status": "success",
  "message": "Test email processed successfully",
  "data": {
    "ticket_id": 123,
    "user_id": 45,
    "is_new_user": true,
    "ai_classification": {
      "used": true,
      "category": "hardware",
      "priority": "medium",
      "confidence": 0.85
    }
  }
}
```

### Option 2: Test with Real Email

1. **Send email** to your configured support address (e.g., `support@yourdomain.com`)
2. **Check backend logs** for webhook processing:
   ```
   📧 Received inbound email webhook
   📧 Sender: user@example.com
   📧 Subject: Need help with login issue
   ✅ Ticket #124 created from email
   ```
3. **Verify in database**:
   ```sql
   SELECT * FROM tickets ORDER BY created_at DESC LIMIT 1;
   ```
4. **Check confirmation email** was sent to sender

### Option 3: Test with Mailgun Test Feature

1. Go to Mailgun dashboard > **Sending** > **Sending Domains**
2. Click your domain > **Send a Test Email**
3. Fill in:
   - **From**: `support@yourdomain.com`
   - **To**: `support@yourdomain.com` (or your configured address)
   - **Subject**: `Test support ticket`
   - **Body**: `This is a test email for ticket creation`
4. Click **Send**
5. Check backend logs and database

---

## Troubleshooting

### Issue: Webhook not receiving emails

**Possible causes:**
1. **DNS not propagated** - Wait 24-48 hours for DNS changes
2. **Wrong webhook URL** - Verify URL in Mailgun route configuration
3. **Firewall blocking** - Ensure webhook endpoint is publicly accessible
4. **Route not matching** - Check recipient expression in Mailgun route

**Debug steps:**
```bash
# Check webhook endpoint is accessible
curl https://your-backend-url.com/api/webhooks/health

# Check Mailgun logs (dashboard > Logs)
# Look for delivery failures or webhook errors
```

### Issue: Signature validation failing

**Error:** `Invalid webhook signature`

**Solutions:**
1. **Check signing key** - Ensure `MAILGUN_WEBHOOK_SIGNING_KEY` in `.env` matches Mailgun dashboard
2. **Development mode** - Set `NODE_ENV=development` to skip validation temporarily
3. **Clock skew** - Ensure server time is accurate (webhooks expire after 5 minutes)

### Issue: Ticket not created

**Check backend logs:**
```
📧 Processing inbound email to create ticket...
❌ Error creating ticket from email: [error message]
```

**Common errors:**
- `Cannot determine sender email address` - Email missing sender field
- `Email must have both subject and body` - Empty email content
- Database errors - Check database connection and user creation

### Issue: Confirmation email not sent

**Check environment variables:**
```bash
# Ensure email is configured in .env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
NODE_ENV=production  # Must be production to send emails
```

**Check logs:**
```
✅ Ticket confirmation email sent to user@example.com
# Or:
Failed to send confirmation email: [error details]
```

---

## Production Considerations

### 1. Use Custom Domain

- **Don't use sandbox** - Sandbox domains are limited to authorized recipients
- **Configure SPF/DKIM** - Improves deliverability and prevents spam classification
- **Test thoroughly** - Send test emails from various providers (Gmail, Outlook, etc.)

### 2. Security

- **Always use HTTPS** - HTTP webhooks can be intercepted
- **Validate signatures** - Never skip signature validation in production
- **Rate limiting** - Built-in protection against abuse (10 requests/minute/sender)
- **Monitor logs** - Watch for suspicious activity or spam

### 3. User Management

- **Auto-created users** - Emails from unknown addresses create guest accounts
- **Guest account policy** - Consider requiring email verification before enabling full access
- **Password resets** - New users need password reset link to access portal
- **Notification preferences** - Auto-created users get emails by default

### 4. Email Parsing

- **HTML vs Plain Text** - System handles both automatically
- **Signature removal** - Common signatures ("Sent from my iPhone") are stripped
- **Quoted replies** - Previous email threads are removed
- **Attachments** - Currently not processed (feature can be added)

### 5. Monitoring

Monitor these metrics:
- **Email reception rate** - Emails received vs tickets created
- **Parse failures** - Emails that couldn't be processed
- **AI classification accuracy** - Review AI-assigned categories/priorities
- **User satisfaction** - Follow up on auto-created tickets

---

## Advanced Features (Optional)

### Auto-Assignment by Category

Modify `inboundEmailService.js` to auto-assign tickets:

```javascript
// After creating ticket, auto-assign to technician
if (ticket.category === 'hardware') {
    const technician = await findAvailableTechnician('hardware');
    await assignTicketToTechnician(ticket.id, technician.id);
}
```

### Attachment Processing

Mailgun provides attachment URLs in webhook data:

```javascript
// In extractEmailContent function:
if (emailData.attachments) {
    const attachments = JSON.parse(emailData.attachments);
    // Download and store attachments
}
```

### Email Thread Tracking

Track email conversations:

```javascript
// Check In-Reply-To or References headers
const inReplyTo = emailData['In-Reply-To'];
if (inReplyTo) {
    // Find original ticket and add comment instead of creating new ticket
}
```

### Priority Keywords

Enhance AI classification with urgency keywords:

```javascript
const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately'];
if (urgentKeywords.some(keyword => subject.toLowerCase().includes(keyword))) {
    priority = 'high';
}
```

---

## Summary

✅ **Mailgun setup** - Account created, sandbox domain configured, authorized recipient verified  
✅ **ngrok tunnel** - Public HTTPS endpoint established for local development  
✅ **DNS records** - Not needed for sandbox (required for custom domain only)  
✅ **Webhook configured** - Route created with wildcard expression, signing key saved  
✅ **Backend updated** - Environment variables set, production mode enabled, server running  
✅ **Testing complete** - Emails create tickets successfully, confirmations sent, priority detection working  

**What was tested in practice:**
- ✅ Basic email-to-ticket creation (Ticket #28: "Computer won't turn on")
- ✅ Confirmation email delivery to sender
- ✅ Priority detection with urgent keywords
- ✅ Webhook signature validation
- ✅ Database ticket creation and verification

Your email-to-ticket feature is now live! Users can submit support tickets by sending emails to your sandbox address (or custom domain if configured).

---

## Quick Reference

### Webhook Endpoints

- **Health Check**: `GET /api/webhooks/health`
- **Inbound Email**: `POST /api/webhooks/inbound-email`
- **Test Endpoint**: `POST /api/webhooks/test-email` (dev only)

### Environment Variables

```env
MAILGUN_WEBHOOK_SIGNING_KEY=key-from-mailgun-dashboard
NODE_ENV=production
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Mailgun Dashboard Links

- **Domains**: https://app.mailgun.com/app/sending/domains
- **Routes**: https://app.mailgun.com/app/routes
- **Webhooks**: https://app.mailgun.com/app/account/security
- **Logs**: https://app.mailgun.com/app/logs

### Support

For issues or questions:
- Check logs: `tail -f blueclue/backend/logs/app.log`
- Mailgun docs: https://documentation.mailgun.com
- Mailgun support: https://help.mailgun.com

---

**Implementation Date**: February 22, 2026  
**Feature Status**: ✅ Production Ready  
**Tested By**: BlueClue Development Team
