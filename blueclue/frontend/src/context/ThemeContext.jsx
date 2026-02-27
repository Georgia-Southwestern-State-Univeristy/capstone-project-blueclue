import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { isAuthenticated } from '../services/authService';
import {
  fetchThemePreferences,
  updateThemePreferences,
  saveTheme as apiSaveTheme,
  deleteSavedTheme as apiDeleteSavedTheme,
  renameSavedTheme as apiRenameSavedTheme,
} from '../services/themeService';

export const ThemeContext = createContext();

/* ── Colour-generation helpers ──────────────────────────────────────── */
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const clr = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, clr))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Derive lighter / darker shades from a single hex colour. */
function deriveShades(hex) {
  const [h, s] = hexToHSL(hex);
  return {
    lightest: hslToHex(h, Math.min(s, 30), 95),
    lighter:  hslToHex(h, Math.min(s, 40), 90),
    light:    hslToHex(h, Math.min(s, 50), 80),
    mid:      hslToHex(h, s, 50),
    dark:     hslToHex(h, s, 35),
    darker:   hslToHex(h, s, 28),
    darkest:  hslToHex(h, s, 15),
  };
}

/** Mix two hex colours at a given ratio (0–1). */
function mixHex(hex1, hex2, ratio = 0.5) {
  const r1 = parseInt(hex1.slice(1,3),16), g1 = parseInt(hex1.slice(3,5),16), b1 = parseInt(hex1.slice(5,7),16);
  const r2 = parseInt(hex2.slice(1,3),16), g2 = parseInt(hex2.slice(3,5),16), b2 = parseInt(hex2.slice(5,7),16);
  const r = Math.round(r1 + (r2 - r1) * ratio).toString(16).padStart(2,'0');
  const g = Math.round(g1 + (g2 - g1) * ratio).toString(16).padStart(2,'0');
  const b = Math.round(b1 + (b2 - b1) * ratio).toString(16).padStart(2,'0');
  return `#${r}${g}${b}`;
}

/** Convert hex to rgba string. */
function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Default custom slot colours (matches default dark theme) ───────── */
const DEFAULT_CUSTOM_SLOTS = {
  accent:      '#2563eb',  // Accent colour → derives full accent-50…900 scale
  pageBg:      '#030712',  // Page / body background
  cardBg:      '#1f2937',  // Cards, panels, inputs
  sidebarBg:   '#111827',  // Sidebar & secondary areas
  textColor:   '#ffffff',  // Primary text colour
  borderColor: '#374151',  // Borders & dividers
};

/**
 * Apply ONLY the accent-scale custom vars (leaves structural theme intact).
 * Used when Custom accent is selected but Override is OFF.
 */
function applyCustomAccentVars(slots) {
  const root = document.documentElement;

  /* Accent scale */
  const aShades = deriveShades(slots.accent);
  root.style.setProperty('--accent-50',  aShades.lightest);
  root.style.setProperty('--accent-100', aShades.lighter);
  root.style.setProperty('--accent-200', aShades.light);
  root.style.setProperty('--accent-300', mixHex(slots.accent, '#ffffff', 0.4));
  root.style.setProperty('--accent-400', mixHex(slots.accent, '#ffffff', 0.2));
  root.style.setProperty('--accent-500', slots.accent);
  root.style.setProperty('--accent-600', slots.accent);
  root.style.setProperty('--accent-700', aShades.dark);
  root.style.setProperty('--accent-800', aShades.darker);
  root.style.setProperty('--accent-900', aShades.darkest);
  const [,, al] = hexToHSL(slots.accent);
  root.style.setProperty('--accent-text-on-bg', al > 55 ? '#000000' : '#ffffff');

  /* Gradient */
  root.style.setProperty('--gradient-from', slots.accent);
  root.style.setProperty('--gradient-to',   aShades.darker);
}

/**
 * Apply ALL custom CSS variables — accent scale + structural (bg, text, border).
 * Overrides whatever the dark/light CSS theme defines.
 * Used when Custom accent is selected AND Override is ON.
 */
function applyAllCustomVars(slots) {
  applyCustomAccentVars(slots);
  const root = document.documentElement;

  /* Backgrounds */
  root.style.setProperty('--bg-body',      slots.pageBg);
  root.style.setProperty('--bg-primary',   slots.pageBg);
  root.style.setProperty('--bg-secondary', slots.sidebarBg);
  root.style.setProperty('--bg-card',      slots.cardBg);
  root.style.setProperty('--bg-card-alt',  hexAlpha(slots.cardBg, 0.6));
  root.style.setProperty('--bg-hover',     mixHex(slots.cardBg, '#ffffff', 0.15));
  root.style.setProperty('--bg-input',     slots.cardBg);
  root.style.setProperty('--bg-sidebar',   slots.sidebarBg);
  root.style.setProperty('--bg-sub-panel', mixHex(slots.sidebarBg, slots.cardBg, 0.5));

  /* Text */
  root.style.setProperty('--text-primary',   slots.textColor);
  const [,, tl] = hexToHSL(slots.textColor);
  const fadeTarget = tl > 50 ? '#000000' : '#ffffff';
  root.style.setProperty('--text-secondary', mixHex(slots.textColor, fadeTarget, 0.18));
  root.style.setProperty('--text-muted',     mixHex(slots.textColor, fadeTarget, 0.35));
  root.style.setProperty('--text-dimmed',    mixHex(slots.textColor, fadeTarget, 0.50));

  /* Borders */
  root.style.setProperty('--border-primary',   slots.borderColor);
  root.style.setProperty('--border-secondary',  mixHex(slots.borderColor, slots.pageBg, 0.5));
}

/** Remove ALL inline custom vars so the CSS-defined theme reasserts control. */
function clearCustomVars() {
  const root = document.documentElement;
  ['50','100','200','300','400','500','600','700','800','900','text-on-bg']
    .forEach(k => root.style.removeProperty(`--accent-${k}`));
  ['--bg-body','--bg-primary','--bg-secondary','--bg-card','--bg-card-alt',
   '--bg-hover','--bg-input','--bg-sidebar','--bg-sub-panel',
   '--gradient-from','--gradient-to',
   '--text-primary','--text-secondary','--text-muted','--text-dimmed',
   '--border-primary','--border-secondary']
    .forEach(k => root.style.removeProperty(k));
}

/** Remove ONLY structural inline vars (keeps accent vars intact). */
function clearStructuralVars() {
  const root = document.documentElement;
  ['--bg-body','--bg-primary','--bg-secondary','--bg-card','--bg-card-alt',
   '--bg-hover','--bg-input','--bg-sidebar','--bg-sub-panel',
   '--text-primary','--text-secondary','--text-muted','--text-dimmed',
   '--border-primary','--border-secondary']
    .forEach(k => root.style.removeProperty(k));
}

/**
 * ThemeProvider — manages dark/light theme + accent colour scheme + full custom colours.
 * Persists to localStorage always and syncs to server when authenticated.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('blueclue-theme') || 'dark'; } catch { return 'dark'; }
  });

  const [accent, setAccentState] = useState(() => {
    try { return localStorage.getItem('blueclue-accent') || 'blue'; } catch { return 'blue'; }
  });

  // Full-site custom colour slots
  const [customSlots, setCustomSlotsState] = useState(() => {
    try {
      const raw = localStorage.getItem('blueclue-custom-slots');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate from old schema (had primary/accent/surface/border) to new schema
        if (parsed.pageBg) return parsed;
        return { ...DEFAULT_CUSTOM_SLOTS };
      }
      return { ...DEFAULT_CUSTOM_SLOTS };
    } catch { return { ...DEFAULT_CUSTOM_SLOTS }; }
  });

  // Full override toggle — when ON, custom colours replace ALL theme colours site-wide
  const [customOverride, setCustomOverrideState] = useState(() => {
    try { return localStorage.getItem('blueclue-custom-override') === 'true'; } catch { return false; }
  });

  // ── Saved themes from the server ──
  const [savedThemes, setSavedThemes] = useState([]);

  // Guard: skip server sync while we're loading FROM server to avoid echo
  const loadingFromServer = useRef(false);
  // Debounce timer ref for server sync
  const syncTimer = useRef(null);
  // Track whether we've loaded from server in this session
  const serverLoaded = useRef(false);

  // ── Load preferences from server on mount (if authenticated) ──
  useEffect(() => {
    let cancelled = false;
    const loadFromServer = async () => {
      if (!isAuthenticated()) return;
      try {
        loadingFromServer.current = true;
        const data = await fetchThemePreferences();
        if (cancelled) return;
        if (data) {
          if (data.theme)       { setThemeState(data.theme);       try { localStorage.setItem('blueclue-theme', data.theme); } catch {} }
          if (data.accent)      { setAccentState(data.accent);     try { localStorage.setItem('blueclue-accent', data.accent); } catch {} }
          if (typeof data.customOverride === 'boolean') {
            setCustomOverrideState(data.customOverride);
            try { localStorage.setItem('blueclue-custom-override', String(data.customOverride)); } catch {}
          }
          if (data.customSlots && typeof data.customSlots === 'object' && data.customSlots.pageBg) {
            setCustomSlotsState(data.customSlots);
            try { localStorage.setItem('blueclue-custom-slots', JSON.stringify(data.customSlots)); } catch {}
          }
          if (Array.isArray(data.savedThemes)) {
            setSavedThemes(data.savedThemes);
          }
          serverLoaded.current = true;
        }
      } catch (err) {
        console.warn('Failed to load theme preferences from server:', err.message);
      } finally {
        // Small delay so the state updates settle before we start syncing
        setTimeout(() => { loadingFromServer.current = false; }, 300);
      }
    };
    loadFromServer();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced sync to server whenever active prefs change ──
  const syncToServer = useCallback(() => {
    if (loadingFromServer.current) return;
    if (!isAuthenticated()) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await updateThemePreferences({
          theme: document.documentElement.getAttribute('data-theme') || 'dark',
          accent: document.documentElement.getAttribute('data-accent') || 'blue',
          customOverride: localStorage.getItem('blueclue-custom-override') === 'true',
          customSlots: JSON.parse(localStorage.getItem('blueclue-custom-slots') || '{}'),
        });
      } catch (err) {
        console.warn('Theme sync failed:', err.message);
      }
    }, 800);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('blueclue-theme', theme); } catch { /* noop */ }
    syncToServer();
  }, [theme, syncToServer]);

  // Apply accent + custom vars (merged with override logic)
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    try { localStorage.setItem('blueclue-accent', accent); } catch { /* noop */ }

    if (accent === 'custom') {
      if (customOverride) {
        applyAllCustomVars(customSlots);
        document.documentElement.setAttribute('data-custom-override', 'true');
      } else {
        clearStructuralVars();
        applyCustomAccentVars(customSlots);
        document.documentElement.removeAttribute('data-custom-override');
      }
    } else {
      clearCustomVars();
      document.documentElement.removeAttribute('data-custom-override');
    }
    syncToServer();
  }, [accent, customSlots, customOverride, syncToServer]);

  // Persist custom override preference
  useEffect(() => {
    try { localStorage.setItem('blueclue-custom-override', String(customOverride)); } catch { /* noop */ }
  }, [customOverride]);

  const setTheme = useCallback((t) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState(p => p === 'dark' ? 'light' : 'dark'), []);
  const isDark = theme === 'dark';

  const setAccent = useCallback((a) => setAccentState(a), []);
  const setCustomOverride = useCallback((v) => setCustomOverrideState(v), []);

  /** Update one custom colour slot.  Usage: setCustomSlot('pageBg', '#1a1a2e') */
  const setCustomSlot = useCallback((slotName, hex) => {
    setCustomSlotsState(prev => {
      const next = { ...prev, [slotName]: hex };
      try { localStorage.setItem('blueclue-custom-slots', JSON.stringify(next)); } catch { /* noop */ }
      // Live-update: re-apply vars immediately so the picker feels responsive
      if (document.documentElement.getAttribute('data-accent') === 'custom') {
        const override = localStorage.getItem('blueclue-custom-override') === 'true';
        if (override) {
          applyAllCustomVars(next);
        } else {
          applyCustomAccentVars(next);
        }
      }
      return next;
    });
  }, []);

  /** Reset all custom slots to defaults. */
  const resetCustomSlots = useCallback(() => {
    const defaults = { ...DEFAULT_CUSTOM_SLOTS };
    setCustomSlotsState(defaults);
    try { localStorage.setItem('blueclue-custom-slots', JSON.stringify(defaults)); } catch { /* noop */ }
    if (document.documentElement.getAttribute('data-accent') === 'custom') {
      const override = localStorage.getItem('blueclue-custom-override') === 'true';
      if (override) {
        applyAllCustomVars(defaults);
      } else {
        applyCustomAccentVars(defaults);
      }
    }
  }, []);

  // ── Saved themes CRUD ──

  /** Save the current active config under a given name. */
  const saveCurrentTheme = useCallback(async (name) => {
    if (!isAuthenticated()) throw new Error('Not authenticated');
    const data = await apiSaveTheme(name, {
      theme, accent, customOverride, customSlots,
    });
    if (data?.savedThemes) setSavedThemes(data.savedThemes);
    return data;
  }, [theme, accent, customOverride, customSlots]);

  /** Load a saved theme's settings into the active state. */
  const loadSavedTheme = useCallback((themeData) => {
    loadingFromServer.current = true; // suppress echo sync while applying
    if (themeData.theme)  setThemeState(themeData.theme);
    if (themeData.accent) setAccentState(themeData.accent);
    if (typeof themeData.customOverride === 'boolean') setCustomOverrideState(themeData.customOverride);
    if (themeData.customSlots && themeData.customSlots.pageBg) {
      setCustomSlotsState(themeData.customSlots);
      try { localStorage.setItem('blueclue-custom-slots', JSON.stringify(themeData.customSlots)); } catch {}
    }
    // Sync after a brief delay so all state has settled
    setTimeout(() => {
      loadingFromServer.current = false;
      syncToServer();
    }, 400);
  }, [syncToServer]);

  /** Delete a saved theme by id. */
  const deleteTheme = useCallback(async (themeId) => {
    if (!isAuthenticated()) throw new Error('Not authenticated');
    const data = await apiDeleteSavedTheme(themeId);
    if (data?.savedThemes) setSavedThemes(data.savedThemes);
    return data;
  }, []);

  /** Rename a saved theme. */
  const renameTheme = useCallback(async (themeId, newName) => {
    if (!isAuthenticated()) throw new Error('Not authenticated');
    const data = await apiRenameSavedTheme(themeId, newName);
    if (data?.savedThemes) setSavedThemes(data.savedThemes);
    return data;
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme, setTheme, toggleTheme, isDark,
        accent, setAccent,
        customSlots, setCustomSlot, resetCustomSlots,
        customOverride, setCustomOverride,
        savedThemes, saveCurrentTheme, loadSavedTheme, deleteTheme, renameTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
