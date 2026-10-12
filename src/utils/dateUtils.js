/**
 * Date utilities to ensure consistent local timezone date formatting
 * and avoid UTC day-shift bugs (especially around midnight in timezones like IST).
 */

export const getLocalDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== 'string') return new Date(NaN);
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(NaN);
  }
  return new Date(year, (month || 1) - 1, day || 1);
};

/**
 * Normalize any stored date value (YYYY-MM-DD string, ISO timestamp, or
 * Firestore-like { seconds } object) into a local-midnight Date, or null if
 * unparseable. Always use this (never `new Date(str)`) for date-only strings:
 * the native parser treats 'YYYY-MM-DD' as UTC, which shifts the day in
 * UTC-negative and positive-offset timezones alike.
 */
export const toLocalDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return parseLocalDate(str);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

export const formatDisplayDate = (dateStr, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!dateStr) return '';
  try {
    // toLocalDate handles YYYY-MM-DD strings, Date objects and Firestore
    // { seconds } timestamps; parseLocalDate alone would throw on objects.
    const d = toLocalDate(dateStr);
    if (!d) return typeof dateStr === 'string' ? dateStr : '';
    return d.toLocaleDateString('en-GB', options);
  } catch {
    return typeof dateStr === 'string' ? dateStr : '';
  }
};

/**
 * Advance a YYYY-MM-DD date by one frequency period WITHOUT day drift.
 * Raw setMonth(+1) turns Jan 31 into "Feb 31" which silently rolls to Mar 3
 * and keeps drifting every cycle. Instead, clamp to the target month's last
 * real day (Jan 31 -> Feb 28/29 -> Mar 31 ...), the standard billing-cycle
 * behavior for subscriptions.
 */
export const calculateNextDueDate = (currentDueDateStr, frequency = 'monthly') => {
  const d = parseLocalDate(currentDueDateStr);
  if (isNaN(d.getTime())) return typeof currentDueDateStr === 'string' ? currentDueDateStr : '';
  const dayOfMonth = d.getDate();
  const daysInTargetMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    const y = d.getFullYear();
    const m = d.getMonth();
    d.setDate(1);
    d.setMonth(m + 1);
    d.setDate(Math.min(dayOfMonth, daysInTargetMonth(y, m + 1)));
  } else if (frequency === 'yearly') {
    const targetYear = d.getFullYear() + 1;
    // Clamp Feb 29 -> Feb 28 on non-leap years.
    d.setFullYear(targetYear, d.getMonth(), Math.min(dayOfMonth, daysInTargetMonth(targetYear, d.getMonth())));
  }

  return getLocalDateString(d);
};
