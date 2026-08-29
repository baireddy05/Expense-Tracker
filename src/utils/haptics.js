/**
 * Web Haptic Feedback Engine for ExTrack
 * Provides tactile vibration feedback for mobile browsers & touch devices.
 */

const STORAGE_KEY = 'extrack_haptics_enabled';
const INTENSITY_KEY = 'extrack_haptics_intensity';

// Check if haptics are enabled (defaults to true)
export const isHapticsEnabled = () => {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
};

export const setHapticsEnabled = (enabled) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage issues
  }
};

export const getHapticIntensity = () => {
  try {
    return localStorage.getItem(INTENSITY_KEY) || 'strong';
  } catch {
    return 'strong';
  }
};

export const setHapticIntensity = (intensity) => {
  try {
    localStorage.setItem(INTENSITY_KEY, intensity);
  } catch {
    // Ignore storage issues
  }
};

// Robust physical motor duration profiles
const INTENSITY_PROFILES = {
  subtle: {
    selection: 30,
    light: 45,
    medium: 70,
    heavy: [80, 50, 80],
    success: [40, 50, 60],
    warning: [50, 40, 50],
    error: [60, 40, 60]
  },
  medium: {
    selection: 45,
    light: 70,
    medium: 100,
    heavy: [110, 60, 110],
    success: [60, 60, 90],
    warning: [70, 50, 70],
    error: [90, 50, 90]
  },
  strong: {
    selection: 65,
    light: 95,
    medium: 140,
    heavy: [150, 70, 150],
    success: [80, 70, 130],
    warning: [100, 60, 100],
    error: [120, 60, 120]
  }
};

let lastVibrateTime = 0;

/**
 * Triggers a vibration pattern if supported and enabled.
 * Safe to call on all platforms (fails silently on desktop or unsupported devices).
 */
export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined' || !navigator || !navigator.vibrate) return;
  if (!isHapticsEnabled()) return;

  const now = Date.now();
  // Don't cancel an ongoing multi-pulse vibration if called in rapid succession (< 70ms)
  if (now - lastVibrateTime < 70 && type === 'selection') return;
  lastVibrateTime = now;

  try {
    const intensity = getHapticIntensity();
    const profile = INTENSITY_PROFILES[intensity] || INTENSITY_PROFILES.strong;

    if (typeof type === 'number' || Array.isArray(type)) {
      navigator.vibrate(type);
      return;
    }

    const pattern = profile[type] || profile.light;
    navigator.vibrate(pattern);
  } catch {
    // Vibration API blocked or unsupported in current context
  }
};

export const haptics = {
  selection: () => triggerHaptic('selection'),
  tick: () => triggerHaptic('selection'),
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  heavy: () => triggerHaptic('heavy'),
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
  custom: (pattern) => triggerHaptic(pattern)
};

/**
 * Global delegated touch-event listener.
 * Automatically gives tactile haptic feedback to buttons, interactive pills, and links on touch.
 */
export const initGlobalHaptics = () => {
  if (typeof window === 'undefined' || !window.addEventListener) return;

  const handlePointerDown = (e) => {
    const target = e.target;
    if (!target || !(target instanceof HTMLElement)) return;

    // Check if target is interactive
    const interactive = target.closest(
      'button, a, input[type="radio"], input[type="checkbox"], select, [role="button"], [role="tab"], .touch-feedback, .interactive-pill'
    );

    if (interactive) {
      // Determine haptic weight based on element attributes
      const customType = interactive.getAttribute('data-haptic');
      if (customType) {
        triggerHaptic(customType);
      } else if (interactive.classList.contains('bg-rose-600') || interactive.getAttribute('data-danger')) {
        triggerHaptic('heavy');
      } else if (interactive.tagName === 'BUTTON' && (interactive.classList.contains('py-2.5') || interactive.classList.contains('py-3') || interactive.classList.contains('bg-zinc-900'))) {
        triggerHaptic('medium');
      } else {
        triggerHaptic('light');
      }
    }
  };

  // Attach pointerdown for immediate hardware response
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
};

export default haptics;
