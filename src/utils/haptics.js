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

// Intensity multipliers
const INTENSITY_PROFILES = {
  subtle: {
    selection: 16,
    light: 28,
    medium: 45,
    heavy: 65,
    success: [20, 35, 35],
    warning: [35, 30, 35],
    error: [45, 35, 45, 35]
  },
  medium: {
    selection: 26,
    light: 42,
    medium: 68,
    heavy: [80, 35, 80],
    success: [30, 40, 55],
    warning: [50, 40, 50],
    error: [65, 45, 65, 45]
  },
  strong: {
    selection: 36,
    light: 55,
    medium: 85,
    heavy: [110, 45, 110],
    success: [45, 45, 75],
    warning: [70, 45, 70],
    error: [90, 50, 90, 50]
  }
};

/**
 * Triggers a vibration pattern if supported and enabled.
 * Safe to call on all platforms (fails silently on desktop or unsupported devices).
 */
export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined' || !navigator || !navigator.vibrate) return;
  if (!isHapticsEnabled()) return;

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

  let lastHapticTime = 0;

  const handlePointerDown = (e) => {
    // Debounce micro-vibrations to avoid vibration overlapping
    const now = Date.now();
    if (now - lastHapticTime < 60) return;

    const target = e.target;
    if (!target || !(target instanceof HTMLElement)) return;

    // Check if target is interactive
    const interactive = target.closest(
      'button, a, input[type="radio"], input[type="checkbox"], select, [role="button"], [role="tab"], .touch-feedback, .interactive-pill'
    );

    if (interactive) {
      lastHapticTime = now;
      
      // Determine haptic weight based on element attributes
      const customType = interactive.getAttribute('data-haptic');
      if (customType) {
        triggerHaptic(customType);
      } else if (interactive.classList.contains('bg-rose-600') || interactive.getAttribute('data-danger')) {
        triggerHaptic('heavy');
      } else if (interactive.tagName === 'BUTTON' && (interactive.classList.contains('py-2.5') || interactive.classList.contains('py-3'))) {
        triggerHaptic('light');
      } else {
        triggerHaptic('selection');
      }
    }
  };

  // Attach pointerdown for immediate hardware response
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
};

export default haptics;
