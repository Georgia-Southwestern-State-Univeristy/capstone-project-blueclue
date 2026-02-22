# BlueClue Email System - User Guide

## Table of Contents
1. [Email Verification](#email-verification)
2. [Email Notifications](#email-notifications)
3. [Managing Preferences](#managing-preferences)
4. [Troubleshooting](#troubleshooting)

---

## Email Verification

### What is Email Verification?

When you create a new BlueClue account, we send a verification email to confirm your email address. This helps protect your account and ensures we can communicate important updates about your support tickets.

### How to Verify Your Email

#### Step 1: Register Your Account
1. Go to the BlueClue registration page
2. Fill in your details (name, email, password)
3. Click "Register"
4. You'll be redirected to the login page with a message

#### Step 2: Check Your Email
1. Open your email inbox
2. Look for an email from **BlueClue Support**
3. Subject: "Verify Your Email Address - BlueClue"
4. If you don't see it, check your **Spam/Junk** folder

#### Step 3: Click the Verification Link
1. Open the verification email
2. Click the blue **"Verify Email Address"** button
3. You'll be redirected to BlueClue
4. You'll see a success message with a countdown
5. You'll automatically be redirected to the login page

#### Step 4: Log In
1. Enter your email and password
2. Click "Log In"
3. You're now verified and can use BlueClue!

### Verification Link Expired?

Verification links expire after **24 hours** for security. If your link expired:

#### Option 1: From the Verification Page
1. Click "Resend Verification Email"
2. Enter your email address
3. Click "Send New Verification Email"
4. Check your inbox for a new verification email

#### Option 2: From the Login Page
1. Try to log in with your email and password
2. You'll see an error: "Please verify your email address"
3. Click the **"Resend Verification Email"** button
4. Check your inbox for a new verification email

**Rate Limit:** You can request up to **3 verification emails per hour** to prevent spam.

---

## Email Notifications

### What Email Notifications Will I Receive?

BlueClue sends automatic email notifications to keep you informed about your support tickets.

#### For Customers:
1. **Ticket Confirmation** 
   - Sent immediately when you create a new ticket
   - Contains your ticket ID, subject, description, and priority

2. **Status Updates**
   - Sent when your ticket status changes
   - Examples: Open → In Progress, In Progress → Resolved
   - Shows old status and new status

#### For Technicians:
1. **Ticket Assignment**
   - Sent when a ticket is assigned to you
   - Contains all ticket details and requester information
   - Direct link to your dashboard

### Email Notification Examples

#### Ticket Confirmation Email
```
Subject: Ticket #123 Submitted - BlueClue Support

Hi John,

Your support ticket has been successfully submitted.

Ticket Details:
- Ticket ID: #123
- Subject: Computer won't turn on
- Priority: High
- Category: Hardware
- Status: Open

Our team will review your ticket and respond as soon as possible.

[View Ticket] (button linking to ticket details)
```

#### Status Update Email
```
Subject: Ticket #123 Status Update - BlueClue Support

Hi John,

Your support ticket status has been updated.

Ticket #123: Computer won't turn on
Status Changed: Open → In Progress

A technician is now working on your issue.

[View Ticket] (button linking to ticket details)
```

#### Ticket Assignment Email (Technician)
```
Subject: Ticket #123 Assigned to You - BlueClue Support

Hi Mary,

A new support ticket has been assigned to you.

Ticket Details:
- Ticket ID: #123
- Subject: Computer won't turn on
- Priority: High
- Category: Hardware
- Status: Open
- Requested by: John Doe
- Created: Jan 15, 2026 10:30 AM

[Go to Dashboard] (button linking to technician dashboard)
```

---

## Managing Preferences

### Turning Email Notifications On/Off

**Note:** Currently, email preferences can only be managed by administrators through the database. A user interface for managing preferences is coming soon!

#### Check Your Current Preference
Ask an administrator to run:
```sql
SELECT email, email_notifications 
FROM users 
WHERE email = 'your-email@example.com';
```

#### Disable Email Notifications
Ask an administrator to run:
```sql
UPDATE users 
SET email_notifications = false 
WHERE email = 'your-email@example.com';
```

#### Enable Email Notifications
Ask an administrator to run:
```sql
UPDATE users 
SET email_notifications = true 
WHERE email = 'your-email@example.com';
```

**Important:**
- Verification emails are **always sent** (cannot be disabled)
- Ticket notification preferences only affect ticket-related emails
- You will still see in-system notifications even if email notifications are off

---

## Troubleshooting

### I didn't receive the verification email

**Possible causes and solutions:**

1. **Check your Spam/Junk folder**
   - Gmail, Outlook, and other email providers sometimes filter automated emails
   - If you find it in spam, mark it as "Not Spam"

2. **Wait a few minutes**
   - Email delivery can take 1-5 minutes
   - Check your inbox again after waiting

3. **Verify your email address**
   - Make sure you entered the correct email when registering
   - Check for typos

4. **Request a new verification email**
   - Use the "Resend Verification Email" button on the login page
   - Or use the resend link on the verification expired page

5. **Check email server status**
   - If the issue persists, contact support
   - Our email service may be experiencing issues

### The verification link doesn't work

**Solution:**

1. **Link expired (after 24 hours)**
   - Request a new verification email
   - Complete verification within 24 hours

2. **Link already used**
   - If you already verified your email, try logging in
   - You may see a message saying "Email already verified"

3. **Malformed link**
   - Make sure you copied the entire URL
   - Try clicking the button in the email instead of copying the link
   - Some email clients break long URLs across multiple lines

### I'm not receiving ticket notification emails

**Check these common issues:**

1. **Email notifications are disabled**
   - Ask an administrator to check your `email_notifications` preference
   - Enable notifications if they're turned off

2. **Check spam folder**
   - Ticket notifications might be filtered
   - Add BlueClue Support to your email contacts

3. **Email address is incorrect**
   - Verify your account email is correct
   - Contact an administrator to update if needed

4. **System email service is down**
   - Check with other users if they're receiving emails
   - Contact support if there's a system-wide issue

### I want to change my email address

**Steps:**

1. Contact an administrator
2. Request an email address change
3. Administrator will update your account
4. You'll need to verify the new email address

**Note:** Self-service email change functionality is coming in a future update!

### Email contains broken links

**Possible causes:**

1. **Very old email**
   - The application URL may have changed
   - Manually navigate to BlueClue and find your ticket by ID

2. **Email client issue**
   - Some email clients don't handle HTML emails well
   - Try viewing the email in a different client or browser

3. **Local development environment**
   - If you're a developer, ensure `FRONTEND_URL` is correctly set in `.env`

### Emails look strange or unformatted

**Possible causes:**

1. **Text-only email client**
   - Some email clients only show plain text
   - All BlueClue emails include a plain text version

2. **Images blocked**
   - Some clients block images by default
   - Click "Show Images" or "Display Images" in your email

3. **Old email client**
   - Consider upgrading to a modern email client
   - Or access BlueClue directly for ticket updates

---

## Additional Help

### Contact Support

If you're still experiencing issues with emails:

1. **In-system support:**
   - Create a support ticket describing the email issue
   - Include: your email address, issue description, timestamps

2. **Administrator contact:**
   - Contact your BlueClue administrator
   - Provide your user ID or email address

### Frequently Asked Questions

**Q: How long does it take to receive an email?**  
A: Usually within 1-2 minutes. Maximum 5 minutes during high traffic.

**Q: Can I use multiple email addresses?**  
A: No, each account is tied to one email address. Contact an admin to change it.

**Q: Will I get spammed with emails?**  
A: No, you only receive emails for:
- Account verification (once)
- Welcome message (once)
- Ticket confirmations (when you create tickets)
- Status updates (only for your own tickets)
- Assignments (technicians only)

**Q: How do I unsubscribe from all emails?**  
A: Contact an administrator to disable your `email_notifications` preference. Note: Verification emails cannot be disabled.

**Q: Are my ticket details secure in emails?**  
A: Yes, emails are sent over encrypted connections (TLS). However:
- Avoid putting passwords in ticket descriptions
- Sensitive tickets should be discussed via secure channels
- Email is not end-to-end encrypted

**Q: Can I reply to notification emails?**  
A: No, BlueClue emails are sent from a no-reply address. To respond:
- Log in to BlueClue
- Add comments to the ticket directly
- Use the in-system messaging features

---

## Version History

- **v1.0** - Initial email system
  - Account verification
  - Ticket notifications
  - Preference management

---

*Last updated: February 2026*  
*BlueClue Support System*
