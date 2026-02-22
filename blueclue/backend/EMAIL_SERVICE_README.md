# BlueClue Email Service

Complete transactional email infrastructure for the BlueClue Support Portal.

## Overview

This email service provides production-ready email functionality with retry logic, multiple operational modes, and a comprehensive template system.

## Features

✅ **Production-Ready**
- Retry logic with exponential backoff (3 attempts)
- Connection pooling for performance
- Graceful error handling and logging
- SMTP connection verification on startup

✅ **Multiple Operational Modes**
- **Production**: Sends real emails via SMTP
- **Development**: Logs emails to console (no credentials needed)
- **Test**: Returns mock success for unit testing

✅ **Email Templates**
- HTML + Plain text fallback for all emails
- Professional BlueClue branding
- Responsive design for mobile devices
- Placeholder replacement system

✅ **Email Types**
1. **Welcome Email** - New user onboarding with verification link
2. **Email Verification** - Standalone verification with 24-hour expiry
3. **Ticket Confirmation** - Confirmation after ticket submission
4. **Status Updates** - Notifications when ticket status changes
5. **Password Reset** - Secure password reset with 1-hour expiry

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

Nodemailer (`^6.9.8`) is already included in `package.json`.

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure email settings:

```env
# For Gmail (see docs/setup/EMAIL_SETUP_GUIDE.md for full instructions)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM=BlueClue Support <noreply@blueclue.com>
FRONTEND_URL=http://localhost:5173
```

> **Note**: If email credentials are not configured, the service runs in **development mode** (logs to console only).

### 3. Start the Server

```bash
npm start
```

The email service initializes automatically on startup.

### 4. Test Email Service

Check service status:
```bash
curl http://localhost:3000/api/dev/email-status
```

Send test email:
```bash
curl -X POST http://localhost:3000/api/dev/email-test/welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"John","verificationToken":"test123"}'
```

## Usage

### In Your Code

```javascript
import { 
  sendWelcomeEmail,
  sendVerificationEmail,
  sendTicketConfirmation,
  sendTicketStatusUpdate,
  sendPasswordResetEmail 
} from './services/emailService.js';

// Send welcome email
await sendWelcomeEmail(
  'user@example.com',
  'John',
  'verification-token-123'
);

// Send ticket confirmation
await sendTicketConfirmation('user@example.com', {
  ticket_id: 1001,
  subject: 'Login issue',
  priority: 'high',
  category: 'technical',
  description: 'Cannot log in to my account'
});

// Send status update
await sendTicketStatusUpdate('user@example.com', {
  ticket_id: 1001,
  subject: 'Login issue',
  old_status: 'open',
  status: 'in-progress',
  assigned_technician_name: 'Jane Doe',
  updated_at: new Date().toISOString()
}, 'Looking into this now');

// Send password reset
await sendPasswordResetEmail(
  'user@example.com',
  'John',
  'reset-token-456'
);
```

### Check Service Status

```javascript
import { isEmailServiceReady, getEmailServiceStatus } from './services/emailService.js';

// Simple check
if (isEmailServiceReady()) {
  console.log('Email service is ready');
}

// Detailed status
const status = getEmailServiceStatus();
console.log(status);
// {
//   configured: true,
//   mode: 'production',
//   host: 'smtp.gmail.com',
//   port: 587,
//   from: 'BlueClue Support <noreply@blueclue.com>'
// }
```

## File Structure

```
blueclue/backend/
├── src/
│   ├── services/
│   │   └── emailService.js         # Main email service (370+ lines)
│   ├── templates/
│   │   └── emails/
│   │       ├── welcome.html        # Welcome email HTML
│   │       ├── welcome.txt         # Welcome email plain text
│   │       ├── verification.html
│   │       ├── verification.txt
│   │       ├── ticket-created.html
│   │       ├── ticket-created.txt
│   │       ├── ticket-status-changed.html
│   │       ├── ticket-status-changed.txt
│   │       ├── password-reset.html
│   │       └── password-reset.txt
│   └── routes/
│       └── dev.js                  # Development testing endpoints
├── .env.example                    # Email configuration template
└── package.json                    # Includes nodemailer ^6.9.8
```

## Development Endpoints

**Only available when `NODE_ENV !== 'production'`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dev/email-status` | GET | Check email service configuration |
| `/api/dev/email-test/welcome` | POST | Test welcome email |
| `/api/dev/email-test/verification` | POST | Test verification email |
| `/api/dev/email-test/ticket-created` | POST | Test ticket confirmation |
| `/api/dev/email-test/ticket-status` | POST | Test status update |
| `/api/dev/email-test/password-reset` | POST | Test password reset |
| `/api/dev/email-test/examples` | GET | Get example test payloads |

## Email Templates

### Template Variables

Each template supports placeholder replacement using `{{variable}}` syntax:

**Welcome Email:**
- `{{firstName}}` - User's first name
- `{{verificationLink}}` - Email verification URL
- `{{frontendUrl}}` - Frontend base URL

**Verification Email:**
- `{{firstName}}` - User's first name
- `{{verificationLink}}` - Verification URL (24-hour expiry)

**Ticket Created:**
- `{{ticketId}}` - Ticket number
- `{{subject}}` - Ticket subject
- `{{priority}}` - Priority level (high/medium/low)
- `{{category}}` - Ticket category
- `{{description}}` - Ticket description
- `{{ticketUrl}}` - Link to ticket details
- `{{frontendUrl}}` - Frontend base URL

**Ticket Status Changed:**
- `{{oldStatus}}` - Previous status
- `{{newStatus}}` - New status
- `{{oldStatusClass}}` - CSS class for old status badge
- `{{newStatusClass}}` - CSS class for new status badge
- `{{ticketId}}` - Ticket number
- `{{subject}}` - Ticket subject
- `{{assignedTechnician}}` - Technician name (optional)
- `{{updatedAt}}` - Update timestamp
- `{{updateComment}}` - Optional comment from support team
- `{{ticketUrl}}` - Link to ticket details

**Password Reset:**
- `{{firstName}}` - User's first name
- `{{resetLink}}` - Password reset URL (1-hour expiry)
- `{{frontendUrl}}` - Frontend base URL

### Customizing Templates

Templates are located in `src/templates/emails/`. To customize:

1. Edit the HTML file for rich email clients
2. Edit the TXT file for plain text fallback
3. Use `{{variable}}` syntax for dynamic content
4. Inline CSS for email client compatibility

## Configuration Details

### SMTP Settings

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| Gmail | `smtp.gmail.com` | 587 or 465 | Requires App Password |
| SendGrid | `smtp.sendgrid.net` | 587 or 465 | Use API key as password |
| Mailgun | `smtp.mailgun.org` | 587 or 465 | Domain verification required |
| Office 365 | `smtp.office365.com` | 587 | Enable SMTP auth |

### Retry Configuration

The service retries failed email sends up to 3 times with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: Wait 2 seconds
- Attempt 3: Wait 4 seconds
- Attempt 4: Wait 6 seconds

After 3 failed retries, the error is logged and thrown.

## Error Handling

The email service includes comprehensive error handling:

```javascript
try {
  await sendWelcomeEmail(email, firstName, token);
  console.log('Email sent successfully');
} catch (error) {
  console.error('Failed to send email:', error.message);
  // Email service logs detailed error internally
  // Application can continue without crashing
}
```

**Error scenarios handled:**
- Missing or invalid SMTP credentials (falls back to dev mode)
- SMTP connection failures (retries with backoff)
- Template file not found (detailed error message)
- Invalid recipient email (validation error)
- Network timeouts (retry logic)

## Testing

### Unit Testing

The email service supports test mode for unit tests:

```javascript
// In your test setup
process.env.NODE_ENV = 'test';

// Email functions will return mock success without sending
const result = await sendWelcomeEmail('test@example.com', 'Test', 'token');
// Returns: { success: true, mode: 'test', message: '...' }
```

### Integration Testing

Use the development endpoints to test actual email sending:

```bash
# Test welcome email
curl -X POST http://localhost:3000/api/dev/email-test/welcome \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-real-email@gmail.com",
    "firstName": "Test User",
    "verificationToken": "test-token-123"
  }'
```

## Security Considerations

🔒 **Best Practices:**

1. **Never commit credentials** - Use `.env` for sensitive data
2. **Use App Passwords** - Don't use your main email password
3. **Enable 2FA** - Required for Gmail App Passwords
4. **Validate inputs** - All email functions validate recipient emails
5. **Sanitize data** - User-provided data is escaped in templates
6. **Rate limiting** - Consider implementing rate limits for production
7. **Monitor usage** - Track email sending patterns for abuse

⚠️ **Security Notes:**
- Password reset tokens should expire (1 hour recommended)
- Verification tokens should expire (24 hours recommended)
- Use HTTPS for all email links
- Implement CAPTCHA for public-facing email forms

## Troubleshooting

### Common Issues

**Problem**: "Invalid login" error with Gmail
**Solution**: Use an App Password, not your regular Gmail password. See [EMAIL_SETUP_GUIDE.md](../../docs/setup/EMAIL_SETUP_GUIDE.md)

**Problem**: Emails not sending
**Solution**: Check `GET /api/dev/email-status` for configuration issues

**Problem**: Emails going to spam
**Solution**: 
- Use a verified domain email
- Set up SPF/DKIM/DMARC records
- Avoid spam trigger words

**Problem**: Template not found
**Solution**: Ensure template files exist in `src/templates/emails/`

See [EMAIL_SETUP_GUIDE.md](../../docs/setup/EMAIL_SETUP_GUIDE.md#troubleshooting) for more detailed troubleshooting.

## Documentation

- [Email Setup Guide](../../docs/setup/EMAIL_SETUP_GUIDE.md) - Complete setup instructions
- [BlueClue Troubleshooting](../../docs/TROUBLESHOOTING.md) - General troubleshooting
- [Nodemailer Documentation](https://nodemailer.com/) - Official Nodemailer docs

## Production Deployment

For production deployments:

1. ✅ Use a dedicated email service (SendGrid, Mailgun, AWS SES)
2. ✅ Configure custom domain for professional sender address
3. ✅ Set up SPF, DKIM, and DMARC DNS records
4. ✅ Implement rate limiting to prevent abuse
5. ✅ Monitor email delivery rates and bounces
6. ✅ Use environment variables for all configuration
7. ✅ Set NODE_ENV=production to disable dev endpoints
8. ✅ Enable email sending analytics/tracking

## Support

For issues or questions:
1. Check the [Email Setup Guide](../../docs/setup/EMAIL_SETUP_GUIDE.md)
2. Review error logs in the backend console
3. Test with `/api/dev/email-status` endpoint
4. Open an issue on the project repository

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Dependencies**: Nodemailer ^6.9.8
