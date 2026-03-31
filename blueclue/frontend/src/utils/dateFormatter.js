// ============================================================================
// Centralized Date/Time Formatter
// ============================================================================
// Respects the user's timezone preference stored in their profile.
// Falls back to the browser's local timezone when no preference is set.

import { getUser } from '../services/authService';

/**
 * Get the user's preferred IANA timezone (e.g. "America/New_York").
 * Returns the browser default when no preference is saved.
 */
export function getUserTimezone() {
  const user = getUser();
  return user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a date string as a locale date (e.g. "Mar 24, 2026").
 * @param {string|Date} value
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function formatDate(value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-US', { ...opts, timeZone: getUserTimezone() });
}

/**
 * Format a date string as a full date+time (e.g. "Mar 24, 2026, 3:45 PM").
 * @param {string|Date} value
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function formatDateTime(value, opts = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date)) return '';
  return date.toLocaleString('en-US', { ...opts, timeZone: getUserTimezone() });
}

/**
 * Format a date string as time only (e.g. "3:45 PM").
 * @param {string|Date} value
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function formatTime(value, opts = { hour: 'numeric', minute: '2-digit' }) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date)) return '';
  return date.toLocaleTimeString('en-US', { ...opts, timeZone: getUserTimezone() });
}

/**
 * Format a date as a relative time string (e.g. "just now", "30s ago", "2m ago").
 * @param {string|Date} value
 */
export function formatTimeAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date)) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}
