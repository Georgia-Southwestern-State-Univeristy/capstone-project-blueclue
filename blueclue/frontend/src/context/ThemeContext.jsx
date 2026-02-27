import { createContext, useState, useEffect, useCallback } from 'react';

export const ThemeContext = createContext();

/**
 * ThemeProvider — manages 'dark' | 'light' theme state.
 * Persists to localStorage and applies a `data-theme` attribute on <html>.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('blueclue-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  // Apply the theme to the document whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('blueclue-theme', theme);
    } catch {
      // localStorage not available — ignore
    }
  }, [theme]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
