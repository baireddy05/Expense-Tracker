/**
 * Web Haptic Feedback Engine for ExTrack
 * Provides tactile vibration feedback for mobile browsers & touch devices.
 */

const STORAGE_KEY = 'extrack_haptics_enabled';

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

/**
 * Triggers a vibration pattern if supported and enabled.
 * Safe to call on all platforms (fails silently on desktop or unsupported devices).
 */
export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined' || !navigator || !navigator.vibrate) return;
  if (!isHapticsEnabled()) return;

  try {
    switch (type) {
      case 'selection':
      case 'tick':
        navigator.vibrate(6);
        break;
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(22);
        break;
      case 'heavy':
        navigator.vibrate(38);
        break;
      case 'success':
        navigator.vibrate([12, 40, 20]);
        break;
      case 'warning':
        navigator.vibrate([25, 40, 25]);
        break;
      case 'error':
        navigator.vibrate([40, 50, 40, 50]);
        break;
      default:
        if (typeof type === 'number' || Array.isArray(type)) {
          navigator.vibrate(type);
        } else {
          navigator.vibrate(12);
        }
    }
  } catch {
    // Vibration API blocked or unsupported in current context
  }
};

export const haptics = {
  selection: () => triggerHaptic('selection'),
  tick: () => triggerHaptic('tick'),
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
 * Automatically gives subtle haptic feedback to buttons, interactive pills, and links on touch.
 */
export const initGlobalHaptics = () => {
  if (typeof window === 'undefined' || !window.addEventListener) return;

  let lastHapticTime = 0;

  const handlePointerDown = (e) => {
    // Debounce micro-vibrations to avoid vibration overlapping
    const now = Date.now();
    if (now - lastHapticTime < 45) return;

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
        triggerHaptic('medium');
      } else {
        triggerHaptic('selection');
      }
    }
  };

  // Attach pointerdown / touchstart for zero-latency response
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
};

export default haptics;
