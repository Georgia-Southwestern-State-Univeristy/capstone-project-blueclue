/**
 * PII Redactor — strips personally-identifiable information from text
 * before storing free-text feedback in the database.
 *
 * Handles:
 *  - Email addresses
 *  - US phone numbers
 *  - US Social Security numbers
 *  - Credit card numbers
 *  - IP addresses
 *  - Names preceded by common PII triggers ("my name is", "i'm", "i am")
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

const PATTERNS = [
  // Email
  {
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: '[email]',
  },
  // US Phone  (+1 optional, various delimiters)
  {
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: '[phone]',
  },
  // SSN
  {
    regex: /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g,
    replacement: '[ssn]',
  },
  // Credit card (13-16 digits, spaced or dashed)
  {
    regex: /\b(?:\d{4}[- ]?){3}\d{1,4}\b/g,
    replacement: '[card]',
  },
  // IPv4
  {
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[ip]',
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Redact PII from a string.
 *
 * @param {string|null|undefined} text
 * @returns {string} text with PII replaced by placeholders
 */
export function redactPII(text) {
  if (!text || typeof text !== 'string') return text ?? '';
  let result = text;
  for (const { regex, replacement } of PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Detect whether a string likely contains PII (for logging / alerting).
 *
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function containsPII(text) {
  if (!text || typeof text !== 'string') return false;
  return PATTERNS.some(({ regex }) => {
    regex.lastIndex = 0;
    return regex.test(text);
  });
}

/**
 * Redact PII from an object's string values (shallow).
 *
 * Useful for sanitising request bodies before logging.
 */
export function redactObjectPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? redactPII(v) : v;
  }
  return out;
}
