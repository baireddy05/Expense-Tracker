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
