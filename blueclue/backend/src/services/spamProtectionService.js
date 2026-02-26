/**
 * Spam Protection & Security Service
 * Part 5 of Email-to-Ticket Implementation
 * Updated in Part 6 with allowlist and test mode support
 * 
 * Provides comprehensive spam filtering, rate limiting, domain validation,
 * content filtering, verification challenges, and security monitoring.
 */

import pool from '../config/database.js';
import crypto from 'crypto';
import { sendEmail } from './emailService.js';
import { isAllowlisted, incrementAllowlistCount, getSystemSetting } from './adminService.js';

// Configuration constants
const RATE_LIMIT_MAX_TICKETS_PER_DAY = 10;
const SPAM_SCORE_THRESHOLD = 50; // Block if score >= 50
const VERIFICATION_CHALLENGE_THRESHOLD = 30; // Require verification if score >= 30
const CHALLENGE_EXPIRY_HOURS = 24;
const MAX_EMAIL_BODY_SIZE = 500000; // 500KB
const MAX_SUBJECT_LENGTH = 500;

/**
 * Main spam check function - orchestrates all spam protection checks
 * @param {Object} emailData - Parsed email data
 * @returns {Object} { allowed: boolean, reason: string, spamScore: number, requiresVerification: boolean }
 */
async function checkSpamProtection(emailData) {
  // Extract sender email and handle various formats:
  // - "John Doe <john@example.com>" -> "john@example.com"
  // - "john@example.com" -> "john@example.com"
  let senderEmail = emailData.from?.toLowerCase() || emailData.sender?.toLowerCase();
  
  // Extract email from format: "Name <email@domain.com>"
  const emailMatch = senderEmail?.match(/<(.+?)>/);
  if (emailMatch) {
    senderEmail = emailMatch[1].toLowerCase();
  }
  
  const senderDomain = senderEmail?.split('@')[1];
  
  console.log(`[Spam Protection] Checking email from: ${senderEmail}`);
  
  const result = {
    allowed: true,
    blocked: false,
    reason: '',
    spamScore: 0,
    requiresVerification: false,
    triggeredFilters: [],
    spfResult: 'none',
    dkimResult: 'none'
  };

  try {
    // Part 6: Check test mode and allowlist FIRST
    const testModeEnabled = await getSystemSetting('email_test_mode');
    const domainIsAllowlisted = await isAllowlisted(senderDomain);

    // If test mode is enabled, ONLY allow emails from allowlisted domains
    if (testModeEnabled && !domainIsAllowlisted) {
      result.allowed = false;
      result.blocked = true;
      result.reason = `Test mode active: Only emails from allowlisted domains are accepted. Domain '${senderDomain}' is not allowlisted.`;
      result.spamScore = 100;
      result.triggeredFilters.push('test_mode_not_allowlisted');
      await logSpamActivity(emailData, result);
      await createSecurityAlert('test_mode_blocked', 'low', senderEmail, senderDomain,
        `Test mode: Domain ${senderDomain} not in allowlist`, result);
      console.log(`[Spam Protection] ⛔ Blocked by test mode: ${senderDomain} not allowlisted`);
      return result;
    }

    // If domain is allowlisted, bypass most spam checks (but still log)
    if (domainIsAllowlisted) {
      console.log(`[Spam Protection] ✅ Domain ${senderDomain} is allowlisted - bypassing spam checks`);
      result.allowed = true;
      result.spamScore = 0;
      result.reason = `Allowlisted domain: ${senderDomain}`;
      result.triggeredFilters.push('allowlisted_bypass');
      await incrementAllowlistCount(senderDomain);
      await logSpamActivity(emailData, result);
      return result;
    }

    // Continue with normal spam protection checks for non-allowlisted domains
    console.log(`[Spam Protection] Running full spam checks for ${senderDomain}`);

    // 1. Size validation (prevent DoS)
    const sizeCheck = validateEmailSize(emailData);
    if (!sizeCheck.valid) {
      result.allowed = false;
      result.blocked = true;
      result.reason = sizeCheck.reason;
      result.spamScore = 100;
      result.triggeredFilters.push('size_limit_exceeded');
      await logSpamActivity(emailData, result);
      await createSecurityAlert('size_limit_exceeded', 'medium', senderEmail, senderDomain, sizeCheck.reason, result);
      return result;
    }

    // 2. Email validation
    const emailValidation = validateEmailAddress(senderEmail);
    if (!emailValidation.valid) {
      result.allowed = false;
      result.blocked = true;
      result.reason = emailValidation.reason;
      result.spamScore = 100;
      result.triggeredFilters.push('invalid_email');
      await logSpamActivity(emailData, result);
      return result;
    }

    // 3. Domain blacklist check
    const blacklistCheck = await checkDomainBlacklist(senderDomain);
    if (blacklistCheck.isBlacklisted) {
      result.allowed = false;
      result.blocked = true;
      result.reason = `Domain ${senderDomain} is blacklisted: ${blacklistCheck.reason}`;
      result.spamScore = 100;
      result.triggeredFilters.push('blacklisted_domain');
      await logSpamActivity(emailData, result);
      await updateBlacklistHitCount(senderDomain);
      await createSecurityAlert('blacklisted_domain', 'high', senderEmail, senderDomain, blacklistCheck.reason, result);
      return result;
    }

    // 4. Rate limiting check
    const rateLimitCheck = await checkRateLimit(senderEmail);
    if (rateLimitCheck.isLimited) {
      result.allowed = false;
      result.blocked = true;
      result.reason = `Rate limit exceeded: Maximum ${RATE_LIMIT_MAX_TICKETS_PER_DAY} tickets per day. Try again after ${rateLimitCheck.resetTime}`;
      result.spamScore = 75;
      result.triggeredFilters.push('rate_limit_exceeded');
      await logSpamActivity(emailData, result);
      await createSecurityAlert('rate_limit_exceeded', 'medium', senderEmail, senderDomain, 
        `Sender exceeded ${RATE_LIMIT_MAX_TICKETS_PER_DAY} tickets/day limit`, result);
      return result;
    }

    // 5. SPF/DKIM validation (simulated - in production would check actual headers)
    const domainValidation = await validateSenderDomain(emailData, senderDomain);
    result.spfResult = domainValidation.spfResult;
    result.dkimResult = domainValidation.dkimResult;
    result.spamScore += domainValidation.spamPoints;
    if (domainValidation.spamPoints > 0) {
      result.triggeredFilters.push(...domainValidation.triggeredFilters);
    }

    // 6. Content filtering (spam keywords)
    const contentCheck = await checkSpamContent(emailData);
    result.spamScore += contentCheck.spamPoints;
    if (contentCheck.keywords.length > 0) {
      result.triggeredFilters.push(...contentCheck.keywords);
    }

    // 7. Determine final action based on spam score
    if (result.spamScore >= SPAM_SCORE_THRESHOLD) {
      result.allowed = false;
      result.blocked = true;
      result.reason = `Email blocked due to high spam score (${result.spamScore}/100)`;
      await logSpamActivity(emailData, result);
      await createSecurityAlert('spam_detected', 'high', senderEmail, senderDomain, 
        `High spam score: ${result.spamScore}. Filters: ${result.triggeredFilters.join(', ')}`, result);
    } else if (result.spamScore >= VERIFICATION_CHALLENGE_THRESHOLD) {
      // Requires verification but not blocked yet
      result.requiresVerification = true;
      result.reason = `Suspicious activity detected (score: ${result.spamScore}/100). Verification required.`;
      await logSpamActivity(emailData, result);
    } else {
      // Email looks legitimate
      result.allowed = true;
      await logSpamActivity(emailData, result);
    }

    console.log(`[Spam Protection] Result: allowed=${result.allowed}, score=${result.spamScore}, verification=${result.requiresVerification}`);
    return result;

  } catch (error) {
    console.error('[Spam Protection] Error during spam check:', error);
    // On error, allow email but log for review
    result.allowed = true;
    result.reason = 'Spam check error - allowed by default';
    await createSecurityAlert('spam_check_error', 'low', senderEmail, senderDomain, 
      `Error during spam check: ${error.message}`, result);
    return result;
  }
}

/**
 * Validate email size to prevent DoS attacks
 */
function validateEmailSize(emailData) {
  const body = emailData.body || emailData['body-plain'] || '';
  const subject = emailData.subject || '';
  
  if (body.length > MAX_EMAIL_BODY_SIZE) {
    return {
      valid: false,
      reason: `Email body exceeds maximum size of ${MAX_EMAIL_BODY_SIZE} bytes`
    };
  }
  
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return {
      valid: false,
      reason: `Email subject exceeds maximum length of ${MAX_SUBJECT_LENGTH} characters`
    };
  }
  
  return { valid: true };
}

/**
 * Validate email address format
 */
function validateEmailAddress(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email address is missing or invalid' };
  }
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Email address format is invalid' };
  }
  
  // Check for suspicious patterns
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return { valid: false, reason: 'Email address contains suspicious patterns' };
  }
  
  return { valid: true };
}

/**
 * Check if domain is blacklisted
 */
async function checkDomainBlacklist(domain) {
  try {
    const result = await pool.query(
      'SELECT domain, reason FROM domain_blacklist WHERE domain = $1 AND is_active = TRUE',
      [domain]
    );
    
    if (result.rows.length > 0) {
      return {
        isBlacklisted: true,
        reason: result.rows[0].reason
      };
    }
    
    return { isBlacklisted: false };
  } catch (error) {
    console.error('[Spam Protection] Error checking domain blacklist:', error);
    return { isBlacklisted: false };
  }
}

/**
 * Update blacklist hit count when domain is blocked
 */
async function updateBlacklistHitCount(domain) {
  try {
    await pool.query(
      `UPDATE domain_blacklist 
       SET block_count = block_count + 1,
           last_blocked_at = CURRENT_TIMESTAMP
       WHERE domain = $1 AND is_active = TRUE`,
      [domain]
    );
  } catch (error) {
    console.error('[Spam Protection] Error updating blacklist hit count:', error);
  }
}

/**
 * Check rate limiting for sender email
 * Max 10 tickets per day
 */
async function checkRateLimit(email) {
  try {
    // Get or create rate limit record
    const result = await pool.query(
      `INSERT INTO email_rate_limits (email_address, ticket_count_today, reset_at, first_ticket_at)
       VALUES ($1, 0, CURRENT_DATE + INTERVAL '1 day', CURRENT_TIMESTAMP)
       ON CONFLICT (email_address) 
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [email]
    );
    
    const record = result.rows[0];
    
    // Check if we need to reset counter (new day)
    if (new Date(record.reset_at) < new Date()) {
      await pool.query(
        `UPDATE email_rate_limits 
         SET ticket_count_today = 0,
             reset_at = CURRENT_DATE + INTERVAL '1 day',
             is_rate_limited = FALSE,
             rate_limit_expires_at = NULL
         WHERE email_address = $1`,
        [email]
      );
      return { isLimited: false };
    }
    
    // Check if currently rate limited
    if (record.is_rate_limited && record.rate_limit_expires_at > new Date()) {
      return {
        isLimited: true,
        resetTime: new Date(record.reset_at).toLocaleString()
      };
    }
    
    // Check if limit exceeded
    if (record.ticket_count_today >= RATE_LIMIT_MAX_TICKETS_PER_DAY) {
      // Apply rate limit
      await pool.query(
        `UPDATE email_rate_limits 
         SET is_rate_limited = TRUE,
             rate_limit_expires_at = reset_at
         WHERE email_address = $1`,
        [email]
      );
      
      return {
        isLimited: true,
        resetTime: new Date(record.reset_at).toLocaleString()
      };
    }
    
    return { isLimited: false };
  } catch (error) {
    console.error('[Spam Protection] Error checking rate limit:', error);
    return { isLimited: false }; // Allow on error
  }
}

/**
 * Increment rate limit counter after successful ticket creation
 */
async function incrementRateLimit(email) {
  try {
    await pool.query(
      `UPDATE email_rate_limits 
       SET ticket_count_today = ticket_count_today + 1,
           total_tickets_all_time = total_tickets_all_time + 1,
           last_ticket_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE email_address = $1`,
      [email]
    );
    console.log(`[Rate Limit] Incremented counter for ${email}`);
  } catch (error) {
    console.error('[Spam Protection] Error incrementing rate limit:', error);
  }
}

/**
 * Validate sender domain (SPF, DKIM simulation)
 * In production, this would check actual email headers from Mailgun
 */
async function validateSenderDomain(emailData, domain) {
  const result = {
    spfResult: 'none',
    dkimResult: 'none',
    spamPoints: 0,
    triggeredFilters: []
  };
  
  try {
    // Check if Mailgun provided SPF/DKIM results in headers
    // In real implementation, Mailgun includes these in webhook data
    const spfHeader = emailData['X-Mailgun-Spf'] || emailData.spf;
    const dkimHeader = emailData['X-Mailgun-Dkim-Check-Result'] || emailData.dkim;
    
    if (spfHeader) {
      result.spfResult = spfHeader.toLowerCase();
    }
    
    if (dkimHeader) {
      result.dkimResult = dkimHeader.toLowerCase();
    }
    
    // Score based on SPF result
    if (result.spfResult === 'fail') {
      result.spamPoints += 20;
      result.triggeredFilters.push('spf_fail');
    } else if (result.spfResult === 'softfail') {
      result.spamPoints += 10;
      result.triggeredFilters.push('spf_softfail');
    } else if (result.spfResult === 'pass') {
      result.spamPoints -= 5; // Reduce spam score for valid SPF
    }
    
    // Score based on DKIM result
    if (result.dkimResult === 'fail') {
      result.spamPoints += 15;
      result.triggeredFilters.push('dkim_fail');
    } else if (result.dkimResult === 'pass') {
      result.spamPoints -= 5; // Reduce spam score for valid DKIM
    }
    
    // Check for suspicious/free domains
    const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    const tempDomains = ['tempmail', 'guerrillamail', '10minutemail', 'throwaway'];
    
    if (tempDomains.some(temp => domain.includes(temp))) {
      result.spamPoints += 25;
      result.triggeredFilters.push('temporary_email_domain');
    }
    
    // Ensure spam points don't go negative
    if (result.spamPoints < 0) {
      result.spamPoints = 0;
    }
    
  } catch (error) {
    console.error('[Spam Protection] Error validating sender domain:', error);
  }
  
  return result;
}

/**
 * Check email content for spam keywords and patterns
 */
async function checkSpamContent(emailData) {
  const result = {
    spamPoints: 0,
    keywords: []
  };
  
  try {
    const subject = (emailData.subject || '').toLowerCase();
    const body = (emailData.body || emailData['body-plain'] || '').toLowerCase();
    const combinedText = `${subject} ${body}`;
    
    // Get active spam keywords from database
    const keywordsResult = await pool.query(
      'SELECT keyword, pattern_type, weight, category FROM spam_keywords WHERE is_active = TRUE'
    );
    
    for (const row of keywordsResult.rows) {
      let matched = false;
      
      switch (row.pattern_type) {
        case 'exact':
          matched = combinedText === row.keyword.toLowerCase();
          break;
        case 'contains':
          matched = combinedText.includes(row.keyword.toLowerCase());
          break;
        case 'regex':
          try {
            const regex = new RegExp(row.keyword, 'i');
            matched = regex.test(combinedText);
          } catch (e) {
            console.error(`[Spam Protection] Invalid regex pattern: ${row.keyword}`);
          }
          break;
      }
      
      if (matched) {
        result.spamPoints += row.weight;
        result.keywords.push(`spam_keyword_${row.category}_${row.keyword.replace(/\s+/g, '_')}`);
        
        // Update hit count
        await pool.query(
          `UPDATE spam_keywords 
           SET hit_count = hit_count + 1,
               last_hit_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id]
        );
      }
    }
    
    // Additional pattern checks
    // Check for excessive capitalization (SCREAMING)
    const upperCaseRatio = (combinedText.match(/[A-Z]/g) || []).length / combinedText.length;
    if (upperCaseRatio > 0.3 && combinedText.length > 50) {
      result.spamPoints += 10;
      result.keywords.push('excessive_capitalization');
    }
    
    // Check for excessive punctuation (!!!!!!)
    const exclamationCount = (combinedText.match(/!/g) || []).length;
    if (exclamationCount > 5) {
      result.spamPoints += 8;
      result.keywords.push('excessive_punctuation');
    }
    
    // Check for excessive links
    const linkCount = (combinedText.match(/https?:\/\//g) || []).length;
    if (linkCount > 5) {
      result.spamPoints += 12;
      result.keywords.push('excessive_links');
    }
    
    console.log(`[Content Filter] Detected ${result.keywords.length} spam indicators, +${result.spamPoints} points`);
    
  } catch (error) {
    console.error('[Spam Protection] Error checking spam content:', error);
  }
  
  return result;
}

/**
 * Log spam activity to database for audit trail
 */
async function logSpamActivity(emailData, spamResult) {
  try {
    // Extract email properly (handle "Name <email>" format)
    let senderEmail = emailData.from?.toLowerCase() || emailData.sender?.toLowerCase();
    const emailMatch = senderEmail?.match(/<(.+?)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1].toLowerCase();
    }
    
    const senderDomain = senderEmail?.split('@')[1];
    const body = emailData.body || emailData['body-plain'] || '';
    const bodyPreview = body.substring(0, 500);
    
    // Convert triggeredFilters array to PostgreSQL array format
    const filtersArray = spamResult.triggeredFilters && spamResult.triggeredFilters.length > 0 
      ? spamResult.triggeredFilters 
      : null;
    
    // Part 6: Determine processing status
    const processingStatus = spamResult.blocked ? 'failed' : 'success';
    
    // Part 6: Store raw email data for potential retry (sanitize sensitive fields if needed)
    const rawEmailData = {
      from: emailData.from,
      sender: emailData.sender,
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
      'body-plain': emailData['body-plain'],
      'body-html': emailData['body-html'],
      'In-Reply-To': emailData['In-Reply-To'],
      References: emailData.References,
      'Message-Id': emailData['Message-Id'],
      timestamp: emailData.timestamp || Date.now()
    };
    
    await pool.query(
      `INSERT INTO email_spam_logs 
       (sender_email, sender_domain, subject, body_preview, spam_score, is_spam, is_blocked, 
        block_reason, spf_result, dkim_result, content_filters_triggered, ip_address,
        processing_status, processing_error, raw_email_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13, $14, $15)`,
      [
        senderEmail,
        senderDomain,
        emailData.subject,
        bodyPreview,
        spamResult.spamScore ?? 0,  // Ensure consistent numeric type (default to 0 if null/undefined)
        spamResult.spamScore >= VERIFICATION_CHALLENGE_THRESHOLD,
        spamResult.blocked,
        spamResult.reason || null,
        spamResult.spfResult || null,  // Ensure consistent type
        spamResult.dkimResult || null,  // Ensure consistent type
        filtersArray,
        emailData.ip || null,
        processingStatus,
        spamResult.blocked ? spamResult.reason : null,
        JSON.stringify(rawEmailData)
      ]
    );
  } catch (error) {
    console.error('[Spam Protection] Error logging spam activity:', error);
  }
}

/**
 * Create security alert for admin monitoring
 */
async function createSecurityAlert(alertType, severity, email, domain, description, metadataObj) {
  try {
    await pool.query(
      `INSERT INTO security_alerts 
       (alert_type, severity, email_address, domain, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        alertType,
        severity,
        email,
        domain,
        description,
        JSON.stringify(metadataObj)
      ]
    );
    
    console.log(`[Security Alert] ${severity.toUpperCase()}: ${alertType} - ${email}`);
    
    // In production, could send email to admins for high/critical alerts
    if (severity === 'high' || severity === 'critical') {
      console.warn(`⚠️  HIGH PRIORITY ALERT: ${description}`);
      // await notifyAdmins(alertType, description);
    }
  } catch (error) {
    console.error('[Spam Protection] Error creating security alert:', error);
  }
}

/**
 * Create verification challenge for suspicious sender
 * Sends email with verification link
 */
async function createVerificationChallenge(emailData, spamScore) {
  try {
    const senderEmail = emailData.from?.toLowerCase() || emailData.sender?.toLowerCase();
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Store challenge in database
    await pool.query(
      `INSERT INTO email_verification_challenges 
       (email_address, challenge_token, expires_at, original_email_data, spam_score, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        senderEmail,
        challengeToken,
        expiresAt,
        JSON.stringify(emailData),
        spamScore,
        emailData.ip || null
      ]
    );
    
    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${challengeToken}`;
    
    await sendEmail(
      senderEmail,
      'Verify Your Email - BlueClue Support',
      `
        <h2>Email Verification Required</h2>
        <p>Hello,</p>
        <p>We detected suspicious activity associated with your recent support email. To ensure the security of our system, please verify your email address to submit your ticket.</p>
        <p><strong>Click the button below to verify your email:</strong></p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p><strong>This link expires in ${CHALLENGE_EXPIRY_HOURS} hours.</strong></p>
        <p>If you did not attempt to submit a support ticket, please ignore this email.</p>
        <p>Thank you,<br>BlueClue Support Team</p>
      `
    );
    
    console.log(`[Verification] Challenge created for ${senderEmail}, token: ${challengeToken}`);
    
    return {
      success: true,
      token: challengeToken,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error('[Spam Protection] Error creating verification challenge:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify challenge token and process original email
 * Called when user clicks verification link
 */
async function verifyChallenge(token) {
  try {
    const result = await pool.query(
      `SELECT * FROM email_verification_challenges 
       WHERE challenge_token = $1 
       AND is_verified = FALSE 
       AND expires_at > CURRENT_TIMESTAMP
       AND attempts < max_attempts`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return {
        success: false,
        reason: 'Invalid, expired, or already used verification token'
      };
    }
    
    const challenge = result.rows[0];
    
    // Mark as verified
    await pool.query(
      `UPDATE email_verification_challenges 
       SET is_verified = TRUE,
           verified_at = CURRENT_TIMESTAMP,
           attempts = attempts + 1
       WHERE id = $1`,
      [challenge.id]
    );
    
    console.log(`[Verification] Challenge verified for ${challenge.email_address}`);
    
    return {
      success: true,
      emailData: challenge.original_email_data,
      email: challenge.email_address
    };
  } catch (error) {
    console.error('[Spam Protection] Error verifying challenge:', error);
    return { success: false, reason: error.message };
  }
}

/**
 * Add domain to blacklist
 */
async function addToBlacklist(domain, reason, addedBy = null) {
  try {
    await pool.query(
      `INSERT INTO domain_blacklist (domain, reason, added_by, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (domain) DO UPDATE SET
       reason = $2,
       added_by = $3,
       is_active = TRUE,
       added_at = CURRENT_TIMESTAMP`,
      [domain, reason, addedBy]
    );
    
    console.log(`[Blacklist] Added domain: ${domain}`);
    return { success: true };
  } catch (error) {
    console.error('[Spam Protection] Error adding to blacklist:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove domain from blacklist
 */
async function removeFromBlacklist(domain) {
  try {
    await pool.query(
      'UPDATE domain_blacklist SET is_active = FALSE WHERE domain = $1',
      [domain]
    );
    
    console.log(`[Blacklist] Removed domain: ${domain}`);
    return { success: true };
  } catch (error) {
    console.error('[Spam Protection] Error removing from blacklist:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get security alerts (for admin dashboard)
 */
async function getSecurityAlerts(limit = 50, onlyUnresolved = true) {
  try {
    const query = onlyUnresolved
      ? 'SELECT * FROM security_alerts WHERE is_resolved = FALSE ORDER BY created_at DESC LIMIT $1'
      : 'SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT $1';
    
    const result = await pool.query(query, [limit]);
    return { success: true, alerts: result.rows };
  } catch (error) {
    console.error('[Spam Protection] Error fetching security alerts:', error);
    return { success: false, error: error.message, alerts: [] };
  }
}

/**
 * Get spam statistics (for admin dashboard)
 */
async function getSpamStats(days = 7) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE is_spam) as spam_count,
        COUNT(*) FILTER (WHERE is_blocked) as blocked_count,
        AVG(spam_score) as avg_spam_score,
        COUNT(DISTINCT sender_domain) as unique_domains
       FROM email_spam_logs
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${days} days'`
    );
    
    return { success: true, stats: result.rows[0] };
  } catch (error) {
    console.error('[Spam Protection] Error fetching spam stats:', error);
    return { success: false, error: error.message };
  }
}

export {
  checkSpamProtection,
  incrementRateLimit,
  createVerificationChallenge,
  verifyChallenge,
  addToBlacklist,
  removeFromBlacklist,
  getSecurityAlerts,
  getSpamStats,
  validateEmailAddress,
  validateEmailSize,
  SPAM_SCORE_THRESHOLD,
  VERIFICATION_CHALLENGE_THRESHOLD,
  RATE_LIMIT_MAX_TICKETS_PER_DAY
};
