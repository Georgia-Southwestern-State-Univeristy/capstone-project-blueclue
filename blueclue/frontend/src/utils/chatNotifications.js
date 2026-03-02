/**
 * chatNotifications — Sound + browser notification helpers for the chat.
 *
 * - playMessageSound(): plays a short blip (Web Audio API, no file needed)
 * - requestNotificationPermission(): asks for browser Notification permission
 * - sendBrowserNotification(title, body): fires a desktop notification
 *   if the tab is not focused and permission was granted.
 *
 * Sound preference is stored in localStorage under `blueclue_chat_sound`.
 */

const SOUND_PREF_KEY = 'blueclue_chat_sound';

// ── Sound preference ─────────────────────────────────────────────────
export function isSoundEnabled() {
  try {
    const val = localStorage.getItem(SOUND_PREF_KEY);
    return val === null ? true : val === 'true'; // default ON
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {
    // storage full or blocked — silently ignore
  }
}

// ── Play a short notification blip via Web Audio API ─────────────────
let audioCtx = null;

export function playMessageSound() {
  if (!isSoundEnabled()) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // Web Audio not supported — silently ignore
  }
}

// ── Browser Notifications ────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function sendBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // don't notify if tab is active

  try {
    const notification = new Notification(title, {
      body,
      icon: '/BlueClueLogoDefault.png', // uses the public logo
      tag: 'blueclue-chat', // collapse repeat notifications
    });
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } catch {
    // Notification constructor blocked — silently ignore
  }
}
