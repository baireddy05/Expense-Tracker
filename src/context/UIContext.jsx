import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  isHapticsEnabled as checkHaptics, 
  setHapticsEnabled, 
  getHapticIntensity, 
  setHapticIntensity, 
  triggerHaptic, 
  haptics 
} from '../utils/haptics';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    return localStorage.getItem('extrack_privacy_mode') === 'true';
  });

  const [isHapticsOn, setIsHapticsOn] = useState(() => checkHaptics());
  const [hapticIntensity, setIntensityState] = useState(() => getHapticIntensity());

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      localStorage.setItem('extrack_privacy_mode', String(next));
      triggerHaptic('medium');
      return next;
    });
  }, []);

  const toggleHaptics = useCallback(() => {
    setIsHapticsOn(prev => {
      const next = !prev;
      setHapticsEnabled(next);
      if (next) triggerHaptic('success');
      return next;
    });
  }, []);

  const updateHapticIntensity = useCallback((level) => {
    setIntensityState(level);
    setHapticIntensity(level);
    triggerHaptic('heavy');
  }, []);

  const openCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
    triggerHaptic('light');
  }, []);

  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(prev => {
      triggerHaptic('light');
      return !prev;
    });
  }, []);

  const openQuickAdd = useCallback(() => {
    setIsQuickAddOpen(true);
    triggerHaptic('light');
  }, []);

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

  const contextValue = React.useMemo(() => ({
    isPrivacyMode,
    togglePrivacyMode,
    isHapticsOn,
    toggleHaptics,
    hapticIntensity,
    updateHapticIntensity,
    triggerHaptic,
    haptics,
    maskNumber,
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
    isQuickAddOpen,
    openQuickAdd,
    closeQuickAdd
  }), [
    isPrivacyMode,
    togglePrivacyMode,
    isHapticsOn,
    toggleHaptics,
    hapticIntensity,
    updateHapticIntensity,
    maskNumber,
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
    isQuickAddOpen,
    openQuickAdd,
    closeQuickAdd
  ]);

  return (
    <UIContext.Provider value={contextValue}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);
