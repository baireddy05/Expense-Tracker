import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { initGlobalHaptics } from './utils/haptics'

// Initialize 120Hz global touch haptic feedback
initGlobalHaptics();

// IMMEDIATE SECURITY PURGE:
// Wipe all unencrypted financial records, old backups, and legacy keys from client storage on startup
try {
  const allowedPreferences = new Set(['theme', 'extrack_privacy_mode', 'extrack_haptics_enabled', 'extrack_haptics_intensity']);
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(k => {
    if (!allowedPreferences.has(k)) {
      localStorage.removeItem(k);
    }
  });
  sessionStorage.clear();
} catch (e) {
  // Silent fail in restrictive private browsing modes
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
