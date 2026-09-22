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

/**
 * Cooldowns (ms) per haptic class. Tap-level feedback is rate-limited so rapid
 * taps feel like even ticks; outcome patterns (success/warning/error/heavy)
 * always play because navigator.vibrate() atomically replaces any in-progress
 * pattern — they can never stack or double-buzz.
 */
const TAP_COOLDOWNS = {
  selection: 60,
  light: 60,
  medium: 90,
};

const lastFiredAt = {};

/**
 * Triggers a vibration pattern if supported and enabled.
 * Safe to call on all platforms (fails silently on desktop or unsupported devices).
 *
 * Consistency contract (see initGlobalHaptics below):
 * - The global pointerdown handler owns ALL tap feedback. Do NOT call
 *   light/medium/selection from click handlers for the same tap.
 * - Call sites should only fire OUTCOME haptics: success / warning / error /
 *   heavy, i.e. after an async save, delete, validation failure, or modal
 *   confirm. Outcomes replace the tap tick instead of layering on top of it.
 */
export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined' || !navigator || !navigator.vibrate) return;
  if (!isHapticsEnabled()) return;

  const now = Date.now();
  const cooldown = TAP_COOLDOWNS[type];
  if (cooldown && now - (lastFiredAt[type] || 0) < cooldown) return;
  lastFiredAt[type] = now;

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
 * Owns ALL tap feedback: buttons, links, radios, checkboxes, selects and
 * `.touch-feedback` pills get exactly one tick on pointerdown. Component code
 * must not add its own tap haptics — only outcome haptics (success/warning/
 * error/heavy), which replace the tick via navigator.vibrate().
 *
 * Attach-once guarded: safe to call from module scope, StrictMode, and HMR
 * without ever stacking duplicate listeners (the main cause of double-buzz).
 * Returns a cleanup function for tests/unmount.
 */
let globalHapticsCleanup = null;

export const initGlobalHaptics = () => {
  if (typeof window === 'undefined' || !window.addEventListener) return () => {};
  if (globalHapticsCleanup) return globalHapticsCleanup;

  const handlePointerDown = (e) => {
    const target = e.target;
    if (!target || !(target instanceof HTMLElement)) return;

    // Check if target is interactive
    const interactive = target.closest(
      'button, a, input[type="radio"], input[type="checkbox"], select, [role="button"], [role="tab"], .touch-feedback, .interactive-pill'
    );

    if (interactive) {
      // Explicit per-element weight always wins (e.g. data-haptic="medium" on CTAs)
      const customType = interactive.getAttribute('data-haptic');
      if (customType) {
        triggerHaptic(customType);
        return;
      }
      // Destructive actions get a heavier tick
      if (interactive.classList.contains('bg-rose-600') || interactive.getAttribute('data-danger')) {
        triggerHaptic('heavy');
        return;
      }
      // Primary submit-style buttons get a firmer tick than plain taps
      if (
        interactive.tagName === 'BUTTON' &&
        (interactive.type === 'submit' ||
          interactive.classList.contains('py-2.5') ||
          interactive.classList.contains('py-3') ||
          interactive.classList.contains('bg-zinc-900'))
      ) {
        triggerHaptic('medium');
        return;
      }
      // Toggles / picks get a tick instead of a thud
      if (
        interactive.matches('input[type="radio"], input[type="checkbox"], select, [role="tab"]')
      ) {
        triggerHaptic('selection');
        return;
      }
      triggerHaptic('light');
    }
  };

  // Attach pointerdown for immediate hardware response
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  globalHapticsCleanup = () => {
    window.removeEventListener('pointerdown', handlePointerDown);
    globalHapticsCleanup = null;
  };
  return globalHapticsCleanup;
};

export const destroyGlobalHaptics = () => {
  if (globalHapticsCleanup) globalHapticsCleanup();
};

export default haptics;
