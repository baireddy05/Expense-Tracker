import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    return localStorage.getItem('extrack_privacy_mode') === 'true';
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      localStorage.setItem('extrack_privacy_mode', String(next));
      return next;
    });
  }, []);

  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsCommandPaletteOpen(prev => !prev), []);

  const openQuickAdd = useCallback(() => setIsQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setIsQuickAddOpen(false), []);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K / Ctrl+N)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsQuickAddOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette]);

  const maskNumber = useCallback((val, prefix = '₹') => {
    if (!isPrivacyMode) {
      if (typeof val === 'number') {
        return `${prefix}${val.toLocaleString('en-IN')}`;
      }
      return val;
    }
    return `${prefix}••••••`;
  }, [isPrivacyMode]);

  return (
    <UIContext.Provider value={{
      isPrivacyMode,
      togglePrivacyMode,
      maskNumber,
      isCommandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
      isQuickAddOpen,
      openQuickAdd,
      closeQuickAdd
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);
