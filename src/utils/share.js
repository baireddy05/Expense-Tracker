import toast from 'react-hot-toast';

/**
 * Shared helpers for the lent/borrowed reminder composers.
 * Phone handling follows one rule everywhere: strip non-digits (and any
 * trunk leading zeros), then add India's 91 country code for bare 10-digit
 * mobile numbers so wa.me links are always valid.
 */

export const normalizePhoneForWhatsApp = (phone) => {
  let clean = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (clean && !clean.startsWith('91') && clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
};

export const buildWhatsAppUrl = (phone, message) => {
  const clean = normalizePhoneForWhatsApp(phone);
  return clean
    ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
};

/**
 * Mobile-friendly WhatsApp navigation.
 * On mobile devices, window.location.href or direct navigation reliably opens
 * the WhatsApp app without getting blocked by mobile popup blockers or opening
 * blank dead tabs. On desktop, opens a new tab.
 */
export const openWhatsApp = (phone, message) => {
  const url = buildWhatsAppUrl(phone, message);
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Native web share helper if available on device (especially mobile phones),
 * falling back to WhatsApp if native share fails or is unavailable.
 */
export const shareOrWhatsApp = async (title, text, phone) => {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // user cancelled sheet
    }
  }
  openWhatsApp(phone, text);
  return true;
};

/**
 * Clipboard copy with fallback for insecure contexts / denied permissions.
 * Resolves true on success, false on failure (and toasts accordingly).
 */
export const copyTextToClipboard = async (text, successMessage = 'Message copied to clipboard') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    // Fallback for non-secure contexts where the async API is unavailable.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        toast.success(successMessage);
        return true;
      }
    } catch { /* fall through */ }
    toast.error('Copy failed — long-press to copy the text manually');
    return false;
  }
};
