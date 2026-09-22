import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { initGlobalHaptics } from './utils/haptics'

// Initialize 120Hz global touch haptic feedback
initGlobalHaptics();

// Note: Guest offline data (extrack_guest_*) and preferences are intentionally
// preserved across reloads. Use Settings → Purge Cache for an explicit wipe.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
