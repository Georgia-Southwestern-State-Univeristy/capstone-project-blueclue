# Email Service Setup Guide

This guide explains how to configure the email service for the BlueClue backend application.

## Table of Contents
- [Overview](#overview)
- [Gmail Setup (Recommended)](#gmail-setup-recommended)
- [Alternative Email Providers](#alternative-email-providers)
- [Environment Configuration](#environment-configuration)
- [Testing Email Service](#testing-email-service)
- [Troubleshooting](#troubleshooting)

---

## Overview

BlueClue uses **Nodemailer** to send transactional emails for:
- ✉️ Welcome emails with account verification
- 🔐 Email address verification
- 📧 Ticket submission confirmations
- 🔄 Ticket status update notifications
- 🔑 Password reset emails

The email service has three operational modes:
- **Production**: Sends real emails via SMTP
- **Development**: Logs email content to console (no actual sending)
- **Test**: Returns mock success without sending

---

## Gmail Setup (Recommended)

### Prerequisites
- A Gmail account
- Two-factor authentication (2FA) enabled

### Step-by-Step Instructions

#### 1. Enable Two-Factor Authentication (2FA)

If you haven't already enabled 2FA:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", select **2-Step Verification**
3. Follow the prompts to set up 2FA using your phone

> **Note**: App Passwords are only available for accounts with 2FA enabled.

#### 2. Generate an App Password

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to **Security** > **2-Step Verification**
3. Scroll down to **App passwords** section
4. Click **App passwords** (you may need to sign in again)
5. In the "Select app" dropdown, choose **Mail**
6. In the "Select device" dropdown, choose **Other (Custom name)**
7. Enter a name like `BlueClue Backend` or `BlueClue Dev`
8. Click **Generate**
9. **Important**: Copy the 16-character password shown (e.g., `abcd efgh ijkl mnop`)
   - Remove spaces when entering into `.env`: `abcdefghijklmnop`
   - You won't be able to see this password again!

#### 3. Update Environment Variables

Open or create `blueclue/backend/.env` and add:

```env
# Email Service Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=abcdefghijklmnop
EMAIL_FROM=BlueClue Support <noreply@blueclue.com>
FRONTEND_URL=http://localhost:5173
```

**Configuration details:**
- `EMAIL_HOST`: Gmail's SMTP server
- `EMAIL_PORT`: Use `587` (TLS) or `465` (SSL)
- `EMAIL_USER`: Your full Gmail address
- `EMAIL_PASS`: The 16-character App Password (no spaces)
- `EMAIL_FROM`: Display name and email for sent messages
- `FRONTEND_URL`: Used for generating links in emails

#### 4. Restart the Backend Server

```powershell
# Stop the current server (Ctrl+C)
# Then restart
npm start
```

#### 5. Verify Setup

Check email service status:
```powershell
curl http://localhost:3000/api/dev/email-status
```

Expected response:
```json
{
  "ready": true,
  "configured": true,
  "mode": "production",
  "message": "Email service is configured and ready"
}
```

---

## Alternative Email Providers

### SendGrid

SendGrid is a reliable alternative for production environments.

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key in Settings > API Keys
3. Update `.env`:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.your_sendgrid_api_key_here
EMAIL_FROM=BlueClue Support <noreply@yourdomain.com>
```

### Mailgun

1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Get SMTP credentials from Dashboard > Sending > Domain Settings
3. Update `.env`:

```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@yourdomain.mailgun.org
EMAIL_PASS=your_mailgun_password
EMAIL_FROM=BlueClue Support <noreply@yourdomain.com>
```

### Microsoft 365 / Outlook

1. Enable SMTP authentication in your Microsoft 365 admin center
2. Update `.env`:

```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASS=your_password_or_app_password
EMAIL_FROM=BlueClue Support <your-email@yourdomain.com>
```

---

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP server port (587 or 465) | `587` |
| `EMAIL_USER` | SMTP username/email | `user@gmail.com` |
| `EMAIL_PASS` | SMTP password/app password | `abcdefghijklmnop` |
| `EMAIL_FROM` | Sender email for outgoing mail | `BlueClue <noreply@blueclue.com>` |
| `FRONTEND_URL` | Frontend base URL for links | `http://localhost:5173` |

### Optional Configuration

If email credentials are **not configured**, the service automatically runs in **development mode**:
- Emails are logged to the console
- No actual emails are sent
- Useful for local development

---

## Testing Email Service

### Development Endpoints

BlueClue includes development endpoints for testing email functionality (only available when `NODE_ENV !== production`).

#### Check Email Service Status

```bash
GET http://localhost:3000/api/dev/email-status
```

#### Test Welcome Email

```bash
POST http://localhost:3000/api/dev/email-test/welcome
Content-Type: application/json

{
  "email": "test@example.com",
  "firstName": "John",
  "verificationToken": "test-token-123"
}
```

#### Test Ticket Creation Email

```bash
POST http://localhost:3000/api/dev/email-test/ticket-created
Content-Type: application/json

{
  "email": "test@example.com",
  "ticketId": 1001,
  "subject": "Test Ticket",
  "priority": "high",
  "category": "technical",
  "description": "This is a test ticket"
}
```

#### Get All Test Examples

```bash
GET http://localhost:3000/api/dev/email-test/examples
```

This returns example payloads for all email types.

### Testing with Postman

1. Import the BlueClue API collection
2. Create a new request:
   - Method: `POST`
   - URL: `http://localhost:3000/api/dev/email-test/welcome`
   - Body (raw JSON):
     ```json
     {
       "email": "your-email@gmail.com",
       "firstName": "Test User",
       "verificationToken": "abc123"
     }
     ```
3. Send the request
4. Check your email inbox or console logs

### End-to-End Testing Workflow

Test the complete email notification system through the frontend application:

#### 1. Register & Verify Account (Part 3 - Email Verification)

1. Navigate to the frontend registration page
2. Register a new customer account using your email (e.g., `claytonmcgough@gmail.com`)
3. Check your email inbox for the **verification email**
4. Click the verification link to activate your account
5. You'll be redirected back to login with a success message

**Expected Email**: "Verify Your Email - BlueClue" with a magic link valid for 24 hours

#### 2. Submit Support Ticket (Part 4 - Ticket Confirmation)

1. Log in with your verified customer account
2. Navigate to the Customer Portal
3. Submit a new support ticket with:
   - Subject
   - Description
   - Priority
   - Category
4. Check your email inbox for the **ticket confirmation email**

**Expected Email**: "Ticket #[ID] Submitted - BlueClue Support" with ticket details

#### 3. Change Ticket Status (Part 4 - Status Update Notification)

1. Log in as an admin or technician account
2. Navigate to the Technician Dashboard
3. Select the ticket you created
4. Change the status (e.g., from "open" to "in-progress")
5. Check the customer's email inbox for the **status update email**

**Expected Email**: "Ticket #[ID] Status Update - BlueClue Support" showing old and new status

#### 4. Assign Ticket to Technician (Part 4 - Assignment Notification)

1. As an admin, open a ticket
2. Assign the ticket to a technician user
3. Check the technician's email inbox for the **assignment notification**

**Expected Email**: "Ticket #[ID] Assigned to You - BlueClue Support" with full ticket details

#### Backend Console Verification

When emails are sent successfully, you'll see console output:
```
✅ Ticket confirmation email sent to user@example.com
✅ Status update email sent to user@example.com
✅ Assignment notification sent to tech@example.com
```

If email sending fails (non-fatal):
```
Failed to send ticket confirmation email: [error message]
```

**Note**: Email failures don't break the application - tickets are still created, statuses still update, and assignments still work. Email errors are logged for debugging.

#### Email Notification Preferences

All users have email notifications enabled by default (`email_notifications = true`). To disable for specific users:

```sql
-- Disable email notifications for a user
UPDATE users SET email_notifications = false WHERE email = 'user@example.com';

-- Re-enable email notifications
UPDATE users SET email_notifications = true WHERE email = 'user@example.com';
```

Users with notifications disabled will not receive any ticket-related emails.

---

## Troubleshooting

### Problem: "Error: Invalid login"

**Cause**: Incorrect Gmail credentials or App Password not used.

**Solution**:
1. Verify you're using an **App Password**, not your regular Gmail password
2. Remove spaces from the App Password (should be 16 characters)
3. Double-check `EMAIL_USER` matches the Gmail account that generated the App Password

### Problem: "Self signed certificate in certificate chain"

**Cause**: SSL certificate verification issues.

**Solution**: Add to `emailService.js` transporter config:
```javascript
tls: {
  rejectUnauthorized: false
}
```

⚠️ **Warning**: Only use this in development, not production.

### Problem: "Connection timeout"

**Possible causes**:
- Firewall blocking SMTP ports
- Incorrect host or port
- Network restrictions

**Solutions**:
1. Try port `465` instead of `587`:
   ```env
   EMAIL_PORT=465
   ```
2. Check firewall settings
3. Test SMTP connection using `telnet`:
   ```bash
   telnet smtp.gmail.com 587
   ```

### Problem: Emails going to spam

**Solutions**:
- Use a verified domain email address
- Set up SPF, DKIM, and DMARC records for your domain
- Avoid spam trigger words in subject lines
- Keep email content professional and relevant

### Problem: Email service not starting

**Check logs** for specific error messages:
```powershell
npm start
```

Look for lines starting with `[EmailService]` for diagnostic information.

---

## Security Best Practices

✅ **DO:**
- Use App Passwords for Gmail (never your main password)
- Store credentials in `.env` file (never commit to Git)
- Use environment variables in production
- Enable 2FA on email accounts
- Rotate App Passwords periodically
- Use dedicated email accounts for automated sending

❌ **DON'T:**
- Commit `.env` files to version control
- Share App Passwords
- Use personal email for production
- Disable TLS/SSL in production
- Log email passwords in application logs

---

## Production Deployment

For production environments:

1. **Use a dedicated email service** (SendGrid, Mailgun, AWS SES)
2. **Configure a custom domain** for professional sender addresses
3. **Set up DNS records** (SPF, DKIM, DMARC) for email authentication
4. **Monitor email delivery** and bounces
5. **Implement rate limiting** to prevent abuse
6. **Use environment variables** for all sensitive configuration

Example production `.env`:
```env
NODE_ENV=production
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=${SENDGRID_API_KEY}
EMAIL_FROM=BlueClue Support <support@yourdomain.com>
FRONTEND_URL=https://blueclue.yourdomain.com
```

---

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Password Help](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP Documentation](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [Email Best Practices](https://postmarkapp.com/guides/email-best-practices)

---

## Support

If you encounter issues not covered in this guide:

1. Check the backend console logs for detailed error messages
2. Test with `GET /api/dev/email-status` to verify configuration
3. Review the [BlueClue Troubleshooting Guide](../TROUBLESHOOTING.md)
4. Open an issue on the project repository

---

**Last Updated**: January 2026  
**BlueClue Version**: 1.0.0
