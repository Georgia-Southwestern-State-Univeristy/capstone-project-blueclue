import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * useTheme hook — returns { theme, setTheme, toggleTheme, isDark }
 */
export default function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
