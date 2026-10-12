import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const THEME_KEY = 'kharch_theme';
  const LEGACY_THEME_KEY = 'theme';

  const readTheme = () => {
    try {
      const val = localStorage.getItem(THEME_KEY);
      if (val) return val;
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy) {
        try {
          localStorage.setItem(THEME_KEY, legacy);
          localStorage.removeItem(LEGACY_THEME_KEY);
        } catch { /* ignore */ }
        return legacy;
      }
      return 'system';
    } catch {
      return 'system';
    }
  };

  const [theme, setTheme] = useState(() => readTheme());

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      let isDark = theme === 'dark';
      if (theme === 'system') {
        isDark = mediaQuery.matches;
      }
      
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();
    try {
      localStorage.setItem('kharch_theme', theme);
      localStorage.removeItem('theme');
    } catch { /* ignore */ }

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const contextValue = React.useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
